/**
 * L'amorçage rejoue le **scénario du ticket** (lot `bootstrap-scenario`).
 *
 * Avant, tous les tickets de démonstration recevaient les quatre critères du
 * sample et les mêmes trois preuves. Maintenant chaque ticket reçoit SES
 * critères, SES preuves, SES gestes humains, et peut revisionner un critère.
 *
 * Le harnais d'acceptation est réutilisé tel quel : vrais modules, doubles en
 * mémoire, horloge figée.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  BOOTSTRAP_TOKEN_VAR,
  handleBootstrap,
  type BootstrapOutcome,
} from '../../src/handlers/bootstrap.js';
import { bootstrapDemoData } from '../../src/sample/bootstrap.js';
import { parseScenario } from '../../src/sample/scenario.js';
import { createAcceptanceHarness, PROJECT_ID } from '../acceptance/harness.js';
import type { AcceptanceHarness } from '../acceptance/harness.js';
import { anIssue } from '../helpers/builders.js';

const TOKEN = 'jeton-d-amorcage-de-test';
const FRESH_ISSUE = { id: '20002', key: 'PAY-901' };
/** Les quatre comptes : l'agent, l'assignée, la testeuse, le product owner. */
const CAST = {
  developer: 'user-dev',
  tester: 'user-tester',
  owner: 'user-po',
  agent: 'agent-coder',
};

afterEach(() => {
  delete process.env[BOOTSTRAP_TOKEN_VAR];
});

/** Un corps d'amorçage : action, ticket, clé de CI, distribution, scénario. */
function body(scenario?: unknown, flow?: unknown): string {
  return JSON.stringify({
    action: 'bootstrap',
    issueKey: FRESH_ISSUE.key,
    ciKey: 'cle-ci-reelle',
    cast: CAST,
    ...(scenario === undefined ? {} : { scenario }),
    ...(flow === undefined ? {} : { flow }),
  });
}

/** Le harnais avec un ticket vierge, prêt à être amorcé. */
async function harnessWithFreshIssue(): Promise<AcceptanceHarness> {
  const h = await createAcceptanceHarness();
  h.scenario.jira.addIssue(
    anIssue({ id: FRESH_ISSUE.id, key: FRESH_ISSUE.key, projectId: PROJECT_ID }),
  );
  return h;
}

/** Amorce le ticket vierge avec le scénario donné et rend le résultat. */
async function bootstrap(
  scenario: unknown,
  flow?: unknown,
): Promise<{ h: AcceptanceHarness; outcome: BootstrapOutcome }> {
  process.env[BOOTSTRAP_TOKEN_VAR] = TOKEN;
  const h = await harnessWithFreshIssue();
  const outcome = await handleBootstrap(
    { method: 'POST', headers: { 'x-bootstrap-token': TOKEN }, body: body(scenario, flow) },
    h.deps,
  );
  return { h, outcome };
}

/** Le premier critère du ticket amorcé. */
async function firstCriterion(h: AcceptanceHarness) {
  const criteria = await h.deps.store.listCriteriaByIssue(FRESH_ISSUE.id);
  return criteria[0];
}

