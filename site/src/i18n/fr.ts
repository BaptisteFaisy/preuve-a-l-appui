/**
 * Textes français du site public.
 *
 * Le site est la vitrine : il reprend le vocabulaire de l'app sans le recopier
 * depuis `src/i18n/*`, qui reste la source des messages produits par l'app
 * elle-même (validateur, gestes, outils). Ici ne vivent que les textes de
 * présentation (SPEC §20 : interface en anglais et en français).
 *
 * Fichier GÉNÉRÉ par /tmp/i18ngen/gen.py — modifier le générateur, pas ce fichier.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SiteStrings } from './types.js';

export const FR: SiteStrings = {
  skipToContent: "Aller au contenu",
  nav: {
    problem: "Le problème",
    rule: "La règle",
    features: "Fonctionnalités",
    demo: "Démo en direct",
    screens: "Écrans",
    agents: "Agents & MCP",
    architecture: "Architecture",
    recipe: "La recette",
    judges: "Pour les juges",
  },
  hero: {
    kicker: "Codegeist 2026 · Apps for Software Teams · Atlassian Forge",
    title: "Terminé veut dire ",
    titleEmphasis: "prouvé.",
    lede: "Un ticket Jira ne passe à « Terminé » que si chaque critère d’acceptation porte une preuve assez forte. Sinon l’app nomme le critère manquant et la preuve attendue — et elle continue de surveiller ces preuves après la livraison.",
    ctaDemo: "Essayer la démo",
    ctaRepo: "Lire le code",
    statCriteria: "critères, versionnés",
    statProofTypes: "types de preuve, 3 forces",
    statTests: "points de recette, rejoués à chaque commit",
  },
  problem: {
    title: "« Terminé » est une déclaration",
    lede: "Rien dans Jira ne relie cette déclaration à ce qui était demandé. Trois dérives en découlent, et les agents de code les rendent moins chères que jamais à produire.",
    drifts: [
      {
        title: "Le critère oublié",
        body: "Quatre critères d’acceptation, trois réellement traités. Le quatrième revient en bug deux sprints plus tard.",
      },
      {
        title: "La preuve implicite",
        body: "« J’ai testé, ça marche. » Aucune trace de ce qui a été testé, par qui, sur quel commit.",
      },
      {
        title: "La preuve qui s’évapore",
        body: "Le test qui prouvait un critère est désactivé six mois plus tard. Personne ne sait que le critère n’est plus garanti.",
      },
    ],
    agents: "Un agent déclare « terminé » avec aplomb, et son compte rendu est plausible par construction. Le relecteur n’a pas le temps de tout revérifier. Il lui faut une règle : pas de preuve, pas de « Terminé ».",
  },
  rule: {
    title: "Toutes les preuves ne se valent pas — et l’app le dit",
    lede: "Chaque critère porte un type et une force minimale. Chaque preuve est vérifiée par l’app, puis classée. Une capture prouve qu’une pièce existe, pas ce qu’elle montre.",
    strengthsTitle: "Trois forces",
    strengths: [
      {
        name: "Vérifiée par machine",
        meaning: "le pipeline le dit",
        example: "un test nommé, vert sur un commit de la branche du ticket",
      },
      {
        name: "Attestée",
        meaning: "un tiers le dit",
        example: "une testeuse clique « j’ai vérifié »",
      },
      {
        name: "Déclarée",
        meaning: "quelqu’un le dit",
        example: "un compte rendu d’agent, une capture, un lien",
      },
    ],
    typesTitle: "Six types de preuve",
    principlesTitle: "Les cinq principes",
    principles: [
      "La preuve s’attache à un critère, jamais au ticket.",
      "Celui qui fait n’atteste pas. Un agent ne peut que déclarer.",
      "Une preuve a une date et un commit : le code bouge, la preuve se périme.",
      "Le blocage explique : le message nomme le critère et la preuve attendue.",
      "Prouver doit coûter moins qu’expliquer — un geste, pas un formulaire.",
    ],
  },
  ruleTypes: {
    title: "Six types de preuve, vérifiés par l’app",
    lede: "Une preuve n’est pas ce que son auteur en dit : l’app vérifie ce qu’elle peut et classe le reste. Une capture accompagnée d’une attestation prend la force de l’attestation.",
    head: ["Type", "Ce qui est fourni", "Force", "Ce que l’app vérifie"],
    rows: [
      {
        name: "Test automatisé",
        provides: "Le nom complet du test",
        strength: "Vérifiée par machine",
        check: "Le test figure dans les résultats de CI, il passe, sur un commit de la branche du ticket",
      },
      {
        name: "Page de documentation",
        provides: "Un lien vers une page Confluence",
        strength: "Vérifiée par machine",
        check: "La page existe et a été modifiée après le début du ticket",
      },
      {
        name: "Attestation",
        provides: "Un clic « j’ai vérifié », note et pièce jointe facultatives",
        strength: "Attestée",
        check: "L’attestant n’est ni l’assigné ni un agent",
      },
      {
        name: "Capture ou vidéo",
        provides: "Une pièce jointe du ticket ou un lien",
        strength: "Déclarée",
        check: "La pièce existe",
      },
      {
        name: "Compte rendu d’agent",
        provides: "Une section du compte rendu",
        strength: "Déclarée",
        check: "La section existe et cite le critère",
      },
      {
        name: "Lien libre",
        provides: "Un tableau de bord, un commit, une PR",
        strength: "Déclarée",
        check: "Le lien est joignable si l’app peut le vérifier",
      },
    ],
    note: "L’app ne « lit » pas les captures : les modèles disponibles dans Forge ne traitent que du texte. Une image prouve qu’une pièce existe, pas ce qu’elle montre — d’où sa force « déclarée » tant qu’un tiers n’a pas attesté.",
  },
  demo: {
    title: "Démo en direct : {issue}",
    lede: "Cette page exécute le vrai moteur de décision de l’app, compilé pour le navigateur — les mêmes critères, forces, couvertures, règles d’indépendance et message de blocage que l’app Forge. Les données affichées sont l’état réel de l’app installée sur le site de démonstration, relu à l’exécution. Rien n’est simulé, rien n’est envoyé nulle part.",
    engineNote: "Moteur : src/domain/* et src/handlers/* de ce dépôt, en mémoire.",
    reset: "Réinitialiser le ticket",
    coverage: "Preuves",
    tryDone: "Passer à Terminé",
    gatePassed: "La transition passe : chaque critère est prouvé ou dérogé.",
    runCi: "Lancer le pipeline",
    attachTest: "Attacher un test",
    attest: "J’ai vérifié",
    attestAs: "Vous êtes",
    waive: "Déroger",
    waiverReason: "Motif",
    waiverPlaceholder: "Reporté dans PAY-140",
    mode: "Mode du projet",
    actor: "Acteur",
    colCriterion: "Critère",
    colRequired: "Exigé",
    colProofs: "Preuves",
    colState: "État",
    noProof: "Aucune preuve",
    log: "Ce que l’app a fait",
    editCriterion: "Modifier le texte",
    criterionPrompt: "Nouveau texte pour ce critère :",
    modes: {
      strict: "Strict",
      lenient: "Souple",
      observe: "Observation",
    },
  },
  screens: {
    title: "Quatre écrans dans Jira",
    lede: "UI Kit 2 de Forge, rendu nativement dans le ticket, le tableau et les réglages du projet.",
    items: [
      {
        name: "Panneau du ticket",
        module: "jira:issuePanel",
        body: "La matrice critères × preuves : force exigée, preuves, état, et les quatre gestes — attacher, attester, demander une attestation, déroger.",
      },
      {
        name: "Champ de couverture",
        module: "jira:customField",
        body: "« 3 / 4 », coloré, en lecture seule, utilisable en JQL et sur les tableaux. Écrit par l’app depuis la même ligne que lit le validateur.",
      },
      {
        name: "Réglages du projet",
        module: "jira:projectSettingsPage",
        body: "La grille des forces par type de critère, les rôles qui attestent et dérogent, le mode, la clé de CI et la commande d’une ligne à copier.",
      },
      {
        name: "Page projet",
        module: "jira:projectPage",
        body: "Les tickets en cours et leur couverture, les dérogations et leurs compteurs, les critères livrés qui ne sont plus prouvés, les statistiques.",
      },
    ],
  },
  agents: {
    title: "Conçu pour les agents de code",
    lede: "Sept outils MCP et un agent Rovo permettent à un agent de demander ce qui manque, d’attacher ce qu’il a, et de solliciter un humain pour le reste.",
    forbidden: "Aucun outil ne permet d’attester, de déroger ni de valider un critère. Ces gestes n’existent que dans l’interface, pour un humain — et tout ce qui arrive par MCP est marqué « agent », donc ne peut que déclarer.",
    toolsTitle: "Les sept outils",
    toolsHead: ["Outil", "Verbe", "Retour"],
    tools: [
      {
        key: "list-criteria",
        verb: "GET",
        returns: "Critères, type, force exigée, état",
      },
      {
        key: "get-proof-status",
        verb: "GET",
        returns: "Couverture, critères en défaut, preuve attendue pour chacun",
      },
      {
        key: "attach-evidence",
        verb: "CREATE",
        returns: "La preuve enregistrée et la force obtenue",
      },
      {
        key: "propose-criteria",
        verb: "CREATE",
        returns: "Des propositions en attente de validation humaine",
      },
      {
        key: "request-attestation",
        verb: "CREATE",
        returns: "Une demande adressée au rôle compétent",
      },
      {
        key: "suggest-evidence",
        verb: "GET",
        returns: "Des paires proposées avec confiance et justification",
      },
      {
        key: "get-release-proof",
        verb: "GET",
        returns: "La couverture d’une version et ses dérogations",
      },
    ],
    questionsTitle: "L’agent répond à",
    questions: [
      "Qu’est-ce qui manque pour terminer PAY-123 ?",
      "Quels tickets de la version 2.4 ont été clos par dérogation ?",
      "Quels critères livrés ne sont plus prouvés ?",
      "Rédige les critères d’acceptation de ce ticket. (propositions, à valider par un humain)",
    ],
  },
  architecture: {
    title: "Comment ça tient",
    lede: "Un domaine pur, des ports, des adaptateurs. Le chemin de décision n’importe jamais @forge/* : il se teste en mémoire — et il tourne dans un navigateur, comme cette page le prouve.",
    flowTitle: "Les trois chemins",
    flows: [
      {
        name: "Transition vers « Terminé »",
        path: "jira:workflowValidator → handlers/validator → la ligne de couverture → { result, errorMessage }",
      },
      {
        name: "Fin de pipeline",
        path: "webtrigger ci-results → file proof-ci → consommateur → preuves, fraîcheur, couverture, preuve vivante",
      },
      {
        name: "Agent ou humain",
        path: "rovo:mcp (7 outils) → handlers/dispatch → domaine pur → Forge SQL",
      },
    ],
    fastTitle: "Pourquoi le validateur répond en moins d’une seconde",
    fastBody: "Il ne calcule rien. Chaque écriture — preuve attachée, résumé de CI, dérogation — recalcule la couverture et la range. Le validateur lit une ligne, compose le message, répond.",
    limitsTitle: "Ce que l’app annonce ne pas couvrir",
    limits: [
      "Les transitions en masse, certaines automatisations et certains appels d’API contournent le validateur : un contrôle nocturne liste les tickets clos sans couverture.",
      "Les modèles de Forge ne lisent que du texte : une image prouve qu’une pièce existe, pas ce qu’elle montre.",
      "Une preuve de test est liée à un commit : un nouveau commit la rend « à reconfirmer » jusqu’au prochain passage vert.",
    ],
  },
  recipe: {
    title: "La recette d’acceptation, rejouée à chaque commit",
    lede: "Onze points du cahier des charges, chacun rejoué de bout en bout avec les vrais modules assemblés — pas avec des simulacres d’eux-mêmes. La démo ci-dessus exécute le même moteur.",
    head: ["Point", "Test qui le prouve"],
    items: [
      {
        point: "Un ticket à quatre critères dont un sans preuve ne peut pas passer à Terminé ; le message nomme ce critère.",
        test: "tests/acceptance/recette-01",
      },
      {
        point: "Un test attaché, présent et vert dans les résultats de CI de la branche, donne une preuve vérifiée par machine.",
        test: "tests/acceptance/recette-02",
      },
      {
        point: "Le même test, absent ou en échec, ne donne aucune preuve valable.",
        test: "tests/acceptance/recette-02",
      },
      {
        point: "L’assigné ne peut pas attester ; un autre membre du projet le peut.",
        test: "tests/acceptance/recette-03",
      },
      {
        point: "Une preuve déclarée par un agent ne satisfait pas un critère exigeant une attestation.",
        test: "tests/acceptance/recette-03",
      },
      {
        point: "Une dérogation motivée sur le critère manquant débloque la transition et figure dans le dossier.",
        test: "tests/acceptance/recette-04",
      },
      {
        point: "Modifier le texte d’un critère fait passer ses preuves en « à revoir ».",
        test: "tests/acceptance/recette-05",
      },
      {
        point: "Un nouveau commit après une preuve de test la rend « à reconfirmer » jusqu’au passage vert suivant.",
        test: "tests/acceptance/recette-05",
      },
      {
        point: "En mode observation, la transition passe et le blocage évité est compté.",
        test: "tests/acceptance/recette-04",
      },
      {
        point: "get-proof-status renvoie les mêmes critères en défaut que le message du validateur.",
        test: "tests/acceptance/recette-01",
      },
      {
        point: "Aucun outil MCP ne permet d’attester ni de déroger.",
        test: "tests/acceptance/recette-06",
      },
    ],
    howTo: "Rejouez-les : npx vitest run tests/acceptance",
  },
  judges: {
    title: "Testez en dix minutes",
    lede: "Aucun dépôt, aucun outil de CI : le projet de démo et son ticket sont préchargés.",
    stepsTitle: "Le parcours",
    steps: [
      {
        title: "Installer l’app sur le site de démonstration",
        body: "Apps → Manage your apps → Install app. Ouvrez le projet de démo PAY : jeu PAY-123 préchargé, couverture 2 / 4.",
      },
      {
        title: "Poser le validateur sur la transition vers Terminé",
        body: "Réglages du projet → Workflows → éditer la transition → Add validator → Apps → « Fait, preuve à l’appui » → Publish.",
      },
      {
        title: "Tenter de clore le ticket",
        body: "Jira refuse et nomme les deux critères en défaut : AC-3 (attestation attendue, déclaration reçue) et AC-4 (aucune preuve).",
      },
      {
        title: "Attester, déroger, clore",
        body: "La testeuse clique « j’ai vérifié » sur AC-3 ; le product owner déroge AC-4 avec le motif « reporté dans PAY-140 ». La transition passe.",
      },
      {
        title: "Envoyer un résumé de CI, interroger l’agent",
        body: "Un curl en fin de pipeline transforme les deux tests en preuves vérifiées par machine. Demandez ensuite à l’agent Rovo ce qui manque.",
      },
    ],
    ciCommandTitle: "Une ligne en fin de pipeline",
    ciCommand: "curl -fsS -X POST \"$PROOF_CI_URL\" -H \"x-ci-key: $PROOF_CI_KEY\" \\\n  -H \"x-ci-timestamp: $(date +%s)\" -H \"x-ci-signature: $SIGNATURE\" \\\n  --data '{\"repo\":\"pay/paiements\",\"branch\":\"feature/PAY-123-refusal-email\",\n           \"commit\":\"e41f0c9a\",\"tests\":[{\"name\":\"checkout refuses an expired card\",\"state\":\"passed\"}]}'",
    ciCommandBody: "Des noms et des états seulement — aucun code, aucun journal. Au-delà de 5 Mo, le résumé est découpé en lots.",
    copy: "Copier",
    copied: "Copié",
    linksTitle: "Pour aller plus loin",
    links: [
      {
        label: "Guide des juges (docs/JUDGES.md)",
        href: "https://github.com/Tradoooo/preuve-a-l-appui/blob/main/docs/JUDGES.md",
      },
      {
        label: "La recette d’acceptation (docs/RECETTE.md)",
        href: "https://github.com/Tradoooo/preuve-a-l-appui/blob/main/docs/RECETTE.md",
      },
      {
        label: "Architecture (docs/ARCHITECTURE.md)",
        href: "https://github.com/Tradoooo/preuve-a-l-appui/blob/main/docs/ARCHITECTURE.md",
      },
      {
        label: "Le cahier des charges complet",
        href: "https://github.com/Tradoooo/preuve-a-l-appui/blob/main/docs/CAHIER-DES-CHARGES.md",
      },
      {
        label: "Script de la vidéo (docs/VIDEO-SCRIPT.md)",
        href: "https://github.com/Tradoooo/preuve-a-l-appui/blob/main/docs/VIDEO-SCRIPT.md",
      },
      {
        label: "Code source",
        href: "https://github.com/Tradoooo/preuve-a-l-appui",
      },
    ],
  },
  footer: {
    built: "Conçu pour Codegeist 2026 par Baptiste Faisy, avec une flotte d’agents de code sous contrat.",
    license: "Licence MIT",
    contest: "Codegeist 2026 · Apps for Software Teams",
    source: "Code source et documentation",
  },
  langLabel: "English",
};
