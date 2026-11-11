/**
 * État partagé du faux `ProofStore` : les tables en mémoire et leurs aides.
 *
 * Un seul endroit définit les collections (docs/CONTRACTS.md §5 : « on les
 * utilise, on ne les recopie pas ») ; les fabriques par zone
 * (`fake-store-criteria.ts`, …) les lisent, `fake-store.ts` les assemble.
 *
 * Règles du contrat respectées ici :
 * - aucune liste sans borne (SPEC §18, docs/CONTRACTS.md §4) ;
 * - `null` quand la ligne est absente, jamais d'exception ;
 * - jamais de suppression physique : `replacedBy`, `revokedAt`, `superseded`.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type {
  Attestation,
  Coverage,
  Criterion,
  CriterionRevision,
  Evidence,
  LivingProof,
  ProjectSettings,
  ProofStats,
  ReleaseDossier,
  TestLink,
  TestOutcome,
  TestRun,
  Waiver,
} from '../../src/types.js';

/** Borne par défaut de toute liste renvoyée par le faux store. */
export const DEFAULT_LIST_LIMIT = 500;

/** Les tables en mémoire, exposées aux tests via `store.__tables`. */
export interface FakeStoreTables {
  /** `criterion` (SPEC §18) : une ligne par critère, version incluse. */
  readonly criteria: Map<string, Criterion>;
  /** `criterion_history` : l'historique par critère. */
  readonly revisions: Map<string, CriterionRevision[]>;
  /** `evidence` (SPEC §18) : les preuves, remplacées mais jamais ôtées. */
  readonly evidence: Map<string, Evidence>;
  /** `attestation` : les attestations par critère. */
  readonly attestations: Map<string, Attestation[]>;
  /** `waiver` (SPEC §18) : les dérogations, révoquées mais gardées. */
  readonly waivers: Map<string, Waiver>;
  /** `coverage` : la dernière couverture calculée par ticket. */
  readonly coverage: Map<string, Coverage>;
  /** `settings` : les réglages par projet. */
  readonly settings: Map<string, ProjectSettings>;
  /** `test_run` : les pipelines reçus. */
  readonly runs: Map<string, TestRun>;
  /** `test_result` : les résultats par pipeline. */
  readonly results: Map<string, TestOutcome[]>;
  /** `test_link` : les paires test ↔ critère. */
  readonly links: Map<string, TestLink>;
  /** `living_proof` : les preuves vivantes après clôture (SPEC §13). */
  readonly living: Map<string, LivingProof>;
  /** Dossiers de preuve par version (SPEC §17, lot S). */
  readonly dossiers: Map<string, ReleaseDossier>;
  /** Ticket (id **ou** clé) → projet : rend les listes par projet possibles. */
  readonly issueProject: Map<string, string>;
  /** Tickets clos hors validateur, relevés par le contrôle nocturne. */
  readonly closedIssues: Map<string, string>;
  /** Statistiques forcées par un test, lues avant le calcul. */
  readonly seededStats: Map<string, ProofStats>;
}

export function createTables(): FakeStoreTables {
  return {
    criteria: new Map(),
    revisions: new Map(),
    evidence: new Map(),
    attestations: new Map(),
    waivers: new Map(),
    coverage: new Map(),
    settings: new Map(),
    runs: new Map(),
    results: new Map(),
    links: new Map(),
    living: new Map(),
    dossiers: new Map(),
    issueProject: new Map(),
    closedIssues: new Map(),
    seededStats: new Map(),
  };
}

/** Coupe une liste à `limit` lignes : le faux store n'a pas de liste infinie. */
export function bounded<T>(rows: readonly T[], limit: number = DEFAULT_LIST_LIMIT): T[] {
  return rows.slice(0, Math.max(0, limit));
}

/** Ajoute une ligne à une liste indexée (historique, résultats, attestations). */
export function append<T>(table: Map<string, T[]>, key: string, row: T): void {
  table.set(key, [...(table.get(key) ?? []), row]);
}

/** Clé projet déduite d'un identifiant de ticket : `PAY-123` → `PAY`. */
export function projectKeyOf(identifier: string): string {
  const dash = identifier.lastIndexOf('-');
  return dash > 0 ? identifier.slice(0, dash) : identifier;
}

/**
 * Projet d'un ticket : le lien explicite (`linkIssue`) prime, sinon la clé
 * déduite de l'identifiant. C'est ce qui permet `listByProject('10000')` aussi
 * bien que `listByProject('PAY')`.
 */
export function projectOf(tables: FakeStoreTables, identifier: string): string {
  const explicit = tables.issueProject.get(identifier);
  if (explicit !== undefined) return explicit;
  const key = projectKeyOf(identifier);
  return tables.issueProject.get(key) ?? key;
}

/** Vrai si le ticket appartient au projet (id de projet ou clé acceptés). */
export function inProject(tables: FakeStoreTables, identifier: string, projectId: string): boolean {
  const project = projectOf(tables, identifier);
  return project === projectId || projectKeyOf(project) === projectKeyOf(projectId);
}

/** Critères d'un ticket, éventuellement filtrés par statut. */
export function criteriaOfIssue(
  tables: FakeStoreTables,
  issueId: string,
  statuses?: readonly string[],
): Criterion[] {
  return [...tables.criteria.values()].filter(
    (criterion) =>
      criterion.issueId === issueId && (statuses === undefined || statuses.includes(criterion.status)),
  );
}

/** Identifiants des critères d'un ticket. */
export function criterionIdsOfIssue(tables: FakeStoreTables, issueId: string): Set<string> {
  return new Set(criteriaOfIssue(tables, issueId).map((criterion) => criterion.id));
}

/** Ticket d'un critère, ou `null` : sert aux listes par ticket. */
export function issueOfCriterion(tables: FakeStoreTables, criterionId: string): string | null {
  return tables.criteria.get(criterionId)?.issueId ?? null;
}

/** Tri stable par horodatage, puis par identifiant (déterminisme). */
export function byTime<T>(field: (row: T) => string, id: (row: T) => string) {
  return (a: T, b: T): number => field(a).localeCompare(field(b)) || id(a).localeCompare(id(b));
}