describe('amorçage — les critères propres au ticket', () => {
  it('écrit les codes, les textes et les types du scénario', async () => {
    const { h, outcome } = await bootstrap({
      criteria: [
        {
          code: 'AC-1',
          text: 'Le devis est signé par le client',
          type: 'functional',
          requiredStrength: 'machine-verified',
        },
        {
          code: 'AC-2',
          text: 'La facture est archivée dix ans',
          type: 'data',
          requiredStrength: 'attested',
        },
      ],
      evidences: [],
    });
    expect(outcome).toEqual({ statusCode: 200, outputKey: 'ok' });
    const criteria = await h.deps.store.listCriteriaByIssue(FRESH_ISSUE.id);
    expect(criteria.map((criterion) => criterion.code)).toEqual(['AC-1', 'AC-2']);
    expect(criteria[0]?.text).toBe('Le devis est signé par le client');
    expect(criteria[0]?.type).toBe('functional');
    expect(criteria[0]?.requiredStrength).toBe('machine-verified');
    expect(criteria[1]?.type).toBe('data');
    expect(criteria[1]?.requiredStrength).toBe('attested');
  });

  it('ne compte dans la couverture que les critères actifs', async () => {
    const { h } = await bootstrap({
      criteria: [
        { code: 'AC-1', text: 'Le devis est signé', type: 'functional', requiredStrength: 'attested' },
        { code: 'AC-2', text: 'Le devis est notifié', type: 'functional', requiredStrength: 'attested' },
        {
          code: 'AC-3',
          text: 'Le devis est archivé',
          type: 'functional',
          requiredStrength: 'attested',
          status: 'proposed',
        },
      ],
      evidences: [],
    });
    const criteria = await h.deps.store.listCriteriaByIssue(FRESH_ISSUE.id);
    expect(criteria.map((criterion) => criterion.status)).toEqual([
      'active',
      'active',
      'proposed',
    ]);
    const coverage = await h.deps.store.getCoverage(FRESH_ISSUE.id);
    expect(coverage?.total).toBe(2);
  });

  it('écrit un critère proposé sans le compter dans la couverture', async () => {
    const { h } = await bootstrap({
      criteria: [
        {
          code: 'AC-1',
          text: 'Le devis est archivé',
          type: 'functional',
          requiredStrength: 'attested',
          status: 'proposed',
        },
      ],
      evidences: [],
    });
    const criterion = await firstCriterion(h);
    expect(criterion?.status).toBe('proposed');
    const coverage = await h.deps.store.getCoverage(FRESH_ISSUE.id);
    expect(coverage?.total).toBe(0);
  });
});

describe('amorçage — les preuves du scénario', () => {
  it('écrit une preuve de documentation et une preuve de pièce jointe', async () => {
    const { h } = await bootstrap({
      criteria: [
        {
          code: 'AC-1',
          text: 'Le devis est signé',
          type: 'functional',
          requiredStrength: 'machine-verified',
        },
      ],
      evidences: [
        {
          criterion: 'AC-1',
          type: 'documentation',
          reference: 'https://confluence.example.com/pages/devis',
          note: 'Procédure de signature publiée',
          addedBy: 'developer',
        },
        {
          criterion: 'AC-1',
          type: 'attachment',
          reference: 'capture-devis.png',
          note: 'Capture de la revue',
          addedBy: 'agent',
        },
      ],
    });
    const evidences = await h.deps.store.listEvidencesByIssue(FRESH_ISSUE.id);
    expect(evidences.map((evidence) => [evidence.type, evidence.reference])).toEqual([
      ['documentation', 'https://confluence.example.com/pages/devis'],
      ['attachment', 'capture-devis.png'],
    ]);
    expect(evidences[0]?.note).toBe('Procédure de signature publiée');
    expect(evidences[0]?.addedBy).toBe('user-dev');
    expect(evidences[0]?.addedByAgent).toBe(false);
    expect(evidences[1]?.addedByAgent).toBe(true);
  });

  it('laisse les preuves déclarées : c’est la CI signée qui les fera monter', async () => {
    const { h } = await bootstrap({
      criteria: [
        { code: 'AC-1', text: 'Le devis est signé', type: 'functional', requiredStrength: 'machine-verified' },
      ],
      evidences: [{ criterion: 'AC-1', type: 'test', reference: 'devis signe' }],
    });
    const evidences = await h.deps.store.listEvidencesByIssue(FRESH_ISSUE.id);
    expect(evidences[0]?.strength).toBe('declared');
    expect(evidences[0]?.verified).toBe(false);
    expect(evidences[0]?.commit).toBe('');
  });

  it('n’écrit aucune preuve quand le scénario n’en donne pas', async () => {
    const { h } = await bootstrap({
      criteria: [
        { code: 'AC-1', text: 'Le devis est signé', type: 'functional', requiredStrength: 'attested' },
        { code: 'AC-2', text: 'Le devis est notifié', type: 'functional', requiredStrength: 'attested' },
      ],
      evidences: [],
    });
    const evidences = await h.deps.store.listEvidencesByIssue(FRESH_ISSUE.id);
    expect(evidences).toHaveLength(0);
  });
});

