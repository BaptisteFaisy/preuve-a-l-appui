/**
 * Textes de la « vitrine de confiance » du site public (lot
 * `site-vitrine-confiance`) : le badge « Runs on Atlassian », les chiffres
 * clés et le schéma unique « comment ça marche ».
 *
 * Comme pour `dossier.ts` et `live.ts`, ce fichier n’écrit que ce que l’app ne
 * produit pas déjà : les libellés de force, de couverture et de statistiques
 * viennent de `src/i18n/reports.ts` et `src/i18n/ui.ts` (réutilisables via
 * `text()`), et ne sont donc pas recopiés ici.
 *
 * Les lignes du schéma sont des TABLEAUX de lignes courtes : le SVG ne mesure
 * pas le texte, c’est la mise en page qui est écrite ici, une fois pour les
 * deux langues.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Lang } from './index.js';

/** Un bloc du schéma : son titre (1-2 lignes) puis son détail (0-2 lignes). */
export interface DiagramBoxText {
  readonly title: readonly string[];
  readonly detail: readonly string[];
}

/** Les onze blocs du schéma, dans les deux langues. */
export interface DiagramNodeTexts {
  readonly ciSummary: DiagramBoxText;
  readonly webTrigger: DiagramBoxText;
  readonly queue: DiagramBoxText;
  readonly consumer: DiagramBoxText;
  readonly proofs: DiagramBoxText;
  readonly coverage: DiagramBoxText;
  readonly validator: DiagramBoxText;
  readonly accepted: DiagramBoxText;
  readonly refused: DiagramBoxText;
  readonly agentProposes: DiagramBoxText;
  readonly humanAttests: DiagramBoxText;
}

/** Les textes du badge « Runs on Atlassian ». */
export interface BadgeStrings {
  /** Le libellé sobre, jamais le logo officiel. */
  readonly label: string;
  /** Ce que ça veut dire, en une phrase. */
  readonly meaning: string;
  /** Où le vérifier. */
  readonly proof: string;
  /** La même mention, en une ligne, pour les pieds de section. */
  readonly compact: string;
}

/** Les textes de la bande de chiffres clés. */
export interface FiguresStrings {
  readonly title: string;
  readonly lede: string;
  /** « Mesuré le {date} » — la date vient de l’instantané embarqué. */
  readonly measuredOn: string;
  /** La même mention pour les chiffres du dépôt. */
  readonly repoMeasuredOn: string;
  readonly labels: {
    readonly tickets: string;
    readonly proven: string;
    readonly waivers: string;
    readonly waiversBy: string;
    readonly reopenings: string;
    readonly living: string;
    readonly tests: string;
    readonly testsDetail: string;
    /** Le compte exact des tests verts, avec sa date de mesure. */
    readonly testsCount: string;
    readonly runtimeDeps: string;
    readonly runtimeDepsDetail: string;
    /** Détail du chiffre « tickets » : version et projet du dossier. */
    readonly ticketsDetail: string;
    /** Détail du chiffre « critères prouvés » : la répartition par force. */
    readonly provenDetail: string;
    /** Détail du chiffre « preuves vivantes ». */
    readonly livingDetail: string;
  };
  readonly sources: {
    readonly app: string;
    readonly dossier: string;
    readonly history: string;
    readonly repo: string;
    readonly package: string;
  };
  /** Affiché quand l’instantané réel n’est pas embarqué. */
  readonly missingLive: string;
}

/** Les textes du schéma « comment ça marche ». */
export interface DiagramStrings {
  readonly title: string;
  readonly lede: string;
  readonly svgTitle: string;
  readonly svgDesc: string;
  readonly laneMain: string;
  readonly laneBranch: string;
  readonly stepsTitle: string;
  readonly nodes: DiagramNodeTexts;
}

export interface VitrineStrings {
  readonly badge: BadgeStrings;
  readonly figures: FiguresStrings;
  readonly diagram: DiagramStrings;
}

