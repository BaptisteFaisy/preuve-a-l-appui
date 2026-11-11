/**
 * Tests de l'adaptateur SQL `settings` (SPEC §9.2, §18).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { createFakeSqlClient } from './fake-sql-l3.js';
import { settings } from './fixtures.js';
import { createSettingsStore } from '../../src/db/settings.js';
import { projectSettingsToRow } from '../../src/db/mapping-coverage.js';

describe('db/settings — lecture des réglages projet', () => {
  it('rend les réglages mappés depuis la ligne SQL', async () => {
    const sql = createFakeSqlClient();
    sql.scriptRows([projectSettingsToRow(settings())]);
    const store = createSettingsStore(sql);

    const found = await store.getSettings('10001');
    expect(found).toEqual(settings());

    const call = sql.calls[0];
    expect(call?.statement).toContain('FROM settings');
    expect(call?.statement).toContain('WHERE project_id = ?');
    expect(call?.statement).toContain('LIMIT 1');
    expect(call?.params).toEqual(['10001']);
  });

  it('rend null quand le projet n’a pas de réglages', async () => {
    const sql = createFakeSqlClient();
    expect(await createSettingsStore(sql).getSettings('inconnu')).toBeNull();
  });

  it('retrouve un projet par le hash de sa clé de CI (SPEC §10)', async () => {
    const sql = createFakeSqlClient();
    sql.scriptRows([projectSettingsToRow(settings())]);

    const found = await createSettingsStore(sql).findProjectByCiKeyHash('sha256:9f2c1b');
    expect(found?.projectId).toBe('10001');
    expect(sql.calls[0]?.statement).toContain('WHERE ci_key_hash = ?');
    expect(sql.calls[0]?.params).toEqual(['sha256:9f2c1b']);
  });

  it('un hash vide ne requête jamais la base', async () => {
    const sql = createFakeSqlClient();
    expect(await createSettingsStore(sql).findProjectByCiKeyHash('')).toBeNull();
    expect(sql.calls).toHaveLength(0);
  });
});

describe('db/settings — écriture rejouable', () => {
  it('écrit en upsert avec la grille et les rôles en JSON texte', async () => {
    const sql = createFakeSqlClient();
    const fixture = settings();

    await createSettingsStore(sql).saveSettings(fixture);

    const call = sql.calls[0];
    expect(call?.kind).toBe('execute');
    expect(call?.statement).toContain('INSERT INTO settings');
    expect(call?.statement).toContain('ON DUPLICATE KEY UPDATE');
    expect(call?.params).toHaveLength(9);
    expect(call?.params?.[0]).toBe(fixture.projectId);
    // La grille d'exigences part en TEXT sérialisé (SPEC §18, R4 §3)
    const parsed = JSON.parse(String(call?.params?.[1])) as Record<string, unknown>;
    expect(parsed.functional).toBeDefined();
    expect(call?.params?.[7]).toBe('fr');
    expect(call?.params?.[8]).toBe('2026-11-11 08:00:00.000');
  });
});
