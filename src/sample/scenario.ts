/**
 * Le scénario de démonstration d'un ticket — SOCLE GELÉ (lot `env-complet`).
 *
 * Un ticket de démonstration n'est pas « les quatre critères du sample »
 * recopiés : c'est une petite histoire — des critères propres à ce ticket,
 * des preuves de plusieurs types, des gestes humains, parfois un critère
 * révisé, parfois des critères en attente de validation. Ce fichier définit
 * la **forme** de cette histoire ; `src/sample/bootstrap.ts` sait la rejouer,
 * `tools/demo-scenarios.mjs` sait l'écrire.
 *
 * Le format est volontairement strict : un scénario mal formé est **rejeté**
 * (`null`), jamais appliqué à moitié. Un code de critère qui n'existe pas dans
 * le scénario est une erreur de données, pas un détail à ignorer.
 *
 * Socle : aucun import applicatif, aucune dépendance réseau ; ce fichier ne
 * bouge plus sans décision explicite (docs/CONTRACTS.md).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type {
  CriterionStatus,
  CriterionType,
  EvidenceType,
  Strength,
} from '../types';
import { CRITERION_TYPES, EVIDENCE_TYPES } from '../types';

/** Les trois forces, de la plus faible à la plus forte (SPEC §9.1). */
export const SCENARIO_STRENGTHS: readonly Strength[] = [
  'declared',
  'attested',
  'machine-verified',
];

/** Un critère de démonstration, propre à son ticket. */
export interface ScenarioCriterion {
  /** Code stable dans le ticket (`AC-1`). */
  readonly code: string;
  /** Texte du critère, en français. */
  readonly text: string;
  /** Type du critère (SPEC §9.1) : il commande la force exigée. */
  readonly type: CriterionType;
  /** Force exigée pour le prouver. */
  readonly requiredStrength: Strength;
  /**
   * `proposed` = l'agent l'a proposé, un humain ne l'a pas encore validé
   * (SPEC §8.3) : le critère ne compte pas dans la couverture.
   */
  readonly status: CriterionStatus;
}

/** Une preuve de démonstration, rattachée à un critère par son code. */
export interface ScenarioEvidence {
  /** Code du critère prouvé. */
  readonly criterion: string;
  /** Type de preuve (SPEC §9.1) : `test`, `documentation`, `attachment`… */
  readonly type: EvidenceType;
  /** Référence : nom de test, lien de documentation, chemin de capture… */
  readonly reference: string;
  /** Note libre, affichée dans la matrice. */
  readonly note: string;
  /** Qui l'a attachée : l'agent (par défaut) ou la personne du ticket. */
  readonly addedBy: 'agent' | 'developer';
}

/** Une attestation : la preuve vient d'un tiers, pas de l'agent ni de l'assigné. */
export interface ScenarioAttestation {
  readonly code: string;
  readonly accountId: string;
  readonly note: string;
}

/** Une dérogation : un critère livré sans preuve, assumé et motivé. */
export interface ScenarioWaiver {
  readonly code: string;
  readonly accountId: string;
  readonly role: string;
  readonly reason: string;
}

/** Une paire test ↔ critère : proposée (à confirmer) ou confirmée. */
export interface ScenarioLink {
  readonly code: string;
  readonly testName: string;
  readonly status: 'proposed' | 'confirmed';
}

/** Une révision de critère : le texte change, les preuves passent « à revoir ». */
export interface ScenarioRevision {
  readonly code: string;
  readonly text: string;
}

/** L'histoire complète d'un ticket de démonstration. */
export interface DemoScenario {
  readonly criteria: readonly ScenarioCriterion[];
  readonly evidences: readonly ScenarioEvidence[];
  readonly attest: readonly ScenarioAttestation[];
  readonly waive: readonly ScenarioWaiver[];
  readonly links: readonly ScenarioLink[];
  readonly revisions: readonly ScenarioRevision[];
}

