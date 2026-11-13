/**
 * Demo dataset PAY-123 (SPEC §7, §22, §24).
 *
 * Single source of truth for every demo number, criterion, proof, CI outcome,
 * attestation and waiver quoted in the documentation. Nothing is hard-coded
 * twice: the docs quote these values and `tests/sample/pay-123.test.ts` locks
 * them (4 criteria, 2 machine proofs, 1 awaiting attestation, 1 without
 * evidence → coverage 2 / 4).
 *
 * Rule: files < 500 lines, functions < 50 lines.
 */
import type {
  Actor,
  Attestation,
  BlockingItem,
  CiSummary,
  Coverage,
  Criterion,
  CriterionState,
  Evidence,
  IssueRef,
  ProjectSettings,
  TestOutcome,
  TestRun,
  Waiver,
} from '../types';
import type { ProofStore } from '../ports';
import { defaultProjectSettings } from '../defaults';
import { DOCS_MESSAGES } from '../i18n/docs';

/** Reads a demo message in French; the English twin lives beside it. */
function fr(key: string): string {
  return DOCS_MESSAGES[key].fr;
}

export const DEMO_PROJECT_ID = '10000';
export const DEMO_PROJECT_KEY = 'PAY';
export const DEMO_ISSUE_ID = '10001';
export const DEMO_ISSUE_KEY = 'PAY-123';
export const DEMO_REPO = 'pay/paiements';
export const DEMO_BRANCH = 'feature/PAY-123-refusal-email';
export const DEMO_COMMIT = 'e41f0c9a1b2c3d4e5f60';
export const DEMO_COMPONENT = 'checkout-api';
export const DEMO_FIX_VERSION = '2.4';
export const DEMO_NOW = '2026-11-11T08:00:00.000Z';

export const DEMO_ACTORS: Readonly<Record<string, Actor>> = {
  agent: { accountId: 'agent-coder', displayName: 'Agent Code', agent: true, roles: [] },
  developer: { accountId: 'user-dev', displayName: 'Camille Dev', agent: false, roles: ['Developers'] },
  tester: { accountId: 'user-tester', displayName: 'Nora QA', agent: false, roles: ['Developers'] },
  owner: { accountId: 'user-po', displayName: 'Sam PO', agent: false, roles: ['Product Owner'] },
};

export const DEMO_TEST_REFUSAL = 'checkout refuses an expired card';
export const DEMO_TEST_LOG = 'checkout logs the refusal reason';

export function createDemoSettings(projectId: string = DEMO_PROJECT_ID): ProjectSettings {
  return {
    ...defaultProjectSettings(projectId),
    ciKeyHash: 'sha256-demo-hash-of-the-ci-key',
    updatedAt: DEMO_NOW,
  };
}

export function createDemoIssue(): IssueRef {
  return {
    id: DEMO_ISSUE_ID,
    key: DEMO_ISSUE_KEY,
    projectId: DEMO_PROJECT_ID,
    projectKey: DEMO_PROJECT_KEY,
    summary: 'Refuser un paiement par carte expirée et notifier le client',
    description: 'Critères d’acceptation à valider avant mise en production.',
    status: 'In Progress',
    assigneeAccountId: DEMO_ACTORS.developer.accountId,
    reporterAccountId: DEMO_ACTORS.owner.accountId,
    components: [DEMO_COMPONENT],
    fixVersions: [DEMO_FIX_VERSION],
    children: [],
  };
}

export function createDemoCriteria(): readonly [Criterion, Criterion, Criterion, Criterion] {
  const base = {
    issueId: DEMO_ISSUE_ID,
    version: 1,
    status: 'active' as const,
    createdBy: DEMO_ACTORS.agent.accountId,
    createdAt: DEMO_NOW,
    updatedAt: DEMO_NOW,
  };
  const of = (
    id: string,
    code: string,
    textKey: string,
    type: Criterion['type'],
    requiredStrength: Criterion['requiredStrength'],
  ): Criterion => ({ ...base, id, code, text: fr(textKey), type, requiredStrength });
  return [
    of('crit-1', 'AC-1', 'sample.criterion.ac1.text', 'functional', 'machine-verified'),
    of('crit-2', 'AC-2', 'sample.criterion.ac2.text', 'regression', 'machine-verified'),
    of('crit-3', 'AC-3', 'sample.criterion.ac3.text', 'functional', 'attested'),
    of('crit-4', 'AC-4', 'sample.criterion.ac4.text', 'functional', 'machine-verified'),
  ];
}

export function createDemoEvidences(): readonly [Evidence, Evidence, Evidence] {
  const common = {
    criterionVersion: 1,
    freshness: 'fresh' as const,
    addedBy: DEMO_ACTORS.agent.accountId,
    addedByAgent: true,
    at: DEMO_NOW,
    replacedBy: '',
  };
  const test = (id: string, criterionId: string, reference: string): Evidence => ({
    ...common,
    id,
    criterionId,
    type: 'test',
    reference,
    note: fr('sample.evidence.test.note'),
    strength: 'machine-verified',
    commit: DEMO_COMMIT,
    verified: true,
  });
  return [
    test('ev-1', 'crit-1', DEMO_TEST_REFUSAL),
    test('ev-2', 'crit-2', DEMO_TEST_LOG),
    {
      ...common,
      id: 'ev-3',
      criterionId: 'crit-3',
      type: 'agent-report',
      reference: 'report#ac-3',
      note: fr('sample.evidence.report.note'),
      strength: 'declared',
      commit: '',
      verified: true,
    },
  ];
}

