#!/usr/bin/env node
/**
 * Garde « Runs on Atlassian » — « Fait, preuve à l'appui ».
 *
 * Une seule implémentation de la règle d'éligibilité : ce module. La CI
 * (`.github/workflows/eligibility.yml`) l'appelle, les tests
 * (`tests/tools/check-eligibility.test.ts`) l'appellent aussi — jamais une
 * copie de la logique.
 *
 * Deux modes :
 *   node tools/check-eligibility.mjs                  vérifie l'éligibilité de
 *                                                     l'app en production ET en
 *                                                     development (CLI Forge) ;
 *   node tools/check-eligibility.mjs --check-workflow contrôle, hors ligne, que
 *                                                     le workflow est bien branché
 *                                                     (déclencheur, budget,
 *                                                     secrets, appel du garde).
 *
 * Variables d'environnement :
 *   FORGE_EMAIL / FORGE_API_TOKEN  identifiants Atlassian (API token) ;
 *   FORGE_BIN                      binaire de la CLI Forge (défaut : `forge`) ;
 *   FORGE_DISABLE_ANALYTICS=1      pas de télémétrie.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseMiniYaml } from './lib/mini-yaml.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = path.join(RACINE, '.github', 'workflows', 'eligibility.yml');
const ENVIRONNEMENTS = ['production', 'development'];
const SECRETS = ['FORGE_EMAIL', 'FORGE_API_TOKEN'];
const BUDGET_MINUTES = 5;
const DELAI_CLI_MS = 120000;

/** Phrases exactes de la CLI Forge (`forge eligibility`). */
const ELIGIBLE = 'is eligible for the Runs on Atlassian program';
const INELIGIBLE = 'is not eligible for the Runs on Atlassian program';

/* --------------------------------------------------------------- diagnostic */

/** Retire les codes couleur ANSI de la sortie de la CLI. */
function sansCouleur(texte) {
  return String(texte ?? '').replace(/\u001B\[[0-9;]*[A-Za-z]/g, '');
}

/** Message de la CLI sur la ligne qui porte le verdict. */
function ligneVerdict(sortie) {
  const lignes = sansCouleur(sortie).split('\n').map((l) => l.trim()).filter(Boolean);
  return lignes.find((l) => l.includes('Runs on Atlassian program')) ?? '';
}

/** Règles violées, listées par la CLI sous le verdict. */
function motifs(sortie) {
  return sansCouleur(sortie)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).trim());
}

/**
 * Verdict : éligible / inéligible / inconnu.
 * `is not eligible` est cherché avant `is eligible` (le second est presque le
 * sous-texte du premier).
 */
function analyserSortie(sortie) {
  const texte = sansCouleur(sortie);
  if (texte.includes(INELIGIBLE)) return { eligible: false, connu: true };
  if (texte.includes(ELIGIBLE)) return { eligible: true, connu: true };
  return { eligible: false, connu: false };
}

/* ------------------------------------------------------- contrôle du workflow */

/** Déclencheurs déclarés sous `on:` (mini-yaml garde `on` en texte). */
function declencheurs(on) {
  if (typeof on === 'string') return [on];
  if (Array.isArray(on)) return on.map(String);
  if (on && typeof on === 'object') return Object.keys(on);
  return [];
}

/** Jobs du workflow, sous forme de liste. */
function jobs(doc) {
  const brut = doc?.jobs ?? {};
  return brut && typeof brut === 'object' ? Object.entries(brut) : [];
}

/** Collecte les `run:` et les valeurs d'`env:` de tout le document. */
function collecter(noeud, acc) {
  if (Array.isArray(noeud)) {
    for (const enfant of noeud) collecter(enfant, acc);
    return acc;
  }
  if (!noeud || typeof noeud !== 'object') return acc;
  for (const [cle, valeur] of Object.entries(noeud)) {
    if (cle === 'run' && typeof valeur === 'string') acc.runs.push(valeur);
    if (cle === 'env' && valeur && typeof valeur === 'object') {
      for (const v of Object.values(valeur)) acc.env.push(String(v));
    }
    collecter(valeur, acc);
  }
  return acc;
}

/**
 * Contrôle statique du workflow : déclencheur `pull_request`, budget de 5 min
 * par job, deux secrets attendus, appel du garde local. Les secrets et l'appel
 * sont cherchés dans les vraies commandes (`env:` / `run:`), pas dans les
 * commentaires — sinon une phrase de commentaire suffirait à faire passer.
 */
function verifierWorkflow(texte) {
  const controles = [];
  const problemes = [];
  let doc;
  try {
    doc = parseMiniYaml(texte);
  } catch (err) {
    return { controles, problemes: [`YAML illisible : ${err.message}`] };
  }
  const on = declencheurs(doc.on ?? doc[true]);
  if (on.includes('pull_request')) controles.push('déclencheur pull_request présent');
  else problemes.push('le workflow ne se déclenche pas sur pull_request');
  const listeJobs = jobs(doc);
  if (listeJobs.length === 0) problemes.push('le workflow ne définit aucun job');
  for (const [nom, job] of listeJobs) {
    const budget = Number(job?.['timeout-minutes']);
    if (!Number.isFinite(budget)) problemes.push(`job « ${nom} » sans timeout-minutes`);
    else if (budget > BUDGET_MINUTES) {
      problemes.push(`job « ${nom} » : timeout-minutes ${budget} > ${BUDGET_MINUTES}`);
    } else controles.push(`job « ${nom} » : timeout-minutes ${budget} ≤ ${BUDGET_MINUTES}`);
  }
  const { runs, env } = collecter(doc, { runs: [], env: [] });
  const references = [...env, ...runs].join('\n');
  for (const secret of SECRETS) {
    if (references.includes(`secrets.${secret}`)) controles.push(`secret ${secret} utilisé`);
    else problemes.push(`secret ${secret} absent du workflow`);
  }
  if (runs.some((commande) => commande.includes('tools/check-eligibility.mjs'))) {
    controles.push('garde local tools/check-eligibility.mjs appelé');
  } else {
    problemes.push('le workflow n’appelle pas tools/check-eligibility.mjs');
  }
  return { controles, problemes };
}

