/**
 * Le monde de la démo, bâti sur l'état RÉEL de l'app (lot `site-donnees-reelles`).
 *
 * L'instantané reçu du web trigger `demo-data` est rangé dans les mêmes doubles
 * en mémoire que le jeu embarqué (`tests/helpers/`), puis les mêmes modules de
 * l'app sont câblés dessus : le moteur de couverture, le validateur, les gestes
 * du panneau, les outils MCP. Le site rejoue donc le vrai moteur sur de vraies
 * données — le ticket, les critères, les preuves, la couverture et les
 * statistiques lus dans Jira et dans Forge SQL.
 *
 * Les gestes modifient la copie en mémoire : un site statique public n'a pas de
 * secret à présenter pour écrire dans le Jira de quelqu'un. L'interface le dit.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type {
  Actor,
  CiSummary,
  Criterion,
  Evidence,
  IssueRef,
  Language,
  ProjectSettings,
} from '../../../src/types.js';
import type { DemoSnapshotData } from '../../../src/demo-contract.js';
import { createFakeClock, createFakeIds, createRecordingLogger } from '../../../tests/helpers/fake-clock.js';
import {
  createFakeEvidenceChecker,
  createFakeIdentity,
  createFakeJira,
  createFakeLlm,
  createFakeQueue,
} from '../../../tests/helpers/fake-gateways.js';
import { createFakeStore } from '../../../tests/helpers/fake-store.js';
import type { DemoScenario } from './world.js';

/** Le compte de l'agent : celui qui a attaché les preuves déclarées. */
function agentRefOf(snapshot: DemoSnapshotData): string {
  const declared = snapshot.evidences.find((evidence) => evidence.addedByAgent);
  return declared?.addedBy ?? '';
}

/** L'acteur du snapshot, trouvé par sa référence. */
function actorOf(snapshot: DemoSnapshotData, ref: string): Actor | null {
  const found = snapshot.actors.find((actor) => actor.ref === ref);
  if (found === undefined) return null;
  return { accountId: found.ref, displayName: found.displayName, agent: false, roles: [...found.roles] };
}

/**
 * La distribution : l'agent qui a attaché les preuves, l'assignée du ticket,
 * puis les deux autres personnes du projet (testeuse, product owner).
 */
export function liveCast(snapshot: DemoSnapshotData): DemoScenario['actors'] {
  const agentRef = agentRefOf(snapshot);
  const others = snapshot.actors.filter(
    (actor) => actor.ref !== agentRef && actor.ref !== snapshot.issue.assigneeRef,
  );
  // Le compte qui a attaché les preuves est le compte de l'app : il agit
  // comme un agent, donc il ne peut pas attester (SPEC §9.4).
  const attached = actorOf(snapshot, agentRef);
  const agent: Actor = attached
    ? { ...attached, agent: true }
    : { accountId: 'agent', displayName: 'Agent Code', agent: true, roles: [] };
  const developer = actorOf(snapshot, snapshot.issue.assigneeRef) ?? {
    accountId: snapshot.issue.assigneeRef,
    displayName: snapshot.issue.assigneeRef,
    agent: false,
    roles: [],
  };
  const tester = actorOf(snapshot, others[0]?.ref ?? '') ?? {
    accountId: others[0]?.ref ?? developer.accountId,
    displayName: others[0]?.displayName ?? developer.displayName,
    agent: false,
    roles: others[0]?.roles ?? developer.roles,
  };
  const owner = actorOf(snapshot, others[1]?.ref ?? '') ?? tester;
  return { agent, developer, tester, owner };
}

/** Le ticket, tel que le site l'a reçu. */
function liveIssue(snapshot: DemoSnapshotData): IssueRef {
  return {
    id: snapshot.issue.id,
    key: snapshot.issue.key,
    projectId: snapshot.issue.projectId,
    projectKey: snapshot.issue.projectKey,
    summary: snapshot.issue.summary,
    description: snapshot.issue.description,
    status: snapshot.issue.status,
    assigneeAccountId: snapshot.issue.assigneeRef,
    reporterAccountId: snapshot.issue.reporterRef,
    components: [...snapshot.issue.components],
    fixVersions: [...snapshot.issue.fixVersions],
    children: [],
  };
}

/** Le résumé de CI réel, rejouable par le bouton « Lancer le pipeline ». */
function liveCiSummary(snapshot: DemoSnapshotData): CiSummary {
  const run = snapshot.ci?.run;
  return {
    repo: run?.repo ?? '',
    branch: run?.branch ?? '',
    commit: run?.commit ?? '',
    mainBranch: run?.mainBranch ?? false,
    tests: [...(snapshot.ci?.results ?? [])],
    receivedAt: run?.receivedAt ?? snapshot.generatedAt,
  };
}

/** Range l'instantané dans le magasin en mémoire. */
async function seedStore(
  store: ReturnType<typeof createFakeStore>,
  snapshot: DemoSnapshotData,
  issue: IssueRef,
): Promise<void> {
  store.linkIssue(issue.id, issue.projectId).linkIssue(issue.key, issue.projectId);
  await store.saveSettings(snapshot.settings);
  for (const criterion of snapshot.criteria) await store.saveCriterion(criterion);
  for (const evidence of snapshot.evidences) await store.saveEvidence(evidence);
  for (const attestation of snapshot.attestations) await store.addAttestation(attestation);
  for (const waiver of snapshot.waivers) await store.saveWaiver(waiver);
  if (snapshot.coverage !== null) await store.saveCoverage(snapshot.coverage);
  if (snapshot.ci !== null && snapshot.ci !== undefined) {
    await store.saveTestRun(snapshot.ci.run);
    await store.addTestResults(snapshot.ci.run.id, snapshot.ci.results);
  }
}

/** Construit le monde de la démo à partir de l'instantané réel. */
export async function createLiveScenario(
  snapshot: DemoSnapshotData,
  language: Language,
  error = '',
  readAt = snapshot.generatedAt,
): Promise<DemoScenario> {
  const issue = liveIssue(snapshot);
  const actors = liveCast(snapshot);
  const store = createFakeStore();
  await seedStore(store, snapshot, issue);
  const jira = createFakeJira([issue], {
    roles: Object.fromEntries(snapshot.actors.map((actor) => [actor.ref, [...actor.roles]])),
    displayNames: Object.fromEntries(snapshot.actors.map((actor) => [actor.ref, actor.displayName])),
  });
  const settings: ProjectSettings = { ...snapshot.settings, language };
  const criteria: readonly Criterion[] = snapshot.criteria;
  const evidences: readonly Evidence[] = snapshot.evidences;
  return {
    store,
    jira,
    checker: createFakeEvidenceChecker(),
    llm: createFakeLlm(),
    identity: createFakeIdentity(Object.values(actors)),
    queue: createFakeQueue(),
    clock: createFakeClock(),
    ids: createFakeIds(),
    logger: createRecordingLogger(),
    project: settings,
    issue,
    actors,
    ciSummary: liveCiSummary(snapshot),
    criteria,
    evidences,
    source: {
      // `error` non vide : la relecture a échoué et l'instantané vient du
      // fichier embarqué à la construction. Le bandeau le dit, la provenance
      // ne laisse rien deviner.
      kind: error === '' ? 'live' : 'embedded',
      site: snapshot.site,
      generatedAt: snapshot.generatedAt,
      readAt,
      error,
    },
  };
}
