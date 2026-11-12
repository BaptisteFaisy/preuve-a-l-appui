/**
 * Rapprochement tests ↔ critères (SPEC §11, FP-14, §21).
 *
 * Ce module ne fait que quatre choses, dans cet ordre :
 * 1. proposer des paires test ↔ critère, avec une confiance et une phrase de
 *    justification, en appelant `LlmGateway.suggestPairs` — sortie validée
 *    (clés inconnues rejetées, confiance bornée 0..1, justification
 *    obligatoire) et repli déterministe sur les noms si le modèle tombe ;
 * 2. mémoriser ces paires en statut `proposed` : **une paire proposée n'est
 *    jamais une preuve** (SPEC §11) ;
 * 3. confirmer ou rejeter une paire (geste humain), puis, aux passages
 *    suivants, mettre la preuve à jour toute seule depuis les résultats de CI ;
 * 4. signaler un test partagé par plus de trois critères (autorisé, §21).
 *
 * Domaine pur : aucun import `@forge/*`, horloge et identifiants injectés.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Clock, IdGenerator, LlmGateway, Logger, ProofStore, SuggestedPair } from '../ports';
import type { Criterion, Evidence, Language, TestLink, TestOutcome } from '../types';
import { reportMessage } from '../i18n/reports';

/** Ce dont le rapprochement a besoin, injecté. */
export interface MatchingDeps {
  store: ProofStore;
  llm: LlmGateway;
  clock: Clock;
  ids: IdGenerator;
  logger?: Logger;
  /** Langue des phrases de justification visibles (SPEC §20). */
  language?: Language;
}

/** Un test qui prouve trop de critères à la fois (SPEC §21). */
export interface SharedTestWarning {
  testName: string;
  criterionCount: number;
  message: string;
}

/** Mots vides ignorés par le repli déterministe (anglais et français). */
const STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et',
  'est', 'en', 'pour', 'par', 'sur', 'dans', 'qui', 'que', 'son', 'sa', 'ses',
  'pas', 'ne', 'au', 'aux', 'ce', 'cet', 'cette', 'plus', 'moins',
]);

/** Les clés admises dans une paire proposée : tout le reste est rejeté. */
const PAIR_KEYS: ReadonlySet<string> = new Set([
  'criterionId',
  'testName',
  'confidence',
  'rationale',
]);

/** Seuil sous lequel une similarité de noms ne propose rien. */
const MIN_SIMILARITY = 0.15;

/** Au-delà de ce nombre de critères, un test partagé est signalé (SPEC §21). */
export const SHARED_TEST_LIMIT = 3;

