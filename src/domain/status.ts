/**
 * Le statut « livré » d'un ticket (SPEC §8.3, §13).
 *
 * Un seul endroit dit ce qu'est un ticket livré : la preuve vivante ne suit
 * que ceux-là (SPEC §13), et les réouvertures se mesurent sur ceux qui ont
 * été livrés puis rouverts (SPEC §14 FP-18). Jira parle la langue du site —
 * « Done », « Closed », « Terminé »… — donc la liste est large, et la
 * comparaison ignore la casse.
 *
 * Domaine pur : aucun import applicatif.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */

/** Les statuts qui signifient « livré », dans les langues d'un Jira. */
export const CLOSED_STATUSES: readonly string[] = [
  'done',
  'closed',
  'resolved',
  'complete',
  'completed',
  'terminé',
  'termine',
  'fermé',
  'ferme',
  'clos',
  'close',
  'résolu',
  'resolu',
];

/** Vrai si le ticket est livré : la preuve vivante ne surveille que ceux-là. */
export function isClosedStatus(status: string): boolean {
  return CLOSED_STATUSES.includes(status.trim().toLowerCase());
}
