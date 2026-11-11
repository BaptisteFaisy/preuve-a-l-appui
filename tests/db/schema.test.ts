/**
 * Le schéma Forge SQL doit rester portable, idempotent et conforme aux règles
 * Forge (SPEC §18, R4 §1.3, §3).
 *
 * Ce test ne touche pas une base : il lit le DDL et vérifie ses promesses —
 * pas de clé étrangère, pas de colonne `JSON`, des `*_id` en `VARCHAR(64)`
 * indexés, des dates en `TIMESTAMP`, du JSON en `TEXT`.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import type { DdlMigration, DdlRunner } from '../../src/db/sql-client.js';
import { TABLES, TABLE_DDL, applySchema, migrationName } from '../../src/db/schema.js';

/** Les dix tables du SPEC §18, telles que le cahier les liste. */
const SPEC_18_TABLES = [
  'criterion',
  'criterion_history',
  'evidence',
  'attestation',
  'waiver',
  'test_run',
  'test_result',
  'test_link',
  'coverage',
  'settings',
] as const;

/** Les deux tables ajoutées par le SPEC §13 (preuve vivante) et §17 (dossier). */
const EXTRA_TABLES = ['living_proof', 'release_dossier'] as const;

/** Un `DdlRunner` de test : il enregistre ce qu'on lui demande d'appliquer. */
class RecordingRunner implements DdlRunner {
  readonly migrations: DdlMigration[] = [];

  async run(migrations: readonly DdlMigration[]): Promise<string[]> {
    this.migrations.push(...migrations);
    return migrations.map((migration) => migration.name);
  }
}

interface ColumnDef {
  name: string;
  type: string;
}

/** Les colonnes d'un DDL : les lignes d'index et de clé primaire sont écartées. */
function columnsOf(ddl: string): ColumnDef[] {
  const body = ddl.slice(ddl.indexOf('(') + 1, ddl.lastIndexOf(')'));
  const columns: ColumnDef[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim().replace(/,$/, '');
    if (line.length === 0) continue;
    if (/^(INDEX|PRIMARY KEY|UNIQUE|KEY|CONSTRAINT|FOREIGN KEY|CHECK)\b/i.test(line)) continue;
    const match = /^(\w+)\s+([A-Za-z]+)/.exec(line);
    if (match?.[1] && match[2]) columns.push({ name: match[1], type: match[2].toUpperCase() });
  }
  return columns;
}

/** Les colonnes couvertes par un index ou par la clé primaire. */
function indexedColumnsOf(ddl: string): Set<string> {
  const indexed = new Set<string>();
  const body = ddl.slice(ddl.indexOf('(') + 1, ddl.lastIndexOf(')'));
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    const keyMatch = /^(?:INDEX|PRIMARY KEY|UNIQUE KEY)\s+\S*\s*\(([^)]+)\)/i.exec(line);
    if (keyMatch?.[1]) {
      for (const name of keyMatch[1].split(',')) {
        indexed.add(name.trim().replace(/`/g, '').split(/\s+/)[0] ?? '');
      }
      continue;
    }
    // Clé primaire en ligne : `issue_id VARCHAR(64) NOT NULL PRIMARY KEY`.
    const inline = /^(\w+)\s+.*\bPRIMARY KEY\b/i.exec(line);
    if (inline?.[1]) indexed.add(inline[1]);
  }
  return indexed;
}

describe('schéma — tables', () => {
  it('contient les dix tables du SPEC §18, plus la preuve vivante et le dossier', () => {
    for (const table of [...SPEC_18_TABLES, ...EXTRA_TABLES]) {
      expect(TABLES).toContain(table);
      expect(TABLE_DDL[table]).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('donne exactement un DDL par table', () => {
    expect(Object.keys(TABLE_DDL).sort()).toEqual([...TABLES].sort());
  });

  it('n\'ajoute aucune table en dehors du modèle', () => {
    expect(TABLES).toHaveLength(SPEC_18_TABLES.length + EXTRA_TABLES.length);
  });
});

describe('schéma — idempotence', () => {
  it('écrit chaque table avec IF NOT EXISTS', () => {
    for (const table of TABLES) {
      expect(TABLE_DDL[table]).toMatch(/CREATE TABLE IF NOT EXISTS/);
    }
  });

  it('ne détruit rien : ni DROP, ni ALTER', () => {
    for (const table of TABLES) {
      expect(TABLE_DDL[table]).not.toMatch(/\b(DROP|ALTER|TRUNCATE)\b/i);
    }
  });

  it('applique le schéma et renvoie les noms appliqués', async () => {
    const runner = new RecordingRunner();
    const applied = await applySchema(runner);
    expect(applied).toEqual(TABLES.map((table) => migrationName(table)));
    expect(runner.migrations).toHaveLength(TABLES.length);
  });

  it('rejoue le schéma sans rien casser', async () => {
    const runner = new RecordingRunner();
    const first = await applySchema(runner);
    const second = await applySchema(runner);
    expect(second).toEqual(first);
    expect(runner.migrations).toHaveLength(TABLES.length * 2);
    expect(runner.migrations.slice(0, TABLES.length)).toEqual(runner.migrations.slice(TABLES.length));
  });

  it('donne un nom de migration stable par table', () => {
    for (const table of TABLES) {
      expect(migrationName(table)).toBe(`v001_create_${table}`);
    }
  });
});

describe('schéma — règles Forge SQL', () => {
  it('n\'utilise aucune clé étrangère (Forge SQL ne les supporte pas)', () => {
    for (const table of TABLES) {
      expect(TABLE_DDL[table]).not.toMatch(/FOREIGN KEY|REFERENCES/i);
    }
  });

  it('ne déclare aucune colonne de type JSON (le type est en sursis)', () => {
    for (const table of TABLES) {
      for (const column of columnsOf(TABLE_DDL[table])) {
        expect(column.type).not.toBe('JSON');
      }
    }
  });

  it('stocke les charges utiles en TEXT', () => {
    for (const table of TABLES) {
      for (const column of columnsOf(TABLE_DDL[table])) {
        if (column.name.endsWith('_json')) expect(column.type).toBe('TEXT');
      }
    }
  });

  it('garde les dates en TIMESTAMP', () => {
    for (const table of TABLES) {
      for (const column of columnsOf(TABLE_DDL[table])) {
        if (/_at$/.test(column.name) || column.name === 'since' || column.name === 'expires_at') {
          expect(column.type).toBe('TIMESTAMP');
        }
      }
    }
  });

  it('met les identifiants *_id en VARCHAR(64), indexés', () => {
    for (const table of TABLES) {
      const ddl = TABLE_DDL[table];
      const indexed = indexedColumnsOf(ddl);
      for (const column of columnsOf(ddl)) {
        if (!column.name.endsWith('_id')) continue;
        expect(column.type, `${table}.${column.name}`).toBe('VARCHAR');
        expect(ddl, `${table}.${column.name}`).toMatch(
          new RegExp(`${column.name}\\s+VARCHAR\\(64\\)`),
        );
        expect(indexed.has(column.name), `${table}.${column.name} non indexé`).toBe(true);
      }
    }
  });

  it('cite les colonnes réservées entre backticks', () => {
    expect(TABLE_DDL.evidence).toContain('`commit`');
    expect(TABLE_DDL.evidence).toContain('`reference`');
    expect(TABLE_DDL.test_run).toContain('`commit`');
  });
});
