/**
 * Résolveur des quatre écrans Forge (SPEC §16, §20, lot L6).
 *
 * Enregistre les définitions appelées via `invoke` par l'UI :
 * - `get-issue-matrix` : matrice du ticket (lit la couverture stockée, ne
 *   recalcule pas — SPEC §20 : matrice affichée en moins de 2 s) ;
 * - `list-criterion-history` : historique des versions d'un critère (§8.4) ;
 * - `get-coverage-field` : champ « n / m » en lecture seule (§12.3, §16.2) ;
 * - `get-project-settings` / `save-project-settings` : réglages projet (§16.3) ;
 * - `get-project-page` : page projet (§16.4) ;
 * - gestes humains de la matrice : `attach-evidence`, `attest-criterion`,
 *   `waive-criterion`, `request-attestation` (§7.3, §9.4, §12.4). Après une
 *   écriture, la couverture est recalculée (§12.3).
 *
 * Aucun import `@forge/*` ici : le resolver ne voit que `AppDeps`.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { defaultProjectSettings } from '../defaults';
import type { AppDeps } from '../deps';
import { canAttest } from '../domain/independence';
import { attachEvidence, type AttachEvidenceInput } from '../domain/evidence';
import { isRoleAllowedToWaive, validateWaiverCandidate } from '../domain/waivers';
import type {
  Actor,
  Attestation,
  Coverage,
  Criterion,
  Evidence,
  EvidenceType,
  IssueRef,
  Language,
  ProjectSettings,

  Waiver,
} from '../types';
import { text } from '../i18n/index';
import { UI_MESSAGES } from '../i18n/ui';
import { buildCoverageFieldViewModel } from '../viewmodel/coverage';
import { buildMatrixViewModel, formatRevisionItem } from '../viewmodel/matrix';
import type { MatrixRights } from '../viewmodel/matrix';
import { buildProjectPageViewModel } from '../viewmodel/project';
import { buildSettingsViewModel } from '../viewmodel/settings';

/** Ce que `@forge/resolver` passe au callback : la charge utile et le contexte. */
export interface ResolverRequest {
  payload: Record<string, unknown>;
  context: unknown;
}

/** Ce que `@forge/resolver` expose : une définition par clé de module. */
export interface ResolverLike {
  define(key: string, fn: (request: ResolverRequest) => Promise<unknown>): void;
}

/** Contexte normalisé extrait de la charge utile et du contexte Forge. */
interface CallContext {
  readonly accountId: string;
  readonly projectId: string;
  readonly issueId: string;
  readonly issueKey: string;
  readonly language: Language;
}

/** Le début de l'histoire, au format que la base accepte dans un TIMESTAMP. */
const EPOCH = '1970-01-01 00:00:00';

function str(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return value === undefined || value === null ? '' : String(value);
}

/** Reconstruit le contexte d'appel depuis payload + contexte Forge. */
export function extractContext(req: ResolverRequest): CallContext {
  const p = req.payload ?? {};
  const ctx = (req.context ?? {}) as Record<string, unknown>;
  const ext = (ctx['extension'] ?? {}) as Record<string, unknown>;
  const jira = (ctx['platformContext'] ?? {}) as Record<string, unknown>;
  const langRaw = str(p, 'language') || str(ctx, 'locale') || 'en';
  return {
    accountId: str(p, 'accountId') || str(ctx, 'accountId'),
    projectId: str(p, 'projectId') || str(ext, 'projectId') || str(jira, 'projectId'),
    issueId: str(p, 'issueId') || str(ext, 'issueId') || str(jira, 'issueId'),
    issueKey: str(p, 'issueKey') || str(ext, 'issueKey') || str(jira, 'issueKey'),
    language: langRaw.toLowerCase().startsWith('fr') ? 'fr' : 'en',
  };
}

/**
 * Lit la couverture stockée (SPEC §20 : pas de recalcul au rendu). Résout une
 * clé de ticket en id via Jira si besoin ; `null` si aucune couverture.
 */
async function readStoredCoverage(deps: AppDeps, issueId: string, issueKey: string): Promise<Coverage | null> {
  if (issueId) {
    const direct = await deps.store.getCoverage(issueId);
    if (direct) return direct;
  }
  if (issueKey) {
    const byKey = await deps.store.getCoverage(issueKey);
    if (byKey) return byKey;
    const issue = await deps.jira.getIssue(issueKey);
    if (issue) return deps.store.getCoverage(issue.id);
  }
  return null;
}

