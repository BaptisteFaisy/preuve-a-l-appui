/**
 * Tests de l'adaptateur SQL `coverage` (SPEC §18, docs/CONTRACTS.md §4).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { createFakeSqlClient } from './fake-sql-l3.js';
import { coverage } from './fixtures.js';
import { createCoverageStore } from '../../src/db/coverage.js';
import { coverageToRow } from '../../src/db/mapping-coverage.js';

describe('db/coverage — lecture de la ligne du validateur (SPEC §17)', () => {
  it('rend la couverture mappée depuis sa ligne SQL', async () => {
    const sql = createFakeSqlClient();
    sql.scriptRows([coverageToRow(coverage())]);
    const store = createCoverageStore(sql);

    const found = await store.getCoverage('10001');
    expect(found).toEqual(coverage());

    const call = sql.calls[0];
    expect(call?.statement).toContain('FROM coverage');
    expect(call?.statement).toContain('WHERE issue_id = ? OR issue_key = ?');
    expect(call?.statement).toContain('LIMIT 1');
    expect(call?.params).toEqual(['10001', '10001']);
  });

  it('rend null quand aucune ligne ne correspond', async () => {
    const sql = createFakeSqlClient();
    const store = createCoverageStore(sql);
    expect(await store.getCoverage('inconnu')).toBeNull();
  });
});

describe('db/coverage — écriture rejouable (SPEC §18, §20)', () => {
  it('écrit en upsert avec les colonnes dans l’ordre du mapping', async () => {
    const sql = createFakeSqlClient();
    const store = createCoverageStore(sql);
    const fixture = coverage();

    await store.saveCoverage(fixture);

    const call = sql.calls[0];
    expect(call?.kind).toBe('execute');
    expect(call?.statement).toContain('INSERT INTO coverage');
    expect(call?.statement).toContain('ON DUPLICATE KEY UPDATE');
    expect(call?.params).toHaveLength(11);
    expect(call?.params?.[0]).toBe(fixture.issueId);
    expect(call?.params?.[1]).toBe(fixture.issueKey);
  });

  it('sérialise les booléens en 0/1 et les listes en JSON texte', async () => {
    const sql = createFakeSqlClient();
    await createCoverageStore(sql).saveCoverage(coverage());

    const params = sql.calls[0]?.params ?? [];
    expect(params[6]).toBe(0); // passes = false
    expect(params[7]).toBe(1); // would_block = true
    expect(String(params[8]).startsWith('[')).toBe(true); // blocking_json
    expect(String(params[9]).startsWith('[')).toBe(true); // criteria_json
  });

  it('écrit la date au format Forge SQL', async () => {
    const sql = createFakeSqlClient();
    await createCoverageStore(sql).saveCoverage(coverage());
    expect(sql.calls[0]?.params?.[10]).toBe('2026-11-11 10:10:00.000');
  });
});

describe('db/coverage — contrôle nocturne (SPEC §20)', () => {
  it('borne la liste des tickets clos non couverts par projet', async () => {
    const sql = createFakeSqlClient();
    sql.scriptRows([{ issue_id: 'PAY-999' }, { issue_id: 'PAY-998' }]);

    const missed = await createCoverageStore(sql).listClosedWithoutCoverage('PAY', 10);
    expect(missed).toEqual(['PAY-999', 'PAY-998']);

    const call = sql.calls[0];
    expect(call?.statement).toContain('passes = 0');
    expect(call?.statement).toContain('LIMIT 10');
    expect(call?.params).toEqual(['PAY-%', 'PAY-%']);
  });

  it('un projet vide audite toutes les lignes non passées', async () => {
    const sql = createFakeSqlClient();
    sql.scriptRows([]);
    await createCoverageStore(sql).listClosedWithoutCoverage('', 5);

    const call = sql.calls[0];
    expect(call?.params).toEqual([]);
    expect(call?.statement).toContain('WHERE passes = 0');
    expect(call?.statement).toContain('LIMIT 5');
  });

  it('borne la limite entre 1 et 500', async () => {
    const sql = createFakeSqlClient();
    sql.scriptRows([]);
    await createCoverageStore(sql).listClosedWithoutCoverage('PAY', 0);
    expect(sql.calls[0]?.statement).toContain('LIMIT 1');

    sql.scriptRows([]);
    await createCoverageStore(sql).listClosedWithoutCoverage('PAY', 9999);
    expect(sql.calls[1]?.statement).toContain('LIMIT 500');
  });

  it('toute requête porte un WHERE et un LIMIT (CONTRACTS §4)', async () => {
    const sql = createFakeSqlClient();
    sql.scriptRows([]).scriptRows([]);
    const store = createCoverageStore(sql);
    await store.getCoverage('10001');
    await store.listClosedWithoutCoverage('PAY', 10);

    for (const select of sql.selects()) {
      expect(select).toMatch(/WHERE/);
      expect(select).toMatch(/LIMIT/);
    }
  });
});
