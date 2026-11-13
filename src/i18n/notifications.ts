/**
 * Les messages de notification — un seul dictionnaire pour la passerelle Jira.
 *
 * Les notifications envoyées à Jira portaient jusqu'ici la **clé** brute
 * (`ci.living.unproven.subject`), pas le texte : le destinataire lisait un
 * identifiant. Elles sont désormais résolues ici, dans la langue du projet,
 * au même endroit pour tous les appelants (SPEC §20).
 *
 * Une clé absente de ce dictionnaire n'est pas traduite : la passerelle
 * envoie alors le texte tel qu'il a été fourni (certains appelants
 * traduisent déjà eux-mêmes).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { mergeDictionaries, type Messages } from './index';
import { ACTION_MESSAGES } from './actions';
import { CI_MESSAGES } from './ci';
import { GATE_MESSAGES } from './gate';
import { UI_MESSAGES } from './ui';

/** Tout ce que la passerelle Jira peut avoir à dire. */
export const NOTIFICATION_MESSAGES: Messages = mergeDictionaries(
  ACTION_MESSAGES,
  CI_MESSAGES,
  GATE_MESSAGES,
  UI_MESSAGES,
);
