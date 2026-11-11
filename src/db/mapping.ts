/**
 * Couche de mapping : aller-retour entre les types du domaine (`src/types.ts`)
 * et les lignes SQL de Forge (SPEC §18).
 *
 * Organisation (règle des fichiers < 500 lignes) : un fichier par famille de
 * tables, tous réunis ici pour que les adaptateurs de `repo.ts` n'aient qu'un
 * seul import.
 *
 *   mapping-common.ts    scalaires : dates, énumérations, booléens, JSON
 *   mapping-criteria.ts  criterion, criterion_history          (SPEC §8)
 *   mapping-evidence.ts  evidence, attestation, waiver         (SPEC §9, §12.4)
 *   mapping-coverage.ts  coverage, settings                    (SPEC §12, §9.2)
 *   mapping-ci.ts        test_run, test_result, test_link      (SPEC §10, §11)
 *   mapping-living.ts    living_proof, release_dossier         (SPEC §13, §17)
 *
 * Trois invariants partout (SPEC §20, R4 §1.2) :
 * - une chaîne non nulle du domaine s'écrit `''`, jamais `NULL` ;
 * - un tableau vide s'écrit `'[]'` ;
 * - un objet écrit puis relu est identique, champ pour champ.
 *
 * Aucun import `@forge/*` ici : cette couche est pure et testable hors runtime.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { TableName } from './schema.js';
import { CRITERION_COLUMNS, CRITERION_HISTORY_COLUMNS } from './mapping-criteria.js';
import { ATTESTATION_COLUMNS, EVIDENCE_COLUMNS, WAIVER_COLUMNS } from './mapping-evidence.js';
import { COVERAGE_COLUMNS, SETTINGS_COLUMNS } from './mapping-coverage.js';
import { TEST_LINK_COLUMNS, TEST_RESULT_COLUMNS, TEST_RUN_COLUMNS } from './mapping-ci.js';
import { LIVING_PROOF_COLUMNS, RELEASE_DOSSIER_COLUMNS } from './mapping-living.js';

export * from './mapping-common.js';
export * from './mapping-criteria.js';
export * from './mapping-evidence.js';
export * from './mapping-coverage.js';
export * from './mapping-ci.js';
export * from './mapping-living.js';

/**
 * Colonnes par table, typées contre leur interface de ligne : une colonne
 * renommée casse la compilation au lieu de renvoyer `undefined` en silence.
 */
export const TABLE_COLUMNS: Record<TableName, readonly string[]> = {
  criterion: CRITERION_COLUMNS,
  criterion_history: CRITERION_HISTORY_COLUMNS,
  evidence: EVIDENCE_COLUMNS,
  attestation: ATTESTATION_COLUMNS,
  waiver: WAIVER_COLUMNS,
  test_run: TEST_RUN_COLUMNS,
  test_result: TEST_RESULT_COLUMNS,
  test_link: TEST_LINK_COLUMNS,
  coverage: COVERAGE_COLUMNS,
  settings: SETTINGS_COLUMNS,
  living_proof: LIVING_PROOF_COLUMNS,
  release_dossier: RELEASE_DOSSIER_COLUMNS,
};

/**
 * Mots réservés MySQL/TiDB employés comme noms de colonne : `commit` (SPEC §4,
 * principe 4) et `reference` (SPEC §9.1). Sans backticks, le DDL et le SELECT
 * sont rejetés par la politique de requête Forge (R4 §1.6).
 */
const RESERVED_COLUMNS: ReadonlySet<string> = new Set(['commit', 'reference']);

function quoteColumn(column: string): string {
  return RESERVED_COLUMNS.has(column) ? `\`${column}\`` : column;
}

/** Liste de colonnes prête pour `SELECT`/`INSERT`, mots réservés requotés. */
export function selectColumns(table: TableName): string {
  return TABLE_COLUMNS[table].map(quoteColumn).join(', ');
}

/** Les `?` d'un `INSERT` de cette table, dans l'ordre de `selectColumns`. */
export function insertPlaceholders(table: TableName): string {
  return TABLE_COLUMNS[table].map(() => '?').join(', ');
}
