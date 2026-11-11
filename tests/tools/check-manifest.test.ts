/**
 * Tests du garde `tools/check-manifest.mjs`.
 *
 * Conformément à la tâche, seuls des modules natifs Node sont utilisés
 * (`node:child_process`, `node:fs`, et `node:path`/`node:os`/`node:url` pour
 * situer les fichiers temporaires) — aucune dépendance de test, aucune
 * importation du code source : le garde est exercé comme un exécutable, sur
 * le manifest du dépôt et sur des copies temporaires cassées.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const guardPath = path.join(repoRoot, 'tools/check-manifest.mjs');
const manifestPath = path.join(repoRoot, 'manifest.yml');

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function runGuard(target: string, env: Record<string, string> = {}) {
  const run = spawnSync(process.execPath, [guardPath, target], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { status: run.status ?? -1, output: `${run.stdout ?? ''}${run.stderr ?? ''}` };
}

/** Copie le manifest du dépôt dans un fichier temporaire, puis le casse. */
function brokenManifest(mutate: (text: string) => string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proof-manifest-'));
  tempDirs.push(dir);
  const target = path.join(dir, 'manifest.yml');
  const original = fs.readFileSync(manifestPath, 'utf8');
  const mutated = mutate(original);
  expect(mutated, 'la mutation de test doit changer le manifest').not.toBe(original);
  fs.writeFileSync(target, mutated);
  return target;
}

describe('check-manifest', () => {
  it('accepte le manifest du dépôt', () => {
    const { status, output } = runGuard(manifestPath);
    expect(output).toContain('OK — manifest conforme');
    expect(status).toBe(0);
  });

  it('accepte le manifest du dépôt avec le parseur YAML de repli', () => {
    const { status, output } = runGuard(manifestPath, { FORCE_MINI_YAML: '1' });
    expect(output).toContain('parseur YAML mini');
    expect(status).toBe(0);
  });

  it('refuse une action manquante (§15)', () => {
    const target = brokenManifest((text) => text.replace('- key: attach-evidence', '- key: attach-evidence-x'));
    const { status, output } = runGuard(target);
    expect(status).toBe(1);
    expect(output).toContain('attach-evidence');
    expect(output).toContain('manquante');
  });

  it('refuse une fonction référencée mais non déclarée', () => {
    const target = brokenManifest((text) => text.replace('function: ingestResults', 'function: ingestResultsX'));
    const { status, output } = runGuard(target);
    expect(status).toBe(1);
    expect(output).toContain('ingestResultsX');
    expect(output).toContain('absente de modules.function');
  });

  it("refuse une action sans verbe", () => {
    const target = brokenManifest((text) => text.replace('      actionVerb: GET\n', ''));
    const { status, output } = runGuard(target);
    expect(status).toBe(1);
    expect(output).toContain('actionVerb');
  });

  it('refuse un outil MCP sans action déclarée', () => {
    const target = brokenManifest((text) =>
      text.replace('      tools:\n', '      tools:\n        - ghost-tool\n'),
    );
    const { status, output } = runGuard(target);
    expect(status).toBe(1);
    expect(output).toContain('ghost-tool');
  });

  it("refuse un type d'entrée hors §19", () => {
    const target = brokenManifest((text) =>
      text.replace('        testNames:\n          title: Test names\n          type: string', '        testNames:\n          title: Test names\n          type: array'),
    );
    const { status, output } = runGuard(target);
    expect(status).toBe(1);
    expect(output).toContain('testNames');
    expect(output).toContain('§19');
  });

  it('refuse une clé de module en double', () => {
    const target = brokenManifest((text) => text.replace('    - key: ci-results', '    - key: proof-gate'));
    const { status, output } = runGuard(target);
    expect(status).toBe(1);
    expect(output).toContain('déjà utilisée');
  });

  it('refuse un manifest introuvable', () => {
    const { status, output } = runGuard(path.join(os.tmpdir(), 'proof-manifest-absent.yml'));
    expect(status).toBe(1);
    expect(output).toContain('introuvable');
  });
});
