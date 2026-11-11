/**
 * Faux ports externes : Jira, vérificateur de preuves, modèle de langue,
 * identité, file d'ingestion CI, moteur de couverture.
 *
 * Chaque fake est pilotable par scénario (réglages, réponses scriptées,
 * résultats d'écriture forcés) et tient un journal d'appels complet : un
 * test sait ce qui a été demandé, dans quel ordre, avec quels arguments.
 * Aucun import `@forge/*` : les fakes vivent hors du runtime.
 *
 * Les lectures/écritures Jira sont dans `fake-jira-helpers.ts` (découpage
 * imposé par la règle des 50 lignes par fonction).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type {
  ActorContext,
  CiIngestMessage,
  CoverageEngine,
  CoverageStore,
  EvidenceChecker,
  IdentityGateway,
  JiraGateway,
  JobQueue,
  LlmGateway,
  SuggestedPair,
} from '../../src/ports.js';
import type {
  Actor,
  Coverage,
  Criterion,
  CriterionType,
  IssueRef,
  ParsedCriterion,
} from '../../src/types.js';
import {
  createJiraReader,
  createJiraWriter,
  type FakeJiraState,
} from './fake-jira-helpers.js';

/* ----------------------------------------------------------------- journal */

/** Un appel enregistré : la méthode et ses arguments, dans l'ordre. */
export interface CallRecord {
  readonly method: string;
  readonly args: readonly unknown[];
}

/** Journal d'appels partagé par tous les fakes de ce fichier. */
export interface CallJournal {
  readonly calls: CallRecord[];
  /** Les appels d'une méthode, dans l'ordre. */
  of(method: string): CallRecord[];
  /** Le nombre d'appels d'une méthode. */
  count(method: string): number;
  /** Les listes d'arguments d'une méthode, dans l'ordre. */
  argsOf(method: string): readonly (readonly unknown[])[];
  /** Les noms de méthodes appelées, dans l'ordre (doublons gardés). */
  methods(): string[];
}

export function createJournal(): CallJournal {
  const calls: CallRecord[] = [];
  const matching = (method: string): CallRecord[] => calls.filter((call) => call.method === method);
  return {
    calls,
    of: matching,
    count: (method) => matching(method).length,
    argsOf: (method) => matching(method).map((call) => call.args),
    methods: () => calls.map((call) => call.method),
  };
}

/* -------------------------------------------------------------------- Jira */

/** Ce qu'un test peut forcer côté écritures Jira. */
export type JiraWrite = 'rewrite' | 'coverage' | 'notify';

export interface FakeJiraOptions {
  /** Rôles projet par compte : `{ 'user-1': ['Developers'] }`. */
  roles?: Readonly<Record<string, readonly string[]>>;
  /** Noms affichés par compte. */
  displayNames?: Readonly<Record<string, string>>;
  /** Résultat renvoyé par les écritures (défaut : toutes vraies). */
  writes?: Partial<Record<JiraWrite, boolean>>;
}

export interface FakeJira extends JiraGateway {
  readonly journal: CallJournal;
  /** Les tickets connus, dans l'ordre d'ajout. */
  readonly issues: IssueRef[];
  /** Les sections de description réécrites. */
  readonly rewrites: { issueId: string; section: string }[];
  /** Les champs de couverture écrits. */
  readonly coverageFields: { issueId: string; label: string; proven: number; total: number }[];
  /** Les notifications envoyées. */
  readonly notifications: {
    accountId: string;
    subjectKey: string;
    bodyKey: string;
    issueKey: string;
  }[];
  addIssue(issue: IssueRef): FakeJira;
  setRoles(accountId: string, roles: readonly string[]): FakeJira;
  setDisplayName(accountId: string, name: string): FakeJira;
  setWriteResult(write: JiraWrite, ok: boolean): FakeJira;
}

function jiraState(issues: readonly IssueRef[], options: FakeJiraOptions): FakeJiraState {
  return {
    journal: createJournal(),
    known: [...issues],
    roles: new Map(Object.entries(options.roles ?? {})),
    names: new Map(Object.entries(options.displayNames ?? {})),
    writes: {
      rewrite: options.writes?.rewrite ?? true,
      coverage: options.writes?.coverage ?? true,
      notify: options.writes?.notify ?? true,
    },
    rewrites: [],
    coverageFields: [],
    notifications: [],
  };
}

