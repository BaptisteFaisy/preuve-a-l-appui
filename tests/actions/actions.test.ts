/**
 * Tests des sept outils MCP individuels (SPEC §15).
 *
 * Vérifie :
 * 1. list-criteria : cas nominal (PAY-123) et ticket sans critère
 * 2. get-proof-status : cohérence parfaite avec le validateur (même source coverage.read)
 * 3. attach-evidence : marquage agent: true et force declared si MCP, interdiction attestation
 * 4. propose-criteria : statut proposed uniquement, validation humaine requise
 * 5. request-attestation : ciblage du rôle compétent, exclusion de l'assigné
 * 6. suggest-evidence : paires suggérées via llm, ne compte pas comme preuve
 * 7. get-release-proof : critères livrés non prouvés, dérogations avec motifs
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import type {
  AttachEvidenceResult,
  GetProofStatusResult,
  ReleaseProofResult,
  ListCriteriaResult,
  ProposeCriteriaResult,
  RequestAttestationResult,
  SuggestEvidenceResult,
} from '../../src/actions/types.js';
import { runAction } from '../../src/handlers/dispatch.js';
import { anIssue, aDossier, DEVELOPER } from '../helpers/builders.js';
import { createMcpHarness, ISSUE_KEY, PROJECT_ID } from './mcp-fixture.js';

describe('1. list-criteria', () => {
  it('liste les 4 critères de PAY-123 avec leur code et force exigée', async () => {
    const { deps, mcpContext } = await createMcpHarness();
    const result = (await runAction('list-criteria', { issueKey: ISSUE_KEY }, deps, mcpContext)) as ListCriteriaResult;
    expect(result.issueKey).toBe(ISSUE_KEY);
    expect(result.total).toBe(4);
    expect(result.criteria.map((c) => c.code)).toEqual(['AC-1', 'AC-2', 'AC-3', 'AC-4']);
    expect(result.text).toContain('AC-1');
  });

  it('gère proprement un ticket sans critère', async () => {
    const { scenario, deps, mcpContext } = await createMcpHarness();
    const emptyIssue = anIssue({ id: 'empty-1', key: 'PAY-999', projectId: PROJECT_ID });
    scenario.jira.addIssue(emptyIssue);
    scenario.store.linkIssue('PAY-999', PROJECT_ID);

    const result = (await runAction('list-criteria', { issueKey: 'PAY-999' }, deps, mcpContext)) as ListCriteriaResult;
    expect(result.total).toBe(0);
    expect(result.criteria).toEqual([]);
    expect(result.text).toContain('No criteria defined');
  });

  it('rejette si le ticket n existe pas', async () => {
    const { deps, mcpContext } = await createMcpHarness();
    await expect(runAction('list-criteria', { issueKey: 'PAY-UNKNOWN' }, deps, mcpContext)).rejects.toThrow(
      /Issue not found/,
    );
  });
});

describe('2. get-proof-status', () => {
  it('renvoie exactement la couverture lue sans recalculer (SPEC §22 point 10)', async () => {
    const { scenario, deps, mcpContext } = await createMcpHarness();
    const mockCoverage = {
      issueId: scenario.issue.id,
      issueKey: scenario.issue.key,
      total: 4,
      proven: 2,
      waived: 0,
      mode: 'strict' as const,
      passes: false,
      wouldBlock: true,
      blocking: [
        {
          criterionId: 'crit-3',
          code: 'AC-3',
          text: "L'e-mail de refus est envoyé",
          defect: 'weak-strength' as const,
          expected: 'Une attestation d’un tiers',
          minor: false,
        },
        {
          criterionId: 'crit-4',
          code: 'AC-4',
          text: 'La limite est réglable par l’administrateur',
          defect: 'no-evidence' as const,
          expected: 'Un test vert sur le commit de la branche',
          minor: false,
        },
      ],
      criteria: [],
      updatedAt: '2026-11-11T08:00:00.000Z',
    };
    await scenario.store.saveCoverage(mockCoverage);

    const result = (await runAction('get-proof-status', { issueKey: ISSUE_KEY }, deps, mcpContext)) as GetProofStatusResult;
    expect(result.total).toBe(4);
    expect(result.proven).toBe(2);
    expect(result.passes).toBe(false);
    expect(result.blocking).toHaveLength(2);
    expect(result.blocking[0]?.code).toBe('AC-3');
    expect(result.blocking[1]?.code).toBe('AC-4');
    expect(result.text).toContain('AC-3');
    expect(result.text).toContain('AC-4');
  });
});

describe('3. attach-evidence', () => {
  it('marque addedByAgent: true et calcule la force declared pour un appel MCP (SPEC §19)', async () => {
    const { scenario, deps, mcpContext } = await createMcpHarness();
    const result = (await runAction(
      'attach-evidence',
      {
        issueKey: ISSUE_KEY,
        criterionId: 'AC-4',
        type: 'test',
        reference: 'LimitAdminTests.testLimitConfigurable',
        note: 'Ajouté par un agent',
      },
      deps,
      mcpContext,
    )) as AttachEvidenceResult;

    expect(result.addedByAgent).toBe(true);
    expect(result.strength).toBe('declared');
    expect(result.criterionCode).toBe('AC-4');

    const stored = await scenario.store.getEvidence(result.evidenceId);
    expect(stored?.addedByAgent).toBe(true);
    expect(stored?.strength).toBe('declared');
  });

  it('refuse formellement d attacher une attestation via MCP (SPEC §22 point 11)', async () => {
    const { deps, mcpContext } = await createMcpHarness();
    await expect(
      runAction(
        'attach-evidence',
        {
          issueKey: ISSUE_KEY,
          criterionId: 'AC-3',
          type: 'attestation',
          reference: 'attestation-directe',
        },
        deps,
        mcpContext,
      ),
    ).rejects.toThrow(/SPEC §15, §22 point 11/);
  });

  it('rejette un type de preuve invalide', async () => {
    const { deps, mcpContext } = await createMcpHarness();
    await expect(
      runAction(
        'attach-evidence',
        {
          issueKey: ISSUE_KEY,
          criterionId: 'AC-1',
          type: 'magic-proof',
          reference: 'ref',
        },
        deps,
        mcpContext,
      ),
    ).rejects.toThrow(/Invalid evidence type/);
  });
});

describe('4. propose-criteria', () => {
  it('crée des critères en attente au statut proposed sans valider directement', async () => {
    const { scenario, deps, mcpContext } = await createMcpHarness();
    const result = (await runAction(
      'propose-criteria',
      {
        issueKey: ISSUE_KEY,
        criteria: 'Le reçu PDF est téléchargeable, La TVA à 20% est affichée',
      },
      deps,
      mcpContext,
    )) as ProposeCriteriaResult;

    expect(result.proposedCount).toBe(2);
    expect(result.criteria[0]?.status).toBe('proposed');
    expect(result.criteria[1]?.status).toBe('proposed');
    expect(result.criteria[0]?.code).toBe('AC-5');
    expect(result.criteria[1]?.code).toBe('AC-6');

    // Vérification en base : les statuts sont bien 'proposed'
    const first = result.criteria[0];
    const crit5 = await scenario.store.getCriterion(first?.id ?? '');
    expect(crit5?.status).toBe('proposed');
  });

  it('rejette une proposition avec entrée criteria vide', async () => {
    const { deps, mcpContext } = await createMcpHarness();
    await expect(
      runAction('propose-criteria', { issueKey: ISSUE_KEY, criteria: '   ,  ' }, deps, mcpContext),
    ).rejects.toThrow(/No criteria provided/);
  });
});

describe('5. request-attestation', () => {
  it('adresse la demande au rôle compétent et exclut l assigné du ticket (SPEC §9.4)', async () => {
    const { scenario, deps, mcpContext } = await createMcpHarness();
    // PAY-123 : assigné = DEVELOPER, reporter = OWNER (rôle Product Owner)
    // Ajoutons un testeur avec rôle Developers qui est éligible pour AC-3
    scenario.jira.setRoles(scenario.actors.owner.accountId, ['Product Owner', 'Developers']);

    const result = (await runAction(
      'request-attestation',
      {
        issueKey: ISSUE_KEY,
        criterionId: 'AC-3',
        what: 'Vérifier la réception effective de l e-mail de refus de carte',
      },
      deps,
      mcpContext,
    )) as RequestAttestationResult;

    expect(result.criterionCode).toBe('AC-3');
    expect(result.role).toBe('Administrators'); // premier rôle attest par défaut
    expect(result.notified).toBe(true);

    // Vérifie que les notifications n'ont JAMAIS été envoyées à l'assigné (DEVELOPER)
    const notifs = scenario.jira.notifications;
    expect(notifs.some((n) => n.accountId === DEVELOPER)).toBe(false);
  });

  it('n enregistre aucune attestation en base (l outil ne fait que demander)', async () => {
    const { scenario, deps, mcpContext } = await createMcpHarness();
    await runAction(
      'request-attestation',
      {
        issueKey: ISSUE_KEY,
        criterionId: 'AC-3',
        what: 'Vérifier l e-mail',
      },
      deps,
      mcpContext,
    );
    const attestations = await scenario.store.listAttestations('crit-3');
    expect(attestations).toHaveLength(0);
  });
});

describe('6. suggest-evidence', () => {
  it('suggère des paires avec confiance et justification via le modèle (SPEC §11)', async () => {
    const { scenario, deps, mcpContext } = await createMcpHarness();
    scenario.llm.suggestPairs = async () => [
      {
        criterionId: 'crit-1',
        testName: 'checkout refuses an expired card',
        confidence: 0.95,
        rationale: 'Le test vérifie explicitement le refus par carte expirée.',
      },
    ];

    const result = (await runAction(
      'suggest-evidence',
      {
        issueKey: ISSUE_KEY,
        testNames: 'checkout refuses an expired card, otherTest',
      },
      deps,
      mcpContext,
    )) as SuggestEvidenceResult;

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.testName).toBe('checkout refuses an expired card');
    expect(result.suggestions[0]?.confidence).toBe(0.95);
    expect(result.text).toContain('95%');

    // Une suggestion ne crée pas de preuve en base
    const links = await scenario.store.listLinksByCriterion('crit-1');
    expect(links).toHaveLength(0);
  });
});

describe('7. get-release-proof', () => {
  it('renvoie la couverture de la version, les dérogations et critères livrés non prouvés', async () => {
    const { scenario, deps, mcpContext } = await createMcpHarness();
    const dossier = aDossier({
      versionId: 'ver-2.4',
      versionName: '2.4',
      projectKey: 'PAY',
      totals: {
        issues: 1,
        criteria: 2,
        proven: 1,
        machineVerified: 1,
        attested: 0,
        declared: 0,
        waived: 0,
      },
      issues: [
        {
          issueKey: 'PAY-100',
          summary: 'Ancien ticket',
          total: 2,
          proven: 1,
          waived: 0,
          waivers: [],
          criteria: [
            {
              criterionId: 'c1',
              code: 'AC-1',
              text: 'Critère prouvé',
              type: 'functional',
              version: 1,
              requiredStrength: 'machine-verified',
              bestEvidenceId: 'e1',
              bestStrength: 'machine-verified',
              proven: true,
              waived: false,
              minor: false,
              defect: null,
              expected: 'test',
              evidences: [],
              waiverId: '',
            },
            {
              criterionId: 'c2',
              code: 'AC-2',
              text: 'Critère qui a régressé',
              type: 'regression',
              version: 1,
              requiredStrength: 'machine-verified',
              bestEvidenceId: '',
              bestStrength: null,
              proven: false,
              waived: false,
              minor: false,
              defect: 'no-evidence',
              expected: 'test',
              evidences: [],
              waiverId: '',
            },
          ],
        },
      ],
    });
    await scenario.store.saveDossier(dossier);

    const result = (await runAction('get-release-proof', { versionId: 'ver-2.4' }, deps, mcpContext)) as ReleaseProofResult;
    expect(result.versionName).toBe('2.4');
    expect(result.issuesCount).toBe(1);
    expect(result.unprovenDeliveredCount).toBe(1);
    expect(result.unprovenDelivered[0]?.criterionCode).toBe('AC-2');
    expect(result.text).toContain('AC-2 : Critère qui a régressé');
  });

  it('lève une erreur si la version est introuvable', async () => {
    const { deps, mcpContext } = await createMcpHarness();
    await expect(runAction('get-release-proof', { versionId: 'ver-999' }, deps, mcpContext)).rejects.toThrow(
      /Version not found/,
    );
  });
});
