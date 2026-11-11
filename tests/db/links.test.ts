/**
 * Adaptateur SQL des paires test ↔ critère (SPEC §11, §18, table `test_link`).
 *
 * Ce que ces tests garantissent :
 * - une paire **proposée** n'est jamais servie comme preuve : seule
 *   `listConfirmedLinksByTest` retient `status = 'confirmed'` (SPEC §11) ;
 * - toute requête est bornée (`WHERE` + `LIMIT`), toute écriture est rejouable
 *   (`INSERT … ON DUPLICATE KEY UPDATE`) ;
 * - les paramètres suivent l'ordre des colonnes, mots réservés compris.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestLinkStore, TEST_LINK_LIST_LIMIT } from '../../src/db/links.js';
import { testLinkToRow } from '../../src/db/mapping-ci.js';
import { aTestLink, TEST_REFUSAL } from '../helpers/builders.js';
import { allSelectsBounded, allWritesReplayable, createFakeSql, type FakeSql } from './links-sql-fake.js';

describe('db/links — lecture des paires', () => {
  let sql: FakeSql;

  beforeEach(() => {
    sql = createFakeSql();
  });

  it('lit les paires d’un critère, bornées et triées', async () => {
    sql.scriptRows([testLinkToRow(aTestLink())]);
    const store = createTestLinkStore(sql);

    const links = await store.listLinksByCriterion('crit-1');

    expect(links).toHaveLength(1);
    expect(links[0]?.testName).toBe(TEST_REFUSAL);
    const call = sql.selects()[0];
    expect(call?.statement).toContain('FROM test_link WHERE criterion_id = ?');
    expect(call?.statement).toContain(`LIMIT ${TEST_LINK_LIST_LIMIT}`);
    expect(call?.params).toEqual(['crit-1']);
  });

  it('ne retient que les paires confirmées pour un nom de test', async () => {
    const store = createTestLinkStore(sql);
    await store.listConfirmedLinksByTest(TEST_REFUSAL);

    const call = sql.selects()[0];
    expect(call?.statement).toContain('test_name = ?');
    expect(call?.statement).toContain("status = 'confirmed'");
    expect(call?.statement).toContain('LIMIT');
  });

  it('liste les propositions d’un ticket via ses critères', async () => {
    const store = createTestLinkStore(sql);
    await store.listProposedLinks('10001');

    const call = sql.selects()[0];
    expect(call?.statement).toContain("status = 'proposed'");
    expect(call?.statement).toContain('SELECT id FROM criterion WHERE issue_id = ?');
    expect(call?.params).toEqual(['10001']);
  });

  it('rend une liste vide quand aucune ligne ne correspond', async () => {
    const store = createTestLinkStore(sql);
    expect(await store.listLinksByCriterion('inconnu')).toEqual([]);
  });

  it('lit une ligne illisible comme une paire proposée, jamais confirmée', async () => {
    sql.scriptRows([
      { ...testLinkToRow(aTestLink()), status: 'peut-être', confidence: '0.4' },
    ]);
    const store = createTestLinkStore(sql);

    const links = await store.listLinksByCriterion('crit-1');
    expect(links[0]?.status).toBe('proposed');
    expect(links[0]?.confidence).toBe(0.4);
  });
});

describe('db/links — écriture des paires', () => {
  let sql: FakeSql;

  beforeEach(() => {
    sql = createFakeSql();
  });

  it('écrit une paire en upsert rejouable', async () => {
    const store = createTestLinkStore(sql);
    await store.saveLink(aTestLink({ id: 'link-7' }));

    const write = sql.writes()[0];
    expect(write?.statement).toContain('INSERT INTO test_link');
    expect(write?.statement).toContain('ON DUPLICATE KEY UPDATE');
    expect(write?.params[0]).toBe('link-7');
    expect(write?.params[2]).toBe(TEST_REFUSAL);
    expect(write?.params[3]).toBe('confirmed');
  });

  it('écrit la date au format Forge SQL', async () => {
    const store = createTestLinkStore(sql);
    await store.saveLink(aTestLink({ at: '2026-11-11T08:00:00.000Z' }));

    expect(sql.writes()[0]?.params[7]).toBe('2026-11-11 08:00:00.000');
  });

  it('conserve la justification et l’auteur de la confirmation', async () => {
    const store = createTestLinkStore(sql);
    await store.saveLink(aTestLink({ rationale: 'Nom du test aligné', confirmedBy: 'user-qa' }));

    const params = sql.writes()[0]?.params ?? [];
    expect(params).toContain('Nom du test aligné');
    expect(params).toContain('user-qa');
  });

  it('garde toutes les requêtes bornées et toutes les écritures rejouables', async () => {
    const store = createTestLinkStore(sql);
    await store.listLinksByCriterion('crit-1');
    await store.listConfirmedLinksByTest(TEST_REFUSAL);
    await store.listProposedLinks('10001');
    await store.saveLink(aTestLink());

    expect(allSelectsBounded(sql)).toBe(true);
    expect(allWritesReplayable(sql)).toBe(true);
  });
});
