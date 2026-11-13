/**
 * Domain contract — the frozen vocabulary of the app (SPEC §4, §8, §9, §12).
 *
 * Every lot owns its own files but nobody owns this one: changing a type here
 * is a contract change, done in a dedicated pull request and announced in
 * docs/CONTRACTS.md. Rule: files < 500 lines, functions < 50 lines.
 */

/* ------------------------------------------------------------------ strengths */

/** The three strengths of an evidence (SPEC §4, §9.1), weakest to strongest. */
export type Strength = 'declared' | 'attested' | 'machine-verified';

/** Ranking used by every comparison: a proof must *reach* the required strength. */
export const STRENGTH_ORDER: Readonly<Record<Strength, number>> = {
  declared: 1,
  attested: 2,
  'machine-verified': 3,
};

/** True when `got` is at least as strong as `required`. */
export function reaches(got: Strength | null, required: Strength): boolean {
  if (got === null) return false;
  return STRENGTH_ORDER[got] >= STRENGTH_ORDER[required];
}

/* ------------------------------------------------------------------- criteria */

/** Criterion types (SPEC §8.1). The type drives the required strength. */
export type CriterionType =
  | 'functional'
  | 'regression'
  | 'performance'
  | 'security'
  | 'accessibility'
  | 'data'
  | 'documentation';

export const CRITERION_TYPES: readonly CriterionType[] = [
  'functional',
  'regression',
  'performance',
  'security',
  'accessibility',
  'data',
  'documentation',
];

/**
 * Lifecycle of a criterion (SPEC §8.3, §8.4):
 * - `proposed`  — suggested by an agent or by the import, awaiting a human;
 * - `active`    — validated, counted in the coverage;
 * - `superseded`— an older version, kept for the dossier, never counted.
 */
export type CriterionStatus = 'proposed' | 'active' | 'superseded';

