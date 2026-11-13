/**
 * Textes du simulateur du site public (lot `site-simulateur`).
 *
 * Le simulateur ne réécrit rien de ce que l'app sait dire : la force, l'état
 * du critère, la couverture et le verdict viennent des view-models de l'app
 * (`src/viewmodel/*`) et du domaine (`src/domain/*`). N'est écrit ici que ce
 * que l'app ne produit pas : les libellés du formulaire, les titres du
 * panneau et les quatre rôles que le visiteur peut faire jouer.
 *
 * Les deux langues du site (SPEC §20) ; les messages produits par l'app
 * restent dans la langue du projet, telle que le domaine les écrit.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Lang } from './index.js';

/** Les quatre personnes que le visiteur peut faire attacher une preuve. */
export type SimulatorRole = 'agent' | 'developer' | 'tester' | 'owner';

/** Le jeu de chaînes du simulateur, dans les deux langues du site. */
export interface SimulatorStrings {
  /** Le libellé de l'ancre, dans la navigation. */
  readonly navLabel: string;
  /** Le titre de la section. */
  readonly title: string;
  /** Le chapeau de la section. */
  readonly lede: string;
  /** Le texte affiché pendant la construction du monde. */
  readonly loading: string;
  /** L'étiquette du ticket simulé. */
  readonly issueLabel: string;
  /** Le rappel que le simulateur joue sur le même ticket que la démo. */
  readonly sameAsDemo: string;
  /** La mention « rien ne sort du navigateur ». */
  readonly inMemory: string;
  /** Libellé du champ « critère ». */
  readonly criterionLabel: string;
  /** Libellé du champ « type de preuve ». */
  readonly typeLabel: string;
  /** Libellé du champ « qui attache ». */
  readonly actorLabel: string;
  /** Libellé du champ « référence ». */
  readonly referenceLabel: string;
  /** L'aide du champ « référence ». */
  readonly referenceHint: string;
  /** Le bouton qui applique le geste. */
  readonly submit: string;
  /** Le bouton qui remet le monde à zéro. */
  readonly reset: string;
  /** Le rôle de chaque personne, dans la langue du site. */
  readonly roles: Readonly<Record<SimulatorRole, string>>;
  /** Le rendu d'un geste accepté. */
  readonly outcomeOk: string;
  /** Le rendu d'un geste refusé. */
  readonly outcomeRefused: string;
  /** Titre du bloc « force du critère ». */
  readonly strengthTitle: string;
  /** Titre du bloc « couverture ». */
  readonly coverageTitle: string;
  /** Titre du bloc « proofs ». */
  readonly proofsTitle: string;
  /** Le préfixe de la force exigée. */
  readonly requiredStrength: string;
  /** Le préfixe de la force retenue. */
  readonly keptStrength: string;
  /** Le préfixe de l'état du critère. */
  readonly stateLabel: string;
  /** Ce qu'on dit quand aucun critère n'a de preuve. */
  readonly noProof: string;
  /** Le verdict quand la transition passe. */
  readonly verdictPassed: string;
  /** Le verdict quand la transition est bloquée. */
  readonly verdictBlocked: string;
  /** La mention « ajouté par l'agent ». */
  readonly addedByAgent: string;
}

export const SIMULATOR_STRINGS: Readonly<Record<Lang, SimulatorStrings>> = {
  en: {
    navLabel: 'Simulator',
    title: 'Simulator: attach a proof, watch the verdict change',
    lede:
      'Pick a criterion of the real ticket, choose a kind of proof and who attaches it. The app itself computes the strength, the coverage and the verdict — the same modules that run in Jira, on the data of the installed app.',
    loading: 'Reading the ticket…',
    issueLabel: 'Simulated ticket',
    sameAsDemo: 'The same ticket, the same criteria and the same proofs as the demo above.',
    inMemory:
      'Everything happens in this page: nothing is written in Jira, and no account identifier leaves the browser.',
    criterionLabel: 'Criterion',
    typeLabel: 'Kind of proof',
    actorLabel: 'Who attaches it',
    referenceLabel: 'Reference',
    referenceHint:
      'The test name, the documentation page, the file, the report section or the link the app will check.',
    submit: 'Attach the proof',
    reset: 'Start over',
    roles: {
      agent: 'The agent (declares only)',
      developer: 'The ticket assignee',
      tester: 'The tester',
      owner: 'The product owner',
    },
    outcomeOk: 'The app accepted the proof.',
    outcomeRefused: 'The app refused:',
    strengthTitle: 'Strength of the criterion',
    coverageTitle: 'Coverage',
    proofsTitle: 'Proofs attached',
    requiredStrength: 'Required',
    keptStrength: 'Kept by the app',
    stateLabel: 'State',
    noProof: 'No proof attached yet.',
    verdictPassed: 'Transition allowed by the validator',
    verdictBlocked: 'Transition blocked by the validator',
    addedByAgent: 'added by the agent',
  },
  fr: {
    navLabel: 'Simulateur',
    title: 'Simulateur : attachez une preuve, voyez le verdict changer',
    lede:
      'Choisissez un critère du ticket réel, un type de preuve et la personne qui l’attache. L’app calcule elle-même la force, la couverture et le verdict — les mêmes modules qui tournent dans Jira, sur les données de l’app installée.',
    loading: 'Lecture du ticket…',
    issueLabel: 'Ticket simulé',
    sameAsDemo: 'Le même ticket, les mêmes critères et les mêmes preuves que la démo ci-dessus.',
    inMemory:
      'Tout se passe dans cette page : rien n’est écrit dans Jira, et aucun identifiant de compte ne sort du navigateur.',
    criterionLabel: 'Critère',
    typeLabel: 'Type de preuve',
    actorLabel: 'Qui l’attache',
    referenceLabel: 'Référence',
    referenceHint:
      'Le nom du test, la page de documentation, le fichier, la section du compte rendu ou le lien que l’app va vérifier.',
    submit: 'Attacher la preuve',
    reset: 'Recommencer',
    roles: {
      agent: 'L’agent (déclare seulement)',
      developer: 'L’assignée du ticket',
      tester: 'La testeuse',
      owner: 'Le product owner',
    },
    outcomeOk: 'L’app a accepté la preuve.',
    outcomeRefused: 'L’app a refusé :',
    strengthTitle: 'Force du critère',
    coverageTitle: 'Couverture',
    proofsTitle: 'Preuves attachées',
    requiredStrength: 'Exigée',
    keptStrength: 'Retenue par l’app',
    stateLabel: 'État',
    noProof: 'Aucune preuve attachée pour l’instant.',
    verdictPassed: 'Transition autorisée par le validateur',
    verdictBlocked: 'Transition bloquée par le validateur',
    addedByAgent: 'attachée par l’agent',
  },
};