export function createFakeJira(
  issues: readonly IssueRef[] = [],
  options: FakeJiraOptions = {},
): FakeJira {
  const state = jiraState(issues, options);
  const jira: FakeJira = {
    journal: state.journal,
    issues: state.known,
    rewrites: state.rewrites,
    coverageFields: state.coverageFields,
    notifications: state.notifications,
    ...createJiraReader(state),
    ...createJiraWriter(state),
    addIssue(issue) {
      state.known.push(issue);
      return jira;
    },
    setRoles(accountId, list) {
      state.roles.set(accountId, list);
      return jira;
    },
    setDisplayName(accountId, name) {
      state.names.set(accountId, name);
      return jira;
    },
    setWriteResult(write, ok) {
      state.writes[write] = ok;
      return jira;
    },
  };
  return jira;
}

/* -------------------------------------------------- vérificateur de preuves */

/** Réglages du vérificateur : ce qui existe, ce qui est joignable. */
export interface CheckerSettings {
  /** url de page → date de dernière modification (ISO). */
  documentation?: Readonly<Record<string, string>>;
  /** pièces présentes, au format `issueId::reference`. */
  attachments?: readonly string[];
  /** sections de compte rendu présentes : `issueId::reference::AC-1`. */
  reports?: readonly string[];
  /** liens joignables. */
  links?: readonly string[];
}

export interface FakeEvidenceChecker extends EvidenceChecker {
  readonly journal: CallJournal;
}

export function createFakeEvidenceChecker(settings: CheckerSettings = {}): FakeEvidenceChecker {
  const journal = createJournal();
  const attachments = new Set(settings.attachments ?? []);
  const reports = new Set(settings.reports ?? []);
  const links = new Set(settings.links ?? []);
  const documentation = settings.documentation ?? {};
  return {
    journal,
    async documentationPage(url, since) {
      journal.calls.push({ method: 'documentationPage', args: [url, since] });
      const modified = documentation[url];
      return modified !== undefined && modified >= since;
    },
    async attachmentExists(issueId, reference) {
      journal.calls.push({ method: 'attachmentExists', args: [issueId, reference] });
      return attachments.has(`${issueId}::${reference}`);
    },
    async reportSection(issueId, reference, criterionCode) {
      journal.calls.push({ method: 'reportSection', args: [issueId, reference, criterionCode] });
      return reports.has(`${issueId}::${reference}::${criterionCode}`);
    },
    async linkReachable(url) {
      journal.calls.push({ method: 'linkReachable', args: [url] });
      return links.has(url);
    },
  };
}

/* ------------------------------------------------------------------- modèle */

/** Une réponse scriptée ; une `Error` fait lever l'appel (panne du modèle). */
export type Scripted<T> = T | Error;

export interface FakeLlmScript {
  /** Réponses successives de `parseCriteria`. */
  criteria?: readonly Scripted<ParsedCriterion[]>[];
  /** Réponses successives de `classifyCriterion`. */
  types?: readonly Scripted<CriterionType>[];
  /** Réponses successives de `suggestPairs`. */
  pairs?: readonly Scripted<readonly SuggestedPair[]>[];
  /** Repli quand une file est épuisée. */
  defaultCriteria?: readonly ParsedCriterion[];
  defaultType?: CriterionType;
  defaultPairs?: readonly SuggestedPair[];
}

export interface FakeLlm extends LlmGateway {
  readonly journal: CallJournal;
}

/** Prend la prochaine réponse scriptée, ou le repli ; lève si c'est une `Error`. */
function replay<T>(queue: Scripted<T>[], fallback: T): T {
  const entry = queue.shift() ?? fallback;
  if (entry instanceof Error) throw entry;
  return entry;
}

