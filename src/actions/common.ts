/**
 * Utilitaires partagés des actions Rovo / MCP (SPEC §15, §19).
 *
 * Validation des entrées, découpage des listes en chaîne (SPEC §19 : les
 * entrées d'action sont limitées à string / integer / number / boolean),
 * résolution du ticket, du critère et de la langue du projet.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps.js';
import { defaultProjectSettings } from '../defaults.js';
import { text } from '../i18n/index.js';
import { ACTION_MESSAGES } from '../i18n/actions.js';
import type { Criterion, IssueRef, Language, ProjectSettings } from '../types.js';
import { ActionError } from './types.js';

/**
 * Découpe une liste transmise en chaîne séparée par des virgules (SPEC §19).
 * Vide les entrées vides et rogne les espaces : `"a, b ,,c"` → `['a','b','c']`.
 */
export function splitCsv(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** Traduit un message du lot L5 ; les erreurs précoces sont en anglais. */
export function actionText(
  key: string,
  lang: Language,
  vars: Record<string, string | number> = {},
): string {
  return text(ACTION_MESSAGES, key, lang, vars);
}

/** Chaîne obligatoire non vide : rend la valeur rognée ou lève `ActionError`. */
export function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ActionError(actionText('err.missing.input', 'en', { name: field }), `missing-${field}`);
  }
  return value.trim();
}

/** Ticket chargé depuis sa clé (SPEC §15 : `issueKey`), ou erreur explicite. */
export async function loadIssue(deps: AppDeps, issueKey: string): Promise<IssueRef> {
  const issue = await deps.jira.getIssue(issueKey);
  if (issue === null) {
    throw new ActionError(
      actionText('err.issue.notFound', 'en', { issueKey }),
      'issue-not-found',
    );
  }
  return issue;
}

/** Réglages du projet, avec repli sur la grille par défaut (SPEC §9.2). */
export async function loadSettings(deps: AppDeps, projectId: string): Promise<ProjectSettings> {
  return (await deps.store.getSettings(projectId)) ?? defaultProjectSettings(projectId);
}

/** Langue du projet pour les textes de réponse (SPEC §20). */
export async function resolveLanguage(deps: AppDeps, projectId: string): Promise<Language> {
  const settings = await deps.store.getSettings(projectId);
  return settings?.language ?? 'en';
}

/**
 * Critère retrouvé par son identifiant (`crit-1`) ou par son code (`AC-1`,
 * SPEC §8.1 : le code est l'identifiant stable visible partout).
 */
export async function resolveCriterion(
  deps: AppDeps,
  issue: IssueRef,
  idOrCode: string,
): Promise<Criterion> {
  const byId = await deps.store.getCriterion(idOrCode);
  if (byId !== null && byId.issueId === issue.id) return byId;
  const byCode = await deps.store.getCriterionByCode(issue.id, idOrCode);
  if (byCode !== null) return byCode;
  throw new ActionError(
    actionText('err.criterion.notFound', 'en', { criterionId: idOrCode, issueKey: issue.key }),
    'criterion-not-found',
  );
}