describe('amorçage — les gestes humains du scénario', () => {
  it('écrit l’attestation et la couverture passe à « attesté »', async () => {
    const { h } = await bootstrap({
      criteria: [
        { code: 'AC-1', text: 'Le devis est signé', type: 'functional', requiredStrength: 'attested' },
      ],
      evidences: [],
      attest: [{ code: 'AC-1', accountId: 'user-tester', note: 'Vérifié à la main' }],
    });
    const criterion = await firstCriterion(h);
    const attestations = await h.deps.store.listAttestations(criterion?.id ?? '');
    expect(attestations).toHaveLength(1);
    expect(attestations[0]?.attesterAccountId).toBe('user-tester');
    expect(attestations[0]?.note).toBe('Vérifié à la main');
    const coverage = await h.deps.store.getCoverage(FRESH_ISSUE.id);
    expect(coverage?.proven).toBe(1);
    expect(coverage?.criteria[0]?.bestStrength).toBe('attested');
  });

  it('écrit la dérogation et le critère est dérogé', async () => {
    const { h } = await bootstrap({
      criteria: [
        { code: 'AC-1', text: 'Le devis est signé', type: 'functional', requiredStrength: 'machine-verified' },
        { code: 'AC-2', text: 'La facture est archivée', type: 'functional', requiredStrength: 'machine-verified' },
      ],
      evidences: [],
      waive: [
        {
          code: 'AC-2',
          accountId: 'user-po',
          role: 'Product Owner',
          reason: 'Reporté à la version 2.5',
        },
      ],
    });
    const waivers = await h.deps.store.listWaiversByIssue(FRESH_ISSUE.id);
    expect(waivers).toHaveLength(1);
    expect(waivers[0]?.reason).toBe('Reporté à la version 2.5');
    expect(waivers[0]?.grantedBy).toBe('user-po');
    const coverage = await h.deps.store.getCoverage(FRESH_ISSUE.id);
    expect(coverage?.waived).toBe(1);
    expect(coverage?.criteria[1]?.waived).toBe(true);
  });

  it('rejoue une révision : version 2 et preuve antérieure à revoir', async () => {
    const { h } = await bootstrap({
      criteria: [
        { code: 'AC-1', text: 'Le devis est signé', type: 'functional', requiredStrength: 'machine-verified' },
      ],
      evidences: [{ criterion: 'AC-1', type: 'test', reference: 'devis signe' }],
      revisions: [{ code: 'AC-1', text: 'Le devis est signé et notifié au client' }],
    });
    const criterion = await firstCriterion(h);
    expect(criterion?.version).toBe(2);
    expect(criterion?.text).toBe('Le devis est signé et notifié au client');
    const evidences = await h.deps.store.listEvidencesByCriterion(criterion?.id ?? '');
    expect(evidences[0]?.freshness).toBe('to-reconfirm');
    const history = await h.deps.store.listCriterionRevisions(criterion?.id ?? '');
    expect(history.map((revision) => revision.version)).toEqual([2]);
  });
});

describe('amorçage — les paires test ↔ critère', () => {
  it('utilise les paires du scénario avec le statut qu’il demande', async () => {
    const { h } = await bootstrap({
      criteria: [
        { code: 'AC-1', text: 'Le devis est signé', type: 'functional', requiredStrength: 'machine-verified' },
        { code: 'AC-2', text: 'Le devis est notifié', type: 'functional', requiredStrength: 'machine-verified' },
      ],
      evidences: [],
      links: [
        { code: 'AC-1', testName: 'devis signe', status: 'confirmed' },
        { code: 'AC-2', testName: 'devis notifie', status: 'proposed' },
      ],
    });
    const criteria = await h.deps.store.listCriteriaByIssue(FRESH_ISSUE.id);
    const links = await Promise.all(
      criteria.map((criterion) => h.deps.store.listLinksByCriterion(criterion.id)),
    );
    expect(links[0]?.[0]?.testName).toBe('devis signe');
    expect(links[0]?.[0]?.status).toBe('confirmed');
    expect(links[1]?.[0]?.testName).toBe('devis notifie');
    expect(links[1]?.[0]?.status).toBe('proposed');
  });
});

