/**
 * Ports: the only boundary between the pure domain and the Forge runtime.
 *
 * The domain (`src/domain/*`) never imports `@forge/*`. Adapters (`src/db`,
 * `src/collect`, `src/ingest`, `src/handlers`, `src/actions`) implement these
 * interfaces, so the whole decision path is testable with in-memory fakes.
 *
 * Frozen contract: see docs/CONTRACTS.md. Rule: files < 500 lines,
 * functions < 50 lines.
 */
import type {
  Actor,
  Attestation,
  CiSummary,
  Coverage,
  Criterion,
  CriterionRevision,
  CriterionType,
  Evidence,
  EvidenceType,
  IssueRef,
  LivingProof,
  ParsedCriterion,
  ProjectMember,
  ProjectSettings,
  ProofStats,
  ReleaseDossier,
  Requirement,
  TestLink,
  TestOutcome,
  TestRun,
  Waiver,
} from './types';

/* --------------------------------------------------------------- primitives */

/** Injectable clock: every timestamp in the app comes from here. */
export interface Clock {
  now(): string;
}

/** Injectable identifiers, so tests are deterministic. */
export interface IdGenerator {
  next(prefix: string): string;
}

export interface Logger {
  log(level: 'info' | 'warn' | 'error', message: string, meta?: unknown): void;
}

/** Forge queue (SPEC §17): the web trigger enqueues, the consumer works. */
export interface JobQueue {
  publish(payload: CiIngestMessage): Promise<void>;
}

/** Message put on the queue by the CI web trigger (SPEC §17). */
export interface CiIngestMessage {
  runId: string;
  projectId: string;
  summary: CiSummary;
}

/* ------------------------------------------------------------------ gateways */

/** Reads Jira, and writes back only what the app owns (SPEC §8.2, §12.3). */
export interface JiraGateway {
  getIssue(issueIdOrKey: string): Promise<IssueRef | null>;
  /** Ticket of a branch, found by the key inside the branch name (SPEC §10). */
  findIssueByBranch(projectId: string, branch: string): Promise<IssueRef | null>;
  listIssuesOfVersion(projectId: string, versionId: string): Promise<IssueRef[]>;
  /** Rewrites only the criteria section of the description (SPEC §8.2). */
  rewriteDescriptionSection(issueId: string, section: string): Promise<boolean>;
  /** The `Preuves n / m` field, or an indexed issue property as a fallback. */
  setCoverageField(issueId: string, label: string, proven: number, total: number): Promise<boolean>;
  projectRoles(projectId: string, accountId: string): Promise<string[]>;
  /** The people who hold a role on the project, with that role (SPEC §9.4). */
  projectMembers(projectId: string): Promise<readonly ProjectMember[]>;
  notify(accountId: string, subjectKey: string, bodyKey: string, issueKey: string): Promise<boolean>;
  displayName(accountId: string): Promise<string>;
}

/** Everything the app verifies outside Jira (SPEC §9.1, right column). */
export interface EvidenceChecker {
  /** A Confluence page exists and changed after the ticket started. */
  documentationPage(url: string, since: string): Promise<boolean>;
  /** An attachment of the ticket exists. */
  attachmentExists(issueId: string, reference: string): Promise<boolean>;
  /** An agent report section exists and quotes the criterion (SPEC §9.1). */
  reportSection(issueId: string, reference: string, criterionCode: string): Promise<boolean>;
  /** A free link is reachable, when the app is allowed to check it. */
  linkReachable(url: string): Promise<boolean>;
}

/** Text-only model (SPEC §19: Forge LLMs never see an image). */
export interface LlmGateway {
  /** Splits acceptance criteria out of a description (SPEC §8.2). */
  parseCriteria(description: string, language: 'en' | 'fr'): Promise<ParsedCriterion[]>;
  /** Guesses the type of a criterion from its text (SPEC §8.1). */
  classifyCriterion(text: string): Promise<CriterionType>;
  /** Pairs new tests with criteria, with a confidence and a reason (SPEC §11). */
  suggestPairs(
    criteria: readonly Criterion[],
    testNames: readonly string[],
  ): Promise<readonly SuggestedPair[]>;
}

/** One pair proposed by the model, never a proof until a human confirms it. */
export interface SuggestedPair {
  criterionId: string;
  testName: string;
  confidence: number;
  rationale: string;
}

/** Who is acting, and whether it is an agent (SPEC §19, identity caveat). */
export interface IdentityGateway {
  /** Actor behind a Forge context or an MCP call; MCP is always `agent`. */
  actorOf(context: ActorContext): Promise<Actor>;
}

/** What Forge passes to a function: identity and module only. */
export interface ActorContext {
  accountId: string;
  moduleId: string;
  /** True when the call comes from `rovo:mcp` or `action` (SPEC §15). */
  fromMcp: boolean;
  cloudId: string;
}

/* ------------------------------------------------------------------- storage */

/** Criteria, their history and the proposals awaiting a human (SPEC §8). */
export interface CriterionStore {
  listCriteriaByIssue(issueId: string, statuses?: readonly string[]): Promise<Criterion[]>;
  getCriterion(criterionId: string): Promise<Criterion | null>;
  getCriterionByCode(issueId: string, code: string): Promise<Criterion | null>;
  saveCriterion(criterion: Criterion): Promise<void>;
  addCriterionRevision(revision: CriterionRevision): Promise<void>;
  listCriterionRevisions(criterionId: string): Promise<CriterionRevision[]>;
  nextCriterionCode(issueId: string): Promise<string>;
}

