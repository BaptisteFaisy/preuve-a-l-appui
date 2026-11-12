/**
 * Tests du resolver des écrans (SPEC §16, §20, lot L6).
 *
 * Chaque clé doit répondre ; le chemin de lecture lit la couverture stockée
 * SANS recalculer (SPEC §20) ; les gestes humains écrivent puis recalculent la
 * couverture (§12.3) ; la langue est détectée depuis le contexte.
 * Utilise les fakes de tests/helpers (jamais Date.now, horloge injectée).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import type { AppDeps } from '../../src/deps.js';
import { registerResolvers } from '../../src/handlers/resolver.js';
import type { ResolverLike, ResolverRequest } from '../../src/handlers/resolver.js';
import type { Attestation, Evidence, Waiver } from '../../src/types.js';
import type { CoverageFieldViewModel } from '../../src/viewmodel/coverage.js';
import type { MatrixViewModel } from '../../src/viewmodel/matrix.js';
import type { SettingsViewModel } from '../../src/viewmodel/settings.js';
import { aCoverage, aCriterionState, AGENT, DEVELOPER, ISSUE_ID, ISSUE_KEY, OWNER, PROJECT_ID, TESTER } from '../../tests/helpers/builders.js';
import { createPay123Scenario, type Pay123Scenario } from '../../tests/helpers/scenario.js';

class FakeResolver implements ResolverLike {
  private readonly defs = new Map<string, (r: ResolverRequest) => Promise<unknown>>();
  define(key: string, fn: (r: ResolverRequest) => Promise<unknown>): void {
    this.defs.set(key, fn);
  }
  keys(): string[] {
    return [...this.defs.keys()];
  }
  async call(key: string, payload: Record<string, unknown> = {}, context: unknown = {}): Promise<unknown> {
    const fn = this.defs.get(key);
    if (!fn) throw new Error(`clé non définie : ${key}`);
    return fn({ payload, context });
  }
}

interface Harness {
  sc: Pay123Scenario;
  resolver: FakeResolver;
}

async function setup(): Promise<Harness> {
  const sc = await createPay123Scenario();
  const deps: AppDeps = {
    store: sc.store,
    coverage: sc.coverage,
    jira: sc.jira,
    checker: sc.checker,
    llm: sc.llm,
    identity: sc.identity,
    queue: sc.queue,
    clock: sc.clock,
    ids: sc.ids,
    logger: sc.logger,
  };
  const resolver = new FakeResolver();
  registerResolvers(resolver, deps);
  return { sc, resolver };
}

const EXPECTED_KEYS = [
  'get-issue-matrix',
  'list-criterion-history',
  'get-coverage-field',
  'attach-evidence',
  'attest-criterion',
  'waive-criterion',
  'request-attestation',
  'get-project-settings',
  'save-project-settings',
  'get-project-page',
];

describe('registerResolvers', () => {
  it('définit les dix clés des écrans et de leurs gestes', async () => {
    const { resolver } = await setup();
    for (const key of EXPECTED_KEYS) expect(resolver.keys()).toContain(key);
  });
});

describe('get-issue-matrix', () => {
  it('lit la couverture stockée sans recalculer (SPEC §20)', async () => {
    const { sc, resolver } = await setup();
    await sc.store.saveCoverage(aCoverage({ issueId: ISSUE_ID, issueKey: ISSUE_KEY, total: 4, proven: 2 }));
    const vm = (await resolver.call('get-issue-matrix', { issueId: ISSUE_ID })) as MatrixViewModel;
    expect(vm.total).toBe(4);
    expect(sc.coverage.journal.count('recompute')).toBe(0);
  });

  it('résout une clé de ticket en couverture via Jira', async () => {
    const { sc, resolver } = await setup();
    await sc.store.saveCoverage(aCoverage({ issueId: ISSUE_ID, issueKey: ISSUE_KEY, total: 3, proven: 1 }));
    const vm = (await resolver.call('get-issue-matrix', { issueKey: ISSUE_KEY })) as MatrixViewModel;
    expect(vm.issueKey).toBe(ISSUE_KEY);
  });

  it('rend une matrice vide quand aucune couverture n’existe', async () => {
    const { resolver } = await setup();
    const vm = (await resolver.call('get-issue-matrix', { issueId: 'inconnu' })) as MatrixViewModel;
    expect(vm.hasCriteria).toBe(false);
    expect(vm.rows).toHaveLength(0);
  });

  it('détecte le français depuis la locale du contexte', async () => {
    const { sc, resolver } = await setup();
    await sc.store.saveCoverage(aCoverage({ issueId: ISSUE_ID, total: 4, proven: 2 }));
    const vm = (await resolver.call('get-issue-matrix', { issueId: ISSUE_ID }, { locale: 'fr-FR' })) as MatrixViewModel;
    expect(vm.summaryText).toContain('sur 4');
  });
});

describe('get-coverage-field', () => {
  it('renvoie le libellé « n / m » coloré', async () => {
    const { sc, resolver } = await setup();
    await sc.store.saveCoverage(aCoverage({ issueId: ISSUE_ID, total: 4, proven: 4, passes: true }));
    const vm = (await resolver.call('get-coverage-field', { issueId: ISSUE_ID })) as CoverageFieldViewModel;
    expect(vm.label).toBe('4 / 4');
    expect(vm.tagColor).toBe('green');
  });
});

describe('attach-evidence', () => {
  it('enregistre la preuve, calcule sa force et recalcule la couverture', async () => {
    const { sc, resolver } = await setup();
    const res = (await resolver.call('attach-evidence', {
      issueId: ISSUE_ID,
      criterionId: 'crit-1',
      type: 'test',
      reference: 'checkout refuses an expired card',
    })) as { ok: boolean; strength: string };
    expect(res.ok).toBe(true);
    // Un test attaché à la main reste « déclaré » : la force machine ne vient
    // que d'un run de CI (SPEC §9.1, §22 point 3).
    expect(res.strength).toBe('declared');
    const saved = await sc.store.listEvidencesByCriterion('crit-1');
    expect(saved.some((e: Evidence) => e.type === 'test')).toBe(true);
    expect(sc.coverage.journal.count('recompute')).toBe(1);
  });

  it('n’attribue pas « vérifiée par machine » à une documentation que le vérificateur refuse', async () => {
    const { sc, resolver } = await setup();
    const res = (await resolver.call('attach-evidence', {
      issueId: ISSUE_ID,
      criterionId: 'crit-1',
      type: 'documentation',
      reference: 'https://wiki.example/paiement-refuse',
    })) as { ok: boolean; strength: string };
    expect(res.ok).toBe(true);
    // La page n'est pas connue du vérificateur : la preuve reste déclarée.
    expect(res.strength).toBe('declared');
    const saved = await sc.store.listEvidencesByCriterion('crit-1');
    const documentation = saved.find((e: Evidence) => e.type === 'documentation');
    expect(documentation?.verified).toBe(false);
  });
});

describe('attest-criterion', () => {
  it('enregistre une preuve attestée et l’attestation, puis recalcule', async () => {
    const { sc, resolver } = await setup();
    const res = (await resolver.call('attest-criterion', {
      issueId: ISSUE_ID,
      criterionId: 'crit-3',
      note: 'Refus déclenché, e-mail reçu.',
      accountId: 'user-tester',
    })) as { ok: boolean; attestationId: string };
    expect(res.ok).toBe(true);
    const attestations: Attestation[] = await sc.store.listAttestations('crit-3');
    expect(attestations).toHaveLength(1);
    expect(attestations[0]?.attesterAccountId).toBe('user-tester');
    expect(sc.coverage.journal.count('recompute')).toBe(1);
  });
});

describe('waive-criterion', () => {
  it('enregistre la dérogation motivée et recalcule la couverture', async () => {
    const { sc, resolver } = await setup();
    const res = (await resolver.call('waive-criterion', {
      issueId: ISSUE_ID,
      criterionId: 'crit-4',
      reason: 'Reporté dans PAY-140',
      accountId: 'user-po',
    })) as { ok: boolean; waiverId: string };
    expect(res.ok).toBe(true);
    const waivers: Waiver[] = await sc.store.listWaiversByCriterion('crit-4');
    expect(waivers).toHaveLength(1);
    expect(waivers[0]?.reason).toBe('Reporté dans PAY-140');
    expect(sc.coverage.journal.count('recompute')).toBe(1);
  });
});

describe('request-attestation', () => {
  it('notifie la personne compétente via Jira', async () => {
    const { sc, resolver } = await setup();
    const res = (await resolver.call('request-attestation', {
      issueKey: ISSUE_KEY,
      criterionId: 'crit-3',
      targetAccount: 'user-tester',
    })) as { ok: boolean };
    expect(res.ok).toBe(true);
    expect(sc.jira.notifications.some((n) => n.accountId === 'user-tester')).toBe(true);
  });
});

describe('list-criterion-history', () => {
  it('renvoie l’historique des versions formaté', async () => {
    const { sc, resolver } = await setup();
    await sc.store.addCriterionRevision({
      criterionId: 'crit-1',
      version: 2,
      text: 'Version 2',
      type: 'functional',
      changedBy: 'user-dev',
      at: '2026-11-11T08:00:00.000Z',
    });
    const rows = (await resolver.call('list-criterion-history', { criterionId: 'crit-1', code: 'AC-1' })) as { version: number }[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.version === 2)).toBe(true);
  });
});

describe('get/save-project-settings', () => {
  it('lit les réglages du projet', async () => {
    const { resolver } = await setup();
    const vm = (await resolver.call('get-project-settings', { projectId: PROJECT_ID })) as SettingsViewModel;
    expect(vm.projectId).toBe(PROJECT_ID);
    expect(vm.mode).toBe('strict');
  });

  it('persiste un changement de mode', async () => {
    const { sc, resolver } = await setup();
    const vm = (await resolver.call('save-project-settings', { projectId: PROJECT_ID, mode: 'observe' })) as SettingsViewModel;
    expect(vm.mode).toBe('observe');
    const saved = await sc.store.getSettings(PROJECT_ID);
    expect(saved?.mode).toBe('observe');
  });
});

describe('get-project-page', () => {
  it('agrège les données du projet sans erreur', async () => {
    const { resolver } = await setup();
    const vm = (await resolver.call('get-project-page', { projectId: PROJECT_ID })) as { projectId: string; stats: unknown };
    expect(vm.projectId).toBe(PROJECT_ID);
    expect(vm.stats).not.toBeNull();
  });
});

/* ---- Indépendance de l'attestation et dérogations contrôlées (SPEC §9.4, §12.4) ---- */

