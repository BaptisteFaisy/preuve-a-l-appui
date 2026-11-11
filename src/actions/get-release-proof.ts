/**
 * Outil `get-release-proof` (SPEC §15, verbe GET).
 *
 * Renvoie la couverture de preuve d'une version : totaux par ticket,
 * dérogations accordées (avec motifs) et critères livrés qui ne sont plus
 * prouvés (SPEC §13, FP-17). Le dossier est produit par le lot L7 ; cet
 * outil le LIT seulement — il ne recalcule rien, même principe que la
 * couverture par ticket (SPEC §22 point 10).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps.js';
import type { ActorContext } from '../ports.js';
import type { DossierIssue, ReleaseDossier } from '../types.js';
import { actionText, requireText } from './common.js';
import {
  ActionError,
  type ReleaseIssueItem,
  type ReleaseProofResult,
  type UnprovenDeliveredItem,
} from './types.js';

/** Critères livrés non prouvés d'un ticket : ni prouvés, ni dérogés (SPEC §13). */
function unprovenOf(issue: DossierIssue): UnprovenDeliveredItem[] {
  return issue.criteria
    .filter((state) => !state.proven && !state.waived)
    .map((state) => ({
      issueKey: issue.issueKey,
      criterionCode: state.code,
      criterionText: state.text,
    }));
}

function toIssueItem(issue: DossierIssue): ReleaseIssueItem {
  return {
    issueKey: issue.issueKey,
    summary: issue.summary,
    total: issue.total,
    proven: issue.proven,
    waived: issue.waived,
    waiverReasons: issue.waivers.map((waiver) => waiver.reason),
  };
}

function buildText(dossier: ReleaseDossier, unproven: readonly UnprovenDeliveredItem[]): string {
  const summary = actionText('release.summary', 'en', {
    versionName: dossier.versionName,
    issuesCount: dossier.totals.issues,
    criteriaCount: dossier.totals.criteria,
    provenCount: dossier.totals.proven,
    waivedCount: dossier.totals.waived,
    unprovenDeliveredCount: unproven.length,
  });
  if (unproven.length === 0) return summary;
  const lines = unproven.map((item) => `  * ${item.issueKey} ${item.criterionCode} : ${item.criterionText}`);
  return `${summary}\nDelivered but no longer proven:\n${lines.join('\n')}`;
}

export async function getReleaseProof(
  payload: Record<string, unknown>,
  deps: AppDeps,
  _context: ActorContext,
): Promise<ReleaseProofResult> {
  const versionId = requireText(payload['versionId'], 'versionId');
  const dossier = await deps.store.getDossier(versionId);
  if (dossier === null) {
    throw new ActionError(actionText('err.version.notFound', 'en', { versionId }), 'version-not-found');
  }

  const unproven = dossier.issues.flatMap(unprovenOf);
  return {
    versionId: dossier.versionId,
    versionName: dossier.versionName,
    projectKey: dossier.projectKey,
    issuesCount: dossier.totals.issues,
    criteriaCount: dossier.totals.criteria,
    provenCount: dossier.totals.proven,
    waivedCount: dossier.totals.waived,
    unprovenDeliveredCount: unproven.length,
    issues: dossier.issues.map(toIssueItem),
    unprovenDelivered: unproven,
    text: buildText(dossier, unproven),
  };
}