export function createFakeLlm(script: FakeLlmScript = {}): FakeLlm {
  const journal = createJournal();
  const criteriaQueue: Scripted<ParsedCriterion[]>[] = [...(script.criteria ?? [])];
  const typesQueue: Scripted<CriterionType>[] = [...(script.types ?? [])];
  const pairsQueue: Scripted<readonly SuggestedPair[]>[] = [...(script.pairs ?? [])];
  const fallbackCriteria: ParsedCriterion[] = [...(script.defaultCriteria ?? [])];
  const fallbackType: CriterionType = script.defaultType ?? 'functional';
  const fallbackPairs: readonly SuggestedPair[] = script.defaultPairs ?? [];
  return {
    journal,
    async parseCriteria(description, language) {
      journal.calls.push({ method: 'parseCriteria', args: [description, language] });
      return [...replay(criteriaQueue, fallbackCriteria)];
    },
    async classifyCriterion(text) {
      journal.calls.push({ method: 'classifyCriterion', args: [text] });
      return replay(typesQueue, fallbackType);
    },
    async suggestPairs(criteria: readonly Criterion[], testNames) {
      journal.calls.push({ method: 'suggestPairs', args: [criteria, testNames] });
      return replay(pairsQueue, fallbackPairs);
    },
  };
}

/* ----------------------------------------------------------------- identité */

export interface FakeIdentity extends IdentityGateway {
  readonly journal: CallJournal;
  /** Acteurs connus par compte. */
  readonly actors: Map<string, Actor>;
  register(actor: Actor): FakeIdentity;
}

export function createFakeIdentity(actors: readonly Actor[] = []): FakeIdentity {
  const journal = createJournal();
  const known = new Map<string, Actor>(actors.map((actor) => [actor.accountId, actor]));
  const identity: FakeIdentity = {
    journal,
    actors: known,
    register(actor) {
      known.set(actor.accountId, actor);
      return identity;
    },
    async actorOf(context: ActorContext) {
      journal.calls.push({ method: 'actorOf', args: [context] });
      const registered = known.get(context.accountId);
      // Tout appel MCP vient d'un agent : il ne peut que déclarer (SPEC §19).
      if (context.fromMcp) {
        return {
          accountId: context.accountId,
          displayName: registered?.displayName ?? context.accountId,
          agent: true,
          roles: [],
        };
      }
      return (
        registered ?? {
          accountId: context.accountId,
          displayName: context.accountId,
          agent: false,
          roles: [],
        }
      );
    },
  };
  return identity;
}

/* --------------------------------------------------------------------- file */

export interface FakeQueue extends JobQueue {
  readonly journal: CallJournal;
  /** Messages publiés, dans l'ordre : le consommateur les rejoue. */
  readonly published: CiIngestMessage[];
}

export function createFakeQueue(): FakeQueue {
  const journal = createJournal();
  const published: CiIngestMessage[] = [];
  return {
    journal,
    published,
    async publish(payload) {
      journal.calls.push({ method: 'publish', args: [payload] });
      published.push(payload);
    },
  };
}

/* ------------------------------------------------------- moteur couverture */

export interface FakeCoverageEngine extends CoverageEngine {
  readonly journal: CallJournal;
  /** Force la couverture qu'un recalcul produira pour un ticket. */
  script(coverage: Coverage): FakeCoverageEngine;
}

/**
 * Double du moteur de couverture (lot L3) : il ne recalcule rien, il rejoue la
 * couverture scriptée puis lit la ligne du store. Les lots qui veulent le vrai
 * calcul injectent l'implémentation de L3.
 */
export function createFakeCoverageEngine(store: CoverageStore): FakeCoverageEngine {
  const journal = createJournal();
  const scripted = new Map<string, Coverage>();
  const engine: FakeCoverageEngine = {
    journal,
    script(coverage) {
      scripted.set(coverage.issueId, coverage);
      return engine;
    },
    async recompute(issueId) {
      journal.calls.push({ method: 'recompute', args: [issueId] });
      const row = scripted.get(issueId);
      if (row !== undefined) await store.saveCoverage(row);
      return store.getCoverage(issueId);
    },
    async read(issueId) {
      journal.calls.push({ method: 'read', args: [issueId] });
      return store.getCoverage(issueId);
    },
  };
  return engine;
}
