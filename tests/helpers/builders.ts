/**
 * Constructeurs de fixtures : chaque test compose ses données à partir de ces
 * défauts réalistes au lieu de réécrire des objets littéraux (zéro duplication,
 * une seule source de vérité). Typage strict : aucun `any`, options partielles.
 *
 * Les défauts décrivent le ticket PAY-123 du SPEC §7 : un refus de paiement,
 * deux tests verts reçus par la CI, une déclaration d'agent, un critère nu.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { defaultProjectSettings, defaultStrengthForType } from '../../src/defaults.js';
import type {
  Actor,
  Attestation,
  CiSummary,
  Coverage,
  Criterion,
  CriterionRevision,
  CriterionState,
  Evidence,
  EvidenceType,
  IssueRef,
  LivingProof,
  ParsedCriterion,
  ProjectSettings,
  ReleaseDossier,
  Strength,
  TestLink,
  TestOutcome,
  TestRun,
  Waiver,
} from '../../src/types.js';
import { FIXED_NOW } from './fake-clock.js';

/* ------------------------------------------------------------------ repères */

export const NOW = FIXED_NOW;
export const PROJECT_ID = '10000';
export const PROJECT_KEY = 'PAY';
export const ISSUE_ID = '10001';
export const ISSUE_KEY = 'PAY-123';
export const REPO = 'pay/paiements';
export const BRANCH = 'feature/PAY-123-refusal-email';
export const COMMIT = 'e41f0c9a1b2c3d4e5f60';
export const COMPONENT = 'checkout-api';
/** Les comptes du scénario : un agent, une développeuse, une testeuse, un PO. */
export const AGENT = 'agent-coder';
export const DEVELOPER = 'user-dev';
export const TESTER = 'user-tester';
export const OWNER = 'user-po';
/** Les deux tests verts du §7.1 : l'un prouve AC-1, l'autre AC-2. */
export const TEST_REFUSAL = 'checkout refuses an expired card';
export const TEST_LOG = 'checkout logs the refusal reason';

/**
 * Force par défaut d'un type de preuve, d'après le tableau du SPEC §9.1.
 * C'est un défaut de fixture : la règle de calcul reste dans le domaine (L2).
 */
const STRENGTH_OF_TYPE: Readonly<Record<EvidenceType, Strength>> = {
  test: 'machine-verified',
  documentation: 'machine-verified',
  attestation: 'attested',
  attachment: 'declared',
  'agent-report': 'declared',
  link: 'declared',
};

export function strengthOfEvidenceType(type: EvidenceType): Strength {
  return STRENGTH_OF_TYPE[type];
}

/* ------------------------------------------------------------------- tickets */

export function anIssue(partial: Partial<IssueRef> = {}): IssueRef {
  return {
    id: ISSUE_ID,
    key: ISSUE_KEY,
    projectId: PROJECT_ID,
    projectKey: PROJECT_KEY,
    summary: 'Refuser un paiement par carte expirée',
    description: 'Critères d’acceptation à valider.',
    status: 'In Progress',
    assigneeAccountId: DEVELOPER,
    reporterAccountId: OWNER,
    components: [COMPONENT],
    fixVersions: ['2.4'],
    children: [],
    ...partial,
  };
}

export function anActor(partial: Partial<Actor> = {}): Actor {
  return {
    accountId: DEVELOPER,
    displayName: 'Camille Dev',
    agent: false,
    roles: ['Developers'],
    ...partial,
  };
}

export function settings(partial: Partial<ProjectSettings> = {}): ProjectSettings {
  return {
    ...defaultProjectSettings(PROJECT_ID),
    ciKeyHash: 'hash-of-the-ci-key',
    updatedAt: NOW,
    ...partial,
  };
}

/* ------------------------------------------------------------------ critères */

