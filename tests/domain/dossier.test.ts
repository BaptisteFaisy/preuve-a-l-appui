/**
 * Tests du domaine : dossier de preuve d'une version (SPEC §4, §17, FP-17).
 *
 * Le dossier complet d'une version à deux tickets est vérifié ligne à ligne :
 * exigence, preuve, attestant, date, commit, dérogation — et le rendu Markdown
 * exportable vers Confluence, en anglais comme en français (SPEC §20).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import {
  buildDossierIssue,
  buildVersionDossier,
  computeDossierTotals,
  getOrGenerateDossier,
  renderDossierMarkdown,
  type DossierDeps,
} from '../../src/domain/dossier.js';
import type { Coverage, DossierIssue } from '../../src/types.js';
import {
  anEvidence,
  anIssue,
  aCoverage,
  aCriterionState,
  aWaiver,
  ISSUE_ID,
  ISSUE_KEY,
  NOW,
  TEST_REFUSAL,
} from '../helpers/builders.js';
import { createPay123Scenario, type Pay123Scenario } from '../helpers/scenario.js';

const VERSION = '2.4';

function depsOf(scenario: Pay123Scenario): DossierDeps {
  return {
    store: scenario.store,
    jira: scenario.jira,
    clock: scenario.clock,
    coverage: scenario.coverage,
  };
}

function coverageOf(issueId: string, issueKey: string, proven: boolean): Coverage {
  return aCoverage({
    issueId,
    issueKey,
    total: 2,
    proven: proven ? 1 : 0,
    waived: proven ? 0 : 1,
    criteria: [
      aCriterionState({
        proven,
        waived: !proven,
        bestStrength: proven ? 'machine-verified' : null,
        bestEvidenceId: proven ? 'ev-1' : '',
        evidences: proven
          ? [anEvidence({ id: 'ev-1', reference: TEST_REFUSAL, addedBy: 'user-dev', at: NOW })]
          : [],
      }),
      aCriterionState({
        criterionId: 'crit-9',
        code: 'AC-9',
        proven: false,
        waived: false,
        bestStrength: null,
        bestEvidenceId: '',
        evidences: [],
      }),
    ],
  });
}

/** Pose une version à deux tickets, l'un prouvé, l'autre dérogé. */
async function seedVersion(scenario: Pay123Scenario): Promise<void> {
  const second = anIssue({ id: '10002', key: 'PAY-124', summary: 'Journaliser les refus' });
  scenario.jira.addIssue(second);
  scenario.store.linkIssue(second.id, scenario.project.projectId);
  await scenario.store.saveCoverage(coverageOf(ISSUE_ID, ISSUE_KEY, false));
  await scenario.store.saveCoverage(coverageOf(second.id, second.key, true));
  await scenario.store.saveWaiver(aWaiver({ id: 'wv-9', criterionId: 'crit-1', grantedBy: 'user-po' }));
}

describe('dossier — totaux et assemblage d’un ticket', () => {
  it('compte les sept totaux du dossier', () => {
    const issue: DossierIssue = {
      issueKey: ISSUE_KEY,
      summary: 'Refus',
      total: 2,
      proven: 1,
      waived: 1,
      waivers: [],
      criteria: [
        aCriterionState({ proven: true, bestStrength: 'machine-verified' }),
        aCriterionState({ criterionId: 'c2', proven: true, bestStrength: 'attested' }),
        aCriterionState({ criterionId: 'c3', proven: true, bestStrength: 'declared' }),
        aCriterionState({ criterionId: 'c4', proven: false, bestStrength: null }),
      ],
    };

    const totals = computeDossierTotals([issue]);

    expect(totals).toEqual({
      issues: 1,
      criteria: 2,
      proven: 1,
      machineVerified: 1,
      attested: 1,
      declared: 1,
      waived: 1,
    });
  });

  it('retient les dérogations actives et écarte les dérogations révoquées', () => {
    const issue = buildDossierIssue(
      anIssue(),
      coverageOf(ISSUE_ID, ISSUE_KEY, false),
      [
        aWaiver({ id: 'w1', criterionId: 'crit-1' }),
        aWaiver({ id: 'w2', criterionId: 'crit-1', revokedAt: '2026-11-10T00:00:00.000Z' }),
      ],
    );

    expect(issue.waivers.map((waiver) => waiver.id)).toEqual(['w1']);
    expect(issue.total).toBe(2);
    expect(issue.waived).toBe(1);
  });

  it('rend un ticket sans couverture au lieu de lever (SPEC §20)', () => {
    const issue = buildDossierIssue(anIssue(), null, []);
    expect(issue.total).toBe(0);
    expect(issue.proven).toBe(0);
    expect(issue.criteria).toEqual([]);
  });
});

