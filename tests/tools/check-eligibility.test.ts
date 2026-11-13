/**
 * Tests de la garantie « Runs on Atlassian ».
 *
 * Deux objets, une seule implémentation : `tools/check-eligibility.mjs` fait la
 * vérification (éligibilité réelle ET câblage du workflow). Ces tests l'exécutent
 * comme un binaire — aucune logique recopiée ici :
 *
 *  - mode `--check-workflow` (hors ligne) sur le vrai `.github/workflows/
 *    eligibility.yml`, puis sur des copies cassées : chaque point exigé
 *    (déclencheur `pull_request`, budget ≤ 5 min, deux secrets, appel du garde)
 *    doit être présent, et son absence doit être refusée ;
 *  - mode par défaut avec un faux `forge` (FORGE_BIN) : l'app inéligible fait
 *    échouer le garde **avec le message de la CLI**, l'app éligible le laisse
 *    passer. C'est le point dur : `forge eligibility` sort en code 0 même
 *    quand l'app est inéligible.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.resolve(ici, '../..');
const garde = path.join(racine, 'tools/check-eligibility.mjs');
const workflow = path.join(racine, '.github/workflows/eligibility.yml');

const temporaires: string[] = [];

afterAll(() => {
  for (const dossier of temporaires) fs.rmSync(dossier, { recursive: true, force: true });
});

type Resultat = { code: number; sortie: string };

/** Lance le garde avec les arguments et l'environnement donnés. */
function lancer(args: string[], env: Record<string, string> = {}): Resultat {
  const run = spawnSync(process.execPath, [garde, ...args], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, FORGE_EMAIL: 'ci@example.test', FORGE_API_TOKEN: 'jeton-de-test', ...env },
  });
  return { code: run.status ?? -1, sortie: `${run.stdout ?? ''}${run.stderr ?? ''}` };
}

/** Écrit un fichier dans un dossier temporaire et rend son chemin. */
function fichierTemporaire(nom: string, contenu: string, mode = 0o644): string {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'eligibilite-'));
  temporaires.push(dossier);
  const cible = path.join(dossier, nom);
  fs.writeFileSync(cible, contenu, 'utf8');
  fs.chmodSync(cible, mode);
  return cible;
}

/** Copie du workflow du dépôt, avec une mutation vérifiée. */
function workflowCasse(muter: (texte: string) => string): string {
  const original = fs.readFileSync(workflow, 'utf8');
  const mute = muter(original);
  expect(mute, 'la mutation de test doit changer le workflow').not.toBe(original);
  return fichierTemporaire('eligibility.yml', mute);
}

/** Faux `forge` : imprime la sortie de la CLI Forge et sort en code 0. */
function fauxForge(sortie: string): string {
  return fichierTemporaire('forge', `#!/bin/sh\ncat <<'SORTIE'\n${sortie}\nSORTIE\nexit 0\n`, 0o755);
}

const INELIGIBLE =
  "ℹ The version of your app [2.7.0] that's deployed to [production] is not eligible for the Runs on Atlassian program.\n" +
  " - App is using a webtrigger module that can egress data";

const ELIGIBLE =
  "ℹ The version of your app [2.7.0] that's deployed to [production] is eligible for the Runs on Atlassian program.";

describe('garde d’éligibilité — câblage du workflow', () => {
  it('existe et passe ses propres contrôles', () => {
    expect(fs.existsSync(workflow), 'workflow présent').toBe(true);
    const { code, sortie } = lancer(['--check-workflow', workflow]);
    expect(sortie).toContain('déclencheur pull_request présent');
    expect(sortie).toContain('timeout-minutes 5 ≤ 5');
    expect(sortie).toContain('secret FORGE_EMAIL utilisé');
    expect(sortie).toContain('secret FORGE_API_TOKEN utilisé');
    expect(sortie).toContain('garde local tools/check-eligibility.mjs appelé');
    expect(code).toBe(0);
  });

  it('refuse un job au-delà de 5 minutes', () => {
    const casse = workflowCasse((t) => t.replace('timeout-minutes: 5', 'timeout-minutes: 9'));
    const { code, sortie } = lancer(['--check-workflow', casse]);
    expect(code).toBe(1);
    expect(sortie).toContain('timeout-minutes 9 > 5');
  });

  it('refuse un workflow sans déclencheur pull_request', () => {
    const casse = workflowCasse((t) => t.replace('on:\n  pull_request:\n', 'on:\n  push:\n'));
    const { code, sortie } = lancer(['--check-workflow', casse]);
    expect(code).toBe(1);
    expect(sortie).toContain('ne se déclenche pas sur pull_request');
  });

  it('refuse un secret manquant', () => {
    const casse = workflowCasse((t) => t.replace(/\n\s*FORGE_API_TOKEN: \$\{\{ secrets\.FORGE_API_TOKEN \}\}/, ''));
    const { code, sortie } = lancer(['--check-workflow', casse]);
    expect(code).toBe(1);
    expect(sortie).toContain('secret FORGE_API_TOKEN absent du workflow');
  });

  it('refuse un workflow qui n’appelle pas le garde', () => {
    const casse = workflowCasse((t) => t.replace('node tools/check-eligibility.mjs', 'node tools/autre.mjs'));
    const { code, sortie } = lancer(['--check-workflow', casse]);
    expect(code).toBe(1);
    expect(sortie).toContain('n’appelle pas tools/check-eligibility.mjs');
  });

  it('refuse un workflow introuvable', () => {
    const { code, sortie } = lancer(['--check-workflow', path.join(os.tmpdir(), 'absent-eligibility.yml')]);
    expect(code).toBe(1);
    expect(sortie).toContain('workflow introuvable');
  });
});

describe('garde d’éligibilité — verdict de la CLI', () => {
  it('échoue en citant le message de la CLI quand l’app est inéligible', () => {
    const { code, sortie } = lancer([], { FORGE_BIN: fauxForge(INELIGIBLE) });
    expect(code).toBe(1);
    expect(sortie).toContain('INÉLIGIBLE');
    expect(sortie).toContain('App is using a webtrigger module that can egress data');
    expect(sortie).toContain('Runs on Atlassian');
  });

  it('passe quand production et development sont éligibles', () => {
    const { code, sortie } = lancer([], { FORGE_BIN: fauxForge(ELIGIBLE) });
    expect(code).toBe(0);
    expect(sortie).toContain('OK : l’app reste éligible');
    expect(sortie).toContain('[production] Éligible');
    expect(sortie).toContain('[development] Éligible');
  });

  it('échoue sans verdict lisible plutôt que de laisser passer', () => {
    const { code, sortie } = lancer([], { FORGE_BIN: fauxForge('Error: UserNotFoundError') });
    expect(code).toBe(1);
    expect(sortie).toContain('VERDICT INCONNU');
    expect(sortie).toContain('UserNotFoundError');
  });

  it('réclame les deux secrets quand ils manquent', () => {
    const { code, sortie } = lancer([], { FORGE_EMAIL: '', FORGE_API_TOKEN: '' });
    expect(code).toBe(1);
    expect(sortie).toContain('FORGE_EMAIL');
    expect(sortie).toContain('FORGE_API_TOKEN');
    expect(sortie).toContain('gh secret set');
  });
});
