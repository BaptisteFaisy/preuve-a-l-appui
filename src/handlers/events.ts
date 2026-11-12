/**
 * Déclencheur sur mise à jour de ticket, `avi:jira:updated:issue` (SPEC §17).
 *
 * Propriétaire : lot L4. Signature gelée : le corps remplace la souche sans la
 * changer. Ce handler relaie, il ne calcule rien :
 *
 *  - seuls les événements qui touchent la **description** sont retenus, parce
 *    que c'est là que vivent les critères d'acceptation (SPEC §8.2) ; un
 *    changement d'assigné ou de priorité ne doit rien coûter ;
 *  - l'import des critères depuis la description est écrit par le lot L1
 *    (`src/domain/criteria-import.ts`) : il se branchera ici, sur cet
 *    événement, sans que la signature change ;
 *  - la couverture est ensuite recalculée par le moteur (SPEC §12.3,
 *    docs/CONTRACTS.md §1bis) : c'est le seul point de passage, jamais un
 *    second calcul dans ce handler.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps';
import { isObject } from '../db/mapping-common';

/** Le seul champ dont dépend la lecture des critères (SPEC §8.2). */
const CRITERIA_FIELD = 'description';

/** Identifiant ou clé du ticket concerné ; `null` si l'événement n'en porte pas. */
export function extractIssueTarget(payload: unknown): { id: string; key: string } | null {
  if (!isObject(payload)) return null;
  const issue = isObject(payload['issue']) ? payload['issue'] : payload;
  const id = typeof issue['id'] === 'string' ? issue['id'] : '';
  const key = typeof issue['key'] === 'string' ? issue['key'] : '';
  if (id.length === 0 && key.length === 0) return null;
  return { id: id.length > 0 ? id : key, key: key.length > 0 ? key : id };
}

/**
 * Vrai si la description fait partie des champs modifiés. Un changelog absent
 * ou vide est traité comme un changement possible : dans le doute, on recalcule
 * (une couverture périmée bloque à tort, SPEC §5 principe 5).
 */
export function hasDescriptionChanged(payload: unknown): boolean {
  if (!isObject(payload)) return false;
  const changelog = payload['changelog'];
  if (!isObject(changelog)) return true;
  const items = Array.isArray(changelog['items']) ? changelog['items'] : [];
  if (items.length === 0) return true;
  return items.some((item) => isObject(item) && item['field'] === CRITERIA_FIELD);
}

/** Événement `avi:jira:updated:issue` : critères modifiés dans la description. */
export async function onJiraEvent(payload: Record<string, unknown>, deps: AppDeps): Promise<void> {
  const target = extractIssueTarget(payload);
  if (target === null) {
    deps.logger.log('info', 'ci.events.no_issue', { payload });
    return;
  }
  if (!hasDescriptionChanged(payload)) {
    deps.logger.log('info', 'ci.events.not_criteria', { target });
    return;
  }

  const issue = await deps.jira.getIssue(target.id);
  if (issue === null) {
    deps.logger.log('warn', 'ci.events.issue_not_found', { target });
    return;
  }

  await deps.coverage.recompute(issue.id);
}
