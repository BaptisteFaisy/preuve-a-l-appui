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

/**
 * Compte les `?` d'un énoncé, en ignorant ceux qui sont dans une chaîne
 * littérale. Forge SQL lie les paramètres positionnellement : un nombre de
 * paramètres différent du nombre de `?` fait échouer l'écriture en production
 * (`Unknown SQL execution error`, sans détail) — le double doit crier au même
 * endroit, sinon le bogue reste invisible jusqu'au déploiement.
 */
export function countPlaceholders(statement: string): number {
  let count = 0;
  let inString = false;
  for (let i = 0; i < statement.length; i += 1) {
    const char = statement[i];
    if (char === "'") {
      inString = !inString;
      continue;
    }
    if (!inString && char === '?') count += 1;
  }
  return count;
}

/** Crie si le nombre de paramètres ne correspond pas aux `?` de l'énoncé. */
export function assertBound(statement: string, params: readonly SqlParam[]): void {
  const expected = countPlaceholders(statement);
  if (expected === params.length) return;
  throw new Error(
    `SQL : ${params.length} paramètre(s) lié(s) pour ${expected} « ? » — Forge SQL refuse ` +
      `l'écriture. Énoncé : ${statement.replace(/\s+/g, ' ').slice(0, 150)}`,
  );
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
      assertBound(statement, params);
      const next = queue.shift() ?? defaultRows;
      return [...next] as Row[];
    },
    async execute(statement: string, params: readonly SqlParam[] = []): Promise<number> {
      calls.push({ kind: 'execute', statement, params });
      assertBound(statement, params);
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
