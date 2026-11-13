/**
 * Contrat de données échangé entre l'app et le site public (lot
 * `app-donnees-reelles`).
 *
 * Ce fichier ne contient que des TYPES : ni le site ni l'app n'y importent quoi
 * que ce soit, donc le site public peut lire le contrat sans embarquer le
 * runtime Forge. `src/demo-snapshot.ts` produit ces données, le site les
 * consomme (`site/src/demo/remote.ts`), et les tests verrouillent la forme.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type {
  Attestation,
  Coverage,
  Criterion,
  Evidence,
  LivingProof,
  ProofStats,
  ProjectSettings,
  ReleaseDossier,
  TestOutcome,
  TestRun,
  Waiver,
} from './types';

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

