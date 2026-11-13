/**
 * Scénario PAY-123 du cahier des charges (§7.1–§7.4), prêt à rejouer.
 *
 * Ce qui est posé dès l'entrée :
 * - le projet `PAY` et ses réglages (`strict`, critères manquants bloquants) ;
 * - le ticket `PAY-123` et ses 4 critères actifs :
 *   - `AC-1` fonctionnel — test vert reçu par la CI → vérifié par machine ;
 *   - `AC-2` non-régression — test vert reçu par la CI → vérifié par machine ;
 *   - `AC-3` attestation exigée — seule une déclaration d'agent est présente ;
 *   - `AC-4` aucune preuve — une dérogation motivée est prête à être accordée ;
 * - le pipeline `run-1` de la branche du ticket, avec les deux tests verts ;
 * - les quatre acteurs (agent, développeuse assignée, testeuse, PO).
 *
 * De là, un lot rejoue le blocage (§7.2), l'attestation (§7.3), la dérogation
 * (§7.4) ou la preuve vivante (§7.5) sans rien reconstruire.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type {
  Actor,
  CiSummary,
  Criterion,
  Evidence,
  IssueRef,
  ProjectSettings,
  Waiver,
} from '../../src/types.js';
import {
  AGENT,
  anActor,
  anEvidence,
  anIssue,
  aCiSummary,
  aCriterion,
  aTestRun,
  aWaiver,
  BRANCH,
  COMMIT,
  DEVELOPER,
  ISSUE_ID,
  OWNER,
  PROJECT_ID,
  REPO,
  settings as buildSettings,
  TEST_LOG,
  TEST_REFUSAL,
  TESTER,
} from './builders.js';
import {
  createFakeClock,
  createFakeIds,
  createRecordingLogger,
  type FakeClock,
  type FakeIds,
  type RecordingLogger,
} from './fake-clock.js';
import {
  createFakeCoverageEngine,
  createFakeEvidenceChecker,
  createFakeIdentity,
  createFakeJira,
  createFakeLlm,
  createFakeQueue,
  type FakeCoverageEngine,
  type FakeEvidenceChecker,
  type FakeIdentity,
  type FakeJira,
  type FakeLlm,
  type FakeQueue,
} from './fake-gateways.js';
import { createFakeStore, type FakeStore } from './fake-store.js';

/** Tout ce que le scénario met en place, prêt à l'emploi. */
export interface Pay123Scenario {
  store: FakeStore;
  jira: FakeJira;
  checker: FakeEvidenceChecker;
  llm: FakeLlm;
  identity: FakeIdentity;
  queue: FakeQueue;
  coverage: FakeCoverageEngine;
  clock: FakeClock;
  ids: FakeIds;
  logger: RecordingLogger;
  project: ProjectSettings;
  issue: IssueRef;
  /** `AC-1`, `AC-2`, `AC-3`, `AC-4` dans cet ordre. */
  criteria: readonly [Criterion, Criterion, Criterion, Criterion];
  /** Deux preuves de test vérifiées par machine, une déclaration d'agent. */
  evidences: readonly [Evidence, Evidence, Evidence];
  ciSummary: CiSummary;
  actors: { agent: Actor; developer: Actor; tester: Actor; owner: Actor };
  /** Dérogation sur `AC-4`, motivée et non enregistrée (§7.4). */
  possibleWaiver: Waiver;
}

function buildActors(): Pay123Scenario['actors'] {
  return {
    agent: anActor({ accountId: AGENT, displayName: 'Agent Code', agent: true, roles: [] }),
    developer: anActor({ accountId: DEVELOPER, displayName: 'Camille Dev', roles: ['Developers'] }),
    tester: anActor({ accountId: TESTER, displayName: 'Nora QA', roles: ['Developers'] }),
    owner: anActor({ accountId: OWNER, displayName: 'Sam PO', roles: ['Product Owner'] }),
  };
}

function buildCriteria(now: string): Pay123Scenario['criteria'] {
  const base = { issueId: ISSUE_ID, createdAt: now, updatedAt: now };
  return [
    aCriterion({
      ...base,
      id: 'crit-1',
      code: 'AC-1',
      text: 'Le paiement par carte expirée est refusé',
      type: 'functional',
    }),
    aCriterion({
      ...base,
      id: 'crit-2',
      code: 'AC-2',
      text: 'Un paiement déjà refusé ne repasse pas',
      type: 'regression',
    }),
    aCriterion({
      ...base,
      id: 'crit-3',
      code: 'AC-3',
      text: "L'e-mail de refus est envoyé",
      type: 'functional',
      requiredStrength: 'attested',
    }),
    aCriterion({
      ...base,
      id: 'crit-4',
      code: 'AC-4',
      text: "La limite est réglable par l'administrateur",
      type: 'functional',
    }),
  ];
}