export function createDemoCiOutcomes(): readonly TestOutcome[] {
  return [
    { name: DEMO_TEST_REFUSAL, state: 'passed', durationMs: 42 },
    { name: DEMO_TEST_LOG, state: 'passed', durationMs: 57 },
  ];
}

export function createDemoCiSummary(): CiSummary {
  return {
    repo: DEMO_REPO,
    branch: DEMO_BRANCH,
    commit: DEMO_COMMIT,
    mainBranch: false,
    tests: createDemoCiOutcomes(),
    receivedAt: DEMO_NOW,
  };
}

export function createDemoTestRun(): TestRun {
  return {
    id: 'run-1',
    repo: DEMO_REPO,
    branch: DEMO_BRANCH,
    commit: DEMO_COMMIT,
    mainBranch: false,
    receivedAt: DEMO_NOW,
  };
}

export function createDemoAttestation(): Attestation {
  return {
    id: 'att-1',
    criterionId: 'crit-3',
    evidenceId: 'ev-3',
    attesterAccountId: DEMO_ACTORS.tester.accountId,
    role: 'Developers',
    note: fr('sample.attestation.note'),
    attachmentRef: 'att-screenshot-1',
    at: DEMO_NOW,
  };
}

export function createDemoWaiver(): Waiver {
  return {
    id: 'wv-ac4',
    criterionId: 'crit-4',
    grantedBy: DEMO_ACTORS.owner.accountId,
    role: 'Product Owner',
    reason: fr('sample.waiver.reason'),
    at: DEMO_NOW,
    expiresAt: '',
    revokedAt: '',
  };
}

/** One matrix row; everything not overridden keeps its neutral default. */
function criterionState(c: Criterion, over: Partial<CriterionState> = {}): CriterionState {
  return {
    criterionId: c.id,
    code: c.code,
    text: c.text,
    type: c.type,
    version: c.version,
    requiredStrength: c.requiredStrength,
    bestEvidenceId: '',
    bestStrength: null,
    proven: false,
    waived: false,
    minor: false,
    defect: null,
    expected: '',
    evidences: [],
    waiverId: '',
    ...over,
  };
}

/** The four rows of the PAY-123 matrix, before attestation and waiver. */
export function createDemoCriterionStates(): readonly CriterionState[] {
  const [c1, c2, c3, c4] = createDemoCriteria();
  const [ev1, ev2, ev3] = createDemoEvidences();
  const provenByTest = (c: Criterion, ev: Evidence): CriterionState =>
    criterionState(c, {
      bestEvidenceId: ev.id,
      bestStrength: ev.strength,
      proven: true,
      expected: fr('sample.expect.machine'),
      evidences: [ev],
    });
  return [
    provenByTest(c1, ev1),
    provenByTest(c2, ev2),
    criterionState(c3, {
      bestEvidenceId: ev3.id,
      bestStrength: ev3.strength,
      defect: 'weak-strength',
      expected: fr('sample.expect.attested'),
      evidences: [ev3],
    }),
    criterionState(c4, { defect: 'no-evidence', expected: fr('sample.expect.none') }),
  ];
}

/** Blocking lines are derived from the matrix: one source, no copy. */
function blockingOf(states: readonly CriterionState[]): readonly BlockingItem[] {
  return states
    .filter((s): s is CriterionState & { defect: NonNullable<CriterionState['defect']> } =>
      !s.proven && !s.waived && s.defect !== null)
    .map((s) => ({
      criterionId: s.criterionId,
      code: s.code,
      text: s.text,
      defect: s.defect,
      expected: s.expected,
      minor: s.minor,
    }));
}

/** The coverage row the validator reads: 2 / 4 proven, transition blocked. */
export function createInitialDemoCoverage(): Coverage {
  const criteria = createDemoCriterionStates();
  const blocking = blockingOf(criteria);
  return {
    issueId: DEMO_ISSUE_ID,
    issueKey: DEMO_ISSUE_KEY,
    total: criteria.length,
    proven: criteria.filter((s) => s.proven).length,
    waived: criteria.filter((s) => s.waived).length,
    mode: 'strict',
    passes: blocking.length === 0,
    wouldBlock: blocking.length > 0,
    blocking,
    criteria,
    updatedAt: DEMO_NOW,
  };
}

/** Seeds any `ProofStore` (fake or Forge SQL) with the initial PAY-123 state. */
export async function loadDemoDataset(store: ProofStore): Promise<{
  settings: ProjectSettings;
  issue: IssueRef;
  criteria: readonly Criterion[];
  evidences: readonly Evidence[];
  coverage: Coverage;
}> {
  const settings = createDemoSettings();
  const issue = createDemoIssue();
  const criteria = createDemoCriteria();
  const evidences = createDemoEvidences();
  const coverage = createInitialDemoCoverage();

  await store.saveSettings(settings);
  for (const c of criteria) await store.saveCriterion(c);
  for (const e of evidences) await store.saveEvidence(e);

  const run = createDemoTestRun();
  await store.saveTestRun(run);
  await store.addTestResults(run.id, createDemoCiOutcomes());
  await store.saveCoverage(coverage);

  return { settings, issue, criteria, evidences, coverage };
}

/**
 * Replays SPEC §7.3–§7.4 on a seeded store: the tester attests AC-3, the
 * product owner waives AC-4. Coverage recomputation belongs to the engine
 * (lot L3); this only writes the two human gestures.
 */
export async function applyDemoResolutions(store: ProofStore): Promise<{
  attestation: Attestation;
  waiver: Waiver;
}> {
  const attestation = createDemoAttestation();
  const waiver = createDemoWaiver();
  await store.addAttestation(attestation);
  await store.saveWaiver(waiver);
  return { attestation, waiver };
}
