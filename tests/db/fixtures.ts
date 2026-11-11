/**
 * Fixtures de la couche de persistance : le scénario du SPEC §7.
 *
 * PAY-123, ses quatre critères d'acceptation, un test vert sur le commit
 * `e41f`, une attestation tierce et une dérogation « reporté dans PAY-140 ».
 * Chaque constructeur accepte un `Partial` pour qu'un test puisse varier un
 * seul champ sans recopier l'objet.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type {
  Attestation,
  Coverage,
  Criterion,
  CriterionRevision,
  CriterionState,
  DossierIssue,
  Evidence,
  LivingProof,
  ProjectSettings,
  Requirement,
  RequirementGrid,
  ReleaseDossier,
  Strength,
  TestLink,
  TestOutcome,
  TestRun,
  Waiver,
} from '../../src/types.js';

/** `AC-1` : le test qui prouve le paiement refusé (SPEC §7.1). */
export function ac1(partial: Partial<Criterion> = {}): Criterion {
  return {
    id: 'crit-ac1',
    issueId: '10001',
    code: 'AC-1',
    text: "Le paiement refusé envoie un e-mail d'explication",
    type: 'functional',
    requiredStrength: 'machine-verified',
    version: 1,
    status: 'active',
    createdBy: 'agent-codex',
    createdAt: '2026-11-11T09:00:00.000Z',
    updatedAt: '2026-11-11T09:00:00.000Z',
    ...partial,
  };
}

/** `AC-3` : exige une attestation d'un tiers (SPEC §7.1). */
export function ac3(partial: Partial<Criterion> = {}): Criterion {
  return ac1({
    id: 'crit-ac3',
    code: 'AC-3',
    text: "L'e-mail de refus est envoyé",
    requiredStrength: 'attested',
    ...partial,
  });
}

/** `AC-4` : le critère dérogé, reporté dans PAY-140 (SPEC §7.4). */
export function ac4(partial: Partial<Criterion> = {}): Criterion {
  return ac1({
    id: 'crit-ac4',
    code: 'AC-4',
    text: 'La limite de refus est réglable par l’administrateur',
    requiredStrength: 'attested',
    ...partial,
  });
}

export function revision(partial: Partial<CriterionRevision> = {}): CriterionRevision {
  return {
    criterionId: 'crit-ac1',
    version: 1,
    text: "Le paiement refusé envoie un e-mail d'explication",
    type: 'functional',
    changedBy: 'user-sarah',
    at: '2026-11-11T09:00:00.000Z',
    ...partial,
  };
}

/** La preuve du test vert, sur le commit `e41f` (SPEC §7.1). */
export function testEvidence(partial: Partial<Evidence> = {}): Evidence {
  return {
    id: 'ev-1',
    criterionId: 'crit-ac1',
    criterionVersion: 1,
    type: 'test',
    reference: 'tests/paiement.spec.ts::refuse le paiement',
    note: 'Vert sur le commit e41f',
    strength: 'machine-verified',
    commit: 'e41f',
    freshness: 'fresh',
    verified: true,
    addedBy: 'agent-codex',
    addedByAgent: true,
    at: '2026-11-11T09:30:00.000Z',
    replacedBy: '',
    ...partial,
  };
}

export function attestation(partial: Partial<Attestation> = {}): Attestation {
  return {
    id: 'att-1',
    criterionId: 'crit-ac3',
    evidenceId: 'ev-3',
    attesterAccountId: 'user-nora',
    role: 'Developers',
    note: 'Capture du refus de paiement',
    attachmentRef: 'att-9911',
    at: '2026-11-11T10:00:00.000Z',
    ...partial,
  };
}

/** La dérogation du product owner : « reporté dans PAY-140 » (SPEC §7.4). */
export function waiver(partial: Partial<Waiver> = {}): Waiver {
  return {
    id: 'wai-1',
    criterionId: 'crit-ac4',
    grantedBy: 'user-pa',
    role: 'Product Owner',
    reason: 'reporté dans PAY-140',
    at: '2026-11-11T10:05:00.000Z',
    expiresAt: '',
    revokedAt: '',
    ...partial,
  };
}

export function criterionState(partial: Partial<CriterionState> = {}): CriterionState {
  return {
    criterionId: 'crit-ac1',
    code: 'AC-1',
    text: "Le paiement refusé envoie un e-mail d'explication",
    type: 'functional',
    version: 1,
    requiredStrength: 'machine-verified',
    bestEvidenceId: 'ev-1',
    bestStrength: 'machine-verified',
    proven: true,
    waived: false,
    minor: false,
    defect: null,
    expected: 'Test automatisé vert sur la branche du ticket',
    evidences: [testEvidence()],
    waiverId: '',
    ...partial,
  };
}