export const VITRINE: Readonly<Record<Lang, VitrineStrings>> = {
  fr: {
    badge: {
      label: "Éligible au programme Atlassian « Runs on Atlassian »",
      meaning:
        "L’app est déployée et installée chez un vrai client : elle tourne dans son tenant Jira, derrière deux déclencheurs web statiques — aucune donnée ne sort du tenant par un chemin dynamique.",
      proof: "Voir la vérification dans le dépôt",
      compact:
        "Éligible « Runs on Atlassian » : l’app tourne chez un vrai client, dans son tenant.",
    },
    figures: {
      title: "Les chiffres, mesurés",
      lede:
        "Rien n’est décoratif : les uns sont lus dans l’instantané que l’app installée a produit, les autres dans le dépôt. Chaque ligne dit d’où elle vient.",
      measuredOn: "Données réelles mesurées le {date} (instantané embarqué)",
      repoMeasuredOn: "Dépôt mesuré le {date}",
      labels: {
        tickets: "tickets du dossier de preuve",
        proven: "critères prouvés",
        waivers: "dérogations accordées",
        waiversBy: "par {people} personnes",
        reopenings: "réouvertures après livraison",
        living: "preuves vivantes",
        tests: "tests verts du dépôt",
        testsDetail: "suite complète, rejouée à chaque push",
        testsCount: "{count} comptés le {date}",
        runtimeDeps: "dépendance à l’exécution",
        runtimeDepsDetail: "hors modules @forge/* fournis par la plateforme",
        ticketsDetail: "version {version} · projet {project}",
        provenDetail: "{machine} vérifiés par machine, {attested} attestés",
        livingDetail: "critères livrés dont la preuve reste surveillée après la clôture",
      },
      sources: {
        app: "source : l’app installée (instantané embarqué)",
        dossier: "source : dossier de preuve v{version}, figé par l’app",
        history: "source : historique Jira lu par l’app",
        repo: "source : dépôt — npx vitest run",
        package: "source : dépôt — package.json",
      },
      missingLive:
        "L’instantané des données réelles n’est pas embarqué dans cette page : seuls les chiffres du dépôt sont affichés.",
    },
    diagram: {
      title: "Comment ça marche, en une image",
      lede:
        "Le chemin réel d’une preuve — du résumé de CI à la transition refusée — et, à côté, la branche où l’agent propose et où un humain atteste.",
      svgTitle:
        "Schéma : du résumé CI signé au refus de transition, avec la branche « l’agent propose, un humain atteste »",
      svgDesc:
        "Flux principal : un résumé CI signé est envoyé par un déclencheur web statique, rangé dans la file proof-ci, puis consommé par l’app ; les preuves sont rafraîchies, la couverture est recalculée, et le validateur de transition répond — soit la transition est acceptée, soit elle est refusée en nommant le critère manquant et la preuve attendue. Branche à côté : l’agent propose une preuve déclarée, un humain l’atteste, et la preuve attestée rejoint la couverture.",
      laneMain: "Le flux de preuve",
      laneBranch: "La branche humaine",
      stepsTitle: "Le même chemin, en texte",
      nodes: {
        ciSummary: { title: ["Résumé CI signé"], detail: ["la pipeline publie"] },
        webTrigger: { title: ["Déclencheur web"], detail: ["statique : sorties déclarées"] },
        queue: { title: ["File proof-ci"], detail: ["rangée par ordre d’arrivée"] },
        consumer: { title: ["Consommateur"], detail: ["rapproche test ↔ critère"] },
        proofs: { title: ["Preuves rafraîchies"], detail: ["fraîcheur et force"] },
        coverage: { title: ["Couverture recalculée"], detail: ["prouvés / total"] },
        validator: { title: ["Validateur de", "transition"], detail: ["il dit quel critère manque"] },
        accepted: { title: ["Transition", "acceptée"], detail: ["il passe à Done"] },
        refused: { title: ["Refus"], detail: ["critère absent", "preuve attendue"] },
        agentProposes: { title: ["L’agent", "propose"], detail: ["preuve déclarée"] },
        humanAttests: { title: ["Un humain", "atteste"], detail: ["preuve attestée"] },
      },
    },
  },
  en: {
    badge: {
      label: 'Eligible for the Atlassian “Runs on Atlassian” program',
      meaning:
        "The app is deployed and installed for a real customer: it runs inside their Jira tenant, behind two static web triggers — no data leaves the tenant through a dynamic path.",
      proof: "See the verification in the repository",
      compact: 'Eligible for “Runs on Atlassian”: the app runs for a real customer, in their tenant.',
    },
    figures: {
      title: "The numbers, measured",
      lede:
        "Nothing here is decorative: some figures are read from the snapshot the installed app produced, others from the repository. Every line says where it comes from.",
      measuredOn: "Real data measured on {date} (bundled snapshot)",
      repoMeasuredOn: "Repository measured on {date}",
      labels: {
        tickets: "tickets in the release dossier",
        proven: "criteria proven",
        waivers: "waivers granted",
        waiversBy: "by {people} people",
        reopenings: "reopenings after delivery",
        living: "living proofs",
        tests: "green tests in the repository",
        testsDetail: "the whole suite, replayed on every push",
        testsCount: "{count} counted on {date}",
        runtimeDeps: "runtime dependency",
        runtimeDepsDetail: "besides the @forge/* modules the platform provides",
        ticketsDetail: "version {version} · project {project}",
        provenDetail: "{machine} machine-verified, {attested} attested",
        livingDetail: "delivered criteria whose proof keeps being watched after closure",
      },
      sources: {
        app: "source: the installed app (bundled snapshot)",
        dossier: "source: release dossier v{version}, frozen by the app",
        history: "source: Jira history read by the app",
        repo: "source: repository — npx vitest run",
        package: "source: repository — package.json",
      },
      missingLive:
        "The real-data snapshot is not bundled in this page: only the repository figures are shown.",
    },
    diagram: {
      title: "How it works, in one picture",
      lede:
        "The real path of a proof — from the signed CI summary to the refused transition — and, next to it, the branch where the agent proposes and a human attests.",
      svgTitle:
        "Diagram: from a signed CI summary to a refused transition, with the “the agent proposes, a human attests” branch",
      svgDesc:
        "Main flow: a signed CI summary is sent through a static web trigger, queued in the proof-ci queue, then consumed by the app; the proofs are refreshed, the coverage is recomputed, and the transition validator answers — either the transition is accepted, or it is refused by naming the missing criterion and the proof expected. Branch next to it: the agent proposes a declared proof, a human attests it, and the attested proof joins the coverage.",
      laneMain: "The proof flow",
      laneBranch: "The human branch",
      stepsTitle: "The same path, in text",
      nodes: {
        ciSummary: { title: ["Signed CI summary"], detail: ["the pipeline posts"] },
        webTrigger: { title: ["Web trigger"], detail: ["static: declared replies"] },
        queue: { title: ["proof-ci queue"], detail: ["queued on arrival"] },
        consumer: { title: ["Consumer"], detail: ["matches test ↔ criterion"] },
        proofs: { title: ["Proofs refreshed"], detail: ["freshness and strength"] },
        coverage: { title: ["Coverage", "recomputed"], detail: ["proven / total"] },
        validator: { title: ["Transition", "validator"], detail: ["names what is missing"] },
        accepted: { title: ["Transition", "accepted"], detail: ["reaches “Done”"] },
        refused: { title: ["Refused"], detail: ["which criterion", "which proof"] },
        agentProposes: { title: ["The agent", "proposes"], detail: ["declared proof"] },
        humanAttests: { title: ["A human", "attests"], detail: ["attested proof"] },
      },
    },
  },
};

/** Les textes de la vitrine, dans la langue du visiteur. */
export function vitrineFor(lang: Lang): VitrineStrings {
  return VITRINE[lang];
}