describe('dossier — version à deux tickets (SPEC §17, FP-17)', () => {
  it('construit le dossier de la version depuis Jira et la couverture lue', async () => {
    const scenario = await createPay123Scenario();
    await seedVersion(scenario);

    const dossier = await buildVersionDossier(depsOf(scenario), {
      projectId: scenario.project.projectId,
      projectKey: 'PAY',
      versionId: VERSION,
      versionName: VERSION,
    });

    expect(dossier.versionId).toBe(VERSION);
    expect(dossier.generatedAt).toBe(NOW);
    expect(dossier.issues.map((issue) => issue.issueKey)).toEqual([ISSUE_KEY, 'PAY-124']);
    expect(dossier.totals.issues).toBe(2);
    expect(dossier.totals.criteria).toBe(4);
    expect(dossier.totals.proven).toBe(1);
    expect(dossier.totals.machineVerified).toBe(1);
    expect(dossier.totals.waived).toBe(1);
  });

  it('lit la couverture par le moteur, jamais recalculée ici (SPEC §22 point 10)', async () => {
    const scenario = await createPay123Scenario();
    await seedVersion(scenario);

    await buildVersionDossier(depsOf(scenario), {
      projectId: scenario.project.projectId,
      projectKey: 'PAY',
      versionId: VERSION,
      versionName: VERSION,
    });

    expect(scenario.coverage.journal.count('read')).toBe(2);
    expect(scenario.coverage.journal.count('recompute')).toBe(0);
  });

  it('mémorise le dossier figé et le relit tel quel', async () => {
    const scenario = await createPay123Scenario();
    await seedVersion(scenario);
    const input = {
      projectId: scenario.project.projectId,
      projectKey: 'PAY',
      versionId: VERSION,
      versionName: VERSION,
    };

    const first = await getOrGenerateDossier(depsOf(scenario), input);
    const second = await getOrGenerateDossier(depsOf(scenario), input);

    expect(second).toEqual(first);
    expect(await scenario.store.getDossier(VERSION)).toEqual(first);
    expect(scenario.jira.journal.count('listIssuesOfVersion')).toBe(1);
  });
});

describe('dossier — rendu Markdown exportable vers Confluence (FP-17)', () => {
  it('porte l’exigence, la preuve, l’attestant, la date, le commit et la dérogation', async () => {
    const scenario = await createPay123Scenario();
    await seedVersion(scenario);
    const dossier = await buildVersionDossier(depsOf(scenario), {
      projectId: scenario.project.projectId,
      projectKey: 'PAY',
      versionId: VERSION,
      versionName: VERSION,
    });

    const markdown = renderDossierMarkdown(dossier, 'en');

    expect(markdown).toContain('# Proof dossier — version 2.4 (PAY)');
    expect(markdown).toContain(`Generated on ${NOW}`);
    expect(markdown).toContain('| Criterion | Required | State | Evidence | Attester | Commit | Date | Waiver |');
    expect(markdown).toContain(TEST_REFUSAL);
    expect(markdown).toContain('user-dev');
    expect(markdown).toContain('e41f0c9a1b2c3d4e5f60');
    expect(markdown).toContain('2026-11-11');
    expect(markdown).toContain('Reporté dans PAY-140 (granted by user-po)');
    expect(markdown).toContain('Issues: 2');
  });

  it('rend le dossier en français quand le projet est francophone (SPEC §20)', async () => {
    const scenario = await createPay123Scenario();
    await seedVersion(scenario);
    const dossier = await buildVersionDossier(depsOf(scenario), {
      projectId: scenario.project.projectId,
      projectKey: 'PAY',
      versionId: VERSION,
      versionName: VERSION,
      language: 'fr',
    });

    const markdown = renderDossierMarkdown(dossier, 'fr');

    expect(markdown).toContain('# Dossier de preuve — version 2.4 (PAY)');
    expect(markdown).toContain('| Critère | Force exigée | État | Preuve | Attestant | Commit | Date | Dérogation |');
    expect(markdown).toContain('Non prouvé');
    expect(markdown).toContain('Tickets : 2');
  });

  it('marque « Agent » une preuve déclarée par un agent (SPEC §9.4)', () => {
    const issue: DossierIssue = {
      issueKey: ISSUE_KEY,
      summary: 'Refus',
      total: 1,
      proven: 0,
      waived: 0,
      waivers: [],
      criteria: [
        aCriterionState({
          proven: false,
          bestStrength: null,
          bestEvidenceId: 'ev-agent',
          evidences: [
            anEvidence({
              id: 'ev-agent',
              type: 'agent-report',
              reference: 'report#ac-1',
              addedByAgent: true,
              strength: 'declared',
              commit: '',
            }),
          ],
        }),
      ],
    };

    const markdown = renderDossierMarkdown(
      {
        versionId: VERSION,
        versionName: VERSION,
        projectKey: 'PAY',
        generatedAt: NOW,
        issues: [issue],
        totals: computeDossierTotals([issue]),
      },
      'fr',
    );

    expect(markdown).toContain('| Agent |');
    expect(markdown).toContain('Non prouvé');
  });
});