/** Evidence, attestations and what the app verified (SPEC §9). */
export interface EvidenceStore {
  listEvidencesByCriterion(criterionId: string): Promise<Evidence[]>;
  listEvidencesByIssue(issueId: string): Promise<Evidence[]>;
  listEvidencesByTestName(testName: string): Promise<Evidence[]>;
  getEvidence(evidenceId: string): Promise<Evidence | null>;
  saveEvidence(evidence: Evidence): Promise<void>;
  addAttestation(attestation: Attestation): Promise<void>;
  listAttestations(criterionId: string): Promise<Attestation[]>;
  /** Evidence of a criterion version, to mark "to review" (SPEC §8.4). */
  markEvidencesToReconfirm(criterionId: string, fromVersion: number): Promise<number>;
}

/** Waivers and their counters (SPEC §12.4). */
export interface WaiverStore {
  listWaiversByCriterion(criterionId: string): Promise<Waiver[]>;
  listWaiversByIssue(issueId: string): Promise<Waiver[]>;
  listWaiversByProject(projectId: string, since: string): Promise<Waiver[]>;
  saveWaiver(waiver: Waiver): Promise<void>;
  revokeWaiver(waiverId: string, at: string): Promise<boolean>;
}

/** Coverage and settings: the two lines the validator reads (SPEC §17). */
export interface CoverageStore {
  getCoverage(issueId: string): Promise<Coverage | null>;
  saveCoverage(coverage: Coverage): Promise<void>;
  /** Tickets closed without coverage, listed every night (SPEC §20). */
  listClosedWithoutCoverage(projectId: string, limit: number): Promise<string[]>;
}

export interface SettingsStore {
  getSettings(projectId: string): Promise<ProjectSettings | null>;
  saveSettings(settings: ProjectSettings): Promise<void>;
  /** Project owning a CI key hash (SPEC §10). */
  findProjectByCiKeyHash(hash: string): Promise<ProjectSettings | null>;
}

/** CI runs, their results and the confirmed pairs (SPEC §10, §11). */
export interface TestRunStore {
  saveTestRun(run: TestRun): Promise<void>;
  getTestRun(runId: string): Promise<TestRun | null>;
  addTestResults(runId: string, outcomes: readonly TestOutcome[]): Promise<number>;
  listTestResults(runId: string): Promise<TestOutcome[]>;
  /** Last run of a branch: drives freshness (SPEC §9.3). */
  latestRunForBranch(repo: string, branch: string): Promise<TestRun | null>;
  latestOutcomesForBranch(repo: string, branch: string): Promise<TestOutcome[]>;
}

export interface TestLinkStore {
  listLinksByCriterion(criterionId: string): Promise<TestLink[]>;
  listConfirmedLinksByTest(testName: string): Promise<TestLink[]>;
  listProposedLinks(issueId: string): Promise<TestLink[]>;
  saveLink(link: TestLink): Promise<void>;
}

/** Living proof after closure (SPEC §13). */
export interface LivingStore {
  listLivingByProject(projectId: string, state?: string): Promise<LivingProof[]>;
  listUnprovenLiving(projectId: string): Promise<LivingProof[]>;
  saveLivingProof(proof: LivingProof): Promise<void>;
}

/** Statistics and the release dossier (SPEC §14 FP-17, FP-18). */
export interface ReportingStore {
  computeStats(projectId: string, since: string): Promise<ProofStats>;
  getDossier(versionId: string): Promise<ReleaseDossier | null>;
  saveDossier(dossier: ReleaseDossier): Promise<void>;
}

/** The whole persistence surface, assembled in `src/db/repo.ts`. */
export interface ProofStore
  extends CriterionStore,
    EvidenceStore,
    WaiverStore,
    CoverageStore,
    SettingsStore,
    TestRunStore,
    TestLinkStore,
    LivingStore,
    ReportingStore {}

/* ---------------------------------------------------------------- dependencies */

/** What the domain needs to compute a coverage (SPEC §12). */
export interface CoverageDeps {
  store: ProofStore;
  jira: JiraGateway;
  clock: Clock;
  logger: Logger;
}

/**
 * Recomputes and stores the coverage of a ticket (SPEC §12.3).
 *
 * Implemented by lot L3 in `src/domain/coverage-engine.ts`; every other lot
 * calls it instead of recomputing coverage, so the validator, the CI consumer
 * and the MCP tool always read the same row (SPEC §22, point 10).
 */
export interface CoverageEngine {
  /** Recomputes the coverage of a ticket and stores it; returns the row. */
  recompute(issueId: string): Promise<Coverage | null>;
  /** The stored coverage, without recomputing. */
  read(issueId: string): Promise<Coverage | null>;
}

/** What the requirement resolution needs (SPEC §9.2). */
export interface RequirementResolver {
  forType(settings: ProjectSettings, type: CriterionType): Requirement;
  forCriterion(settings: ProjectSettings, criterion: Criterion): Requirement;
  /** The proof expected for a criterion, in the project language. */
  expectedProof(settings: ProjectSettings, criterion: Criterion, evidenceType?: EvidenceType): string;
}
