/**
 * Helpers de lecture et d'écriture partagées par la couche de mapping.
 *
 * Un seul endroit pour les conversions scalaires : date, énumération, booléen,
 * nombre, JSON. Les noms et les signatures reprennent ceux de la façade
 * `rows.ts` de Rayon d'impact (`text`, `parseJson`, `fromSqlBoolean`,
 * `toSqlTimestamp`…), pour qu'un futur `src/db/rows.ts` gelé puisse absorber
 * ce module sans changer un seul appelant.
 *
 * Règle du SPEC §20 et de R4 §1.2 : une lecture ne lève jamais. Chaque
 * conversion a une valeur de repli documentée, parce qu'une seule colonne
 * corrompue ne doit pas vider l'écran du dossier de preuve (R4 §6.3).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type {
  CriterionStatus,
  Defect,
  Freshness,
  GateMode,
  Language,
  LinkStatus,
  LivingState,
  MissingCriteriaPolicy,
  Strength,
  TestState,
} from '../types';
import { CRITERION_TYPES, EVIDENCE_TYPES } from '../types';

export { CRITERION_TYPES, EVIDENCE_TYPES };

/* --------------------------------------------------------------- scalaires */

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Une chaîne, ou `fallback` si la colonne n'en est pas une. */
export function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/** Un nombre fini, sinon 0. Les `DECIMAL` reviennent en `string` (R4 §1.2). */
export function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Un nombre lu en base : accepte un `number` ou une chaîne numérique. */
export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** Sérialise une colonne JSON ; une valeur insériable devient `'null'`. */
export function jsonText(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'null';
  } catch {
    return 'null';
  }
}

/**
 * Lit une colonne JSON. `accept` refuse une charge utile de la mauvaise forme :
 * une valeur syntaxiquement valide mais mal formée rend quand même le repli.
 */
export function parseJson<T>(
  raw: unknown,
  fallback: T,
  accept: (value: unknown) => boolean = () => true,
): T {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return accept(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Forge rend un `BOOLEAN` en 0/1 ; un pilote peut rendre un vrai booléen. */
export function fromSqlBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return fallback;
}

export function toSqlBoolean(value: boolean): number {
  return value ? 1 : 0;
}

/** Valide une colonne d'énumération ; l'inconnu prend la valeur de repli. */
export function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Une liste de chaînes : tout ce qui n'en est pas une est jeté. */
export function parseStringList(value: unknown): string[] {
  return asArray(value).filter((item): item is string => typeof item === 'string');
}

/** Une liste JSON d'objets : chaque entrée est validée, les autres jetées. */
export function parseObjectList(raw: unknown): Record<string, unknown>[] {
  const source = Array.isArray(raw) ? raw : parseJson<unknown>(raw, []);
  return asArray(source).filter(isObject);
}

/* ------------------------------------------------------------------ dates */

/** ISO-8601 → `YYYY-MM-DD HH:MM:SS.fff`, le format d'insertion documenté. */
export function toSqlTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace('T', ' ').slice(0, 23);
}

function padFraction(time: string): string {
  const [clock, fraction = ''] = time.split('.');
  return `${clock}.${(fraction + '000').slice(0, 3)}`;
}

/** `YYYY-MM-DD HH:MM:SS[.fff]` → ISO-8601 UTC ; `''` quand c'est illisible. */
export function fromSqlTimestamp(value: unknown): string {
  if (typeof value !== 'string') return '';
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)/.exec(value);
  if (!match) return '';
  return `${match[1]}T${padFraction(match[2])}Z`;
}

/**
 * Le seul convertisseur de date du domaine : une date absente s'écrit `''`
 * (jamais NULL, jamais d'exception), et se relit en `''`.
 */
export function toTimestamp(value: string): string {
  return toSqlTimestamp(value) ?? '';
}

/** Le seul convertisseur de date vers le domaine : `''` si la colonne est vide. */
export function fromTimestamp(value: unknown): string {
  return fromSqlTimestamp(value);
}

/* ---------------------------------------------------------- énumérations */

/** Les trois forces (SPEC §9.1), de la plus faible à la plus forte. */
export const STRENGTHS: readonly Strength[] = ['declared', 'attested', 'machine-verified'];

/** Les trois états d'un critère (SPEC §8.3). */
export const CRITERION_STATUSES: readonly CriterionStatus[] = [
  'proposed',
  'active',
  'superseded',
];

/** Les trois états de fraîcheur d'une preuve (SPEC §9.3). */
export const FRESHNESS_VALUES: readonly Freshness[] = ['fresh', 'to-reconfirm', 'stale'];

/** Les quatre états d'un test dans un résumé de CI (SPEC §10). */
export const TEST_STATES: readonly TestState[] = ['passed', 'failed', 'skipped', 'absent'];

/** Les trois états d'une paire test ↔ critère (SPEC §11). */
export const LINK_STATUSES: readonly LinkStatus[] = ['proposed', 'confirmed', 'rejected'];

/** Les trois états de la preuve vivante (SPEC §13). */
export const LIVING_STATES: readonly LivingState[] = ['proven', 'regressed', 'unproven'];

/** Les trois sévérités du validateur (SPEC §12.2). */
export const GATE_MODES: readonly GateMode[] = ['strict', 'lenient', 'observe'];

/** Ce que l'app fait d'un ticket sans critère (SPEC §8.3). */
export const MISSING_CRITERIA_POLICIES: readonly MissingCriteriaPolicy[] = ['block', 'suggest'];

/** Les deux langues de l'interface (SPEC §20). */
export const LANGUAGES: readonly Language[] = ['en', 'fr'];

/** Les six raisons de blocage (SPEC §7.2). */
export const DEFECTS: readonly Defect[] = [
  'no-evidence',
  'weak-strength',
  'not-fresh',
  'not-independent',
  'unverified',
  'no-criteria',
];
