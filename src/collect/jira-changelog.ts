/**
 * L'historique de statuts des tickets d'un projet (SPEC §14 FP-18).
 *
 * La mesure « taux de réouverture selon la force des preuves » se déduit de
 * l'historique Jira : un ticket livré puis rouvert. Ce fichier en est le seul
 * lecteur — **un** appel borné pour tout le projet, la recherche Jira
 * renvoyant le changelog via `expand: "changelog"` dans le corps de la
 * requête (l'endpoint `/rest/api/3/issue/{id}/changelog` coûterait un appel
 * par ticket).
 *
 * Toute erreur devient une liste vide : la page projet doit répondre, pas
 * planter (SPEC §20).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { route } from '@forge/api';
import type { TicketStatusHistory } from '../types';
import type { JiraTransport } from './jira';

/** Un changement de statut, tel que Jira le rend dans son changelog. */
interface RawStatusItem {
  field?: string;
  fromString?: string | null;
  toString?: string | null;
}

/** Un groupe de changements : l'historique d'un ticket. */
interface RawHistory {
  items?: RawStatusItem[];
}

/** Le changelog d'un ticket, attaché à l'issue par `expand=changelog`. */
interface RawIssueWithChangelog {
  id?: string;
  key?: string;
  fields?: { status?: { name?: string } };
  changelog?: { histories?: RawHistory[] };
}

/** Borne de la lecture : jamais plus de tickets que ça (SPEC §20). */
export const STATUS_HISTORY_LIMIT = 100;

/** Les transitions de statut d'un ticket, du plus ancien au plus récent. */
function transitionsOf(raw: RawIssueWithChangelog): { from: string; to: string }[] {
  return (raw.changelog?.histories ?? [])
    .flatMap((history) => history.items ?? [])
    .filter((item) => item.field === 'status')
    .map((item) => ({ from: item.fromString ?? '', to: item.toString ?? '' }));
}

/**
 * L'historique de statuts de tous les tickets d'un projet, en un appel.
 * Renvoie `[]` si la recherche échoue ou si le projet est vide.
 */
export async function readStatusHistories(
  transport: JiraTransport,
  projectId: string,
): Promise<TicketStatusHistory[]> {
  if (!projectId) return [];
  const page = await transport.sendJson<{ issues?: RawIssueWithChangelog[] }>(
    route`/rest/api/3/search/jql`,
    {
      jql: `project = "${projectId.replace(/["\\]/g, '')}" ORDER BY key ASC`,
      fields: ['status'],
      expand: 'changelog',
      maxResults: STATUS_HISTORY_LIMIT,
    },
  );
  return (page?.issues ?? [])
    .filter((raw) => raw.id && raw.key)
    .map((raw) => ({
      issueId: raw.id ?? '',
      issueKey: raw.key ?? '',
      currentStatus: raw.fields?.status?.name ?? '',
      transitions: transitionsOf(raw),
    }));
}
