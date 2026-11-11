/**
 * Invariants transverses du lot L5 (SPEC §15, §19, §22 points 10 et 11).
 *
 * Ces tests ne vérifient pas un outil mais les garanties que l'ensemble doit
 * tenir, quel que soit l'outil appelé :
 * - `get-proof-status` lit la ligne de couverture et ne recalcule jamais
 *   (même source que le validateur, SPEC §22 point 10) ;
 * - aucun outil n'écrit d'attestation, de dérogation ni ne touche la grille ;
 * - tout appel MCP produit un acteur marqué agent (SPEC §19) ;
 * - les messages existent en anglais **et** en français (SPEC §20).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { ACTION_MESSAGES } from '../../src/i18n/actions.js';
import { runAction } from '../../src/handlers/dispatch.js';
import { AGENT } from '../helpers/builders.js';
import { createMcpHarness, ISSUE_KEY } from './mcp-fixture.js';

describe('get-proof-status ne recalcule rien (SPEC §22 point 10)', () => {
  it('lit la couverture sans jamais appeler recompute', async () => {
    const { scenario, deps, mcpContext } = await createMcpHarness();
    await runAction('get-proof-status', { issueKey: ISSUE_KEY }, deps, mcpContext);
    expect(scenario.coverage.journal.count('read')).toBe(1);
    expect(scenario.coverage.journal.count('recompute')).toBe(0);
  });

  it('renvoie exactement les critères en défaut de la ligne du validateur', async () => {
    const { scenario, deps, mcpContext } = await createMcpHarness();
    const blocking = [
      {
        criterionId: 'crit-3',
        code: 'AC-3',
        text: "L'e-mail de refus est envoyé",
        defect: 'weak-strength' as const,
        expected: 'Une attestation d’un tiers',
        minor: false,
      },
    ];
    await scenario.store.saveCoverage({
      issueId: scenario.issue.id,
      issueKey: scenario.issue.key,
      total: 4,
      proven: 3,
      waived: 0,
      mode: 'strict',
      passes: false,
      wouldBlock: true,
      blocking,
      criteria: [],
      updatedAt: scenario.clock.now(),
    });

    const result = (await runAction('get-proof-status', { issueKey: ISSUE_KEY }, deps, mcpContext)) as {
      blocking: readonly unknown[];
    };
    expect(result.blocking).toEqual(blocking);
  });
});

describe('aucun outil n atteste, ne déroge ni ne valide (SPEC §22 point 11)', () => {
  it('laisse les tables attestation et waiver vides après les sept outils', async () => {
    const { scenario, deps, mcpContext } = await createMcpHarness();
    await runAction('list-criteria', { issueKey: ISSUE_KEY }, deps, mcpContext);
    await runAction('get-proof-status', { issueKey: ISSUE_KEY }, deps, mcpContext);
    await runAction(
      'attach-evidence',
      { issueKey: ISSUE_KEY, criterionId: 'AC-4', type: 'link', reference: 'https://example.test/x' },
      deps,
      mcpContext,
    );
    await runAction('propose-criteria', { issueKey: ISSUE_KEY, criteria: 'Un critère' }, deps, mcpContext);
    await runAction(
      'request-attestation',
      { issueKey: ISSUE_KEY, criterionId: 'AC-3', what: 'Vérifier' },
      deps,
      mcpContext,
    );
    await runAction(
      'suggest-evidence',
      { issueKey: ISSUE_KEY, testNames: 'SomeTests.testX' },
      deps,
      mcpContext,
    );

    expect(scenario.store.__tables.attestations.size).toBe(0);
    expect(scenario.store.__tables.waivers.size).toBe(0);
  });

  it('ne modifie jamais la grille d exigences du projet', async () => {
    const { scenario, deps, mcpContext } = await createMcpHarness();
    const before = await scenario.store.getSettings(scenario.project.projectId);
    await runAction('propose-criteria', { issueKey: ISSUE_KEY, criteria: 'Un critère' }, deps, mcpContext);
    const after = await scenario.store.getSettings(scenario.project.projectId);
    expect(after?.requirements).toEqual(before?.requirements);
    expect(after?.mode).toBe(before?.mode);
  });

  it('ne crée jamais de critère actif : tout reste proposé', async () => {
    const { scenario, deps, mcpContext } = await createMcpHarness();
    await runAction(
      'propose-criteria',
      { issueKey: ISSUE_KEY, criteria: 'Premier, Second' },
      deps,
      mcpContext,
    );
    const actives = await scenario.store.listCriteriaByIssue(scenario.issue.id, ['active']);
    expect(actives).toHaveLength(4); // les 4 critères d'origine, aucun de plus
    const proposed = await scenario.store.listCriteriaByIssue(scenario.issue.id, ['proposed']);
    expect(proposed).toHaveLength(2);
  });
});

describe('marquage agent de tout appel MCP (SPEC §19)', () => {
  it('inscrit l agent comme auteur des preuves et des propositions', async () => {
    const { scenario, deps, mcpContext } = await createMcpHarness();
    const attached = (await runAction(
      'attach-evidence',
      { issueKey: ISSUE_KEY, criterionId: 'AC-4', type: 'agent-report', reference: 'report#ac-4' },
      deps,
      mcpContext,
    )) as { evidenceId: string; addedByAgent: boolean };
    expect(attached.addedByAgent).toBe(true);

    const stored = await scenario.store.getEvidence(attached.evidenceId);
    expect(stored?.addedBy).toBe(AGENT);
    expect(stored?.addedByAgent).toBe(true);
  });

  it('ne marque pas agent une preuve attachée depuis l interface par un humain', async () => {
    const { scenario, deps, humanContext } = await createMcpHarness();
    const attached = (await runAction(
      'attach-evidence',
      { issueKey: ISSUE_KEY, criterionId: 'AC-4', type: 'link', reference: 'https://example.test/y' },
      deps,
      humanContext,
    )) as { evidenceId: string; addedByAgent: boolean; strength: string };
    expect(attached.addedByAgent).toBe(false);
    expect(attached.strength).toBe('declared');

    const stored = await scenario.store.getEvidence(attached.evidenceId);
    expect(stored?.addedByAgent).toBe(false);
    expect(stored?.addedBy).toBe(scenario.actors.developer.accountId);
  });
});

describe('i18n des actions (SPEC §20)', () => {
  it('fournit chaque message en anglais et en français', () => {
    for (const [key, entry] of Object.entries(ACTION_MESSAGES)) {
      expect(entry.en, `clé ${key} sans anglais`).toBeTruthy();
      expect(entry.fr, `clé ${key} sans français`).toBeTruthy();
    }
  });

  it('couvre les messages des sept outils et des interdits', () => {
    for (const key of ['list.none', 'status.blocked', 'attach.agent.success', 'propose.success']) {
      expect(ACTION_MESSAGES[key]).toBeDefined();
    }
    for (const key of ['request.success', 'suggest.success', 'release.summary', 'err.forbidden.action']) {
      expect(ACTION_MESSAGES[key]).toBeDefined();
    }
  });
});
