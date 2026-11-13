/**
 * Amorçage du jeu de démonstration dans l'app RÉELLE (lot `app-donnees-reelles`).
 *
 * Ce module écrit l'histoire d'un ticket dans le Forge SQL d'une installation
 * réelle, pour un ticket Jira réel. Il ne fabrique aucune règle : il pose des
 * lignes, puis laisse le moteur de couverture calculer.
 *
 * L'histoire vient du **scénario** du ticket (`src/sample/scenario.ts`) : ses
 * propres critères, ses preuves de plusieurs types, ses gestes humains, ses
 * paires test ↔ critère, ses révisions. Sans scénario, c'est le jeu du sample
 * (quatre critères du SPEC §7) qui est posé — le comportement d'avant.
 *
 * Ce qui est réel après amorçage : le ticket, sa description réécrite par l'app,
 * les identifiants, les réglages du projet, et la couverture calculée par le
 * moteur. Les preuves d'amorçage partent **déclarées** : c'est le vrai web
 * trigger `ci-results` (signé) qui les fait monter en `machine-verified`, comme
 * dans un vrai pipeline.
 *
 * Idempotent : si le ticket porte déjà des critères, rien n'est recréé.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps';
import type {
  Actor,
  Criterion,
  Evidence,
  IssueRef,
  Language,
  ProjectSettings,
} from '../types';
import { renderCriteriaSection } from '../domain/criteria';
import { hashCiKey } from '../ingest/webtrigger';
import { createDemoCriteria, createDemoEvidences, createDemoSettings } from './pay-123';
import type { DemoScenario } from './scenario';
import {
  applyAttestations,
  applyRevisions,
  applyTestLinks,
  applyWaivers,
  criteriaFromScenario,
  evidencesFromScenario,
  mergeScenario,
  rekey,
  scenarioReplacesStory,
  supersedePreviousStory,
  type BootstrapFlow,
  type GestureOutcome,
} from './scenario-replay';

export type { BootstrapFlow } from './scenario-replay';

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

export interface BootstrapInput {
  readonly issueKey: string;
  /** Clé de CI du projet : seule son empreinte SHA-256 est rangée en base. */
  readonly ciKey: string;
  readonly cast: BootstrapCast;
  readonly language?: Language;
  /** Gestes humains à rejouer (attestation, dérogation) — ancien format. */
  readonly flow?: BootstrapFlow;
  /** L'histoire du ticket : ses critères, ses preuves, ses gestes, ses révisions. */
  readonly scenario?: DemoScenario;
}

export interface BootstrapResult {
  readonly projectId: string;
  readonly issueId: string;
  readonly issueKey: string;
  /** `false` quand les critères existaient déjà : rien n'a été recréé. */
  readonly created: boolean;
  /** Les codes des critères posés, dans l'ordre. */
  readonly criteria: readonly string[];
  /** Preuves écrites, attestations comprises. */
  readonly evidences: number;
  /** Paires test ↔ critère confirmées (preuve vivante). */
  readonly links: number;
  /** Attestations écrites (le domaine les a acceptées). */
  readonly attestations: number;
  /** Attestations refusées par le domaine : rien n'a été écrit pour elles. */
  readonly attestationsRefused: number;
  /** Dérogations accordées pendant l'amorçage. */
  readonly waivers: number;
  /** Dérogations refusées par le domaine : rien n'a été écrit pour elles. */
  readonly waiversRefused: number;
  /** Révisions de critère jouées (version 2 créée). */
  readonly revisions: number;
  readonly descriptionRewritten: boolean;
  readonly coverage: { readonly proven: number; readonly total: number } | null;
}

