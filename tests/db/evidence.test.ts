/**
 * Tests de l'adaptateur SQL des preuves (SPEC §18, §9, §8.4, docs/CONTRACTS.md §4).
 *
 * L'adaptateur est testé contre un faux `SqlClient` local qui enregistre les
 * requêtes et rejoue des lignes préparées : `tests/helpers/` est gelé et ne
 * fournit pas de faux SQL (besoin signalé en CONTRACT-CHANGE). Les lignes
 * fixtures viennent du mapping gelé (`evidenceToRow`, `attestationToRow`) et
 * des builders partagés — zéro duplication.
 *
 * Règles vérifiées : aucune requête sans WHERE, aucune liste sans LIMIT,
 * écritures rejouables (upsert), jamais de suppression (SPEC §20), paramètres
 * positionnels dans l'ordre des colonnes du mapping.
 */
import { describe, expect, it } from 'vitest';
import { createEvidenceStore, EVIDENCE_LIST_LIMIT } from '../../src/db/evidence.js';
import type { SqlClient, SqlParam } from '../../src/db/sql-client.js';
import {
  ATTESTATION_COLUMNS,
  EVIDENCE_COLUMNS,
  attestationToRow,
  evidenceToRow,
  type AttestationRow,
  type EvidenceRow,
} from '../../src/db/mapping.js';
import { anAttestation, anEvidence } from '../helpers/builders.js';

/* ------------------------------------------------------------- faux SQL */

interface SqlCall {
  readonly statement: string;
  readonly params: readonly SqlParam[];
}

interface FakeSql extends SqlClient {
  readonly calls: SqlCall[];
  /** Résponses SELECT successives ; vide par défaut. */
  readonly queue: unknown[][];
  /** Compteur rendu par le prochain `execute`. */
  affected: number;
  last(): SqlCall;
  statements(): string[];
}

function createFakeSql(): FakeSql {
  const calls: SqlCall[] = [];
  const queue: unknown[][] = [];
  const fake: FakeSql = {
    calls,
    queue,
    affected: 0,
    async query<Row>(statement: string, params: readonly SqlParam[] = []): Promise<Row[]> {
      calls.push({ statement, params });
      return (queue.shift() ?? []) as Row[];
    },
    async execute(statement: string, params: readonly SqlParam[] = []) {
      calls.push({ statement, params });
      return fake.affected;
    },
    last() {
      const call = calls[calls.length - 1];
      if (!call) throw new Error('aucun appel SQL enregistré');
      return call;
    },
    statements() {
      return calls.map((call) => call.statement);
    },
  };
  return fake;
}

const EVIDENCE = anEvidence();
const EVIDENCE_ROW: EvidenceRow = evidenceToRow(EVIDENCE);
const ATTESTATION = anAttestation();
const ATTESTATION_ROW: AttestationRow = attestationToRow(ATTESTATION);

/* ------------------------------------------------------------ lectures */

describe('getEvidence — lecture par identifiant', () => {
  it('rend la preuve mappée depuis sa ligne SQL', async () => {
    const sql = createFakeSql();
    sql.queue.push([EVIDENCE_ROW]);
    const store = createEvidenceStore(sql);
    const found = await store.getEvidence(EVIDENCE.id);
    expect(found).toEqual(EVIDENCE);
    expect(sql.last().params).toEqual([EVIDENCE.id]);
    expect(sql.last().statement).toContain('WHERE id = ?');
    expect(sql.last().statement).toContain('LIMIT 1');
  });

  it('rend null quand la ligne est absente, jamais d’exception', async () => {
    const sql = createFakeSql();
    const store = createEvidenceStore(sql);
    expect(await store.getEvidence('ev-inconnue')).toBeNull();
  });
});

describe('listes — bornées, filtrées, triées (CONTRACTS §4)', () => {
  it('liste les preuves d’un critère avec WHERE, ORDER BY et LIMIT', async () => {
    const sql = createFakeSql();
    sql.queue.push([EVIDENCE_ROW]);
    const store = createEvidenceStore(sql);
    const rows = await store.listEvidencesByCriterion('crit-1');
    expect(rows).toEqual([EVIDENCE]);
    const { statement, params } = sql.last();
    expect(statement).toContain('WHERE criterion_id = ?');
    expect(statement).toContain('ORDER BY');
    expect(statement).toContain(`LIMIT ${EVIDENCE_LIST_LIMIT}`);
    expect(params).toEqual(['crit-1']);
  });

  it('liste par ticket en deux requêtes : critères puis preuves', async () => {
    const sql = createFakeSql();
    sql.queue.push([{ id: 'crit-1' }, { id: 'crit-2' }]);
    sql.queue.push([EVIDENCE_ROW]);
    const store = createEvidenceStore(sql);
    const rows = await store.listEvidencesByIssue('10001');
    expect(rows).toEqual([EVIDENCE]);
    expect(sql.calls).toHaveLength(2);
    expect(sql.calls[0].statement).toContain('FROM criterion WHERE issue_id = ?');
    expect(sql.calls[1].statement).toContain('criterion_id IN (?, ?)');
    expect(sql.calls[1].params).toEqual(['crit-1', 'crit-2']);
  });

  it('un ticket sans critères rend une liste vide sans seconde requête', async () => {
    const sql = createFakeSql();
    sql.queue.push([]);
    const store = createEvidenceStore(sql);
    expect(await store.listEvidencesByIssue('10001')).toEqual([]);
    expect(sql.calls).toHaveLength(1);
  });

  it('liste les preuves de test par nom, colonne réservée requotée', async () => {
    const sql = createFakeSql();
    sql.queue.push([EVIDENCE_ROW]);
    const store = createEvidenceStore(sql);
    await store.listEvidencesByTestName(EVIDENCE.reference);
    const { statement, params } = sql.last();
    expect(statement).toContain("type = 'test'");
    expect(statement).toContain('`reference` = ?');
    expect(params).toEqual([EVIDENCE.reference]);
  });

  it('liste les attestations d’un critère, bornées et triées', async () => {
    const sql = createFakeSql();
    sql.queue.push([ATTESTATION_ROW]);
    const store = createEvidenceStore(sql);
    const rows = await store.listAttestations('crit-1');
    expect(rows).toEqual([ATTESTATION]);
    const { statement, params } = sql.last();
    expect(statement).toContain('FROM attestation');
    expect(statement).toContain('WHERE criterion_id = ?');
    expect(statement).toContain(`LIMIT ${EVIDENCE_LIST_LIMIT}`);
    expect(params).toEqual(['crit-1']);
  });
});

