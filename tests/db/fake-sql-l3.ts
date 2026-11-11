/**
 * Faux `SqlClient` du lot L3 : enregistre chaque requête et rejoue des
 * réponses scriptées (docs/CONTRACTS.md §4 — la zone `tests/helpers/` est
 * gelée et n'en fournit pas ; chaque lot de persistance a le sien, à
 * factoriser quand la zone s'ouvrira).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient, SqlParam } from '../../src/db/sql-client.js';

export interface RecordedCall {
  kind: 'query' | 'execute';
  statement: string;
  params: readonly SqlParam[];
}

export interface FakeSqlClient extends SqlClient {
  /** Tous les appels, dans l'ordre. */
  readonly calls: RecordedCall[];
  /** Programme les lignes rendues par le prochain `query`. */
  scriptRows(rows: readonly unknown[]): FakeSqlClient;
  /** Programme le nombre de lignes touchées par le prochain `execute`. */
  scriptAffected(count: number): FakeSqlClient;
  /** Les SELECT enregistrés, pour vérifier WHERE/LIMIT (CONTRACTS §4). */
  selects(): string[];
  /** Toutes les requêtes enregistrées, jointes pour les assertions globales. */
  all(): string;
}

export function createFakeSqlClient(): FakeSqlClient {
  const calls: RecordedCall[] = [];
  const rowsQueue: unknown[][] = [];
  const affectedQueue: number[] = [];
  const client: FakeSqlClient = {
    calls,
    scriptRows(rows) {
      rowsQueue.push([...rows]);
      return client;
    },
    scriptAffected(count) {
      affectedQueue.push(count);
      return client;
    },
    selects() {
      return calls.filter((call) => call.kind === 'query').map((call) => call.statement);
    },
    all() {
      return calls.map((call) => call.statement).join('\n');
    },
    async query<Row>(statement: string, params: readonly SqlParam[] = []): Promise<Row[]> {
      calls.push({ kind: 'query', statement, params });
      return (rowsQueue.shift() ?? []) as Row[];
    },
    async execute(statement: string, params: readonly SqlParam[] = []): Promise<number> {
      calls.push({ kind: 'execute', statement, params });
      return affectedQueue.shift() ?? 1;
    },
  };
  return client;
}