describe('attest-criterion — indépendance (SPEC §9.4)', () => {
  it('refuse l’assigné du ticket et n’écrit rien', async () => {
    const { sc, resolver } = await setup();
    const res = (await resolver.call('attest-criterion', {
      issueId: ISSUE_ID,
      criterionId: 'crit-3',
      note: 'J’ai vérifié moi-même.',
      accountId: DEVELOPER,
    })) as { ok: boolean; reason: string };
    expect(res.ok).toBe(false);
    expect(res.reason.length).toBeGreaterThan(0);
    expect(await sc.store.listAttestations('crit-3')).toHaveLength(0);
  });

  it('refuse un agent, même sur un critère non prouvé', async () => {
    const { sc, resolver } = await setup();
    const res = (await resolver.call('attest-criterion', {
      issueId: ISSUE_ID,
      criterionId: 'crit-3',
      note: 'Auto-attestation.',
      accountId: AGENT,
    })) as { ok: boolean; reason: string };
    expect(res.ok).toBe(false);
    expect(await sc.store.listAttestations('crit-3')).toHaveLength(0);
  });

  it('accepte un autre membre du projet et enregistre son rôle réel', async () => {
    const { sc, resolver } = await setup();
    const res = (await resolver.call('attest-criterion', {
      issueId: ISSUE_ID,
      criterionId: 'crit-3',
      note: 'Refus déclenché, e-mail reçu.',
      accountId: TESTER,
      role: 'Administrators', // rôle déclaré : ignoré, seul le rôle réel compte
    })) as { ok: boolean };
    expect(res.ok).toBe(true);
    const attestations: Attestation[] = await sc.store.listAttestations('crit-3');
    expect(attestations[0]?.role).toBe('Developers');
  });
});

