/**
 * Adaptateur SQL des agrégats : statistiques et dossier de preuve (SPEC §14
 * FP-17/FP-18, §18).
 *
 * Ce que ces tests garantissent :
 * - les agrégats viennent de requêtes bornées (`WHERE` + `LIMIT`) et du
 *   préfixe de clé de projet, seul discriminant disponible dans le schéma ;
 * - une lecture sans ligne rend `null` ou des compteurs à zéro, jamais une
 *   exception (SPEC §20, R4 §6.3) ;
 * - l'écriture du dossier est rejouable (`INSERT … ON DUPLICATE KEY UPDATE`) :
 *   un dossier régénéré remplace l'instantané, il n'en crée pas un second.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createReportingStore, REPORTING_LIST_LIMIT } from '../../src/db/reporting.js';
import { coverageToRow, releaseDossierToRow, waiverToRow } from '../../src/db/mapping.js';
import { coverage, dossier, waiver } from './fixtures.js';
import { allSelectsBounded, allWritesReplayable, createFakeSql, type FakeSql } from './links-sql-fake.js';

const PROJECT_KEY = 'PAY';
const SINCE = '2026-11-01T00:00:00.000Z';

describe('db/reporting — statistiques (FP-18)', () => {
  let sql: FakeSql;

  beforeEach(() => {
    sql = createFakeSql();
  });

  it('agrège la couverture par force depuis les lignes de couverture', async () => {
    sql.scriptRows([coverageToRow(coverage())]);
    sql.scriptRows([]);
    sql.scriptRows([{ n: 0 }]);
    const store = createReportingStore(sql);

    const stats = await store.computeStats(PROJECT_KEY, SINCE);

    expect(stats.projectId).toBe(PROJECT_KEY);
    expect(stats.since).toBe(SINCE);
    expect(stats.coverageByStrength['machine-verified']).toBe(2);
    expect(stats.coverageByStrength.attested).toBe(0);
    expect(stats.coverageByStrength.declared).toBe(0);
  });

  it('filtre les couvertures par préfixe de clé de projet, borné', async () => {
    const store = createReportingStore(sql);
    await store.computeStats(PROJECT_KEY, SINCE);

    const call = sql.selects()[0];
    expect(call?.statement).toContain('FROM coverage WHERE issue_key LIKE ?');
    expect(call?.statement).toContain(`LIMIT ${REPORTING_LIST_LIMIT}`);
    expect(call?.params).toEqual(['PAY-%']);
  });

  it('compte les dérogations par signataire depuis `since`', async () => {
    sql.scriptRows([]);
    sql.scriptRows([waiverToRow(waiver()), waiverToRow(waiver({ id: 'wai-2' }))]);
    sql.scriptRows([{ n: 0 }]);
    const store = createReportingStore(sql);

    const stats = await store.computeStats(PROJECT_KEY, SINCE);

    expect(stats.waiversByGranter).toEqual([
      { accountId: 'user-pa', displayName: 'user-pa', count: 2 },
    ]);
    const call = sql.selects()[1];
    expect(call?.statement).toContain('FROM waiver');
    expect(call?.statement).toContain('at >= ?');
    expect(call?.params[0]).toBe('2026-11-01 00:00:00.000');
  });

  it('ignore une dérogation révoquée dans le compteur par personne', async () => {
    sql.scriptRows([]);
    sql.scriptRows([waiverToRow(waiver({ revokedAt: '2026-11-09T00:00:00.000Z' }))]);
    sql.scriptRows([{ n: 0 }]);
    const store = createReportingStore(sql);

    const stats = await store.computeStats(PROJECT_KEY, SINCE);
    expect(stats.waiversByGranter).toEqual([]);
  });

  it('compte les tickets dont la couverture ne passe pas le validateur', async () => {
    sql.scriptRows([]);
    sql.scriptRows([]);
    sql.scriptRows([{ n: '3' }]);
    const store = createReportingStore(sql);

    const stats = await store.computeStats(PROJECT_KEY, SINCE);
    expect(stats.closedWithoutValidator).toBe(3);
  });

  it('rend des statistiques vides, jamais une exception, quand rien ne correspond', async () => {
    const store = createReportingStore(sql);

    const stats = await store.computeStats('VIDE', SINCE);

    expect(stats.coverageByStrength).toEqual({ declared: 0, attested: 0, 'machine-verified': 0 });
    expect(stats.waiversByGranter).toEqual([]);
    expect(stats.closedWithoutValidator).toBe(0);
    expect(stats.reopenings).toEqual([]);
    expect(allSelectsBounded(sql)).toBe(true);
  });
});

describe('db/reporting — dossier de preuve (FP-17)', () => {
  let sql: FakeSql;

  beforeEach(() => {
    sql = createFakeSql();
  });

  it('relit le dossier figé d’une version, tickets et totaux compris', async () => {
    sql.scriptRows([
      releaseDossierToRow(
        dossier({
          issues: [
            {
              issueKey: 'PAY-123',
              summary: 'Refuser un paiement',
              total: 4,
              proven: 3,
              waived: 1,
              waivers: [waiver()],
              criteria: [],
            },
          ],
        }),
      ),
    ]);
    const store = createReportingStore(sql);

    const read = await store.getDossier('ver-24');

    expect(read?.versionName).toBe('2.4');
    expect(read?.issues[0]?.issueKey).toBe('PAY-123');
    expect(read?.issues[0]?.waivers[0]?.reason).toBe('reporté dans PAY-140');
    expect(sql.selects()[0]?.params).toEqual(['ver-24']);
  });

  it('rend `null` pour une version sans dossier', async () => {
    const store = createReportingStore(sql);
    expect(await store.getDossier('inconnue')).toBeNull();
  });

  it('écrit le dossier en upsert rejouable, instantané sérialisé', async () => {
    const store = createReportingStore(sql);

    await store.saveDossier(dossier());

    const write = sql.writes()[0];
    expect(write?.statement).toContain('INSERT INTO release_dossier');
    expect(write?.statement).toContain('ON DUPLICATE KEY UPDATE');
    expect(write?.params[0]).toBe('ver-24');
    expect(write?.params[4]).toContain('PAY-123');
    expect(allWritesReplayable(sql)).toBe(true);
  });

  it('garde toutes les lectures bornées', async () => {
    const store = createReportingStore(sql);
    await store.computeStats(PROJECT_KEY, SINCE);
    await store.getDossier('ver-24');

    expect(allSelectsBounded(sql)).toBe(true);
  });
});