/** Découpe un texte ou un nom de test en mots-clés normalisés. */
export function extractKeywords(value: string): Set<string> {
  const normalized = value
    .replace(/[._:/-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  const tokens = normalized.match(/[a-z0-9]+/g) ?? [];
  return new Set(tokens.filter((token) => token.length > 2 && !STOPWORDS.has(token)));
}

/** Similarité de Jaccard entre deux jeux de mots-clés, entre 0 et 1. */
export function keywordSimilarity(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  const union = left.size + right.size - shared;
  return union === 0 ? 0 : shared / union;
}

/** Les mots communs, dans l'ordre du critère, pour la phrase de justification. */
function sharedWords(criterionWords: ReadonlySet<string>, testWords: ReadonlySet<string>): string[] {
  return [...criterionWords].filter((word) => testWords.has(word));
}

/** Une confiance ramenée dans 0..1, arrondie au centième. */
export function boundConfidence(value: number): number {
  const bounded = Math.max(0, Math.min(1, value));
  return Math.round(bounded * 100) / 100;
}

/**
 * Repli déterministe : le nom du test partage des mots avec le texte du
 * critère. Aucun appel réseau, aucune exception : c'est ce qui rend l'app
 * utilisable quand le modèle tombe (SPEC §19).
 */
export function deterministicPairs(
  criteria: readonly Criterion[],
  testNames: readonly string[],
  language: Language = 'en',
): SuggestedPair[] {
  const pairs: SuggestedPair[] = [];
  for (const criterion of criteria) {
    const criterionWords = extractKeywords(`${criterion.code} ${criterion.text}`);
    for (const testName of testNames) {
      const score = keywordSimilarity(criterionWords, extractKeywords(testName));
      if (score < MIN_SIMILARITY) continue;
      const words = sharedWords(criterionWords, extractKeywords(testName)).slice(0, 3);
      const key = words.length > 0 ? 'reports.matching.rationale' : 'reports.matching.rationale.empty';
      pairs.push({
        criterionId: criterion.id,
        testName,
        confidence: boundConfidence(Math.min(0.9, Math.max(0.2, score))),
        rationale: reportMessage(key, language, { words: words.join(', ') }),
      });
    }
  }
  return pairs;
}

/** Vrai si l'objet ne porte que les quatre clés admises. */
function hasOnlyPairKeys(raw: Record<string, unknown>): boolean {
  return Object.keys(raw).every((key) => PAIR_KEYS.has(key));
}

/**
 * Valide une paire proposée par le modèle : identifiants connus, confiance
 * bornée, justification non vide, aucune clé inconnue. `null` = rejetée.
 */
export function validatePair(
  raw: unknown,
  criterionIds: ReadonlySet<string>,
  testNames: ReadonlySet<string>,
): SuggestedPair | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  if (!hasOnlyPairKeys(source)) return null;
  const { criterionId, testName, confidence, rationale } = source;
  if (typeof criterionId !== 'string' || !criterionIds.has(criterionId)) return null;
  if (typeof testName !== 'string' || !testNames.has(testName)) return null;
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return null;
  if (typeof rationale !== 'string' || rationale.trim().length === 0) return null;
  return {
    criterionId,
    testName,
    confidence: boundConfidence(confidence),
    rationale: rationale.trim(),
  };
}

/** Valide une liste entière ; les paires invalides sont écartées une à une. */
export function validatePairs(
  raw: unknown,
  criteria: readonly Criterion[],
  testNames: readonly string[],
): SuggestedPair[] {
  if (!Array.isArray(raw)) return [];
  const criterionIds = new Set(criteria.map((criterion) => criterion.id));
  const names = new Set(testNames);
  return raw.flatMap((entry) => {
    const pair = validatePair(entry, criterionIds, names);
    return pair === null ? [] : [pair];
  });
}

/**
 * Les paires retenues : la sortie validée du modèle, ou le repli déterministe
 * quand le modèle tombe ou ne propose rien d'exploitable.
 */
async function askModel(
  deps: MatchingDeps,
  criteria: readonly Criterion[],
  testNames: readonly string[],
): Promise<SuggestedPair[]> {
  const language = deps.language ?? 'en';
  try {
    const raw: unknown = await deps.llm.suggestPairs(criteria, testNames);
    const validated = validatePairs(raw, criteria, testNames);
    if (validated.length > 0) return validated;
    deps.logger?.log('warn', reportMessage('reports.matching.modelDown', language));
  } catch (error) {
    deps.logger?.log('warn', reportMessage('reports.matching.modelDown', language), error);
  }
  return deterministicPairs(criteria, testNames, language);
}

/**
 * Repère les tests nouveaux ou modifiés sur la branche (SPEC §11, point 1) :
 * un test est à rapprocher dès qu'aucune paire **confirmée** ne le porte.
 * Une paire seulement proposée ne suffit pas : elle ne prouve rien, et un
 * humain peut encore la rejeter.
 */
export function newTestsOnBranch(
  outcomes: readonly TestOutcome[],
  links: readonly TestLink[],
): string[] {
  const confirmed = new Set(
    links.filter((link) => link.status === 'confirmed').map((link) => link.testName),
  );
  const fresh: string[] = [];
  for (const outcome of outcomes) {
    if (confirmed.has(outcome.name)) continue;
    if (!fresh.includes(outcome.name)) fresh.push(outcome.name);
  }
  return fresh;
}

/**
 * Propose des paires et les mémorise en statut `proposed`.
 * Une paire proposée ne compte jamais comme preuve (SPEC §11) : c'est
 * `confirmLink` qui la transforme, sur un geste humain.
 */
export async function proposePairs(
  deps: MatchingDeps,
  criteria: readonly Criterion[],
  testNames: readonly string[],
): Promise<TestLink[]> {
  if (criteria.length === 0 || testNames.length === 0) return [];
  const pairs = await askModel(deps, criteria, testNames);
  const now = deps.clock.now();
  const links = pairs.map((pair) => ({
    id: deps.ids.next('link'),
    criterionId: pair.criterionId,
    testName: pair.testName,
    status: 'proposed' as const,
    confidence: pair.confidence,
    rationale: pair.rationale,
    confirmedBy: '',
    at: now,
  }));
  for (const link of links) await deps.store.saveLink(link);
  return links;
}

/** Confirme une paire : à partir d'ici seulement, elle peut porter une preuve. */
export function confirmLink(link: TestLink, confirmedBy: string, at: string): TestLink {
  return { ...link, status: 'confirmed', confirmedBy, at };
}

/** Rejette une paire proposée : elle est conservée, jamais supprimée (§20). */
export function rejectLink(link: TestLink, rejectedBy: string, at: string): TestLink {
  return { ...link, status: 'rejected', confirmedBy: rejectedBy, at };
}

/**
 * Tests prouvant plus de trois critères (SPEC §21) : autorisé, mais signalé
 * pour qu'un humain regarde si le test n'est pas devenu trop large.
 */
export function sharedTestWarnings(
  links: readonly TestLink[],
  language: Language = 'en',
): SharedTestWarning[] {
  const criteriaByTest = new Map<string, Set<string>>();
  for (const link of links) {
    if (link.status !== 'confirmed') continue;
    const known = criteriaByTest.get(link.testName) ?? new Set<string>();
    known.add(link.criterionId);
    criteriaByTest.set(link.testName, known);
  }
  const warnings: SharedTestWarning[] = [];
  for (const [testName, criterionIds] of criteriaByTest) {
    if (criterionIds.size <= SHARED_TEST_LIMIT) continue;
    warnings.push({
      testName,
      criterionCount: criterionIds.size,
      message: reportMessage('reports.matching.shared', language, {
        name: testName,
        count: criterionIds.size,
      }),
    });
  }
  return warnings;
}

/**
 * La preuve qu'une paire confirmée porte, ou `null`.
 * `null` quand la paire n'est pas confirmée (proposée : jamais une preuve) ou
 * quand le test n'est pas vert : un test en échec ne prouve rien (SPEC §22.3).
 */
export function evidenceForLink(
  link: TestLink,
  outcome: TestOutcome,
  commit: string,
  at: string,
): Evidence | null {
  if (link.status !== 'confirmed') return null;
  if (outcome.state !== 'passed') return null;
  return {
    id: `ev-${link.id}`,
    criterionId: link.criterionId,
    criterionVersion: 1,
    type: 'test',
    reference: link.testName,
    note: link.rationale,
    strength: 'machine-verified',
    commit,
    freshness: 'fresh',
    verified: true,
    addedBy: link.confirmedBy,
    addedByAgent: false,
    at,
    replacedBy: '',
  };
}

/** Abaisse une preuve de test devenue fausse : elle n'est jamais supprimée (§20). */
async function downgrade(deps: MatchingDeps, testName: string): Promise<void> {
  const evidences = await deps.store.listEvidencesByTestName(testName);
  for (const evidence of evidences) {
    if (evidence.freshness === 'stale' && !evidence.verified) continue;
    await deps.store.saveEvidence({ ...evidence, freshness: 'stale', verified: false });
  }
}

/**
 * Met à jour la preuve des paires confirmées depuis le dernier run de la
 * branche (SPEC §11, point 3) : le test passe → la preuve est fraîche ; il
 * échoue ou disparaît → la preuve tombe.
 */
export async function refreshConfirmedEvidence(
  deps: MatchingDeps,
  repo: string,
  branch: string,
): Promise<Evidence[]> {
  const run = await deps.store.latestRunForBranch(repo, branch);
  if (run === null) return [];
  const outcomes = await deps.store.latestOutcomesForBranch(repo, branch);
  const at = deps.clock.now();
  const saved: Evidence[] = [];
  for (const outcome of outcomes) {
    const links = await deps.store.listConfirmedLinksByTest(outcome.name);
    for (const link of links) {
      const evidence = evidenceForLink(link, outcome, run.commit, at);
      if (evidence === null) {
        await downgrade(deps, outcome.name);
        continue;
      }
      await deps.store.saveEvidence(evidence);
      saved.push(evidence);
    }
  }
  return saved;
}

/**
 * Test renommé (SPEC §21) : la paire confirmée sur l'ancien nom est perdue
 * (le nom ne correspond plus aux résultats de CI) et l'app propose le
 * rapprochement avec le nouveau nom, sur les mêmes critères.
 */
export async function handleRenamedTest(
  deps: MatchingDeps,
  criteria: readonly Criterion[],
  oldTestName: string,
  newTestName: string,
): Promise<TestLink[]> {
  const previous = await deps.store.listConfirmedLinksByTest(oldTestName);
  const criterionIds = new Set(previous.map((link) => link.criterionId));
  const scoped = criteria.filter((criterion) => criterionIds.has(criterion.id));
  const target = scoped.length > 0 ? scoped : criteria;
  deps.logger?.log(
    'info',
    reportMessage('reports.matching.renamed', deps.language ?? 'en', {
      old: oldTestName,
      new: newTestName,
    }),
  );
  return proposePairs(deps, target, [newTestName]);
}
