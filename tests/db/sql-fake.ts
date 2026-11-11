/**
 * Faux SqlClient local au lot L4 (zone `tests/db/testruns*` et `tests/db/living*`).
 *
 * `tests/helpers/` étant gelé, chaque lot conserve son double de test dans sa
 * zone, sans modifier les fichiers partagés (voir la règle commune du dépôt).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient, SqlParam } from '../../src/db/sql-client.js';

export interface SqlCall {
  readonly kind: 'query' | 'execute';
  readonly statement: string;
  readonly params: readonly SqlParam[];
}

export interface FakeSql extends SqlClient {
  readonly calls: SqlCall[];
  scriptRows(rows: readonly unknown[]): FakeSql;
  setDefaultRows(rows: readonly unknown[]): FakeSql;
  setAffectedRows(count: number): FakeSql;
  clear(): FakeSql;
}

export function createFakeSql(): FakeSql {
  const calls: SqlCall[] = [];
  const queue: unknown[][] = [];
  let defaultRows: readonly unknown[] = [];
  let affectedRows = 1;

  const sql: FakeSql = {
    calls,
    async query<Row>(statement: string, params: readonly SqlParam[] = []): Promise<Row[]> {
      calls.push({ kind: 'query', statement, params });
      const next = queue.shift() ?? defaultRows;
      return [...next] as Row[];
    },
    async execute(statement: string, params: readonly SqlParam[] = []): Promise<number> {
      calls.push({ kind: 'execute', statement, params });
      return affectedRows;
    },
    scriptRows(rows) {
      queue.push([...rows]);
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
    clear() {
      calls.length = 0;
      queue.length = 0;
      defaultRows = [];
      affectedRows = 1;
      return sql;
    },
  };
  return sql;
}

export function allSelectsBounded(sql: FakeSql): boolean {
  return sql.calls
    .filter((call) => /\bSELECT\b/i.test(call.statement))
    .every((call) => /\bWHERE\b/i.test(call.statement) && /\bLIMIT\b/i.test(call.statement));
}