/* ------------------------------------------------------------- lectures sûres */

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T | null {
  if (typeof value !== 'string') return fallback;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/* --------------------------------------------------------------- parsing */

function parseCriteria(raw: unknown): ScenarioCriterion[] | null {
  const items = asArray(raw);
  const criteria: ScenarioCriterion[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const source = asObject(item);
    const code = asText(source['code']);
    const text = asText(source['text']);
    if (code === '' || text === '' || seen.has(code)) return null;
    const type = asEnum<CriterionType>(source['type'], CRITERION_TYPES, 'functional');
    const strength = asEnum<Strength>(
      source['requiredStrength'],
      SCENARIO_STRENGTHS,
      'machine-verified',
    );
    if (type === null || strength === null) return null;
    const status = asEnum<CriterionStatus>(
      source['status'],
      ['proposed', 'active', 'superseded'],
      'active',
    );
    if (status === null) return null;
    seen.add(code);
    criteria.push({ code, text, type, requiredStrength: strength, status });
  }
  return criteria;
}

function parseEvidences(
  raw: unknown,
  codes: ReadonlySet<string>,
): ScenarioEvidence[] | null {
  const evidences: ScenarioEvidence[] = [];
  for (const item of asArray(raw)) {
    const source = asObject(item);
    const criterion = asText(source['criterion']);
    const reference = asText(source['reference']);
    const type = asEnum<EvidenceType>(source['type'], EVIDENCE_TYPES, 'test');
    if (criterion === '' || reference === '' || type === null) return null;
    if (!codes.has(criterion)) return null;
    const addedBy = asEnum<'agent' | 'developer'>(
      source['addedBy'],
      ['agent', 'developer'],
      'agent',
    );
    if (addedBy === null) return null;
    evidences.push({
      criterion,
      type,
      reference,
      note: asText(source['note']),
      addedBy,
    });
  }
  return evidences;
}

function parseAttestations(
  raw: unknown,
  codes: ReadonlySet<string>,
): ScenarioAttestation[] | null {
  const attest: ScenarioAttestation[] = [];
  for (const item of asArray(raw)) {
    const source = asObject(item);
    const code = asText(source['code']);
    const accountId = asText(source['accountId']);
    if (code === '' || accountId === '' || !codes.has(code)) return null;
    attest.push({ code, accountId, note: asText(source['note']) });
  }
  return attest;
}

function parseWaivers(
  raw: unknown,
  codes: ReadonlySet<string>,
): ScenarioWaiver[] | null {
  const waive: ScenarioWaiver[] = [];
  for (const item of asArray(raw)) {
    const source = asObject(item);
    const code = asText(source['code']);
    const accountId = asText(source['accountId']);
    const role = asText(source['role']);
    const reason = asText(source['reason']);
    if (code === '' || accountId === '' || role === '' || reason === '') return null;
    if (!codes.has(code)) return null;
    waive.push({ code, accountId, role, reason });
  }
  return waive;
}

function parseLinks(
  raw: unknown,
  codes: ReadonlySet<string>,
): ScenarioLink[] | null {
  const links: ScenarioLink[] = [];
  for (const item of asArray(raw)) {
    const source = asObject(item);
    const code = asText(source['code']);
    const testName = asText(source['testName']);
    if (code === '' || testName === '' || !codes.has(code)) return null;
    const status = asEnum<'proposed' | 'confirmed'>(
      source['status'],
      ['proposed', 'confirmed'],
      'confirmed',
    );
    if (status === null) return null;
    links.push({ code, testName, status });
  }
  return links;
}

function parseRevisions(
  raw: unknown,
  codes: ReadonlySet<string>,
): ScenarioRevision[] | null {
  const revisions: ScenarioRevision[] = [];
  for (const item of asArray(raw)) {
    const source = asObject(item);
    const code = asText(source['code']);
    const text = asText(source['text']);
    if (code === '' || text === '' || !codes.has(code)) return null;
    revisions.push({ code, text });
  }
  return revisions;
}

/**
 * Lit un scénario de démonstration. Renvoie `null` si quoi que ce soit
 * cloche : un scénario à moitié appliqué mentirait sur l'état du ticket.
 */
export function parseScenario(raw: unknown): DemoScenario | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = asObject(raw);
  const criteria = parseCriteria(source['criteria']);
  if (criteria === null) return null;
  const codes = new Set(criteria.map((criterion) => criterion.code));
  const evidences = parseEvidences(source['evidences'], codes);
  const attest = parseAttestations(source['attest'], codes);
  const waive = parseWaivers(source['waive'], codes);
  const links = parseLinks(source['links'], codes);
  const revisions = parseRevisions(source['revisions'], codes);
  if (evidences === null || attest === null || waive === null) return null;
  if (links === null || revisions === null) return null;
  return { criteria, evidences, attest, waive, links, revisions };
}

/** Un scénario vide : aucun critère, aucune preuve, aucun geste. */
export function emptyScenario(): DemoScenario {
  return { criteria: [], evidences: [], attest: [], waive: [], links: [], revisions: [] };
}