export function aCriterion(partial: Partial<Criterion> = {}): Criterion {
  const type = partial.type ?? 'functional';
  return {
    id: 'crit-1',
    issueId: ISSUE_ID,
    code: 'AC-1',
    text: 'Le paiement par carte expirée est refusé',
    type,
    requiredStrength: partial.requiredStrength ?? defaultStrengthForType(type),
    version: 1,
    status: 'active',
    createdBy: AGENT,
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

export function aCriterionRevision(partial: Partial<CriterionRevision> = {}): CriterionRevision {
  return {
    criterionId: 'crit-1',
    version: 2,
    text: 'Le paiement par carte expirée est refusé, avec un message explicite',
    type: 'functional',
    changedBy: DEVELOPER,
    at: NOW,
    ...partial,
  };
}

export function aParsedCriterion(partial: Partial<ParsedCriterion> = {}): ParsedCriterion {
  return {
    text: 'Le paiement par carte expirée est refusé',
    type: 'functional',
    origin: 'checkbox',
    ...partial,
  };
}

/* -------------------------------------------------------------------- preuves */

export function anEvidence(partial: Partial<Evidence> = {}): Evidence {
  const type = partial.type ?? 'test';
  return {
    id: 'ev-1',
    criterionId: 'crit-1',
    criterionVersion: 1,
    type,
    reference: partial.reference ?? TEST_REFUSAL,
    note: '',
    strength: partial.strength ?? STRENGTH_OF_TYPE[type],
    commit: COMMIT,
    freshness: 'fresh',
    verified: true,
    addedBy: DEVELOPER,
    addedByAgent: false,
    at: NOW,
    replacedBy: '',
    ...partial,
  };
}

export function anAttestation(partial: Partial<Attestation> = {}): Attestation {
  return {
    id: 'att-1',
    criterionId: 'crit-1',
    evidenceId: 'ev-1',
    attesterAccountId: TESTER,
    role: 'Developers',
    note: 'Refus déclenché, e-mail reçu.',
    attachmentRef: 'att-screenshot-1',
    at: NOW,
    ...partial,
  };
}

export function aWaiver(partial: Partial<Waiver> = {}): Waiver {
  return {
    id: 'wv-1',
    criterionId: 'crit-1',
    grantedBy: OWNER,
    role: 'Product Owner',
    reason: 'Reporté dans PAY-140',
    at: NOW,
    expiresAt: '',
    revokedAt: '',
    ...partial,
  };
}

/* ------------------------------------------------------------------------ CI */

export function aTestOutcome(partial: Partial<TestOutcome> = {}): TestOutcome {
  return {
    name: TEST_REFUSAL,
    state: 'passed',
    durationMs: 42,
    ...partial,
  };
}

export function aCiSummary(partial: Partial<CiSummary> = {}): CiSummary {
  return {
    repo: REPO,
    branch: BRANCH,
    commit: COMMIT,
    mainBranch: false,
    tests: [
      aTestOutcome({ name: TEST_REFUSAL }),
      aTestOutcome({ name: TEST_LOG, durationMs: 57 }),
    ],
    receivedAt: NOW,
    ...partial,
  };
}

export function aTestRun(partial: Partial<TestRun> = {}): TestRun {
  return {
    id: 'run-1',
    repo: REPO,
    branch: BRANCH,
    commit: COMMIT,
    mainBranch: false,
    receivedAt: NOW,
    ...partial,
  };
}

export function aTestLink(partial: Partial<TestLink> = {}): TestLink {
  return {
    id: 'link-1',
    criterionId: 'crit-1',
    testName: TEST_REFUSAL,
    status: 'confirmed',
    confidence: 0.92,
    rationale: 'Le nom du test reprend la condition du critère.',
    confirmedBy: DEVELOPER,
    at: NOW,
    ...partial,
  };
}

/* ------------------------------------------------------ couverture et suite */

export function aCriterionState(partial: Partial<CriterionState> = {}): CriterionState {
  return {
    criterionId: 'crit-1',
    code: 'AC-1',
    text: 'Le paiement par carte expirée est refusé',
    type: 'functional',
    version: 1,
    requiredStrength: 'machine-verified',
    bestEvidenceId: 'ev-1',
    bestStrength: 'machine-verified',
    proven: true,
    waived: false,
    minor: false,
    defect: null,
    expected: 'Un test vert sur le commit de la branche.',
    evidences: [],
    waiverId: '',
    ...partial,
  };
}

export function aCoverage(partial: Partial<Coverage> = {}): Coverage {
  return {
    issueId: ISSUE_ID,
    issueKey: ISSUE_KEY,
    total: 0,
    proven: 0,
    waived: 0,
    mode: 'strict',
    passes: true,
    wouldBlock: false,
    blocking: [],
    criteria: [],
    updatedAt: NOW,
    ...partial,
  };
}

export function aLivingProof(partial: Partial<LivingProof> = {}): LivingProof {
  return {
    id: 'lp-1',
    issueKey: ISSUE_KEY,
    criterionId: 'crit-1',
    testName: TEST_REFUSAL,
    state: 'proven',
    component: COMPONENT,
    commit: COMMIT,
    since: NOW,
    ...partial,
  };
}

export function aDossier(partial: Partial<ReleaseDossier> = {}): ReleaseDossier {
  return {
    versionId: 'ver-24',
    versionName: '2.4',
    projectKey: PROJECT_KEY,
    generatedAt: NOW,
    issues: [],
    totals: {
      issues: 0,
      criteria: 0,
      proven: 0,
      machineVerified: 0,
      attested: 0,
      declared: 0,
      waived: 0,
    },
    ...partial,
  };
}
