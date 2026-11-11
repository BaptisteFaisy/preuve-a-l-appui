/**
 * Tests de persistance : living_proof (SPEC §7.5, §13, §18).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { createLivingStore, LIVING_LIST_LIMIT, projectKeyOfIssue } from '../../src/db/living.js';
import { allSelectsBounded, createFakeSql } from './sql-fake.js';
import { aLivingProof, COMPONENT, ISSUE_KEY, PROJECT_ID, TEST_REFUSAL } from '../helpers/builders.js';

function livingRow(state: string) {
  return {
    id: 'lp-1',
    project_id: 'PAY',
    issue_key: ISSUE_KEY,
    criterion_id: 'crit-1',
    test_name: TEST_REFUSAL,
    state,
    component: COMPONENT,
    commit: 'e41f0c9a1b2c3d4e5f60',
    since: '2026-11-11 08:00:00.000',
  };
}

describe('createLivingStore', () => {
  it('déduit la clé projet de la clé du ticket', () => {
    expect(projectKeyOfIssue('PAY-123')).toBe('PAY');
    expect(projectKeyOfIssue('SANSCLÉ')).toBe('SANSCLÉ');
  });

  it('écrit une preuve vivante avec un upsert rejouable', async () => {
    const sql = createFakeSql();
    const store = createLivingStore(sql);

    await store.saveLivingProof(aLivingProof({ state: 'regressed' }));

    expect(sql.calls).toHaveLength(1);
    expect(sql.calls[0].kind).toBe('execute');
    expect(sql.calls[0].statement).toContain('INSERT INTO living_proof');
    expect(sql.calls[0].statement).toContain('ON DUPLICATE KEY UPDATE');
    // Le projet vient du contexte d'écriture, déduit de la clé du ticket.
    expect(sql.calls[0].params[1]).toBe('PAY');
  });

  it('écrit un état illisible comme non prouvé, jamais comme sain', async () => {
    const sql = createFakeSql();
    const store = createLivingStore(sql);

    await store.saveLivingProof(aLivingProof({ state: 'peut-être' as 'proven' }));

    expect(sql.calls[0].params).toContain('unproven');
  });

  it('liste les preuves vivantes d’un projet avec une requête bornée', async () => {
    const sql = createFakeSql();
    const store = createLivingStore(sql);
    sql.scriptRows([livingRow('proven')]);

    const proofs = await store.listLivingByProject(PROJECT_ID);

    expect(proofs).toHaveLength(1);
    expect(proofs[0].state).toBe('proven');
    // La colonne `project_id` porte la clé déduite du ticket : les deux formes
    // sont passées au filtre (voir l'en-tête du fichier et le CONTRACT-CHANGE).
    expect(sql.calls[0].params).toEqual([PROJECT_ID, PROJECT_ID]);
    expect(sql.calls[0].statement).toContain(`LIMIT ${LIVING_LIST_LIMIT}`);
    expect(allSelectsBounded(sql)).toBe(true);
  });

  it('accepte la clé projet, forme réellement écrite en base', async () => {
    const sql = createFakeSql();
    const store = createLivingStore(sql);
    sql.scriptRows([livingRow('proven')]);

    const proofs = await store.listLivingByProject('PAY');

    expect(proofs).toHaveLength(1);
    expect(sql.calls[0].params).toEqual(['PAY', 'PAY']);
    expect(sql.calls[0].statement).toContain('project_id = ? OR project_id = ?');
  });

  it('filtre par état quand il est fourni', async () => {
    const sql = createFakeSql();
    const store = createLivingStore(sql);
    sql.scriptRows([]);

    await store.listLivingByProject(PROJECT_ID, 'regressed');

    expect(sql.calls[0].statement).toContain('AND state = ?');
    expect(sql.calls[0].params).toContain('regressed');
  });

  it('ignore un filtre d’état vide au lieu de tout exclure', async () => {
    const sql = createFakeSql();
    const store = createLivingStore(sql);
    sql.scriptRows([]);

    await store.listLivingByProject(PROJECT_ID, '');

    expect(sql.calls[0].statement).not.toContain('AND state = ?');
  });

  it('liste les critères livrés qui ne sont plus prouvés', async () => {
    const sql = createFakeSql();
    const store = createLivingStore(sql);
    sql.scriptRows([livingRow('regressed'), livingRow('unproven')]);

    const unproven = await store.listUnprovenLiving(PROJECT_ID);

    expect(unproven).toHaveLength(2);
    expect(sql.calls[0].statement).toContain("state <> ?");
    expect(sql.calls[0].params).toContain('proven');
    expect(allSelectsBounded(sql)).toBe(true);
  });

  it('rend une liste vide sans lever quand rien n’est suivi', async () => {
    const sql = createFakeSql();
    const store = createLivingStore(sql);
    sql.scriptRows([]);

    await expect(store.listLivingByProject('INCONNU')).resolves.toEqual([]);
  });
});