/* ------------------------------------------------------------ écritures */

describe('saveEvidence — upsert rejouable, jamais de suppression (SPEC §20)', () => {
  it('insère dans l’ordre exact des colonnes du mapping gelé', async () => {
    const sql = createFakeSql();
    const store = createEvidenceStore(sql);
    await store.saveEvidence(EVIDENCE);
    const { statement, params } = sql.last();
    expect(statement).toContain('INSERT INTO evidence');
    expect(statement).toContain('ON DUPLICATE KEY UPDATE');
    expect(params).toEqual(EVIDENCE_COLUMNS.map((column) => EVIDENCE_ROW[column]));
  });

  it('requote les colonnes réservées dans l’upsert', async () => {
    const sql = createFakeSql();
    const store = createEvidenceStore(sql);
    await store.saveEvidence(EVIDENCE);
    expect(sql.last().statement).toContain('`commit` = VALUES(`commit`)');
    expect(sql.last().statement).toContain('`reference` = VALUES(`reference`)');
  });

  it('deux écritures successives rejouent la même requête (idempotence)', async () => {
    const sql = createFakeSql();
    const store = createEvidenceStore(sql);
    await store.saveEvidence(EVIDENCE);
    await store.saveEvidence(EVIDENCE);
    expect(sql.calls[0].statement).toBe(sql.calls[1].statement);
    expect(sql.calls[0].params).toEqual(sql.calls[1].params);
  });

  it('le remplacement d’une preuve reste une écriture : aucun DELETE', async () => {
    const sql = createFakeSql();
    const store = createEvidenceStore(sql);
    await store.saveEvidence(EVIDENCE);
    await store.saveEvidence({ ...EVIDENCE, replacedBy: 'ev-2', freshness: 'stale' });
    for (const statement of sql.statements()) {
      expect(statement).not.toMatch(/\b(DELETE|DROP|TRUNCATE)\b/i);
    }
  });
});

describe('addAttestation — écriture signée, jamais supprimée', () => {
  it('insère l’attestation dans l’ordre des colonnes du mapping', async () => {
    const sql = createFakeSql();
    const store = createEvidenceStore(sql);
    await store.addAttestation(ATTESTATION);
    const { statement, params } = sql.last();
    expect(statement).toContain('INSERT INTO attestation');
    expect(statement).toContain('ON DUPLICATE KEY UPDATE');
    expect(params).toEqual(ATTESTATION_COLUMNS.map((column) => ATTESTATION_ROW[column]));
  });
});

describe('markEvidencesToReconfirm — péremption après changement (SPEC §8.4, FP-13)', () => {
  it('ne touche que les preuves fraîches des versions antérieures', async () => {
    const sql = createFakeSql();
    sql.affected = 3;
    const store = createEvidenceStore(sql);
    const touched = await store.markEvidencesToReconfirm('crit-1', 2);
    expect(touched).toBe(3);
    const { statement, params } = sql.last();
    expect(statement).toContain("SET freshness = 'to-reconfirm'");
    expect(statement).toContain('WHERE criterion_id = ? AND criterion_version < ?');
    expect(statement).toContain("freshness = 'fresh'");
    expect(params).toEqual(['crit-1', 2]);
  });
});

/* ------------------------------------------------- règles dures du socle */

describe('règles dures de la persistance (CONTRACTS §4, SPEC §20)', () => {
  it('aucune requête sans WHERE, aucune liste sans LIMIT', async () => {
    const sql = createFakeSql();
    sql.queue.push([], [{ id: 'crit-1' }], [EVIDENCE_ROW], [ATTESTATION_ROW]);
    const store = createEvidenceStore(sql);
    await store.listEvidencesByCriterion('crit-1');
    await store.listEvidencesByIssue('10001');
    await store.getEvidence('ev-1');
    await store.listAttestations('crit-1');
    await store.listEvidencesByTestName('un test');
    for (const statement of sql.statements()) {
      expect(statement.toUpperCase()).toContain('WHERE');
      expect(statement.toUpperCase()).toContain('LIMIT');
    }
  });

  it('n’émet jamais DELETE, DROP ni TRUNCATE', async () => {
    const sql = createFakeSql();
    sql.queue.push([]);
    sql.affected = 1;
    const store = createEvidenceStore(sql);
    await store.saveEvidence(EVIDENCE);
    await store.addAttestation(ATTESTATION);
    await store.markEvidencesToReconfirm('crit-1', 2);
    await store.listEvidencesByIssue('10001');
    for (const statement of sql.statements()) {
      expect(statement).not.toMatch(/\b(DELETE|DROP|TRUNCATE)\b/i);
    }
  });
});
