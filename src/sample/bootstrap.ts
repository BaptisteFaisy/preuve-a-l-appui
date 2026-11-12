/**
 * Amorçage du jeu de démonstration dans l'app RÉELLE (lot `app-donnees-reelles`).
 *
 * Ce module écrit le scénario du SPEC §7 (quatre critères, deux preuves de test
 * déclarées, un critère en attente d'attestation, un sans preuve) dans le Forge
 * SQL d'une installation réelle, pour un ticket Jira réel. Il ne fabrique aucune
 * règle : il pose des lignes, puis laisse le moteur de couverture calculer.
 *
 * Ce qui est réel après amorçage : le ticket, sa description réécrite par l'app,
 * les identifiants, les réglages du projet, et la couverture calculée par le
 * moteur. Les deux preuves de test partent **déclarées** : c'est le vrai
 * web trigger `ci-results` (signé) qui les fait monter en `machine-verified`,
 * comme dans un vrai pipeline.
 *
 * Idempotent : si le ticket porte déjà des critères, rien n'est recréé.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps';
import type {
  Actor,
  Attestation,
  Criterion,
  Evidence,
  IssueRef,
  Language,
  ProjectSettings,
  Waiver,
} from '../types';
import { canAttest } from '../domain/independence';
import { validateWaiverCandidate } from '../domain/waivers';
import { renderCriteriaSection } from '../domain/criteria';
import { hashCiKey } from '../ingest/webtrigger';
import { createDemoCriteria, createDemoEvidences, createDemoSettings } from './pay-123';

/** Les trois personnes du scénario, prises parmi les vrais utilisateurs du site. */
export interface BootstrapCast {
  /** Assignée du ticket : ne peut pas attester (SPEC §9.4). */
  readonly developer: string;
  /** Testeuse : rôle compétent pour attester. */
  readonly tester: string;
  /** Product owner : peut déroger (SPEC §12.4). */
  readonly owner: string;
  /** Compte de l'agent qui attache les preuves ; à défaut, celui du développeur. */
  readonly agent?: string;
}

/**
 * Les gestes humains de la démo : des attestations et des dérogations, avec la
 * personne qui les a faites. Le domaine décide (SPEC §9.4, §12.4) : si la
 * personne n'a pas le droit, l'amorçage le dit au lieu d'écrire.
 */
export interface BootstrapFlow {
  /** Attestations : le code du critère et le compte qui atteste. */
  readonly attest?: readonly { readonly code: string; readonly accountId: string }[];
  /** Dérogations : le code du critère, le compte, son rôle et le motif. */
  readonly waive?: readonly {
    readonly code: string;
    readonly accountId: string;
    readonly role: string;
    readonly reason: string;
  }[];
}

export interface BootstrapInput {
  readonly issueKey: string;
  /** Clé de CI du projet : seule son empreinte SHA-256 est rangée en base. */
  readonly ciKey: string;
  readonly cast: BootstrapCast;
  readonly language?: Language;
  /** Gestes humains à rejouer (attestation, dérogation). */
  readonly flow?: BootstrapFlow;
}

export interface BootstrapResult {
  readonly projectId: string;
  readonly issueId: string;
  readonly issueKey: string;
  /** `false` quand les critères existaient déjà : rien n'a été recréé. */
  readonly created: boolean;
  readonly criteria: readonly string[];
  readonly evidences: number;
  /** Dérogations accordées pendant l'amorçage. */
  readonly waivers: number;
  readonly descriptionRewritten: boolean;
  readonly coverage: { readonly proven: number; readonly total: number } | null;
}

/** Identifiants dérivés du ticket réel : deux tickets ne se marchent pas dessus. */
function rekey(issueId: string, sampleId: string): string {
  return `${issueId}-${sampleId}`;
}

/** Les quatre critères du scénario, rattachés au ticket réel. */
function criteriaFor(issue: IssueRef, author: string, at: string): Criterion[] {
  return createDemoCriteria().map((criterion) => ({
    ...criterion,
    id: rekey(issue.id, criterion.id),
    issueId: issue.id,
    createdBy: author,
    createdAt: at,
    updatedAt: at,
  }));
}

/**
 * Les trois preuves du scénario, rattachées au ticket réel et laissées
 * **déclarées** : c'est le vrai web trigger `ci-results` qui les fera monter en
 * `machine-verified` (SPEC §9.1). Le critère visé suit la même règle de
 * ré-indexation que `criteriaFor` : aucune table de correspondance à tenir.
 */
function evidencesFor(issue: IssueRef, author: string, at: string): Evidence[] {
  return createDemoEvidences().map((evidence) => ({
    ...evidence,
    id: rekey(issue.id, evidence.id),
    criterionId: rekey(issue.id, evidence.criterionId),
    strength: 'declared' as const,
    verified: false,
    commit: '',
    addedBy: author,
    addedByAgent: true,
    at,
  }));
}

/** Écrit les réglages du projet : empreinte de la clé de CI, langue, rôles. */
async function writeSettings(
  deps: AppDeps,
  issue: IssueRef,
  input: BootstrapInput,
): Promise<ProjectSettings> {
  const existing = await deps.store.getSettings(issue.projectId);
  const base: ProjectSettings = existing ?? createDemoSettings(issue.projectId);
  const settings: ProjectSettings = {
    ...base,
    projectId: issue.projectId,
    ciKeyHash: hashCiKey(input.ciKey),
    language: input.language ?? base.language ?? 'fr',
    updatedAt: deps.clock.now(),
  };
  await deps.store.saveSettings(settings);
  return settings;
}