/* --------------------------------------------------------------- requêtes */

async function handleGetMatrix(req: ResolverRequest, deps: AppDeps): Promise<unknown> {
  const ctx = extractContext(req);
  const { issueId, issueKey, language } = ctx;
  const coverage = await readStoredCoverage(deps, issueId, issueKey);
  const rights = await computeMatrixRights(deps, ctx, coverage);
  return buildMatrixViewModel(coverage, language, issueKey || issueId, rights);
}

/**
 * Droits de geste de l'acteur courant pour la matrice : ce qu'il peut attester
 * (indépendance, SPEC §9.4) et s'il peut déroger (SPEC §12.4). La vue affiche,
 * le domaine décide.
 */
async function computeMatrixRights(
  deps: AppDeps,
  ctx: CallContext,
  coverage: Coverage | null,
): Promise<MatrixRights> {
  const actor = await actorOfGesture(deps, ctx);
  const { issue, settings } = await loadGestureContext(deps, ctx);
  const waivable = !actor.agent && isRoleAllowedToWaive(actor.roles, settings.roles);
  const attestable = new Set<string>();
  if (!issue || !coverage) return { attestable, waivable };
  const criteria = await deps.store.listCriteriaByIssue(issue.id);
  for (const criterion of criteria) {
    if (canAttest(actor, issue, criterion, settings).allowed) attestable.add(criterion.id);
  }
  return { attestable, waivable };
}

async function handleListHistory(req: ResolverRequest, deps: AppDeps): Promise<unknown> {
  const { language } = extractContext(req);
  const criterionId = str(req.payload, 'criterionId');
  const code = str(req.payload, 'code') || 'AC';
  const revisions = await deps.store.listCriterionRevisions(criterionId);
  return revisions.map((r) => formatRevisionItem(r, code, language));
}

async function handleGetCoverageField(req: ResolverRequest, deps: AppDeps): Promise<unknown> {
  const { issueId, issueKey, language } = extractContext(req);
  const coverage = await readStoredCoverage(deps, issueId, issueKey);
  return buildCoverageFieldViewModel(coverage, language);
}

/* ------------------------------------------------------------ gestes (§7.3) */

/**
 * Acteur d'un geste d'écran : jamais un agent (SPEC §19), et son rôle vient
 * du projet, jamais de la charge utile (SPEC §9.4).
 */
async function actorOfGesture(deps: AppDeps, ctx: CallContext): Promise<Actor> {
  return deps.identity.actorOf({
    accountId: ctx.accountId,
    moduleId: 'jira:issuePanel',
    fromMcp: false,
    cloudId: '',
  });
}

/** Ticket et réglages du projet utiles à un geste (SPEC §9.4, §12.4). */
async function loadGestureContext(
  deps: AppDeps,
  ctx: CallContext,
): Promise<{ issue: IssueRef | null; settings: ProjectSettings }> {
  const issue = await deps.jira.getIssue(ctx.issueId || ctx.issueKey);
  const projectId = ctx.projectId || issue?.projectId || 'DEFAULT';
  const settings = (await deps.store.getSettings(projectId)) ?? defaultProjectSettings(projectId);
  return { issue, settings };
}

/** Rôle porté par l'acteur qui autorise le geste — jamais un rôle déclaré. */
function roleAuthorizing(
  actor: Actor,
  allowed: readonly string[],
): string {
  return actor.roles.find((role) => allowed.includes(role)) ?? actor.roles[0] ?? '';
}

/**
 * Vérifie le droit d'attester avant toute écriture (SPEC §9.4). Sans ticket ou
 * sans critère lisible, on refuse : mieux vaut un geste refusé qu'une
 * attestation non indépendante enregistrée.
 */
function checkAttestRight(
  actor: Actor,
  issue: IssueRef | null,
  criterion: Criterion | null,
  settings: ProjectSettings,
): { allowed: boolean; reason: string } {
  if (!criterion) {
    return { allowed: false, reason: text(UI_MESSAGES, 'ui.gesture.unknownCriterion', settings.language) };
  }
  if (!issue) {
    return { allowed: false, reason: text(UI_MESSAGES, 'ui.gesture.unknownIssue', settings.language) };
  }
  const verdict = canAttest(actor, issue, criterion, settings);
  return verdict.allowed ? { allowed: true, reason: '' } : { allowed: false, reason: verdict.reason };
}

