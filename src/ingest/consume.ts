/**
 * Étapes du consommateur de CI : ce qui se passe après la réponse immédiate
 * du web trigger (SPEC §17, points 2 à 4 ; §10 ; §13).
 *
 * `src/handlers/consumer.ts` reste un câblage mince ; la logique de chaque
 * étape vit ici, testable avec les fakes de `tests/helpers/`. La couverture
 * n'est jamais recalculée ici : on appelle `deps.coverage.recompute`
 * (docs/CONTRACTS.md §1bis), pour que le validateur et le consommateur lisent
 * la même ligne.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps';
import type { CiIngestMessage } from '../ports';
import type { IssueRef, Language, LivingProof, TestOutcome } from '../types';
import { ciText } from '../i18n/ci';
import { applyCiSummaryToEvidences } from '../domain/freshness';
import { evaluateLivingProofs, type LivingAlert, type TrackedLivingItem } from '../domain/living';
import { isClosedStatus } from '../domain/status';

/** Langue du projet, `en` si les réglages sont absents (SPEC §20). */
export async function languageOf(deps: AppDeps, projectId: string): Promise<Language> {
  const settings = await deps.store.getSettings(projectId);
  return settings?.language ?? 'en';
}

/** Étape 1 : le run et ses résultats sont rangés tels quels (noms et états, §20). */
export async function recordRun(deps: AppDeps, message: CiIngestMessage): Promise<number> {
  const { summary } = message;
  await deps.store.saveTestRun({
    id: message.runId,
    repo: summary.repo,
    branch: summary.branch,
    commit: summary.commit,
    mainBranch: summary.mainBranch,
    receivedAt: summary.receivedAt,
  });
  return deps.store.addTestResults(message.runId, summary.tests);
}

/** Étape 2 : preuves de type test mises à jour, puis couverture et champ (§17). */
export async function refreshIssueProofs(
  deps: AppDeps,
  issue: IssueRef,
  message: CiIngestMessage,
): Promise<{ updated: number; reconfirmed: number }> {
  const now = deps.clock.now();
  const evidences = await deps.store.listEvidencesByIssue(issue.id);
  const result = applyCiSummaryToEvidences(evidences, message.summary, deps.ids, now);
  for (const evidence of result.toSave) {
    await deps.store.saveEvidence(evidence);
  }
  await refreshCoverage(deps, issue, message.projectId);
  return { updated: result.updatedCount, reconfirmed: result.reconfirmCount };
}

/** Étape 3 : la couverture est recalculée par le moteur, puis écrite sur le ticket. */
export async function refreshCoverage(
  deps: AppDeps,
  issue: IssueRef,
  projectId: string,
): Promise<void> {
  const coverage = await deps.coverage.recompute(issue.id);
  if (coverage === null) {
    deps.logger.log('warn', 'ci.coverage.missing', { issueKey: issue.key });
    return;
  }
  const language = await languageOf(deps, projectId);
  const label = ciText('ci.coverage.label', language, {
    proven: coverage.proven,
    total: coverage.total,
  });
  await deps.jira.setCoverageField(issue.id, label, coverage.proven, coverage.total);
}

/** Preuve vivante déjà écrite → élément suivi, sans lecture supplémentaire. */
function itemOfExisting(proof: LivingProof): TrackedLivingItem {
  return {
    existing: proof,
    issueKey: proof.issueKey,
    criterionId: proof.criterionId,
    testName: proof.testName,
    component: proof.component,
  };
}

/**
 * Paire confirmée (§11) → élément suivi, seulement si le ticket est clos :
 * un critère non livré n'a pas de preuve vivante (SPEC §13).
 */
async function itemOfLink(
  deps: AppDeps,
  criterionId: string,
  testName: string,
): Promise<TrackedLivingItem | null> {
  const criterion = await deps.store.getCriterion(criterionId);
  if (criterion === null) return null;
  const issue = await deps.jira.getIssue(criterion.issueId);
  if (issue === null || !isClosedStatus(issue.status)) return null;
  return {
    issueKey: issue.key,
    criterionId,
    testName,
    component: issue.components[0] ?? '',
  };
}

/**
 * Les éléments à surveiller : les preuves vivantes déjà écrites, plus les
 * paires test ↔ critère confirmées des tickets clos rencontrées dans ce run.
 * Un test sans paire confirmée ne crée aucune preuve vivante.
 */
export async function collectTrackedItems(
  deps: AppDeps,
  projectId: string,
  outcomes: readonly TestOutcome[],
): Promise<TrackedLivingItem[]> {
  const existing = await deps.store.listLivingByProject(projectId);
  const items: TrackedLivingItem[] = existing.map(itemOfExisting);
  const seen = new Set(items.map((item) => `${item.criterionId}::${item.testName}`));

  for (const outcome of outcomes) {
    const links = await deps.store.listConfirmedLinksByTest(outcome.name);
    for (const link of links) {
      const key = `${link.criterionId}::${link.testName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const item = await itemOfLink(deps, link.criterionId, link.testName);
      if (item !== null) items.push(item);
    }
  }

  return items;
}

/**
 * Signale sur le ticket d'origine un critère livré qui n'est plus prouvé
 * (SPEC §7.5, §13). Le port `notify` transporte des clés de message : les
 * variables (code du critère, nom du test, commit) sont journalisées.
 */
async function notifyAlert(deps: AppDeps, alert: LivingAlert): Promise<void> {
  const issue = await deps.jira.getIssue(alert.issueKey);
  const accountId = issue?.reporterAccountId || issue?.assigneeAccountId || '';
  if (accountId.length === 0) {
    deps.logger.log('warn', 'ci.living.no_recipient', { issueKey: alert.issueKey });
    return;
  }
  const prefix = alert.proof.state === 'regressed' ? 'ci.living.regressed' : 'ci.living.unproven';
  deps.logger.log('info', `${prefix}.body`, {
    issueKey: alert.issueKey,
    criterionId: alert.criterionId,
    testName: alert.testName,
    commit: alert.proof.commit,
    since: alert.proof.since,
  });
  await deps.jira.notify(accountId, `${prefix}.subject`, `${prefix}.body`, alert.issueKey);
}

/** Étape 4 : sur la branche principale, la preuve vivante des tickets clos (§13). */
export async function refreshLivingProofs(
  deps: AppDeps,
  projectId: string,
  message: CiIngestMessage,
): Promise<{ updated: number; alerts: number }> {
  // Les preuves vivantes sont rangées sous la CLÉ du projet (déduite de la clé
  // du ticket) : on la résout depuis l'identifiant du message. Lire avec l'id
  // numérique ne trouvait jamais rien — et chaque run créait alors un doublon.
  const projectKey = await deps.jira.projectKey(projectId);
  if (projectKey === '') return { updated: 0, alerts: 0 };
  const items = await collectTrackedItems(deps, projectKey, message.summary.tests);
  if (items.length === 0) return { updated: 0, alerts: 0 };

  const evaluation = evaluateLivingProofs(
    items,
    message.summary.tests,
    message.summary.commit,
    deps.clock.now(),
    deps.ids,
  );

  for (const proof of evaluation.updated) {
    await deps.store.saveLivingProof(proof);
  }
  for (const alert of evaluation.alerts) {
    await notifyAlert(deps, alert);
  }
  return { updated: evaluation.updated.length, alerts: evaluation.alerts.length };
}