/** Amorce le jeu de démonstration sur un ticket réel ; `null` si ticket inconnu. */
/**
 * Les attestations demandées : le domaine tranche (l'assigné et l'agent ne
 * peuvent pas attester), puis l'app écrit la preuve et l'attestation.
 */
async function applyAttestations(
  deps: AppDeps,
  issue: IssueRef,
  criteria: readonly Criterion[],
  settings: ProjectSettings,
  flow: BootstrapFlow,
): Promise<number> {
  let count = 0;
  for (const wanted of flow.attest ?? []) {
    const criterion = criteria.find((one) => one.code === wanted.code);
    if (criterion === undefined) continue;
    const roles = await deps.jira.projectRoles(issue.projectId, wanted.accountId);
    const actor: Actor = {
      accountId: wanted.accountId,
      displayName: wanted.accountId,
      agent: false,
      roles,
    };
    if (!canAttest(actor, issue, criterion, settings).allowed) continue;
    const evidenceId = deps.ids.next('ev');
    const evidence: Evidence = {
      id: evidenceId,
      criterionId: criterion.id,
      criterionVersion: criterion.version,
      type: 'attestation',
      reference: 'manual-check',
      note: 'Attestation verifiee manuellement.',
      strength: 'attested',
      commit: '',
      freshness: 'fresh',
      verified: true,
      addedBy: wanted.accountId,
      addedByAgent: false,
      at: deps.clock.now(),
      replacedBy: '',
    };
    await deps.store.saveEvidence(evidence);
    const attestation: Attestation = {
      id: deps.ids.next('att'),
      criterionId: criterion.id,
      evidenceId,
      attesterAccountId: wanted.accountId,
      role: roles[0] ?? '',
      note: 'Attestation verifiee manuellement.',
      attachmentRef: '',
      at: deps.clock.now(),
    };
    await deps.store.addAttestation(attestation);
    count += 1;
  }
  return count;
}

/**
 * Les dérogations demandées : le domaine tranche (rôle autorisé, motif
 * obligatoire), puis l'app écrit la dérogation.
 */
async function applyWaivers(
  deps: AppDeps,
  issue: IssueRef,
  criteria: readonly Criterion[],
  settings: ProjectSettings,
  flow: BootstrapFlow,
): Promise<number> {
  let count = 0;
  for (const wanted of flow.waive ?? []) {
    const criterion = criteria.find((one) => one.code === wanted.code);
    if (criterion === undefined) continue;
    const roles = await deps.jira.projectRoles(issue.projectId, wanted.accountId);
    const verdict = validateWaiverCandidate({
      criterionId: criterion.id,
      grantedBy: wanted.accountId,
      role: wanted.role,
      reason: wanted.reason,
      actorIsAgent: false,
      actorRoles: roles,
      rolesPolicy: settings.roles,
    });
    if (!verdict.valid) continue;
    const waiver: Waiver = {
      id: deps.ids.next('wv'),
      criterionId: criterion.id,
      grantedBy: wanted.accountId,
      role: wanted.role,
      reason: wanted.reason,
      at: deps.clock.now(),
      expiresAt: '',
      revokedAt: '',
    };
    await deps.store.saveWaiver(waiver);
    count += 1;
  }
  return count;
}

export async function bootstrapDemoData(
  deps: AppDeps,
  input: BootstrapInput,
): Promise<BootstrapResult | null> {
  const issue = await deps.jira.getIssue(input.issueKey);
  if (issue === null) return null;
  const language: Language = input.language ?? 'fr';
  await writeSettings(deps, issue, input);

  const existing = await deps.store.listCriteriaByIssue(issue.id);
  if (existing.length > 0) {
    const coverage = await deps.coverage.recompute(issue.id);
    return {
      projectId: issue.projectId,
      issueId: issue.id,
      issueKey: issue.key,
      created: false,
      criteria: existing.map((criterion) => criterion.code),
      evidences: (await deps.store.listEvidencesByIssue(issue.id)).length,
      waivers: (await deps.store.listWaiversByIssue(issue.id)).length,
      descriptionRewritten: false,
      coverage: coverage === null ? null : { proven: coverage.proven, total: coverage.total },
    };
  }

  const now = deps.clock.now();
  // Les critères et leurs preuves viennent de l'agent : c'est son compte qui
  // porte la trace (SPEC §19), pas celui du développeur assigné.
  const author = input.cast.agent ?? input.cast.developer;
  const criteria = criteriaFor(issue, author, now);
  for (const criterion of criteria) await deps.store.saveCriterion(criterion);
  const evidences = evidencesFor(issue, author, now);
  for (const evidence of evidences) await deps.store.saveEvidence(evidence);
  const descriptionRewritten = await deps.jira.rewriteDescriptionSection(
    issue.id,
    renderCriteriaSection(criteria, language),
  );
  const settings =
    (await deps.store.getSettings(issue.projectId)) ?? createDemoSettings(issue.projectId);
  const attested = await applyAttestations(deps, issue, criteria, settings, input.flow ?? {});
  const waived = await applyWaivers(deps, issue, criteria, settings, input.flow ?? {});
  const coverage = await deps.coverage.recompute(issue.id);
  return {
    projectId: issue.projectId,
    issueId: issue.id,
    issueKey: issue.key,
    created: true,
    criteria: criteria.map((criterion) => criterion.code),
    evidences: evidences.length + attested,
    waivers: waived,
    descriptionRewritten,
    coverage: coverage === null ? null : { proven: coverage.proven, total: coverage.total },
  };
}
