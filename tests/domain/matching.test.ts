/**
 * Tests du domaine : rapprochement tests ↔ critères (SPEC §11, FP-14, §21).
 *
 * Les quatre invariants du lot, un test par comportement :
 * - une paire proposée n'est **jamais** une preuve ;
 * - une paire confirmée est mémorisée : la preuve se met à jour toute seule ;
 * - un test renommé perd sa paire et reçoit une nouvelle proposition ;
 * - une sortie de modèle invalide ne bloque rien : repli déterministe.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import {
  boundConfidence,
  confirmLink,
  deterministicPairs,
  evidenceForLink,
  extractKeywords,
  handleRenamedTest,
  keywordSimilarity,
  newTestsOnBranch,
  proposePairs,
  refreshConfirmedEvidence,
  rejectLink,
  sharedTestWarnings,
  validatePair,
  type MatchingDeps,
} from '../../src/domain/matching.js';
import type { Criterion, TestOutcome } from '../../src/types.js';
import {
  aCriterion,
  aTestLink,
  aTestOutcome,
  aTestRun,
  BRANCH,
  COMMIT,
  DEVELOPER,
  REPO,
  TESTER,
  TEST_REFUSAL,
} from '../helpers/builders.js';
import { createFakeClock, createFakeIds, createRecordingLogger } from '../helpers/fake-clock.js';
import { createFakeLlm } from '../helpers/fake-gateways.js';
import { createFakeStore, type FakeStore } from '../helpers/fake-store.js';

const AT = '2026-11-11T10:00:00.000Z';

function depsOf(store: FakeStore, llm = createFakeLlm()): MatchingDeps {
  return { store, llm, clock: createFakeClock(), ids: createFakeIds('link') };
}

function criteriaOf(id: string, text: string): Criterion {
  return aCriterion({ id, code: `AC-${id.slice(-1)}`, text });
}

describe('matching — mots-clés et similarité (repli déterministe, SPEC §11)', () => {
  it('garde les mots porteurs et jette les mots vides', () => {
    const words = extractKeywords('checkout: refuses an expired card');
    expect(words.has('checkout')).toBe(true);
    expect(words.has('refuses')).toBe(true);
    expect(words.has('an')).toBe(false);
  });

  it('découpe le camelCase et les séparateurs d’un nom de test', () => {
    const words = extractKeywords('should_refuseExpiredCard.payment');
    expect(words.has('refuse')).toBe(true);
    expect(words.has('expired')).toBe(true);
    expect(words.has('card')).toBe(true);
  });

  it('mesure une similarité de Jaccard entre deux jeux de mots', () => {
    const score = keywordSimilarity(
      new Set(['payment', 'refused', 'card']),
      new Set(['card', 'payment', 'limit']),
    );
    expect(score).toBeCloseTo(0.5, 2);
  });

  it('donne une similarité nulle sur un jeu vide', () => {
    expect(keywordSimilarity(new Set(), new Set(['test']))).toBe(0);
  });

  it('borne une confiance dans 0..1', () => {
    expect(boundConfidence(1.85)).toBe(1);
    expect(boundConfidence(-0.4)).toBe(0);
    expect(boundConfidence(0.42)).toBe(0.42);
  });
});

describe('matching — validation de la sortie du modèle (SPEC §11, point 5)', () => {
  const criterion = criteriaOf('c1', 'Le paiement par carte expirée est refusé');
  const names = [TEST_REFUSAL];
  const ids = new Set(['c1']);
  const testNames = new Set(names);

  it('accepte une paire bien formée', () => {
    const pair = validatePair(
      { criterionId: 'c1', testName: TEST_REFUSAL, confidence: 0.8, rationale: 'Nom repris.' },
      ids,
      testNames,
    );
    expect(pair?.confidence).toBe(0.8);
  });

  it('rejette une paire portant une clé inconnue', () => {
    const pair = validatePair(
      {
        criterionId: 'c1',
        testName: TEST_REFUSAL,
        confidence: 0.8,
        rationale: 'Nom repris.',
        injected: 'drop table',
      },
      ids,
      testNames,
    );
    expect(pair).toBeNull();
  });

  it('rejette un critère ou un test inconnu', () => {
    expect(
      validatePair({ criterionId: 'c9', testName: TEST_REFUSAL, confidence: 0.8, rationale: 'x' }, ids, testNames),
    ).toBeNull();
    expect(
      validatePair({ criterionId: 'c1', testName: 'ghost test', confidence: 0.8, rationale: 'x' }, ids, testNames),
    ).toBeNull();
  });

  it('rejette une confiance non numérique et une justification absente', () => {
    expect(
      validatePair({ criterionId: 'c1', testName: TEST_REFUSAL, confidence: 'high', rationale: 'x' }, ids, testNames),
    ).toBeNull();
    expect(
      validatePair({ criterionId: 'c1', testName: TEST_REFUSAL, confidence: 0.8, rationale: '   ' }, ids, testNames),
    ).toBeNull();
  });

  it('propose par correspondance de noms quand rien ne vient du modèle', () => {
    const pairs = deterministicPairs([criterion], ['paiement carte refuse'], 'fr');
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.rationale).toContain('Repli déterministe');
    expect(pairs[0]?.confidence).toBeGreaterThanOrEqual(0.2);
  });

  it('ne propose rien quand aucun mot ne concorde', () => {
    expect(deterministicPairs([criteriaOf('c2', 'Envoi du récapitulatif')], ['database migration v2'])).toEqual([]);
  });
});

describe('matching — proposition mémorisée en `proposed` (SPEC §11)', () => {
  it('mémorise la paire du modèle en statut proposé, jamais confirmé', async () => {
    const store = createFakeStore();
    const llm = createFakeLlm({
      pairs: [[{ criterionId: 'c1', testName: TEST_REFUSAL, confidence: 0.95, rationale: 'Nom repris.' }]],
    });

    const links = await proposePairs(depsOf(store, llm), [criteriaOf('c1', 'Refus carte')], [TEST_REFUSAL]);

    expect(links).toHaveLength(1);
    expect(links[0]?.status).toBe('proposed');
    expect(links[0]?.confirmedBy).toBe('');
    expect(store.__tables.links.get(links[0]?.id ?? '')?.status).toBe('proposed');
  });

  it('borne la confiance renvoyée par le modèle à 1', async () => {
    const store = createFakeStore();
    const llm = createFakeLlm({
      pairs: [[{ criterionId: 'c1', testName: TEST_REFUSAL, confidence: 4.2, rationale: 'Certain.' }]],
    });

    const links = await proposePairs(depsOf(store, llm), [criteriaOf('c1', 'Refus carte')], [TEST_REFUSAL]);
    expect(links[0]?.confidence).toBe(1);
  });

  it('une panne du modèle ne bloque pas : repli déterministe', async () => {
    const store = createFakeStore();
    const logger = createRecordingLogger();
    const llm = createFakeLlm({ pairs: [new Error('quota exceeded')] });
    const deps = { ...depsOf(store, llm), logger, language: 'fr' as const };

    const links = await proposePairs(deps, [criteriaOf('c1', 'Refus carte expirée')], ['refus carte expirée']);

    expect(links.length).toBeGreaterThan(0);
    expect(links[0]?.status).toBe('proposed');
    expect(logger.atLevel('warn').join(' ')).toMatch(/indisponible/);
  });

  it('ne propose rien sans critère ni test, et n’appelle pas le modèle', async () => {
    const store = createFakeStore();
    const llm = createFakeLlm();

    expect(await proposePairs(depsOf(store, llm), [], [TEST_REFUSAL])).toEqual([]);
    expect(await proposePairs(depsOf(store, llm), [criteriaOf('c1', 'Refus')], [])).toEqual([]);
    expect(llm.journal.count('suggestPairs')).toBe(0);
  });

  it('repère les tests nouveaux : seule une paire confirmée compte déjà', () => {
    const outcomes: TestOutcome[] = [
      aTestOutcome({ name: 'known' }),
      aTestOutcome({ name: 'only-proposed' }),
      aTestOutcome({ name: 'brand-new' }),
    ];
    const links = [
      aTestLink({ testName: 'known', status: 'confirmed' }),
      aTestLink({ testName: 'only-proposed', status: 'proposed' }),
    ];

    expect(newTestsOnBranch(outcomes, links)).toEqual(['only-proposed', 'brand-new']);
  });
});

describe('matching — confirmation, rejet et test partagé (SPEC §11, §21)', () => {
  it('confirme une paire : seul un humain le fait', () => {
    const confirmed = confirmLink(aTestLink({ status: 'proposed', confirmedBy: '' }), TESTER, AT);
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.confirmedBy).toBe(TESTER);
    expect(confirmed.at).toBe(AT);
  });

  it('rejette une paire sans la supprimer (SPEC §20)', () => {
    const rejected = rejectLink(aTestLink({ status: 'proposed' }), TESTER, AT);
    expect(rejected.status).toBe('rejected');
    expect(rejected.id).toBe('link-1');
  });

  it('signale un test partagé par quatre critères, pas par trois', () => {
    const shared = ['c1', 'c2', 'c3', 'c4'].map((id, index) =>
      aTestLink({ id: `link-${index}`, testName: 'big test', criterionId: id, status: 'confirmed' }),
    );
    const three = ['c1', 'c2', 'c3'].map((id, index) =>
      aTestLink({ id: `small-${index}`, testName: 'ok test', criterionId: id, status: 'confirmed' }),
    );

    const warnings = sharedTestWarnings([...shared, ...three], 'fr');

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.testName).toBe('big test');
    expect(warnings[0]?.criterionCount).toBe(4);
    expect(warnings[0]?.message).toContain('4 critères');
  });
});

describe('matching — la preuve se met à jour seule (SPEC §11, point 3)', () => {
  it('ne produit aucune preuve pour une paire seulement proposée', () => {
    const evidence = evidenceForLink(
      aTestLink({ status: 'proposed' }),
      aTestOutcome({ name: TEST_REFUSAL }),
      COMMIT,
      AT,
    );
    expect(evidence).toBeNull();
  });

  it('ne produit aucune preuve pour un test qui n’est pas vert', () => {
    const evidence = evidenceForLink(
      aTestLink({ status: 'confirmed' }),
      aTestOutcome({ name: TEST_REFUSAL, state: 'failed' }),
      COMMIT,
      AT,
    );
    expect(evidence).toBeNull();
  });

  it('produit une preuve vérifiée par machine sur le commit du run', () => {
    const evidence = evidenceForLink(
      aTestLink({ status: 'confirmed', confirmedBy: DEVELOPER }),
      aTestOutcome({ name: TEST_REFUSAL }),
      COMMIT,
      AT,
    );
    expect(evidence?.strength).toBe('machine-verified');
    expect(evidence?.commit).toBe(COMMIT);
    expect(evidence?.reference).toBe(TEST_REFUSAL);
  });

  it('met la preuve à jour seule au passage suivant, sur la paire mémorisée', async () => {
    const store = createFakeStore();
    await store.saveLink(aTestLink({ id: 'link-1', testName: TEST_REFUSAL, status: 'confirmed' }));
    await store.saveTestRun(aTestRun({ id: 'run-2', repo: REPO, branch: BRANCH, commit: COMMIT }));
    await store.addTestResults('run-2', [aTestOutcome({ name: TEST_REFUSAL })]);

    const saved = await refreshConfirmedEvidence(depsOf(store), REPO, BRANCH);

    expect(saved).toHaveLength(1);
    expect(store.__tables.evidence.get('ev-link-1')?.commit).toBe(COMMIT);
    expect(store.__tables.evidence.get('ev-link-1')?.freshness).toBe('fresh');
  });

  it('fait tomber la preuve quand le test mémorisé échoue au passage suivant', async () => {
    const store = createFakeStore();
    await store.saveLink(aTestLink({ id: 'link-1', testName: TEST_REFUSAL, status: 'confirmed' }));
    await store.saveEvidence({
      id: 'ev-link-1',
      criterionId: 'crit-1',
      criterionVersion: 1,
      type: 'test',
      reference: TEST_REFUSAL,
      note: '',
      strength: 'machine-verified',
      commit: COMMIT,
      freshness: 'fresh',
      verified: true,
      addedBy: DEVELOPER,
      addedByAgent: false,
      at: AT,
      replacedBy: '',
    });
    await store.saveTestRun(aTestRun({ id: 'run-3', repo: REPO, branch: BRANCH, commit: 'a1b2c3' }));
    await store.addTestResults('run-3', [aTestOutcome({ name: TEST_REFUSAL, state: 'failed' })]);

    const saved = await refreshConfirmedEvidence(depsOf(store), REPO, BRANCH);

    expect(saved).toEqual([]);
    expect(store.__tables.evidence.get('ev-link-1')?.freshness).toBe('stale');
    expect(store.__tables.evidence.get('ev-link-1')?.verified).toBe(false);
  });

  it('ne fait rien sans run connu pour la branche', async () => {
    const store = createFakeStore();
    expect(await refreshConfirmedEvidence(depsOf(store), REPO, BRANCH)).toEqual([]);
  });
});

describe('matching — test renommé (SPEC §21)', () => {
  it('perd la paire confirmée et propose le rapprochement sur le même critère', async () => {
    const store = createFakeStore();
    await store.saveLink(
      aTestLink({ id: 'link-old', criterionId: 'c1', testName: 'ancien nom', status: 'confirmed' }),
    );
    const criteria = [criteriaOf('c1', 'Refus carte expirée'), criteriaOf('c2', 'Récapitulatif mensuel')];

    const proposed = await handleRenamedTest(depsOf(store), criteria, 'ancien nom', 'refus carte expirée');

    expect(proposed.length).toBeGreaterThan(0);
    expect(proposed.every((link) => link.status === 'proposed')).toBe(true);
    expect(proposed.every((link) => link.criterionId === 'c1')).toBe(true);
    expect(proposed[0]?.testName).toBe('refus carte expirée');
  });

  it('propose sur tous les critères quand l’ancien nom n’a aucune paire confirmée', async () => {
    const store = createFakeStore();
    const criteria = [criteriaOf('c1', 'Refus carte expirée'), criteriaOf('c2', 'Refus carte volée')];

    const proposed = await handleRenamedTest(depsOf(store), criteria, 'inconnu', 'refus carte expirée');

    expect(proposed.map((link) => link.criterionId).sort()).toEqual(['c1', 'c2']);
  });
});
