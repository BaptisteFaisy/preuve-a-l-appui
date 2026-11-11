/**
 * Outil `get-proof-status` (SPEC §15, verbe GET).
 *
 * Renvoie la couverture du ticket et **les mêmes critères en défaut** que le
 * message du validateur : même source, la ligne `coverage` lue via
 * `deps.coverage.read(issueId)` (SPEC §22 point 10, docs/CONTRACTS.md §1bis).
 * Cet outil ne recalcule RIEN — il lit la ligne tenue à jour par le moteur L3.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps.js';
import type { ActorContext } from '../ports.js';
import type { BlockingItem, Coverage } from '../types.js';
import { actionText, loadIssue, requireText, resolveLanguage } from './common.js';
import type { GetProofStatusResult } from './types.js';

/** Les lignes du blocage, formatées comme le message du validateur (§7.2). */
function formatBlocking(blocking: readonly BlockingItem[], lang: 'en' | 'fr'): string {
  const lines = blocking.map(
    (item) =>
      `- ${item.code} « ${item.text} » : ${actionText(`defect.${item.defect}`, lang)} — ${actionText('status.expected', lang)} : ${item.expected}`,
  );
  return lines.join('\n');
}

function buildText(issueKey: string, coverage: Coverage, lang: 'en' | 'fr'): string {
  const vars = {
    issueKey,
    proven: coverage.proven,
    total: coverage.total,
    waived: coverage.waived,
    blockingCount: coverage.blocking.length,
  };
  const head = actionText(coverage.passes ? 'status.passed' : 'status.blocked', lang, vars);
  if (coverage.passes || coverage.blocking.length === 0) return head;
  return `${head}\n${formatBlocking(coverage.blocking, lang)}`;
}

/** Couverture vide pour un ticket sans ligne calculée : rien n'est prouvé. */
function emptyCoverage(deps: AppDeps, issueId: string, issueKey: string): Coverage {
  return {
    issueId,
    issueKey,
    total: 0,
    proven: 0,
    waived: 0,
    mode: 'strict',
    passes: false,
    wouldBlock: true,
    blocking: [],
    criteria: [],
    updatedAt: deps.clock.now(),
  };
}

export async function getProofStatus(
  payload: Record<string, unknown>,
  deps: AppDeps,
  _context: ActorContext,
): Promise<GetProofStatusResult> {
  const issueKey = requireText(payload['issueKey'], 'issueKey');
  const issue = await loadIssue(deps, issueKey);
  const lang = await resolveLanguage(deps, issue.projectId);

  // SPEC §22 point 10 : lecture de la ligne du moteur, jamais de recalcul.
  const coverage = (await deps.coverage.read(issue.id)) ?? emptyCoverage(deps, issue.id, issueKey);

  return {
    issueKey,
    total: coverage.total,
    proven: coverage.proven,
    waived: coverage.waived,
    passes: coverage.passes,
    blocking: coverage.blocking,
    text: buildText(issueKey, coverage, lang),
  };
}
