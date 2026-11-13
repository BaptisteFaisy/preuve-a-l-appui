/**
 * Messages du lot L4 : ingestion CI, fraîcheur, preuve vivante (SPEC §10, §13, §20).
 *
 * Règle : anglais et français pour chaque clé visible, fichiers < 500 lignes,
 * fonctions < 50 lignes.
 */
import type { Language } from '../types';
import { text, type MessageVars, type Messages } from './index';

export const CI_MESSAGES: Messages = {
  'ci.coverage.label': {
    en: '{proven} / {total}',
    fr: '{proven} / {total}',
  },
  'ci.ingest.accepted': {
    en: 'CI summary accepted for run {runId}',
    fr: 'Résumé de CI accepté pour le run {runId}',
  },
  'ci.ingest.batched': {
    en: 'Batch {index}/{total} buffered for run {runId}',
    fr: 'Lot {index}/{total} mis en attente pour le run {runId}',
  },
  'ci.ingest.method_not_allowed': {
    en: 'Only POST is accepted on the CI web trigger',
    fr: 'Seule la méthode POST est acceptée sur le point d’entrée de CI',
  },
  'ci.ingest.missing_auth': {
    en: 'Missing CI key, timestamp or HMAC signature',
    fr: 'Clé de CI, horodatage ou signature HMAC manquante',
  },
  'ci.ingest.invalid_signature': {
    en: 'Invalid CI signature or unknown project key',
    fr: 'Signature de CI invalide ou clé de projet inconnue',
  },
  'ci.ingest.replay_rejected': {
    en: 'CI request timestamp outside the allowed anti-replay window',
    fr: 'Horodatage de la requête CI hors de la fenêtre anti-rejeu',
  },
  'ci.ingest.payload_too_large': {
    en: 'CI payload exceeds 5 MiB limit; split into batches',
    fr: 'Charge utile CI supérieure à 5 Mo ; découper en plusieurs lots',
  },
  'ci.ingest.invalid_payload': {
    en: 'Invalid CI summary payload: repo, branch, commit and tests are required',
    fr: 'Charge utile CI invalide : repo, branch, commit et tests sont requis',
  },
  'ci.living.regressed.subject': {
    en: '[{issueKey}] Delivered criterion {code} is failing in CI',
    fr: '[{issueKey}] Le critère livré {code} échoue en CI',
  },
  'ci.living.regressed.body': {
    en: '{code} is in regression: test "{testName}" failed on commit {commit}. Open a bug or fix it.',
    fr: '{code} est en régression : le test « {testName} » a échoué sur le commit {commit}. Ouvrir un bug ou corriger.',
  },
  'ci.living.unproven.subject': {
    en: '[{issueKey}] Delivered criterion {code} is no longer proven',
    fr: '[{issueKey}] Le critère livré {code} n’est plus prouvé',
  },
  'ci.living.unproven.body': {
    en: '{code} is no longer proven since commit {commit}: test "{testName}" was skipped or removed.',
    fr: '{code} n’est plus prouvé depuis le commit {commit} : le test « {testName} » a été ignoré ou absent.',
  },
  // Notification hors Jira (webhook d'équipe) : la ligne « qui doit agir ».
  'ci.living.webhook.who': {
    en: 'To handle: {who}',
    fr: 'À traiter par : {who}',
  },
};

/** Traduit une clé du dictionnaire CI dans la langue du projet. */
export function ciText(key: string, language: Language, vars: MessageVars = {}): string {
  return text(CI_MESSAGES, key, language, vars);
}
