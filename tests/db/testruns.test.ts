/**
 * Tests de persistance : test_run et test_result (SPEC §10, §18).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { createTestRunStore, TEST_RESULTS_LIMIT } from '../../src/db/testruns.js';
import { allSelectsBounded, createFakeSql } from './sql-fake.js';
import { aTestOutcome, aTestRun, COMMIT, REPO, BRANCH } from '../helpers/builders.js';

describe('createTestRunStore', () => {
  it('enregistre un run avec un upsert idempotent', async () => {
    const sql = createFakeSql();
    const store = createTestRunStore(sql);
    const run = aTestRun();

    await store.saveTestRun(run);

    expect(sql.calls).toHaveLength(1);
    expect(sql.calls[0].kind).toBe('execute');
    expect(sql.calls[0].statement).toContain('INSERT INTO test_run');
    expect(sql.calls[0].statement).toContain('ON DUPLICATE KEY UPDATE');
  });

  it('lit un run par son identifiant avec une requête bornée', async () => {
    const sql = createFakeSql();
    const store = createTestRunStore(sql);
    sql.scriptRows([
      {
        id: 'run-1',
        repo: REPO,
        branch: BRANCH,
        commit: COMMIT,
        main_branch: 0,
        received_at: '2026-11-11 08:00:00.000',
      },
    ]);

    const run = await store.getTestRun('run-1');
    expect(run?.id).toBe('run-1');
    expect(run?.repo).toBe(REPO);
    expect(allSelectsBounded(sql)).toBe(true);
  });

  it('rend null si le run est absent', async () => {
    const sql = createFakeSql();
    const store = createTestRunStore(sql);
    sql.scriptRows([]);

    const run = await store.getTestRun('run-none');
    expect(run).toBeNull();
  });

  it('ajoute des résultats de test avec INSERT IGNORE (rejouable)', async () => {
    const sql = createFakeSql();
    const store = createTestRunStore(sql);
    const outcomes = [aTestOutcome({ name: 't1' }), aTestOutcome({ name: 't2' })];

    const written = await store.addTestResults('run-1', outcomes);
    expect(written).toBe(2);
    expect(sql.calls.every((c) => c.statement.includes('INSERT IGNORE INTO test_result'))).toBe(true);
  });

  it('liste les résultats d’un run avec une limite', async () => {
    const sql = createFakeSql();
    const store = createTestRunStore(sql);
    sql.scriptRows([
      { run_id: 'run-1', test_name: 'test A', state: 'passed', duration_ms: 50 },
    ]);

    const results = await store.listTestResults('run-1');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('test A');
    expect(sql.calls[0].statement).toContain(`LIMIT ${TEST_RESULTS_LIMIT}`);
    expect(allSelectsBounded(sql)).toBe(true);
  });

  it('retrouve le dernier run d’une branche', async () => {
    const sql = createFakeSql();
    const store = createTestRunStore(sql);
    sql.scriptRows([
      {
        id: 'run-latest',
        repo: REPO,
        branch: BRANCH,
        commit: COMMIT,
        main_branch: 1,
        received_at: '2026-11-11 08:00:00.000',
      },
    ]);

    const run = await store.latestRunForBranch(REPO, BRANCH);
    expect(run?.id).toBe('run-latest');
    expect(run?.mainBranch).toBe(true);
    expect(allSelectsBounded(sql)).toBe(true);
  });

  it('latestOutcomesForBranch rend vide si aucun run n’existe', async () => {
    const sql = createFakeSql();
    const store = createTestRunStore(sql);
    sql.scriptRows([]); // premier query rend vide

    const outcomes = await store.latestOutcomesForBranch(REPO, BRANCH);
    expect(outcomes).toEqual([]);
  });
});