describe('amorçage — le contrat du scénario', () => {
  it('refuse un scénario mal formé', async () => {
    process.env[BOOTSTRAP_TOKEN_VAR] = TOKEN;
    const h = await harnessWithFreshIssue();
    const outcome = await handleBootstrap(
      {
        method: 'POST',
        headers: { 'x-bootstrap-token': TOKEN },
        body: body({ criteria: [{ code: '', text: 'Le devis est signé' }] }),
      },
      h.deps,
    );
    expect(outcome).toEqual({ statusCode: 400, outputKey: 'invalid-payload' });
    const criteria = await h.deps.store.listCriteriaByIssue(FRESH_ISSUE.id);
    expect(criteria).toHaveLength(0);
  });

  it('n’écrit pas une attestation refusée par le domaine et le dit', async () => {
    const h = await harnessWithFreshIssue();
    const scenario = parseScenario({
      criteria: [
        { code: 'AC-1', text: 'Le devis est signé', type: 'functional', requiredStrength: 'attested' },
      ],
      evidences: [],
      attest: [{ code: 'AC-1', accountId: 'user-dev', note: 'Je l’ai fait moi-même' }],
    });
    const result = await bootstrapDemoData(h.deps, {
      issueKey: FRESH_ISSUE.key,
      ciKey: 'cle-ci-reelle',
      cast: CAST,
      scenario: scenario ?? undefined,
    });
    expect(result?.attestations).toBe(0);
    expect(result?.attestationsRefused).toBe(1);
    const criterion = await firstCriterion(h);
    const attestations = await h.deps.store.listAttestations(criterion?.id ?? '');
    expect(attestations).toHaveLength(0);
  });

  it('garde la priorité au champ flow pour les gestes humains', async () => {
    process.env[BOOTSTRAP_TOKEN_VAR] = TOKEN;
    const h = await harnessWithFreshIssue();
    // Le PO peut attester ici : le projet lui donne le rôle des attestants.
    h.scenario.jira.setRoles('user-po', ['Product Owner', 'Developers']);
    const outcome = await handleBootstrap(
      {
        method: 'POST',
        headers: { 'x-bootstrap-token': TOKEN },
        body: body(
          {
            criteria: [
              {
                code: 'AC-1',
                text: 'Le devis est signé',
                type: 'functional',
                requiredStrength: 'attested',
              },
            ],
            evidences: [],
            attest: [{ code: 'AC-1', accountId: 'user-tester', note: 'Scenario' }],
          },
          { attest: [{ code: 'AC-1', accountId: 'user-po' }] },
        ),
      },
      h.deps,
    );
    expect(outcome.outputKey).toBe('ok');
    const criterion = await firstCriterion(h);
    const attestations = await h.deps.store.listAttestations(criterion?.id ?? '');
    expect(attestations).toHaveLength(1);
    expect(attestations[0]?.attesterAccountId).toBe('user-po');
  });

  it('laisse le jeu du sample quand le ticket n’a pas de scénario', async () => {
    const { h, outcome } = await bootstrap(undefined);
    expect(outcome.outputKey).toBe('ok');
    const criteria = await h.deps.store.listCriteriaByIssue(FRESH_ISSUE.id);
    expect(criteria.map((criterion) => criterion.code)).toEqual([
      'AC-1',
      'AC-2',
      'AC-3',
      'AC-4',
    ]);
    const evidences = await h.deps.store.listEvidencesByIssue(FRESH_ISSUE.id);
    expect(evidences).toHaveLength(3);
  });
});