function buildEvidences(now: string): Pay123Scenario['evidences'] {
  const agent = { addedBy: AGENT, addedByAgent: true, commit: COMMIT, at: now };
  return [
    anEvidence({ ...agent, id: 'ev-1', criterionId: 'crit-1', reference: TEST_REFUSAL }),
    anEvidence({ ...agent, id: 'ev-2', criterionId: 'crit-2', reference: TEST_LOG }),
    anEvidence({
      ...agent,
      id: 'ev-3',
      criterionId: 'crit-3',
      type: 'agent-report',
      reference: 'report#ac-3',
      note: "Le compte rendu de l'agent cite AC-3.",
      commit: '',
    }),
  ];
}

async function seedStore(scenario: {
  store: FakeStore;
  project: ProjectSettings;
  issue: IssueRef;
  criteria: readonly Criterion[];
  evidences: readonly Evidence[];
  ciSummary: CiSummary;
}): Promise<void> {
  const { store, project, issue, criteria, evidences, ciSummary } = scenario;
  store.linkIssue(issue.id, project.projectId).linkIssue(issue.key, project.projectId);
  await store.saveSettings(project);
  for (const criterion of criteria) await store.saveCriterion(criterion);
  for (const evidence of evidences) await store.saveEvidence(evidence);
  await store.saveTestRun(
    aTestRun({ id: 'run-1', repo: REPO, branch: BRANCH, commit: COMMIT, receivedAt: ciSummary.receivedAt }),
  );
  await store.addTestResults('run-1', ciSummary.tests);
}

/** Les ports externes du scénario, câblés sur le store déjà rempli. */
interface ScenarioWiring {
  jira: FakeJira;
  checker: FakeEvidenceChecker;
  llm: FakeLlm;
  identity: FakeIdentity;
  queue: FakeQueue;
  coverage: FakeCoverageEngine;
}

function wireScenario(
  store: FakeStore,
  issue: IssueRef,
  actors: Pay123Scenario['actors'],
): ScenarioWiring {
  const jira = createFakeJira([issue], {
    roles: {
      [DEVELOPER]: [...actors.developer.roles],
      [TESTER]: [...actors.tester.roles],
      [OWNER]: [...actors.owner.roles],
    },
    displayNames: {
      [AGENT]: actors.agent.displayName,
      [DEVELOPER]: actors.developer.displayName,
      [TESTER]: actors.tester.displayName,
      [OWNER]: actors.owner.displayName,
    },
  });
  const checker = createFakeEvidenceChecker({
    // Le compte rendu de l'agent cite AC-3, et la capture de la testeuse existe.
    reports: [`${ISSUE_ID}::report#ac-3::AC-3`],
    attachments: [`${ISSUE_ID}::att-screenshot-1`],
  });
  return {
    jira,
    checker,
    llm: createFakeLlm(),
    identity: createFakeIdentity(Object.values(actors)),
    queue: createFakeQueue(),
    coverage: createFakeCoverageEngine(store),
  };
}

/** Dérogation motivée du PO sur AC-4 (§7.4), non encore enregistrée. */
function buildPossibleWaiver(now: string): Waiver {
  return aWaiver({
    id: 'wv-ac4',
    criterionId: 'crit-4',
    grantedBy: OWNER,
    role: 'Product Owner',
    reason: 'Reporté dans PAY-140',
    at: now,
  });
}

/** Construit le scénario PAY-123 ; `start` fixe l'instant de l'horloge. */
export async function createPay123Scenario(start?: string): Promise<Pay123Scenario> {
  const clock = createFakeClock(start);
  const now = clock.now();
  const actors = buildActors();
  const project = buildSettings({ projectId: PROJECT_ID, updatedAt: now });
  const issue = anIssue({ projectId: PROJECT_ID });
  const criteria = buildCriteria(now);
  const evidences = buildEvidences(now);
  const ciSummary = aCiSummary({ receivedAt: now });

  const store = createFakeStore();
  await seedStore({ store, project, issue, criteria, evidences, ciSummary });

  return {
    ...wireScenario(store, issue, actors),
    store,
    clock,
    ids: createFakeIds('id'),
    logger: createRecordingLogger(),
    project,
    issue,
    criteria,
    evidences,
    ciSummary,
    actors,
    possibleWaiver: buildPossibleWaiver(now),
  };
}
