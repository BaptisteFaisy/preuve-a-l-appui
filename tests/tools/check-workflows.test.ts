/**
 * Le garde des workflows : YAML valide **et** scripts bash valides.
 *
 * Le 14/11/2026, le workflow `live-refresh.yml` passait le contrôle YAML et
 * mourait à la première étape : une apostrophe échappée `\\'` entre
 * guillemets simples (`\\` est littéral entre `'`), donc une chaîne fermée
 * trop tôt et une ouverte jamais refermée. Le garde attrape ce genre de faute
 * avant le push, en passant chaque bloc `run:` par `bash -n`.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const GARDE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'tools',
  'check-workflows-yaml.py',
);
const ARBRES: string[] = [];
type Resultat = { code: number; sortie: string };

/** Lance le garde sur une racine et rend le code de sortie + la sortie. */
function lancerGarde(racine: string): Resultat {
  try {
    const sortie = execFileSync('python3', [GARDE, '--racine', racine], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, sortie };
  } catch (err) {
    const echec = err as { status?: number | null; stdout?: string; stderr?: string };
    return {
      code: echec.status ?? 1,
      sortie: `${echec.stdout ?? ''}${echec.stderr ?? ''}`,
    };
  }
}

/** Écrit un workflow dans une arborescence temporaire et rend sa racine. */
function arbreTemporaire(workflow: string): string {
  const racine = mkdtempSync(join(tmpdir(), 'garde-workflows-'));
  ARBRES.push(racine);
  mkdirSync(join(racine, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(racine, '.github', 'workflows', 'test.yml'), workflow, 'utf8');
  return racine;
}

/** Un workflow minimal, valide, avec une étape `run:` libre. */
function workflowAvec(script: string): string {
  return [
    'name: Essai',
    'on: workflow_dispatch',
    'jobs:',
    '  essai:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Étape',
    '        run: |',
    ...script.split('\n').map((ligne) => `          ${ligne}`),
    '',
  ].join('\n');
}

afterEach(() => {
  while (ARBRES.length > 0) {
    const racine = ARBRES.pop();
    if (racine !== undefined) rmSync(racine, { recursive: true, force: true });
  }
});

describe('le garde des workflows', () => {
  it('valide les workflows du dépôt', () => {
    const resultat = lancerGarde(resolve(GARDE, '..', '..'));
    expect(resultat.code).toBe(0);
    expect(resultat.sortie).toContain('workflow(s) YAML valide(s)');
  });

  it('refuse un YAML invalide', () => {
    const racine = arbreTemporaire('nom: [non fermé\n');
    const resultat = lancerGarde(racine);
    expect(resultat.code).toBe(1);
    expect(resultat.sortie).toContain('::error::');
  });

  it("refuse un script bash invalide — l'apostrophe échappée d'un echo", () => {
    const racine = arbreTemporaire(
      workflowAvec("echo '::warning::rien n\\'est relu ni publié.'"),
    );
    const resultat = lancerGarde(racine);
    expect(resultat.code).toBe(1);
    expect(resultat.sortie).toContain('script bash invalide');
  });

  it('accepte un script bash valide', () => {
    const racine = arbreTemporaire(workflowAvec('echo "rien n\'est relu"'));
    const resultat = lancerGarde(racine);
    expect(resultat.code).toBe(0);
    expect(resultat.sortie).toContain('script(s) bash vérifié(s)');
  });

  it('ignore les étapes écrites dans un autre langage', () => {
    const corps = [
      'name: Essai',
      'on: workflow_dispatch',
      'jobs:',
      '  essai:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - name: Python',
      '        shell: python',
      '        run: |',
      '          print("ceci n\'est pas du bash")',
      '',
    ].join('\n');
    const racine = arbreTemporaire(corps);
    const resultat = lancerGarde(racine);
    expect(resultat.code).toBe(0);
  });
});
