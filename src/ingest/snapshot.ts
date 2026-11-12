/**
 * Publication de l'instantané du ticket (lot `app-runs-on-atlassian`).
 *
 * L'app écrit son état pseudonymisé dans une **propriété du ticket Jira** :
 * c'est ce qui permet au site public de montrer des données réellement
 * produites par l'app, sans que l'app expose un web trigger dynamique — un
 * déclencheur dynamique ferait perdre l'éligibilité « Runs on Atlassian ».
 *
 * Le site public ne lit jamais cette propriété directement (il n'a pas de jeton
 * Jira) : l'outil `tools/refresh-live-snapshot.mjs` la lit et la versionne dans
 * `site/public/live-snapshot.json`, que le site importe à la construction.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { buildDemoSnapshot, type SnapshotDeps } from '../demo-snapshot';
import type { Logger } from '../ports';

/** Variable d'app : le site Jira d'origine, affiché comme provenance. */
export const SNAPSHOT_SITE_VAR = 'FORGE_USER_VAR_DEMO_SITE';

/** Ce dont la publication a besoin : la base, Jira, l'horloge, le journal. */
export interface PublishDeps extends SnapshotDeps {
  readonly logger: Logger;
}

/** Le site Jira d'origine, s'il est configuré sur l'environnement. */
export function siteOf(): string {
  const raw = process.env[SNAPSHOT_SITE_VAR];
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Construit l'instantané du ticket et l'écrit dans ses propriétés.
 * Renvoie `false` quand le ticket est inconnu ou l'écriture refusée.
 */
export async function publishSnapshot(
  deps: PublishDeps,
  issueIdOrKey: string,
): Promise<boolean> {
  const issue = await deps.jira.getIssue(issueIdOrKey);
  if (issue === null) return false;
  const snapshot = await buildDemoSnapshot(deps, { issueKey: issue.key, site: siteOf() });
  if (snapshot === null) return false;
  const written = await deps.jira.writeSnapshot(issue.id, snapshot);
  if (!written) {
    deps.logger.log('warn', 'snapshot.not_written', { issueKey: issue.key });
  }
  return written;
}