/** Les critères du ticket : ceux du scénario, ou ceux du sample. */
function criteriaFor(
  issue: IssueRef,
  author: string,
  at: string,
  scenario: DemoScenario,
): Criterion[] {
  if (scenario.criteria.length > 0) {
    return criteriaFromScenario(issue, author, at, scenario);
  }
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
 * Les preuves du ticket : celles du scénario, ou celles du sample. Elles
 * restent **déclarées** : c'est le vrai web trigger `ci-results` qui les fera
 * monter en `machine-verified` (SPEC §9.1). Le critère visé suit la même règle
 * de ré-indexation que `criteriaFor` : aucune table de correspondance à tenir.
 *
 * Les preuves du sample ne servent que si le ticket n'a pas de scénario : un
 * scénario a ses propres preuves (ou n'en a pas), jamais celles d'un autre
 * ticket.
 */
function evidencesFor(
  issue: IssueRef,
  author: string,
  developer: string,
  at: string,
  scenario: DemoScenario,
  criteria: readonly Criterion[],
): Evidence[] {
  if (scenario.criteria.length > 0) {
    return evidencesFromScenario(issue, author, developer, at, scenario, criteria);
  }
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

/** L'agent du cast : c'est lui qui attache les preuves et demande les révisions. */
function agentActor(cast: BootstrapCast): Actor {
  const accountId = cast.agent ?? cast.developer;
  return { accountId, displayName: accountId, agent: true, roles: [] };
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

/** Ce que le ticket porte déjà : l'amorçage ne recrée rien. */
async function existingState(
  deps: AppDeps,
  issue: IssueRef,
  criteria: readonly Criterion[],
): Promise<BootstrapResult> {
  const coverage = await deps.coverage.recompute(issue.id);
  let attestations = 0;
  for (const criterion of criteria) {
    attestations += (await deps.store.listAttestations(criterion.id)).length;
  }
  return {
    projectId: issue.projectId,
    issueId: issue.id,
    issueKey: issue.key,
    created: false,
    criteria: criteria.map((criterion) => criterion.code),
    evidences: (await deps.store.listEvidencesByIssue(issue.id)).length,
    links: (await deps.store.listProposedLinks(issue.id)).length,
    attestations,
    attestationsRefused: 0,
    waivers: (await deps.store.listWaiversByIssue(issue.id)).length,
    waiversRefused: 0,
    revisions: 0,
    descriptionRewritten: false,
    coverage: coverage === null ? null : { proven: coverage.proven, total: coverage.total },
  };
}

/** L'histoire du ticket, écrite : critères, preuves, révisions, description. */
interface WrittenScenario {
  readonly criteria: Criterion[];
  readonly evidences: readonly Evidence[];
  readonly revisions: number;
  readonly descriptionRewritten: boolean;
}

/** Les gestes joués : paires test ↔ critère, attestations, dérogations. */
interface PlayedGestures {
  readonly links: number;
  readonly attestations: GestureOutcome;
  readonly waivers: GestureOutcome;
}

/**
 * L'histoire du ticket, écrite : les critères et leurs preuves, puis les
 * révisions (le texte changé porte version 2 et les preuves antérieures passent
 * « à revoir », SPEC §8.4), puis la description réécrite.
 */
async function writeScenario(
  deps: AppDeps,
  issue: IssueRef,
  input: BootstrapInput,
  scenario: DemoScenario,
  author: string,
  at: string,
  language: Language,
): Promise<WrittenScenario> {
  const criteria = criteriaFor(issue, author, at, scenario);
  for (const criterion of criteria) await deps.store.saveCriterion(criterion);
  const evidences = evidencesFor(issue, author, input.cast.developer, at, scenario, criteria);
  for (const evidence of evidences) await deps.store.saveEvidence(evidence);
  const revisions = await applyRevisions(deps, criteria, scenario, agentActor(input.cast));
  const descriptionRewritten = await deps.jira.rewriteDescriptionSection(
    issue.id,
    renderCriteriaSection(revisions.criteria, language),
  );
  return {
    criteria: revisions.criteria,
    evidences,
    revisions: revisions.count,
    descriptionRewritten,
  };
}

/** Les gestes du scénario joués sur le ticket : paires, attestations, dérogations. */
async function playGestures(
  deps: AppDeps,
  issue: IssueRef,
  written: WrittenScenario,
  settings: ProjectSettings,
  scenario: DemoScenario,
): Promise<PlayedGestures> {
  const links = await applyTestLinks(deps, written.criteria, written.evidences, scenario);
  const attestations = await applyAttestations(
    deps,
    issue,
    written.criteria,
    settings,
    scenario.attest,
  );
  const waivers = await applyWaivers(deps, issue, written.criteria, settings, scenario.waive);
  return { links, attestations, waivers };
}

/** Amorce le jeu de démonstration sur un ticket réel ; `null` si ticket inconnu. */
export async function bootstrapDemoData(
  deps: AppDeps,
  input: BootstrapInput,
): Promise<BootstrapResult | null> {
  const issue = await deps.jira.getIssue(input.issueKey);
  if (issue === null) return null;
  const language: Language = input.language ?? 'fr';
  const scenario = mergeScenario(input.flow, input.scenario);
  await writeSettings(deps, issue, input);

  const existing = await deps.store.listCriteriaByIssue(issue.id, ['active', 'proposed']);
  // Un scénario identique ne touche à rien (l'amorçage est idempotent).
  // Un scénario différent remplace l'histoire : l'ancienne prend fin — ses
  // critères passent « superseded », ses dérogations sont révoquées, ses paires
  // rejetées — et la nouvelle s'écrit à côté.
  if (existing.length > 0 && !scenarioReplacesStory(existing, scenario)) {
    return existingState(
      deps,
      issue,
      existing.filter((criterion) => criterion.status === 'active'),
    );
  }
  if (existing.length > 0) await supersedePreviousStory(deps, issue, existing);

  const now = deps.clock.now();
  // Les critères et leurs preuves viennent de l'agent : c'est son compte qui
  // porte la trace (SPEC §19), pas celui du développeur assigné.
  const author = input.cast.agent ?? input.cast.developer;
  const written = await writeScenario(deps, issue, input, scenario, author, now, language);
  const settings =
    (await deps.store.getSettings(issue.projectId)) ?? createDemoSettings(issue.projectId);
  const gestures = await playGestures(deps, issue, written, settings, scenario);
  const coverage = await deps.coverage.recompute(issue.id);
  return {
    projectId: issue.projectId,
    issueId: issue.id,
    issueKey: issue.key,
    created: true,
    criteria: written.criteria.map((criterion) => criterion.code),
    evidences: written.evidences.length + gestures.attestations.written,
    links: gestures.links,
    attestations: gestures.attestations.written,
    attestationsRefused: gestures.attestations.refused,
    waivers: gestures.waivers.written,
    waiversRefused: gestures.waivers.refused,
    revisions: written.revisions,
    descriptionRewritten: written.descriptionRewritten,
    coverage: coverage === null ? null : { proven: coverage.proven, total: coverage.total },
  };
}