/** Mode `--check-workflow` : vérifie le câblage, hors ligne. */
function modeWorkflow(chemin) {
  if (!fs.existsSync(chemin)) {
    console.error(`::error::workflow introuvable : ${chemin}`);
    return 1;
  }
  const { controles, problemes } = verifierWorkflow(fs.readFileSync(chemin, 'utf8'));
  for (const controle of controles) console.log(`OK : ${controle}`);
  for (const probleme of problemes) console.error(`::error::${probleme}`);
  if (problemes.length > 0) {
    console.error(`KO : ${problemes.length} problème(s) de câblage dans ${path.relative(RACINE, chemin)}.`);
    return 1;
  }
  console.log(`OK : workflow éligibilité branché (${path.relative(RACINE, chemin)}).`);
  return 0;
}

/* --------------------------------------------------- vérification d'éligibilité */

/** Secrets absents de l'environnement courant. */
function secretsManquants(env) {
  return SECRETS.filter((secret) => !env[secret]);
}

/** Lance `forge eligibility -e <environnement> --non-interactive`. */
function interrogerForge(environnement, options) {
  const binaire = options.bin;
  const args = ['eligibility', '-e', environnement, '--non-interactive'];
  const run = spawnSync(binaire, args, {
    cwd: RACINE,
    encoding: 'utf8',
    env: process.env,
    timeout: options.delai,
  });
  const sortie = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  return { code: run.status ?? 1, sortie, erreur: run.error ? run.error.message : '' };
}

/** Verdict d'un environnement : éligible, inéligible ou indécidable. */
function verifierEnvironnement(environnement, options) {
  const { code, sortie, erreur } = interrogerForge(environnement, options);
  const analyse = analyserSortie(sortie);
  return {
    environnement,
    code,
    sortie,
    erreur,
    eligible: analyse.eligible,
    connu: analyse.connu,
    message: ligneVerdict(sortie),
    motifs: motifs(sortie),
  };
}

/** Affiche le verdict d'un environnement. */
function afficherVerdict(verdict) {
  if (verdict.connu && verdict.eligible) {
    console.log(`[${verdict.environnement}] Éligible — ${verdict.message}`);
    return;
  }
  if (verdict.connu) {
    console.error(`[${verdict.environnement}] INÉLIGIBLE — ${verdict.message}`);
    for (const motif of verdict.motifs) console.error(`  - ${motif}`);
    return;
  }
  console.error(`[${verdict.environnement}] VERDICT INCONNU (code ${verdict.code})`);
  if (verdict.erreur) console.error(`  CLI : ${verdict.erreur}`);
  const detail = sansCouleur(verdict.sortie).trim();
  if (detail) console.error(`  ${detail.split('\n').slice(-5).join('\n  ')}`);
}

/** Mode par défaut : vérifie production ET development. */
function modeEligibilite(options) {
  const manquants = secretsManquants(process.env);
  if (manquants.length > 0) {
    console.error(
      `::error::secret(s) manquant(s) : ${manquants.join(', ')} — ` +
        'la CLI Forge ne peut pas s’authentifier. `gh secret set FORGE_API_TOKEN`.',
    );
    return 1;
  }
  let echec = false;
  for (const environnement of options.environnements) {
    const verdict = verifierEnvironnement(environnement, options);
    afficherVerdict(verdict);
    if (!verdict.eligible) echec = true;
  }
  if (echec) {
    console.error(
      '::error::l’app n’est pas (ou plus) éligible au programme « Runs on Atlassian » ' +
        'dans au moins un environnement — le message de la CLI ci-dessus dit pourquoi.',
    );
    return 1;
  }
  console.log('OK : l’app reste éligible au programme « Runs on Atlassian ».');
  return 0;
}

/* ------------------------------------------------------------------- entrée */

/** Analyse les arguments : `--check-workflow [chemin]`. */
function analyserArgs(argv) {
  const options = {
    mode: 'eligibilite',
    workflow: WORKFLOW,
    environnements: [...ENVIRONNEMENTS],
    bin: process.env.FORGE_BIN || 'forge',
    delai: DELAI_CLI_MS,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--check-workflow') {
      options.mode = 'workflow';
      const suivant = argv[i + 1];
      if (suivant && !suivant.startsWith('--')) {
        options.workflow = path.resolve(process.cwd(), suivant);
        i += 1;
      }
    } else if (argv[i] === '--env') {
      options.environnements = String(argv[i + 1] ?? '').split(',').filter(Boolean);
      i += 1;
    }
  }
  return options;
}

function main(argv) {
  const options = analyserArgs(argv);
  if (options.mode === 'workflow') return modeWorkflow(options.workflow);
  return modeEligibilite(options);
}

process.exit(main(process.argv.slice(2)));