describe('waive-criterion — dérogation contrôlée (SPEC §12.4)', () => {
  it('refuse une dérogation sans motif et n’écrit rien', async () => {
    const { sc, resolver } = await setup();
    const res = (await resolver.call('waive-criterion', {
      issueId: ISSUE_ID,
      criterionId: 'crit-4',
      reason: '   ',
      accountId: OWNER,
    })) as { ok: boolean; reason: string };
    expect(res.ok).toBe(false);
    expect(await sc.store.listWaiversByCriterion('crit-4')).toHaveLength(0);
  });

  it('refuse une dérogation accordée hors rôle habilité', async () => {
    const { sc, resolver } = await setup();
    const res = (await resolver.call('waive-criterion', {
      issueId: ISSUE_ID,
      criterionId: 'crit-4',
      reason: 'Reporté dans PAY-140',
      accountId: DEVELOPER,
    })) as { ok: boolean; reason: string };
    expect(res.ok).toBe(false);
    expect(await sc.store.listWaiversByCriterion('crit-4')).toHaveLength(0);
  });

  it('refuse une dérogation demandée par un agent', async () => {
    const { sc, resolver } = await setup();
    const res = (await resolver.call('waive-criterion', {
      issueId: ISSUE_ID,
      criterionId: 'crit-4',
      reason: 'Reporté dans PAY-140',
      accountId: AGENT,
    })) as { ok: boolean };
    expect(res.ok).toBe(false);
    expect(await sc.store.listWaiversByCriterion('crit-4')).toHaveLength(0);
  });
});

