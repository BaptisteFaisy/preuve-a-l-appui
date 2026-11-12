/**
 * Textes du panneau « gestes avancés » de la démo (lot `site-toutes-features`).
 *
 * Deux familles de textes :
 * - `labels` : le libellé de chaque bouton, et le titre du panneau ;
 * - `details` : les gabarits des réponses que le site compose lui-même, avec
 *   des accolades à remplacer (`{code}`, `{count}`…). Tout ce que l'app sait
 *   dire elle-même (`result.text` des actions MCP) est affiché tel quel, dans
 *   la langue du projet : le site ne le réécrit pas.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Lang } from './index.js';

/** Le jeu de chaînes du panneau avancé, identique en FR et en EN. */
export interface DemoExtraStrings {
  readonly title: string;
  readonly lede: string;
  /** Libellé court de chaque geste, indexé par l'identifiant du geste. */
  readonly labels: Readonly<Record<string, string>>;
  /** Gabarits des détails composés par le site, indexés par geste. */
  readonly details: Readonly<Record<string, string>>;
  /** Refus et indisponibilités, indexés par cause. */
  readonly failures: Readonly<Record<string, string>>;
}

export const DEMO_EXTRA: Readonly<Record<Lang, DemoExtraStrings>> = {
  en: {
    title: 'The rest of the engine, live',
    lede:
      'These buttons call the very modules the app runs: importing criteria, evidence going stale, test ↔ criterion pairing, attestation requests, the release dossier, other evidence types and cross-evidence. Every answer below is produced by the app, not by this page.',
    labels: {
      'import-criteria': 'Import criteria from the description',
      'stale-on-change': 'Edit a criterion (evidence to reconfirm)',
      'suggest-pairs': 'Suggest test ↔ criterion pairs',
      'request-attestation': 'Ask a competent person to attest',
      'release-proof': 'Generate the release proof dossier',
      'other-evidence-types': 'Attach documentation (another evidence type)',
      'cross-evidence': 'Require cross-evidence',
    },
    details: {
      'import-criteria': '{text} — then validated by a human: {codes}',
      'suggest-fallback':
        '{count} test ↔ criterion pair(s) from the app’s deterministic fallback (no model involved): {pairs}',
      'stale-on-change': '{code} moved to version {version}: {count} evidence item(s) to reconfirm',
      'request-attestation': 'Attestation requested on {code} → {who} ({role}) · {sent} notification(s)',
      'other-evidence-types':
        'Documentation attached to {code} — strength kept by the app: {strength} (never the one its author declares)',
      'cross-evidence':
        'Grid raised: {count} distinct evidence types required for “{type}” — one kind of proof is no longer enough',
    },
    failures: {
      unknown: 'Unknown gesture: {id}',
      unavailable: '{what} not found in the demo scenario',
      'no-recipient': 'No competent recipient ({roles}) among the scenario actors',
    },
  },
  fr: {
    title: 'Le reste du moteur, en direct',
    lede:
      'Ces boutons appellent les modules mêmes que l’app exécute : import des critères, péremption des preuves, rapprochement tests ↔ critères, demande d’attestation, dossier de preuve d’une version, autres types de preuve et preuve croisée. Chaque réponse ci-dessous est produite par l’app, pas par cette page.',
    labels: {
      'import-criteria': 'Importer des critères depuis la description',
      'stale-on-change': 'Modifier un critère (preuves à reconfirmer)',
      'suggest-pairs': 'Proposer des paires test ↔ critère',
      'request-attestation': 'Demander une attestation au rôle compétent',
      'release-proof': 'Générer le dossier de preuve de la version',
      'other-evidence-types': 'Attacher une documentation (autre type de preuve)',
      'cross-evidence': 'Exiger une preuve croisée',
    },
    details: {
      'import-criteria': '{text} — puis validés par un humain : {codes}',
      'suggest-fallback':
        '{count} paire(s) test ↔ critère proposées par le repli déterministe de l’app (sans modèle) : {pairs}',
      'stale-on-change': '{code} passé en version {version} : {count} preuve(s) à reconfirmer',
      'request-attestation': 'Demande d’attestation sur {code} → {who} ({role}) · {sent} notification(s)',
      'other-evidence-types':
        'Documentation attachée à {code} — force retenue par l’app : {strength} (jamais celle que déclare son auteur)',
      'cross-evidence':
        'Grille relevée : {count} types de preuve distincts exigés pour « {type} » — une seule sorte de preuve ne suffit plus',
    },
    failures: {
      unknown: 'Geste inconnu : {id}',
      unavailable: '{what} introuvable dans le scénario de démo',
      'no-recipient': 'Aucun destinataire compétent ({roles}) parmi les acteurs du scénario',
    },
  },
};

/** Remplace les `{clés}` d'un gabarit ; une clé absente laisse son marqueur. */
export function fill(
  template: string,
  vars: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w[\w-]*)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
