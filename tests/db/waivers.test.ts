/**
 * Tests de l'adaptateur SQL `waivers` (SPEC §12.4, §18, §20).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { createFakeSqlClient } from './fake-sql-l3.js';
import { waiver } from './fixtures.js';
import { createWaiverStore } from '../../src/db/waivers.js';
import { waiverToRow } from '../../src/db/mapping-evidence.js';

describe('db/waivers — lecture des dérogations', () => {
  it('liste les dérogations d’un critère', async () => {
    const sql = createFakeSqlClient();
    sql.scriptRows([waiverToRow(waiver())]);
    const store = createWaiverStore(sql);

    const found = await store.listWaiversByCriterion('crit-ac4');
    expect(found).toEqual([waiver()]);
    expect(sql.calls[0]?.statement).toContain('FROM waiver');
    expect(sql.calls[0]?.statement).toContain('WHERE criterion_id = ?');
    expect(sql.calls[0]?.params).toEqual(['crit-ac4']);
  });

  it('liste les dérogations d’un ticket via une jointure sur les critères', async () => {
    const sql = createFakeSqlClient();
    sql.scriptRows([waiverToRow(waiver())]);
    const store = createWaiverStore(sql);

    const found = await store.listWaiversByIssue('10001');
    expect(found).toHaveLength(1);
    expect(sql.calls[0]?.statement).toContain('JOIN criterion c ON c.id = w.criterion_id');
    expect(sql.calls[0]?.params).toEqual(['10001']);
  });

  it('borne les listes par projet avec LIMIT, en cherchant par clé de projet', async () => {
    const sql = createFakeSqlClient();
    sql.scriptRows([]);
    await createWaiverStore(sql).listWaiversByProject('PAY', '2026-11-01 00:00:00');

    const call = sql.calls[0];
    expect(call?.statement).toContain('LIMIT 500');
    // Les tickets du projet sont ceux dont la couverture commence par la clé :
    // un id de ticket Jira ('66653') ne porte aucun préfixe de projet.
    expect(call?.statement).toContain("cov.issue_key LIKE ?");
    expect(call?.params).toEqual(['PAY-%', '2026-11-01 00:00:00']);
  });
});

describe('db/waivers — écriture et révocation (SPEC §20)', () => {
  it('écrit en upsert une dérogation, sans jamais supprimer', async () => {
    const sql = createFakeSqlClient();
    const fixture = waiver();

    await createWaiverStore(sql).saveWaiver(fixture);

    const call = sql.calls[0];
    expect(call?.statement).toContain('INSERT INTO waiver');
    expect(call?.statement).toContain('ON DUPLICATE KEY UPDATE');
    expect(call?.params).toHaveLength(8);
    expect(call?.params?.[4]).toBe('reporté dans PAY-140');
  });

  it('révoque en posant revoked_at, seulement si pas déjà révoquée', async () => {
    const sql = createFakeSqlClient();
    sql.scriptAffected(1);
    const store = createWaiverStore(sql);

    const ok = await store.revokeWaiver('wai-1', '2026-11-11T12:00:00.000Z');
    expect(ok).toBe(true);

    const call = sql.calls[0];
    expect(call?.statement).toContain('UPDATE waiver');
    expect(call?.statement).toContain('SET revoked_at = ?');
    expect(call?.statement).toContain("WHERE id = ? AND revoked_at = ''");
    expect(call?.params).toEqual(['2026-11-11T12:00:00.000Z', 'wai-1']);
  });

  it('une révocation sans effet rend false', async () => {
    const sql = createFakeSqlClient();
    sql.scriptAffected(0);
    expect(await createWaiverStore(sql).revokeWaiver('wai-1', '2026-11-11T12:00:00.000Z')).toBe(false);
  });
});
