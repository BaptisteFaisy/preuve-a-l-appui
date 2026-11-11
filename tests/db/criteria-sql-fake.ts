/**
 * Faux `SqlClient` : enregistre les requêtes et rend des réponses scriptées.
 *
 * Il n'exécute **aucun** SQL (Forge SQL n'a pas de moteur embarqué) : il sert
 * à vérifier ce que les adaptateurs de `src/db/*` écrivent vraiment —
 * énoncés bornés (`WHERE` + `LIMIT`), écritures rejouables
 * (`INSERT … ON DUPLICATE KEY UPDATE`), paramètres dans l'ordre des colonnes —
 * et à relire des lignes brutes comme le ferait Forge.
 *
 * Ce faux vit dans le périmètre du lot L1 (`tests/db/criteria*`,
 * docs/CONTRACTS.md §2) : `tests/helpers/**` est gelé, aucun lot n'y écrit.
 * Sa place naturelle à terme est le harness partagé — voir la mention
 * `CONTRACT-CHANGE` de la PR du lot. Aucun import `@forge/*`.
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
  /** File de réponses `query`, consommée dans l'ordre (FIFO). */
  scriptRows(rows: readonly unknown[]): FakeSql;
  /** Réponse `query` par défaut quand la file est vide. */
  setDefaultRows(rows: readonly unknown[]): FakeSql;
  /** Nombre de lignes affectées rendu par `execute` (défaut : 1). */
  setAffectedRows(count: number): FakeSql;
  /** Vide files et journal entre deux tests. */
  clear(): FakeSql;
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
    clear() {
      calls.length = 0;
      scripted.length = 0;
      defaultRows = [];
      affectedRows = 1;
      return sql;
    },
  };
  return sql;
}

/** Vrai si chaque `SELECT` enregistré porte un `WHERE` et un `LIMIT`. */
export function allSelectsBounded(sql: FakeSql): boolean {
  return sql.calls
    .filter((call) => /\bSELECT\b/i.test(call.statement))
    .every((call) => /\bWHERE\b/i.test(call.statement) && /\bLIMIT\b/i.test(call.statement));
}

/** Vrai si chaque écriture enregistrée est rejouable (upsert à clé). */
export function allWritesReplayable(sql: FakeSql): boolean {
  return sql.calls
    .filter((call) => call.kind === 'execute')
    .every(
      (call) =>
        /\bON DUPLICATE KEY UPDATE\b/i.test(call.statement) ||
        /\bINSERT IGNORE\b/i.test(call.statement),
    );
}