/** One acceptance criterion, with a stable code and a version (SPEC §8.1). */
export interface Criterion {
  id: string;
  issueId: string;
  /** Stable identifier, `AC-1`, kept even when the text changes. */
  code: string;
  text: string;
  type: CriterionType;
  /** Inherited from the type, overridable per criterion (SPEC §8.1). */
  requiredStrength: Strength;
  version: number;
  status: CriterionStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** One row of the criterion history (SPEC §8.4, table `criterion_history`). */
export interface CriterionRevision {
  criterionId: string;
  version: number;
  text: string;
  type: CriterionType;
  changedBy: string;
  at: string;
}

/** A criterion read from the description, before validation (SPEC §8.2). */
export interface ParsedCriterion {
  text: string;
  type: CriterionType;
  /** Where it came from, shown to the human who validates the split. */
  origin: 'checkbox' | 'list' | 'scenario';
}

/* ------------------------------------------------------------------- evidence */

/** The six evidence types (SPEC §9.1). */
export type EvidenceType =
  | 'test'
  | 'documentation'
  | 'attestation'
  | 'attachment'
  | 'agent-report'
  | 'link';

export const EVIDENCE_TYPES: readonly EvidenceType[] = [
  'test',
  'documentation',
  'attestation',
  'attachment',
  'agent-report',
  'link',
];

/**
 * Freshness (SPEC §9.3, §8.4, §21):
 * - `fresh`        — counts now;
 * - `to-reconfirm` — new commits on the branch, or the criterion changed: a
 *                    human confirms it in one click, otherwise it falls;
 * - `stale`        — superseded by a newer version of the same evidence.
 */
export type Freshness = 'fresh' | 'to-reconfirm' | 'stale';

/** One evidence attached to one criterion version (SPEC §9, table `evidence`). */
export interface Evidence {
  id: string;
  criterionId: string;
  criterionVersion: number;
  type: EvidenceType;
  /** Test name, page URL, attachment id, report anchor, free link. */
  reference: string;
  note: string;
  /** Computed by the app, never declared by the caller (SPEC §9.1). */
  strength: Strength;
  /** Commit on which a test evidence passed (SPEC §4, principle 4). */
  commit: string;
  freshness: Freshness;
  /** Result of the app's own verification of this evidence type (SPEC §9.1). */
  verified: boolean;
  addedBy: string;
  /** True when the evidence came through MCP: an agent can only declare. */
  addedByAgent: boolean;
  at: string;
  /** Integrity (SPEC §20): replaced, never deleted. */
  replacedBy: string;
}

/** A third-party attestation (SPEC §9.1, §9.4, table `attestation`). */
export interface Attestation {
  id: string;
  criterionId: string;
  evidenceId: string;
  attesterAccountId: string;
  role: string;
  note: string;
  attachmentRef: string;
  at: string;
}

/** A motivated, signed waiver on one criterion (SPEC §12.4). */
export interface Waiver {
  id: string;
  criterionId: string;
  grantedBy: string;
  role: string;
  reason: string;
  at: string;
  /** Empty means "until the ticket closes". */
  expiresAt: string;
  revokedAt: string;
}

/* --------------------------------------------------------------- requirements */

/** What a project demands for one criterion type (SPEC §9.2). */
export interface Requirement {
  /** Strengths that satisfy the criterion, strongest first. */
  accepted: readonly Strength[];
  /** Role that must attest (security, data). Empty means any project member. */
  attesterRole: string;
  /** The attester must not be the author of the work (data, migration). */
  notAuthor: boolean;
  /** A measurement link must be attached (performance). */
  measurementLink: boolean;
  /** Cross-evidence: how many distinct types are demanded (SPEC §9.2, lot C). */
  minDistinctTypes: number;
  /** Lenient mode lets these criteria through, flagged (SPEC §12.2). */
  minor: boolean;
}

/** The project grid, one entry per criterion type (SPEC §9.2). */
export type RequirementGrid = Readonly<Record<CriterionType, Requirement>>;

/** Gate severity chosen by the project (SPEC §12.2). */
export type GateMode = 'strict' | 'lenient' | 'observe';

/** What the app does when a ticket has no criterion at all (SPEC §8.3). */
export type MissingCriteriaPolicy = 'block' | 'suggest';

/** Project roles that may attest and waive (SPEC §9.4, §12.4). */
export interface RolePolicy {
  attest: readonly string[];
  waive: readonly string[];
  security: readonly string[];
  data: readonly string[];
}

/** Per-project settings (SPEC §18, table `settings`). */
export interface ProjectSettings {
  projectId: string;
  requirements: RequirementGrid;
  mode: GateMode;
  roles: RolePolicy;
  missingCriteria: MissingCriteriaPolicy;
  /** Hash of the CI entry key; the clear key is shown once (SPEC §10). */
  ciKeyHash: string;
  /** A parent may require the coverage of its subtasks (SPEC §21). */
  requireChildren: boolean;
  language: Language;
  updatedAt: string;
}

/** The two interface languages (SPEC §20). */
export type Language = 'en' | 'fr';

/* ------------------------------------------------------------------ coverage */

/** Why a criterion is not proven — drives the blocking message (SPEC §7.2). */
export type Defect =
  | 'no-evidence'
  | 'weak-strength'
  | 'not-fresh'
  | 'not-independent'
  | 'unverified'
  | 'no-criteria';

/** The state of one criterion, as shown in the matrix (SPEC §16.1). */
export interface CriterionState {
  criterionId: string;
  code: string;
  text: string;
  type: CriterionType;
  version: number;
  requiredStrength: Strength;
  /** Best evidence reaching the requirement, or the best one available. */
  bestEvidenceId: string;
  bestStrength: Strength | null;
  proven: boolean;
  waived: boolean;
  minor: boolean;
  defect: Defect | null;
  /** The proof the app expects, in the project language (SPEC §12.1). */
  expected: string;
  evidences: readonly Evidence[];
  waiverId: string;
}

/** One line of the blocking message (SPEC §7.2). */
export interface BlockingItem {
  criterionId: string;
  code: string;
  text: string;
  defect: Defect;
  expected: string;
  minor: boolean;
}

/** The coverage of a ticket, recomputed on every change (SPEC §12.3). */
export interface Coverage {
  issueId: string;
  issueKey: string;
  total: number;
  proven: number;
  waived: number;
  mode: GateMode;
  /** The gate would let the transition through. */
  passes: boolean;
  /** What the gate would have blocked, counted in observe mode (SPEC §12.2). */
  wouldBlock: boolean;
  blocking: readonly BlockingItem[];
  criteria: readonly CriterionState[];
  updatedAt: string;
}

/** The validator answer (SPEC §12.1): `result` + `errorMessage`. */
export interface GateVerdict {
  result: boolean;
  errorMessage: string;
}

/* ---------------------------------------------------------------- CI results */

/** State of one test in a CI summary (SPEC §10). */
export type TestState = 'passed' | 'failed' | 'skipped' | 'absent';

/** One test result line: names and states only, never logs (SPEC §20). */
export interface TestOutcome {
  name: string;
  state: TestState;
  durationMs: number;
}

/** A pipeline summary received by the web trigger (SPEC §10). */
export interface CiSummary {
  repo: string;
  branch: string;
  commit: string;
  /** True when the branch is the main one: feeds the living proof (SPEC §13). */
  mainBranch: boolean;
  tests: readonly TestOutcome[];
  receivedAt: string;
}

/** Batched payload: 5 Mo cap, so a summary may arrive in several lots (SPEC §10). */
export interface CiBatch {
  runId: string;
  index: number;
  total: number;
  summary: CiSummary;
}

/** One stored run (SPEC §18, table `test_run`). */
export interface TestRun {
  id: string;
  repo: string;
  branch: string;
  commit: string;
  mainBranch: boolean;
  receivedAt: string;
}

/* ------------------------------------------------------------- test matching */

/** Status of a test ↔ criterion pair (SPEC §11). */
export type LinkStatus = 'proposed' | 'confirmed' | 'rejected';

/** A pair, proposed by the model and confirmed by a human (SPEC §11). */
export interface TestLink {
  id: string;
  criterionId: string;
  testName: string;
  status: LinkStatus;
  confidence: number;
  /** One sentence of justification, shown to the human who confirms. */
  rationale: string;
  confirmedBy: string;
  at: string;
}

/* --------------------------------------------------------------- living proof */

/** A delivered criterion that is no longer proven (SPEC §13). */
export type LivingState = 'proven' | 'regressed' | 'unproven';

export interface LivingProof {
  id: string;
  issueKey: string;
  criterionId: string;
  testName: string;
  state: LivingState;
  component: string;
  /** Commit of the last run that changed the state. */
  commit: string;
  since: string;
}

/* -------------------------------------------------------------------- actors */

/** Who is acting: a human with roles, or an agent that can only declare. */
export interface Actor {
  accountId: string;
  displayName: string;
  /** True for anything coming from MCP (SPEC §19, identity caveat). */
  agent: boolean;
  roles: readonly string[];
}

/** The ticket, as read from Jira, with only what the app needs. */
/**
 * A member of the Jira project: their account, their display name and the
 * project roles they hold (SPEC §9.4). The public site uses it to name the
 * people it shows — the app never invents an actor.
 */
export interface ProjectMember {
  readonly accountId: string;
  readonly displayName: string;
  readonly roles: readonly string[];
}

export interface IssueRef {
  id: string;
  key: string;
  projectId: string;
  projectKey: string;
  summary: string;
  description: string;
  status: string;
  assigneeAccountId: string;
  reporterAccountId: string;
  components: readonly string[];
  fixVersions: readonly string[];
  children: readonly string[];
}

/* ------------------------------------------------------------------- dossier */

/** The proof dossier of one release (SPEC §4, §17 lot S). */
export interface ReleaseDossier {
  versionId: string;
  versionName: string;
  projectKey: string;
  generatedAt: string;
  issues: readonly DossierIssue[];
  totals: DossierTotals;
}

export interface DossierIssue {
  issueKey: string;
  summary: string;
  total: number;
  proven: number;
  waived: number;
  waivers: readonly Waiver[];
  criteria: readonly CriterionState[];
}

export interface DossierTotals {
  issues: number;
  criteria: number;
  proven: number;
  machineVerified: number;
  attested: number;
  declared: number;
  waived: number;
}

/* ------------------------------------------------------------------ statistics */

/** Coverage and reopening statistics (SPEC §14 FP-18). */
export interface ProofStats {
  projectId: string;
  since: string;
  coverageByStrength: Readonly<Record<Strength, number>>;
  waiversByGranter: readonly GranterCount[];
  closedWithoutValidator: number;
  reopenings: readonly ReopeningRate[];
}

export interface GranterCount {
  accountId: string;
  displayName: string;
  count: number;
}

export interface ReopeningRate {
  strength: Strength;
  closed: number;
  reopened: number;
}

/* ------------------------------------------------------------- statuts Jira */

/** Un changement de statut d'un ticket, lu dans le changelog Jira. */
export interface StatusTransition {
  /** Le statut quitté. */
  readonly from: string;
  /** Le statut atteint. */
  readonly to: string;
}

/**
 * L'historique de statuts d'un ticket : ce qui dit s'il a été clos puis
 * rouvert (SPEC §14 FP-18). Aucun identifiant de compte : le changement de
 * statut est un fait du workflow, pas une personne.
 */
export interface TicketStatusHistory {
  /** L'id Jira du ticket (`10001`), celui de la ligne de couverture. */
  readonly issueId: string;
  /** La clé Jira du ticket (`PAY-123`). */
  readonly issueKey: string;
  /** Le statut actuel du ticket. */
  readonly currentStatus: string;
  /** Les changements de statut, du plus ancien au plus récent. */
  readonly transitions: readonly StatusTransition[];
}
