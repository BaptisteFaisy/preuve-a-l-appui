/**
 * Rafraîchit le jeu de données réel du site public.
 *
 * L'app installée écrit son instantané pseudonymisé dans une propriété du
 * ticket Jira (`proof-live-snapshot`). Cet outil la lit et la versionne dans
 * `site/public/live-snapshot.json` : le site l'importe à la construction, donc
 * la page reste entièrement statique — pas d'appel réseau à l'exécution, pas de
 * CORS, et surtout pas de web trigger dynamique dans l'app (condition de
 * l'éligibilité « Runs on Atlassian »).
 *
 * Usage :
 *   ATLASSIAN_API_TOKEN=… ATLASSIAN_SITE=one-atlas-cndz.atlassian.net \
 *   ATLASSIAN_ISSUE=PRF-1 node tools/refresh-live-snapshot.mjs
 *
 * Sans jeton dans l'environnement, le fichier `~/.atlassian-api-token` est lu.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SITE = process.env.ATLASSIAN_SITE ?? 'one-atlas-cndz.atlassian.net';
const ISSUE = process.env.ATLASSIAN_ISSUE ?? 'PRF-1';
const EMAIL = process.env.ATLASSIAN_EMAIL ?? 'baptiste.faisy@gmail.com';
const PROPERTY = 'proof-live-snapshot';
const OUT = join(process.cwd(), 'site', 'public', 'live-snapshot.json');

/** Le jeton : variable d'environnement, puis le fichier du dossier personnel. */
function token() {
  const fromEnv = process.env.ATLASSIAN_API_TOKEN;
  if (fromEnv !== undefined && fromEnv.trim() !== '') return fromEnv.trim();
  return readFileSync(join(homedir(), '.atlassian-api-token'), 'utf8').trim();
}

/** Lit la propriété du ticket ; `null` si le ticket ou la propriété manque. */
async function readSnapshot() {
  const auth = Buffer.from(`${EMAIL}:${token()}`).toString('base64');
  const url = `https://${SITE}/rest/api/3/issue/${ISSUE}/properties/${PROPERTY}`;
  const response = await fetch(url, {
    headers: { authorization: `Basic ${auth}`, accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`lecture impossible : HTTP ${response.status} sur ${url}`);
  }
  const payload = await response.json();
  // L'API des propriétés renvoie { key, value } : c'est `value` qui porte
  // l'instantané.
  return payload && typeof payload === 'object' && 'value' in payload ? payload.value : payload;
}

const snapshot = await readSnapshot();
const text = JSON.stringify(snapshot, null, 2);
writeFileSync(OUT, `${text}\n`, 'utf8');
console.log(
  `instantané écrit : ${OUT} (${text.length} caractères) — ticket ${ISSUE} sur ${SITE}, ` +
    `généré le ${snapshot.generatedAt ?? '?'}`,
);