export function coverage(partial: Partial<Coverage> = {}): Coverage {
  return {
    issueId: '10001',
    issueKey: 'PAY-123',
    total: 4,
    proven: 2,
    waived: 1,
    mode: 'strict',
    passes: false,
    wouldBlock: true,
    blocking: [
      {
        criterionId: 'crit-ac3',
        code: 'AC-3',
        text: "L'e-mail de refus est envoyé",
        defect: 'weak-strength',
        expected: "Attestation d'un tiers attendue",
        minor: false,
      },
      {
        criterionId: 'crit-ac4',
        code: 'AC-4',
        text: 'La limite de refus est réglable par l’administrateur',
        defect: 'no-evidence',
        expected: 'Preuve de type test ou attestation attendue',
        minor: false,
      },
    ],
    criteria: [criterionState(), criterionState({ criterionId: 'crit-ac3', code: 'AC-3' })],
    updatedAt: '2026-11-11T10:10:00.000Z',
    ...partial,
  };
}

/** Une exigence du SPEC §9.2 : les six champs, avec leurs valeurs par défaut. */
function requirement(
  accepted: readonly Strength[],
  overrides: Partial<Requirement> = {},
): Requirement {
  return {
    accepted,
    attesterRole: '',
    notAuthor: false,
    measurementLink: false,
    minDistinctTypes: 1,
    minor: false,
    ...overrides,
  };
}

/**
 * La grille du SPEC §9.2, écrite en clair pour rester lisible dans les tests.
 * Elle diffère volontairement de `DEFAULT_REQUIREMENTS` (preuve croisée sur la
 * documentation, lien de mesure sur la performance) : un aller-retour doit
 * rendre la grille du projet, pas celle par défaut.
 */
export function requirements(): RequirementGrid {
  return {
    functional: requirement(['machine-verified', 'attested']),
    regression: requirement(['machine-verified']),
    performance: requirement(['attested'], { measurementLink: true }),
    security: requirement(['attested'], { attesterRole: 'Security Reviewer' }),
    accessibility: requirement(['attested']),
    data: requirement(['attested'], { notAuthor: true }),
    documentation: requirement(['machine-verified'], { minDistinctTypes: 2, minor: true }),
  };
}

export function settings(partial: Partial<ProjectSettings> = {}): ProjectSettings {
  return {
    projectId: '10001',
    requirements: requirements(),
    mode: 'strict',
    roles: {
      attest: ['Administrators', 'Developers'],
      waive: ['Administrators', 'Product Owner'],
      security: ['Security Reviewer', 'Administrators'],
      data: ['Data Lead', 'Administrators'],
    },
    missingCriteria: 'block',
    ciKeyHash: 'sha256:9f2c1b',
    requireChildren: false,
    language: 'fr',
    updatedAt: '2026-11-11T08:00:00.000Z',
    ...partial,
  };
}

export function testRun(partial: Partial<TestRun> = {}): TestRun {
  return {
    id: 'run-1',
    repo: 'pay/api-paiement',
    branch: 'feature/PAY-123-paiement-refuse',
    commit: 'e41f',
    mainBranch: false,
    receivedAt: '2026-11-11T09:25:00.000Z',
    ...partial,
  };
}

export function testOutcome(partial: Partial<TestOutcome> = {}): TestOutcome {
  return {
    name: 'tests/paiement.spec.ts::refuse le paiement',
    state: 'passed',
    durationMs: 1240,
    ...partial,
  };
}

export function testLink(partial: Partial<TestLink> = {}): TestLink {
  return {
    id: 'link-1',
    criterionId: 'crit-ac1',
    testName: 'tests/paiement.spec.ts::refuse le paiement',
    status: 'confirmed',
    confidence: 0.87,
    rationale: 'Le nom du test reprend la condition du critère',
    confirmedBy: 'user-sarah',
    at: '2026-11-11T09:26:00.000Z',
    ...partial,
  };
}

export function livingProof(partial: Partial<LivingProof> = {}): LivingProof {
  return {
    id: 'liv-1',
    issueKey: 'PAY-123',
    criterionId: 'crit-ac1',
    testName: 'tests/paiement.spec.ts::refuse le paiement',
    state: 'regressed',
    component: 'paiement',
    commit: 'e41f',
    since: '2026-11-11T09:25:00.000Z',
    ...partial,
  };
}

export function dossierIssue(partial: Partial<DossierIssue> = {}): DossierIssue {
  return {
    issueKey: 'PAY-123',
    summary: 'Refus de paiement expliqué',
    total: 4,
    proven: 2,
    waived: 1,
    waivers: [waiver()],
    criteria: [criterionState()],
    ...partial,
  };
}

export function dossier(partial: Partial<ReleaseDossier> = {}): ReleaseDossier {
  return {
    versionId: 'ver-24',
    versionName: '2.4',
    projectKey: 'PAY',
    generatedAt: '2026-11-11T12:00:00.000Z',
    issues: [dossierIssue()],
    totals: {
      issues: 1,
      criteria: 4,
      proven: 2,
      machineVerified: 2,
      attested: 0,
      declared: 1,
      waived: 1,
    },
    ...partial,
  };
}
