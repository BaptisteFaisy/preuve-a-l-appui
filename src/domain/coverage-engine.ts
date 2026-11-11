/**
 * Moteur de couverture (SPEC §12.3, docs/CONTRACTS.md §1bis).
 *
 * Point de passage obligé : le validateur, le consommateur de CI et l'outil
 * `get-proof-status` appellent `recompute(issueId)` ou `read(issueId)` et
 * lisent ainsi **la même ligne** (SPEC §22, point 10), jamais deux calculs
 * qui divergent. La couverture est stockée à chaque changement : le
 * validateur ne calcule rien (SPEC §17).
 *
 * `deps.ts` (gelé) ne fournit que `{ store, clock, logger }` : `jira` est donc
 * optionnel ici. Sans lui, le moteur retrouve la clé et le projet depuis la
 * ligne existante ; avec lui, il résout le ticket, met à jour le champ
 * « Preuves n / m » (SPEC §12.3, FP-16) et vérifie les sous-tâches (SPEC §21).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Clock, CoverageEngine, JiraGateway, Logger, ProofStore } from '../ports.js';
import type { Coverage, IssueRef, ProjectSettings } from '../types.js';
import { defaultProjectSettings } from '../defaults.js';
import { buildCoverage, coverageFieldLabel } from './coverage.js';
import { text } from '../i18n/index.js';
import { GATE_MESSAGES } from '../i18n/gate.js';

/** Ce dont le moteur a besoin : la persistance, l'horloge, le journal. */
export interface CoverageEngineDeps {
  store: ProofStore;
  clock: Clock;
  logger: Logger;
  /** Optionnel : résolution du ticket, champ de couverture, sous-tâches. */
  jira?: JiraGateway;
}

interface IssueContext {
  issueKey: string;
  projectId: string;
  issue: IssueRef | null;
}

/** Fabrique du moteur de couverture ; la signature exportée est gelée. */
export function createCoverageEngine(deps: CoverageEngineDeps): CoverageEngine {
  return {
    async read(issueId: string): Promise<Coverage | null> {
      return deps.store.getCoverage(issueId);
    },

    async recompute(issueId: string): Promise<Coverage | null> {
      try {
        return await recomputeSafe(deps, issueId);
      } catch (error) {
        deps.logger.log('error', `Échec du recalcul de couverture pour ${issueId}`, error);
        return null;
      }
    },
  };
}

/** Recalcul complet : contexte, réglages, critères, preuves, dérogations. */
async function recomputeSafe(deps: CoverageEngineDeps, issueId: string): Promise<Coverage> {
  const context = await resolveIssueContext(deps, issueId);
  const settings = await resolveSettings(deps.store, context.projectId);
  const [criteria, evidences, waivers] = await Promise.all([
    deps.store.listCriteriaByIssue(issueId, ['active']),
    deps.store.listEvidencesByIssue(issueId),
    deps.store.listWaiversByIssue(issueId),
  ]);
  const childrenCovered = await checkChildren(deps, settings, context.issue);

  const coverage = buildCoverage({
    issueId,
    issueKey: context.issueKey,
    criteria,
    evidences,
    waivers,
    settings,
    now: deps.clock.now(),
    childrenCovered,
  });

  await deps.store.saveCoverage(coverage);
  await afterSave(deps, coverage, settings, criteria.length);
  return coverage;
}

/** Après stockage : champ « Preuves n / m » (FP-16) et traces de contrôle. */
async function afterSave(
  deps: CoverageEngineDeps,
  coverage: Coverage,
  settings: ProjectSettings,
  criterionCount: number,
): Promise<void> {
  if (criterionCount === 0 && settings.missingCriteria === 'suggest') {
    // Ticket sans critère en politique « proposer » : message dédié (SPEC §8.3).
    deps.logger.log(
      'info',
      text(GATE_MESSAGES, 'gate.missingCriteria.suggest', settings.language),
      { issueId: coverage.issueId },
    );
  }
  if (!deps.jira) return;
  const label = coverageFieldLabel(coverage.proven, coverage.total, settings.language);
  const ok = await deps.jira.setCoverageField(
    coverage.issueId,
    label,
    coverage.proven,
    coverage.total,
  );
  if (!ok) {
    deps.logger.log('warn', `Champ de couverture non écrit pour ${coverage.issueKey}`);
  }
}

/** Résout clé et projet : Jira d'abord, puis la ligne existante, sinon l'id. */
async function resolveIssueContext(
  deps: CoverageEngineDeps,
  issueId: string,
): Promise<IssueContext> {
  if (deps.jira) {
    const issue = await deps.jira.getIssue(issueId);
    if (issue) {
      return { issueKey: issue.key, projectId: issue.projectId, issue };
    }
  }
  const existing = await deps.store.getCoverage(issueId);
  if (existing) {
    return {
      issueKey: existing.issueKey,
      projectId: projectKeyOf(existing.issueKey),
      issue: null,
    };
  }
  return { issueKey: issueId, projectId: projectKeyOf(issueId), issue: null };
}

/** Clé projet déduite d'une clé de ticket : `PAY-123` → `PAY`. */
function projectKeyOf(key: string): string {
  const dash = key.indexOf('-');
  return dash > 0 ? key.slice(0, dash) : key;
}

async function resolveSettings(
  store: ProofStore,
  projectId: string,
): Promise<ProjectSettings> {
  const stored = await store.getSettings(projectId);
  return stored ?? defaultProjectSettings(projectId);
}

/** Un parent peut exiger la couverture de ses sous-tâches (SPEC §21). */
async function checkChildren(
  deps: CoverageEngineDeps,
  settings: ProjectSettings,
  issue: IssueRef | null,
): Promise<boolean> {
  if (!settings.requireChildren || !issue || issue.children.length === 0) return true;
  for (const childId of issue.children) {
    const childCoverage = await deps.store.getCoverage(childId);
    if (!childCoverage || !childCoverage.passes) return false;
  }
  return true;
}