/** Traduit le refus du domaine des dérogations (SPEC §20). */
function translateWaiverError(error: string | undefined, language: Language): string {
  const key = (error && WAIVER_ERROR_KEYS[error]) || 'ui.waiver.refused';
  return text(UI_MESSAGES, key, language, { reason: error ?? '' });
}

/** Messages du domaine de dérogation traduits (SPEC §20). */
const WAIVER_ERROR_KEYS: Record<string, string> = {
  'An agent can never grant a waiver': 'ui.waiver.refusedAgent',
  'Criterion ID is required': 'ui.waiver.refusedCriterion',
  'Reason is required for a waiver': 'ui.waiver.reasonRequired',
  'Actor does not possess an authorized role to grant waivers': 'ui.waiver.roleRequired',
};


/**
 * Le panneau attache une preuve par le même geste du domaine que tout le
 * reste : la force et la vérification sont calculées par l'app (SPEC §9.1),
 * jamais déclarées par la personne. Une documentation n'est « vérifiée par
 * machine » que si le vérificateur la confirme — autrefois elle l'était à
 * l'aveugle (`verified: true` et `machine-verified` en dur).
 */
async function handleAttachEvidence(req: ResolverRequest, deps: AppDeps): Promise<unknown> {
  const { issueId, accountId } = extractContext(req);
  const p = req.payload;
  const criterionId = str(p, 'criterionId');
  const type = (str(p, 'type') || 'attachment') as EvidenceType;
  const criterion = await deps.store.getCriterion(criterionId);
  const input: AttachEvidenceInput = {
    criterionId,
    type,
    reference: str(p, 'reference') || str(p, 'value'),
    note: str(p, 'note'),
    addedBy: accountId || 'user',
    ...(str(p, 'replacesEvidenceId') ? { replacesEvidenceId: str(p, 'replacesEvidenceId') } : {}),
  };
  const result = await attachEvidence(input, deps, criterion);
  const target = issueId || criterion?.issueId || '';
  if (target) await deps.coverage.recompute(target);
  return { ok: true, evidenceId: result.evidence.id, strength: result.strength };
}

async function handleAttestCriterion(req: ResolverRequest, deps: AppDeps): Promise<unknown> {
  const ctx = extractContext(req);
  const { issueId } = ctx;
  const p = req.payload;
  const criterionId = str(p, 'criterionId');
  const note = str(p, 'note') || str(p, 'value');
  const attachmentRef = str(p, 'attachmentRef');
  const criterion = await deps.store.getCriterion(criterionId);
  const now = deps.clock.now();
  const actorContext = await actorOfGesture(deps, ctx);
  const { issue, settings } = await loadGestureContext(deps, ctx);

  // SPEC §9.4 : l'assigné n'atteste pas son propre travail, un agent jamais.
  const verdict = checkAttestRight(actorContext, issue, criterion, settings);
  if (!verdict.allowed) {
    return { ok: false, reason: verdict.reason };
  }
  const actor = actorContext.accountId || 'user';
  const role = roleAuthorizing(actorContext, settings.roles.attest);

  const evidenceId = deps.ids.next('ev');
  const evidence: Evidence = {
    id: evidenceId,
    criterionId,
    criterionVersion: criterion ? criterion.version : 1,
    type: 'attestation',
    reference: attachmentRef || 'manual-check',
    note,
    strength: 'attested',
    commit: '',
    freshness: 'fresh',
    verified: true,
    addedBy: actor,
    addedByAgent: false,
    at: now,
    replacedBy: '',
  };
  await deps.store.saveEvidence(evidence);

  const attestation: Attestation = {
    id: deps.ids.next('att'),
    criterionId,
    evidenceId,
    attesterAccountId: actor,
    role: role || str(p, 'role'),
    note,
    attachmentRef,
    at: now,
  };
  await deps.store.addAttestation(attestation);

  const target = issueId || criterion?.issueId || '';
  if (target) await deps.coverage.recompute(target);
  return { ok: true, attestationId: attestation.id };
}

