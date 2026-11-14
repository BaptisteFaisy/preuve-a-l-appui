/**
 * Contrat de données échangé entre l'app et le site public (lot
 * `app-donnees-reelles`).
 *
 * Ce fichier ne contient que des TYPES : ni le site ni l'app n'y importent quoi
 * que ce soit, donc le site public peut lire le contrat sans embarquer le
 * runtime Forge. `src/demo-snapshot.ts` produit ces données, le site les
 * consomme (`site/src/demo/live-fetch.ts`, `site/src/demo/live-world.ts`), et
 * les tests verrouillent la forme.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type {
  Attestation,
  Coverage,
  Criterion,
  DossierTotals,
  Evidence,
  LivingProof,
  ProofStats,
  ProjectSettings,
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

/**
 * Une dérogation, dans le dossier public : qui l'accorde, son rôle, son
 * motif, sa date — et la référence de la personne, jamais son identifiant.
 */
export interface SnapshotDossierWaiver {
  readonly grantedBy: string;
  readonly role: string;
  readonly reason: string;
  readonly at: string;
}

/**
 * Un ticket du dossier public : sa couverture et ses dérogations, sans le
 * détail des critères.
 *
 * Pourquoi allégé : l'instantané est rangé dans une **propriété de ticket
 * Jira**, qui refuse plus de 32 768 octets. Le dossier complet (chaque
 * critère, chaque preuve, chaque ligne d'historique) est dans l'app et dans
 * l'outil `get-release-proof` ; le site n'a besoin que de la vue par ticket.
 */
export interface SnapshotDossierIssue {
  readonly issueKey: string;
  readonly summary: string;
  readonly total: number;
  readonly proven: number;
  readonly waived: number;
  /**
   * Combien de ses critères sont doublement prouvés — une preuve vérifiée par
   * la machine ET une attestation humaine (SPEC §9.1, §9.4). Un entier, pas le
   * détail : la propriété Jira qui porte l'instantané refuse plus de
   * 32 768 octets. Absent d'un instantané publié avant cette information :
   * il se lit alors comme zéro.
   */
  readonly doublyProven?: number;
  readonly waivers: readonly SnapshotDossierWaiver[];
}

/** Le dossier de preuve d'une version, vu par ticket. */
export interface SnapshotDossier {
  readonly versionId: string;
  readonly versionName: string;
  readonly projectKey: string;
  readonly generatedAt: string;
  readonly totals: DossierTotals;
  readonly issues: readonly SnapshotDossierIssue[];
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
  readonly dossier: SnapshotDossier | null;
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

