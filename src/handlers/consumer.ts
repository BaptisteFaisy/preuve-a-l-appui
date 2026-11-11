/**
 * Consommateur de la file `proof-ci` (SPEC §17, points 2 à 4).
 *
 * Propriétaire : lot L4 (docs/CONTRACTS.md). Signature gelée : le corps
 * remplace la souche sans la changer. Le handler reste un câblage mince ; les
 * étapes vivent dans `src/ingest/consume.ts`, testables avec les fakes.
 *
 * Les quatre étapes du SPEC §17 :
 *  1. le run et ses résultats sont rangés (noms et états, SPEC §20) ;
 *  2. le ticket est retrouvé par la clé contenue dans la branche, ses preuves
 *     de type test et leur fraîcheur sont mises à jour (SPEC §9.3, §10) ;
 *  3. la couverture est recalculée par le moteur et écrite sur le ticket
 *     (docs/CONTRACTS.md §1bis : jamais un second calcul ici) ;
 *  4. sur la branche principale, les preuves vivantes des tickets clos sont
 *     mises à jour et signalées (SPEC §7.5, §13).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps.js';
import type { CiIngestMessage } from '../ports.js';
import { recordRun, refreshIssueProofs, refreshLivingProofs } from '../ingest/consume.js';
import { isObject } from '../db/mapping-common.js';

/** Un message lisible : sans run ni branche, il n'y a rien à faire (jamais d'exception). */
export function isUsableMessage(message: CiIngestMessage | null | undefined): boolean {
  if (!isObject(message)) return false;
  const summary = message.summary;
  if (!isObject(summary)) return false;
  return (
    typeof message.runId === 'string' &&
    message.runId.length > 0 &&
    typeof summary.repo === 'string' &&
    typeof summary.branch === 'string' &&
    Array.isArray(summary.tests)
  );
}

/** Traite un résumé de CI : preuves de test, fraîcheur, couverture, preuve vivante. */
export async function onCiMessage(message: CiIngestMessage, deps: AppDeps): Promise<void> {
  if (!isUsableMessage(message)) {
    deps.logger.log('warn', 'ci.consumer.unreadable_message', { message });
    return;
  }

  await recordRun(deps, message);

  // Étape 2 : le ticket est retrouvé par la clé portée par le nom de branche.
  const issue = await deps.jira.findIssueByBranch(message.projectId, message.summary.branch);
  if (issue === null) {
    deps.logger.log('info', 'ci.consumer.no_issue_for_branch', {
      branch: message.summary.branch,
    });
  } else {
    await refreshIssueProofs(deps, issue, message);
  }

  // Étape 4 : la preuve vivante ne suit que la branche principale (SPEC §13).
  if (message.summary.mainBranch === true) {
    await refreshLivingProofs(deps, message.projectId, message);
  }
}
