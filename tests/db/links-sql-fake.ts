/**
 * Faux `SqlClient` pour les tests des adaptateurs du lot L7.
 *
 * Il n'exécute aucun SQL (Forge SQL n'a pas de moteur embarqué) : il enregistre
 * les énoncés et paramètres réellement produits par `src/db/{links,reporting}.ts`
 * et rend des lignes scriptées comme le ferait Forge.
 *
 * Ce faux vit dans le périmètre du lot L7 (`tests/db/links*`) : `tests/helpers/**`
 * est gelé, aucun lot n'y écrit. Il est partagé par `links.test.ts` et
 * `reporting.test.ts` — zéro duplication.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient, SqlParam } from '../../src/db/sql-client.js';

/** Un appel SQL enregistré : nature, énoncé, paramètres. */
export interface SqlCall {
  readonly kind: 'query' | 'execute';
  readonly statement: string;
  readonly params: readonly SqlParam[];
}

export interface FakeSql extends SqlClient {
  /** Tous les appels, dans l'ordre. */
  readonly calls: SqlCall[];
  /** Les appels dont l'énoncé contient `fragment`. */
  callsContaining(fragment: string): SqlCall[];
  /** Les SELECT enregistrés. */
  selects(): SqlCall[];
  /** Les écritures enregistrées. */
  writes(): SqlCall[];
  /** File de réponses `query`, consommée dans l'ordre (FIFO). */
  scriptRows(rows: readonly unknown[]): FakeSql;
  /** Réponse `query` par défaut quand la file est vide. */
  setDefaultRows(rows: readonly unknown[]): FakeSql;
  /** Nombre de lignes affectées rendu par `execute` (défaut : 1). */
  setAffectedRows(count: number): FakeSql;
}

export function createFakeSql(): FakeSql {
  const calls: SqlCall[] = [];
  const scripted: unknown[][] = [];
  let defaultRows: readonly unknown[] = [];
  let affectedRows = 1;

  const sql: FakeSql = {
    calls,
    callsContaining(fragment) {
      return calls.filter((call) => call.statement.includes(fragment));
    },
    selects() {
      return calls.filter((call) => /\bSELECT\b/i.test(call.statement));
    },
    writes() {
      return calls.filter((call) => call.kind === 'execute');
    },
    async query<Row>(statement: string, params: readonly SqlParam[] = []): Promise<Row[]> {
      calls.push({ kind: 'query', statement, params });
      const next = scripted.shift() ?? defaultRows;
      return [...next] as Row[];
    },
    async execute(statement: string, params: readonly SqlParam[] = []): Promise<number> {
      calls.push({ kind: 'execute', statement, params });
      return affectedRows;
    },
    scriptRows(rows) {
      scripted.push([...rows]);
      return sql;
    },
    setDefaultRows(rows) {
      defaultRows = [...rows];
      return sql;
    },
    setAffectedRows(count) {
      affectedRows = count;
      return sql;
    },
  };
  return sql;
}

/** Vrai si chaque `SELECT` enregistré porte un `WHERE` et un `LIMIT`. */
export function allSelectsBounded(sql: FakeSql): boolean {
  return sql
    .selects()
    .every((call) => /\bWHERE\b/i.test(call.statement) && /\bLIMIT\b/i.test(call.statement));
}

/** Vrai si chaque écriture enregistrée est rejouable (upsert à clé). */
export function allWritesReplayable(sql: FakeSql): boolean {
  return sql
    .writes()
    .every((call) => /\bON DUPLICATE KEY UPDATE\b/i.test(call.statement));
}
