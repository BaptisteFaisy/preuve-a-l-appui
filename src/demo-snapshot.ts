/**
 * Contrat du jeu de données servi au site public (lot `app-donnees-reelles`).
 *
 * Le site public lit l'état RÉEL de l'app — celui que Forge SQL et Jira
 * contiennent sur le site de démonstration — au lieu du jeu embarqué. Ce
 * fichier est la seule définition de la forme échangée : le handler
 * (`src/handlers/demo-data.ts`) la produit, le site (`site/src/demo/remote.ts`)
 * la consomme, et `tests/handlers/demo-data.test.ts` la verrouille.
 *
 * Vie privée : le site est public, donc **aucun identifiant de compte Atlassian
 * ne sort**, à quelque profondeur que ce soit (preuves, couverture, dossier,
 * statistiques). Chaque compte rencontré est remplacé par une référence stable
 * (`actor-1`, `actor-2`…) et la table de correspondance ne quitte jamais ce
 * processus. Les noms affichés restent : ils sont déjà publics dans Jira. La
 * clé de CI ne sort pas non plus (`settings.ciKeyHash` est vidé).
 *
 * Domaine pur : aucun import `@forge/*`.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type {
  Attestation,
  Coverage,
  Criterion,
  Evidence,
  IssueRef,
  LivingProof,
  ProofStats,
  ProjectSettings,
  ReleaseDossier,
  TestOutcome,
  TestRun,
  Waiver,
} from './types';
import type { AppDeps } from './deps';

/** Époque de référence pour les lectures « tout l'historique ». */
export const SNAPSHOT_EPOCH = '1970-01-01T00:00:00.000Z';

/**
 * Tous les champs qui portent un identifiant de compte, dans tous les types du
 * domaine. `replacedBy` n'y est PAS : c'est un identifiant de preuve.
 */
export const ACCOUNT_FIELDS: readonly string[] = [
  'accountId',
  'addedBy',
  'assigneeAccountId',
  'attesterAccountId',
  'changedBy',
  'confirmedBy',
  'createdBy',
  'grantedBy',
  'reporterAccountId',
];

/** Une personne, pseudonymisée : le site n'a que ça. */
export interface SnapshotActor {
  /** Référence stable, sans lien avec l'identifiant Atlassian. */
  readonly ref: string;
  readonly displayName: string;
  readonly agent: boolean;
  readonly roles: readonly string[];
}

/** Le ticket, tel que Jira le renvoie, avec des références au lieu des comptes. */
export interface SnapshotIssue {
  readonly id: string;
  readonly key: string;
  readonly projectId: string;
  readonly projectKey: string;
  readonly summary: string;
  readonly description: string;
  readonly status: string;
  readonly assigneeRef: string;
  readonly reporterRef: string;
  readonly components: readonly string[];
  readonly fixVersions: readonly string[];
}

/** Le dernier passage de CI retrouvé, pour rejouer un vrai résumé côté site. */
export interface SnapshotCi {
  readonly run: TestRun;
  readonly results: readonly TestOutcome[];
}

/** Tout ce que le site doit recevoir pour rejouer l'app sur des données réelles. */
export interface DemoSnapshotData {
  readonly generatedAt: string;
  /** Site Jira d'où viennent les données ; affiché comme provenance. */
  readonly site: string;
  readonly project: { readonly id: string; readonly key: string };
  readonly issue: SnapshotIssue;
  readonly settings: ProjectSettings;
  readonly criteria: readonly Criterion[];
  readonly evidences: readonly Evidence[];
  readonly attestations: readonly Attestation[];
  readonly waivers: readonly Waiver[];
  readonly coverage: Coverage | null;
  readonly living: readonly LivingProof[];
  readonly stats: ProofStats | null;
  readonly dossier: ReleaseDossier | null;
  readonly ci: SnapshotCi | null;
  readonly actors: readonly SnapshotActor[];
}

/** Ce que le handler doit savoir pour construire un instantané. */
export interface SnapshotInput {
  readonly issueKey: string;
  readonly site: string;
  /** Dépôt et branche du dernier run de CI ; absents = instantané sans CI. */
  readonly repo?: string;
  readonly branch?: string;
}

/** Remplace les identifiants de compte par des références stables. */
export class ActorRefs {
  private readonly refs = new Map<string, string>();

  /** La référence d'un compte ; les comptes vides restent vides. */
  of(accountId: string): string {
    if (accountId === '') return '';
    const known = this.refs.get(accountId);
    if (known !== undefined) return known;
    const ref = `actor-${this.refs.size + 1}`;
    this.refs.set(accountId, ref);
    return ref;
  }

  /** Les comptes vus, dans l'ordre d'apparition. */
  accounts(): readonly string[] {
    return [...this.refs.keys()];
  }
}

const ACCOUNT_FIELD_SET = new Set(ACCOUNT_FIELDS);

/**
 * Pseudonymise en profondeur : parcourt tableaux et objets et remplace la
 * valeur de tout champ listé dans `ACCOUNT_FIELDS`. Une seule implémentation
 * pour toutes les structures (preuves, couverture, dossier, statistiques) —
 * aucune ne peut fuiter parce qu'on aurait oublié un niveau.
 */
export function anonymizeDeep<T>(value: T, refs: ActorRefs): T {
  if (Array.isArray(value)) {
    return value.map((item) => anonymizeDeep(item, refs)) as unknown as T;
  }
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] =
      ACCOUNT_FIELD_SET.has(key) && typeof item === 'string'
        ? refs.of(item)
        : anonymizeDeep(item, refs);
  }
  return out as T;
}