/** Deux critères non prouvés, dont un exige une attestation (§7.1). */
const MATRIX_ROWS = [
  aCriterionState({ criterionId: 'crit-3', code: 'AC-3', proven: false, type: 'functional' }),
  aCriterionState({ criterionId: 'crit-4', code: 'AC-4', proven: false, type: 'functional' }),
];

describe('get-issue-matrix — droits de geste (SPEC §9.4, §12.4)', () => {
  it('n’offre pas l’attestation à l’assigné, ni la dérogation', async () => {
    const { sc, resolver } = await setup();
    await sc.store.saveCoverage(aCoverage({ issueId: ISSUE_ID, total: 4, proven: 2, criteria: MATRIX_ROWS }));
    const vm = (await resolver.call('get-issue-matrix', {
      issueId: ISSUE_ID,
      accountId: DEVELOPER,
    })) as MatrixViewModel;
    expect(vm.rows.length).toBeGreaterThan(0);
    expect(vm.rows.every((row) => row.canAttest === false)).toBe(true);
    expect(vm.rows.every((row) => row.canWaive === false)).toBe(true);
  });

  it('offre l’attestation à un tiers et la dérogation au rôle habilité', async () => {
    const { sc, resolver } = await setup();
    await sc.store.saveCoverage(aCoverage({ issueId: ISSUE_ID, total: 4, proven: 2, criteria: MATRIX_ROWS }));
    const tiers = (await resolver.call('get-issue-matrix', {
      issueId: ISSUE_ID,
      accountId: TESTER,
    })) as MatrixViewModel;
    expect(tiers.rows.some((row) => row.canAttest)).toBe(true);

    const po = (await resolver.call('get-issue-matrix', {
      issueId: ISSUE_ID,
      accountId: OWNER,
    })) as MatrixViewModel;
    expect(po.rows.some((row) => row.canWaive)).toBe(true);
  });
});
