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
import { defaultProjectSettings } from '../defaults.js';
import type { AppDeps } from '../deps.js';
import type {
  Attestation,
  Coverage,
  Evidence,
  EvidenceType,
  Language,
  ProjectSettings,
  Strength,
  Waiver,
} from '../types.js';
import { buildCoverageFieldViewModel } from '../viewmodel/coverage.js';
import { buildMatrixViewModel, formatRevisionItem } from '../viewmodel/matrix.js';
import { buildProjectPageViewModel } from '../viewmodel/project.js';
import { buildSettingsViewModel } from '../viewmodel/settings.js';

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

const EPOCH = '1970-01-01T00:00:00.000Z';

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
  const { issueId, issueKey, language } = extractContext(req);
  const coverage = await readStoredCoverage(deps, issueId, issueKey);
  return buildMatrixViewModel(coverage, language, issueKey || issueId);
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

function strengthForEvidenceType(type: EvidenceType): Strength {
  if (type === 'test' || type === 'documentation') return 'machine-verified';
  if (type === 'attestation') return 'attested';
  return 'declared';
}

async function handleAttachEvidence(req: ResolverRequest, deps: AppDeps): Promise<unknown> {
  const { issueId, accountId } = extractContext(req);
  const p = req.payload;
  const criterionId = str(p, 'criterionId');
  const type = (str(p, 'type') || 'attachment') as EvidenceType;
  const criterion = await deps.store.getCriterion(criterionId);
  const evidence: Evidence = {
    id: deps.ids.next('ev'),
    criterionId,
    criterionVersion: criterion ? criterion.version : 1,
    type,
    reference: str(p, 'reference') || str(p, 'value'),
    note: str(p, 'note'),
    strength: strengthForEvidenceType(type),
    commit: '',
    freshness: 'fresh',
    verified: true,
    addedBy: accountId || 'user',
    addedByAgent: false,
    at: deps.clock.now(),
    replacedBy: '',
  };
  await deps.store.saveEvidence(evidence);
  const target = issueId || criterion?.issueId || '';
  if (target) await deps.coverage.recompute(target);
  return { ok: true, evidenceId: evidence.id, strength: evidence.strength };
}

async function handleAttestCriterion(req: ResolverRequest, deps: AppDeps): Promise<unknown> {
  const { issueId, accountId } = extractContext(req);
  const p = req.payload;
  const criterionId = str(p, 'criterionId');
  const note = str(p, 'note') || str(p, 'value');
  const attachmentRef = str(p, 'attachmentRef');
  const criterion = await deps.store.getCriterion(criterionId);
  const now = deps.clock.now();
  const actor = accountId || 'user';

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
    role: str(p, 'role') || 'Developers',
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
  const { issueId, accountId } = extractContext(req);
  const p = req.payload;
  const criterionId = str(p, 'criterionId');
  const criterion = await deps.store.getCriterion(criterionId);
  const waiver: Waiver = {
    id: deps.ids.next('wv'),
    criterionId,
    grantedBy: accountId || 'user',
    role: str(p, 'role') || 'Product Owner',
    reason: str(p, 'reason') || str(p, 'value'),
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
  const [settings, waivers, living, stats, closedIds] = await Promise.all([
    deps.store.getSettings(id),
    deps.store.listWaiversByProject(id, EPOCH),
    deps.store.listLivingByProject(id),
    deps.store.computeStats(id, EPOCH),
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