/** Lit le dernier run de CI connu pour un couple dépôt/branche. */
async function readCi(deps: AppDeps, input: SnapshotInput): Promise<SnapshotCi | null> {
  if (input.repo === undefined || input.branch === undefined) return null;
  const run = await deps.store.latestRunForBranch(input.repo, input.branch);
  if (run === null) return null;
  return { run, results: await deps.store.listTestResults(run.id) };
}

/** Le dossier de la première version de correction du ticket, s'il est figé. */
async function readDossier(
  deps: AppDeps,
  versionId: string | undefined,
): Promise<ReleaseDossier | null> {
  if (versionId === undefined || versionId === '') return null;
  return deps.store.getDossier(versionId);
}

/** L'instantané brut, avant pseudonymisation. */
interface RawSnapshot {
  readonly generatedAt: string;
  readonly site: string;
  readonly project: { readonly id: string; readonly key: string };
  readonly issue: IssueRef;
  readonly settings: ProjectSettings | null;
  readonly criteria: readonly Criterion[];
  readonly evidences: readonly Evidence[];
  readonly attestations: readonly Attestation[];
  readonly waivers: readonly Waiver[];
  readonly coverage: Coverage | null;
  readonly living: readonly LivingProof[];
  readonly stats: ProofStats | null;
  readonly dossier: ReleaseDossier | null;
  readonly ci: SnapshotCi | null;
}

/** Construit l'instantané réel d'un ticket : lectures en base et dans Jira. */
export async function buildDemoSnapshot(
  deps: AppDeps,
  input: SnapshotInput,
): Promise<DemoSnapshotData | null> {
  const issue = await deps.jira.getIssue(input.issueKey);
  if (issue === null) return null;
  const criteria = await deps.store.listCriteriaByIssue(issue.id);
  const attestations = (
    await Promise.all(criteria.map((criterion) => deps.store.listAttestations(criterion.id)))
  ).flat();
  const [settings, evidences, waivers, coverage, living, stats, dossier, ci] = await Promise.all([
    deps.store.getSettings(issue.projectId),
    deps.store.listEvidencesByIssue(issue.id),
    deps.store.listWaiversByIssue(issue.id),
    deps.store.getCoverage(issue.id),
    deps.store.listLivingByProject(issue.projectId),
    deps.store.computeStats(issue.projectId, SNAPSHOT_EPOCH),
    readDossier(deps, issue.fixVersions[0]),
    readCi(deps, input),
  ]);
  const raw: RawSnapshot = {
    generatedAt: deps.clock.now(),
    site: input.site,
    project: { id: issue.projectId, key: issue.projectKey },
    issue,
    settings,
    criteria,
    evidences,
    attestations,
    waivers,
    coverage,
    living,
    stats,
    dossier,
    ci,
  };
  return finalize(deps, raw);
}

/**
 * Pseudonymise l'instantané, résout les personnes rencontrées, et vide la clé
 * de CI. L'ordre compte : les acteurs ne sont connus qu'après le parcours.
 */
async function finalize(deps: AppDeps, raw: RawSnapshot): Promise<DemoSnapshotData> {
  const refs = new ActorRefs();
  refs.of(raw.issue.assigneeAccountId);
  refs.of(raw.issue.reporterAccountId);
  const clean = anonymizeDeep(raw, refs);
  const actors = await readActors(deps, refs, raw.issue.projectId);
  return {
    generatedAt: clean.generatedAt,
    site: clean.site,
    project: clean.project,
    issue: {
      id: clean.issue.id,
      key: clean.issue.key,
      projectId: clean.issue.projectId,
      projectKey: clean.issue.projectKey,
      summary: clean.issue.summary,
      description: clean.issue.description,
      status: clean.issue.status,
      assigneeRef: clean.issue.assigneeAccountId,
      reporterRef: clean.issue.reporterAccountId,
      components: clean.issue.components,
      fixVersions: clean.issue.fixVersions,
    },
    // La clé de CI ne sort jamais : le site n'en a aucun usage.
    settings: { ...(clean.settings ?? ({} as ProjectSettings)), ciKeyHash: '' },
    criteria: clean.criteria,
    evidences: clean.evidences,
    attestations: clean.attestations,
    waivers: clean.waivers,
    coverage: clean.coverage,
    living: clean.living,
    stats: clean.stats,
    dossier: clean.dossier,
    ci: clean.ci,
    actors,
  };
}

/**
 * Les personnes rencontrées, avec leur nom affiché et leurs rôles projet lus
 * dans Jira. Un humain réel n'est jamais marqué `agent` : l'agent de la démo
 * est ajouté par le site, qui le dit. Un compte que Jira ne résout pas n'est
 * pas deviné : sa référence sert de nom, l'identifiant réel ne sort pas.
 */
async function readActors(
  deps: AppDeps,
  refs: ActorRefs,
  projectId: string,
): Promise<readonly SnapshotActor[]> {
  const actors: SnapshotActor[] = [];
  for (const accountId of refs.accounts()) {
    const ref = refs.of(accountId);
    const [resolved, roles] = await Promise.all([
      deps.jira.displayName(accountId),
      deps.jira.projectRoles(projectId, accountId),
    ]);
    actors.push({
      ref,
      displayName: resolved === accountId || resolved === '' ? ref : resolved,
      agent: false,
      roles,
    });
  }
  return actors;
}