async function handleWaiveCriterion(req: ResolverRequest, deps: AppDeps): Promise<unknown> {
  const ctx = extractContext(req);
  const { issueId, language } = ctx;
  const p = req.payload;
  const criterionId = str(p, 'criterionId');
  const criterion = await deps.store.getCriterion(criterionId);
  const actor = await actorOfGesture(deps, ctx);
  const { settings } = await loadGestureContext(deps, ctx);
  const reason = str(p, 'reason') || str(p, 'value');
  const role = roleAuthorizing(actor, settings.roles.waive);

  // SPEC §12.4 : dérogation motivée, par un rôle habilité, jamais par un agent.
  const check = validateWaiverCandidate({
    criterionId,
    grantedBy: actor.accountId || 'user',
    role,
    reason,
    actorIsAgent: actor.agent,
    actorRoles: actor.roles,
    rolesPolicy: settings.roles,
  });
  if (!check.valid) {
    return { ok: false, reason: translateWaiverError(check.error, language) };
  }

  const waiver: Waiver = {
    id: deps.ids.next('wv'),
    criterionId,
    grantedBy: actor.accountId || 'user',
    role,
    reason,
    at: deps.clock.now(),
    expiresAt: '',
    revokedAt: '',
  };
  await deps.store.saveWaiver(waiver);
  const target = issueId || criterion?.issueId || '';
  if (target) await deps.coverage.recompute(target);
  return { ok: true, waiverId: waiver.id };
}

async function handleRequestAttestation(req: ResolverRequest, deps: AppDeps): Promise<unknown> {
  const { issueKey, accountId } = extractContext(req);
  const p = req.payload;
  const criterionId = str(p, 'criterionId');
  const target = str(p, 'targetAccount') || accountId;
  if (target) {
    // Les clés de notification sont résolues par la passerelle Jira (§9.4).
    await deps.jira.notify(
      target,
      'ui.notify.attestation.subject',
      'ui.notify.attestation.body',
      issueKey || criterionId,
    );
  }
  return { ok: true };
}

/* -------------------------------------------------- réglages & page projet */

async function handleGetSettings(req: ResolverRequest, deps: AppDeps): Promise<unknown> {
  const { projectId, language } = extractContext(req);
  const id = projectId || 'DEFAULT';
  const settings = await deps.store.getSettings(id);
  return buildSettingsViewModel(settings, id, language);
}

async function handleSaveSettings(req: ResolverRequest, deps: AppDeps): Promise<unknown> {
  const { projectId, language } = extractContext(req);
  const id = projectId || 'DEFAULT';
  const p = req.payload as Partial<ProjectSettings>;
  const existing = (await deps.store.getSettings(id)) ?? defaultProjectSettings(id);
  const updated: ProjectSettings = { ...existing, ...p, projectId: id, updatedAt: deps.clock.now() };
  await deps.store.saveSettings(updated);
  return buildSettingsViewModel(updated, id, language);
}

async function handleGetProjectPage(req: ResolverRequest, deps: AppDeps): Promise<unknown> {
  const { projectId, language } = extractContext(req);
  const id = projectId || 'DEFAULT';
  // Les statistiques se calculent par CLÉ de projet : les lignes de couverture
  // sont rangées par clé de ticket (`PAY-1`), dont le préfixe est la clé du
  // projet. Passer l'id numérique donnait des statistiques vides.
  const projectKey = await deps.jira.projectKey(id);
  const [settings, waivers, living, stats, closedIds] = await Promise.all([
    deps.store.getSettings(id),
    deps.store.listWaiversByProject(projectKey, EPOCH),
    deps.store.listLivingByProject(id),
    deps.store.computeStats(projectKey, EPOCH),
    deps.store.listClosedWithoutCoverage(id, 20),
  ]);
  const rows = await Promise.all(closedIds.map((cid) => deps.store.getCoverage(cid)));
  const coverages = rows.filter((r): r is Coverage => r !== null);
  return buildProjectPageViewModel({
    projectId: id,
    coverages,
    waivers,
    living,
    stats,
    language: settings?.language ?? language,
  });
}

/* ------------------------------------------------------------- enregistrement */

/** Enregistre les définitions des écrans et de leurs gestes. */
export function registerResolvers(resolver: ResolverLike, deps: AppDeps): void {
  resolver.define('get-issue-matrix', (req) => handleGetMatrix(req, deps));
  resolver.define('list-criterion-history', (req) => handleListHistory(req, deps));
  resolver.define('get-coverage-field', (req) => handleGetCoverageField(req, deps));
  resolver.define('attach-evidence', (req) => handleAttachEvidence(req, deps));
  resolver.define('attest-criterion', (req) => handleAttestCriterion(req, deps));
  resolver.define('waive-criterion', (req) => handleWaiveCriterion(req, deps));
  resolver.define('request-attestation', (req) => handleRequestAttestation(req, deps));
  resolver.define('get-project-settings', (req) => handleGetSettings(req, deps));
  resolver.define('save-project-settings', (req) => handleSaveSettings(req, deps));
  resolver.define('get-project-page', (req) => handleGetProjectPage(req, deps));
}
