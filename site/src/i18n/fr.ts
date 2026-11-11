/**
 * Textes français du site public.
 *
 * Le site est la vitrine : il reprend le vocabulaire de l'app sans le recopier
 * depuis `src/i18n/*`, qui reste la source des messages produits par l'app
 * elle-même (validateur, gestes, outils). Ici ne vivent que les textes de
 * présentation (SPEC §20 : interface en anglais et en français).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SiteStrings } from './types.js';

export const FR: SiteStrings = {
    skipToContent: 'Aller au contenu',
    nav: {
      problem: 'Le problème',
      rule: 'La règle',
      demo: 'Démo en direct',
      screens: 'Écrans',
      agents: 'Agents & MCP',
      architecture: 'Architecture',
      judges: 'Pour les juges',
    },
    hero: {
      kicker: 'Codegeist 2026 · Apps for Software Teams · Atlassian Forge',
      title: 'Terminé veut dire ',
      titleEmphasis: 'prouvé.',
      lede:
        'Un ticket Jira ne passe à « Terminé » que si chaque critère d’acceptation porte une preuve ' +
        'assez forte. Sinon l’app nomme le critère manquant et la preuve attendue — et elle continue ' +
        'de surveiller ces preuves après la livraison.',
      ctaDemo: 'Essayer la démo',
      ctaRepo: 'Lire le code',
      statCriteria: 'critères, versionnés',
      statProofTypes: 'types de preuve, 3 forces',
      statTests: 'tests, moteur réel',
    },
    problem: {
      title: '« Terminé » est une déclaration',
      lede:
        'Rien dans Jira ne relie cette déclaration à ce qui était demandé. Trois dérives en découlent, ' +
        'et les agents de code les rendent moins chères que jamais à produire.',
      drifts: [
        {
          title: 'Le critère oublié',
          body: 'Quatre critères d’acceptation, trois réellement traités. Le quatrième revient en bug deux sprints plus tard.',
        },
        {
          title: 'La preuve implicite',
          body: '« J’ai testé, ça marche. » Aucune trace de ce qui a été testé, par qui, sur quel commit.',
        },
        {
          title: 'La preuve qui s’évapore',
          body: 'Le test qui prouvait un critère est désactivé six mois plus tard. Personne ne sait que le critère n’est plus garanti.',
        },
      ],
      agents:
        'Un agent déclare « terminé » avec aplomb, et son compte rendu est plausible par construction. ' +
        'Le relecteur n’a pas le temps de tout revérifier. Il lui faut une règle : pas de preuve, pas de « Terminé ».',
    },
    rule: {
      title: 'Toutes les preuves ne se valent pas — et l’app le dit',
      lede:
        'Chaque critère porte un type et une force minimale. Chaque preuve est vérifiée par l’app, ' +
        'puis classée. Une capture prouve qu’une pièce existe, pas ce qu’elle montre.',
      strengthsTitle: 'Trois forces',
      strengths: [
        {
          name: 'Vérifiée par machine',
          meaning: 'le pipeline le dit',
          example: 'un test nommé, vert sur un commit de la branche du ticket',
        },
        { name: 'Attestée', meaning: 'un tiers le dit', example: 'une testeuse clique « j’ai vérifié »' },
        { name: 'Déclarée', meaning: 'quelqu’un le dit', example: 'un compte rendu d’agent, une capture, un lien' },
      ],
      typesTitle: 'Six types de preuve',
      principles: [
        'La preuve s’attache à un critère, jamais au ticket.',
        'Celui qui fait n’atteste pas. Un agent ne peut que déclarer.',
        'Une preuve a une date et un commit : le code bouge, la preuve se périme.',
        'Le blocage explique : le message nomme le critère et la preuve attendue.',
        'Prouver doit coûter moins qu’expliquer — un geste, pas un formulaire.',
      ],
    },
    demo: {
      title: 'Démo en direct : PAY-123',
      lede:
        'Cette page exécute le vrai moteur de décision de l’app, compilé pour le navigateur — les mêmes ' +
        'critères, forces, couvertures, règles d’indépendance et message de blocage que l’app Forge. ' +
        'Rien n’est simulé, rien n’est envoyé nulle part.',
      engineNote: 'Moteur : src/domain/* et src/handlers/* de ce dépôt, en mémoire.',
      reset: 'Réinitialiser le ticket',
      coverage: 'Preuves',
      tryDone: 'Passer à Terminé',
      gatePassed: 'La transition passe : chaque critère est prouvé ou dérogé.',
      runCi: 'Lancer le pipeline',
      attachTest: 'Attacher un test',
      attest: 'J’ai vérifié',
      attestAs: 'Attester en tant que',
      waive: 'Déroger',
      waiverReason: 'Motif',
      waiverPlaceholder: 'Reporté dans PAY-140',
      mode: 'Mode du projet',
      actor: 'Vous êtes',
      colCriterion: 'Critère',
      colRequired: 'Exigé',
      colProofs: 'Preuves',
      colState: 'État',
      noProof: 'Aucune preuve',
      log: 'Ce que l’app a fait',
    },
    screens: {
      title: 'Quatre écrans dans Jira',
      lede: 'UI Kit 2 de Forge, rendu nativement dans le ticket, le tableau et les réglages du projet.',
      items: [
        {
          name: 'Panneau du ticket',
          module: 'jira:issuePanel',
          body: 'La matrice critères × preuves : force exigée, preuves, état, et les quatre gestes — attacher, attester, demander une attestation, déroger.',
        },
        {
          name: 'Champ de couverture',
          module: 'jira:customField',
          body: '« 3 / 4 », coloré, en lecture seule, utilisable en JQL et sur les tableaux. Écrit par l’app depuis la même ligne que lit le validateur.',
        },
        {
          name: 'Réglages du projet',
          module: 'jira:projectSettingsPage',
          body: 'La grille des forces par type de critère, les rôles qui attestent et dérogent, le mode, la clé de CI et la commande d’une ligne à copier.',
        },
        {
          name: 'Page projet',
          module: 'jira:projectPage',
          body: 'Les tickets en cours et leur couverture, les dérogations et leurs compteurs, les critères livrés qui ne sont plus prouvés, les statistiques.',
        },
      ],
    },
    agents: {
      title: 'Conçu pour les agents de code',
      lede:
        'Sept outils MCP et un agent Rovo permettent à un agent de demander ce qui manque, d’attacher ' +
        'ce qu’il a, et de solliciter un humain pour le reste.',
      forbidden:
        'Aucun outil ne permet d’attester, de déroger ni de valider un critère. Ces gestes n’existent ' +
        'que dans l’interface, pour un humain — et tout ce qui arrive par MCP est marqué « agent », ' +
        'donc ne peut que déclarer.',
      toolsTitle: 'Les sept outils',
      questionsTitle: 'L’agent répond à',
      questions: [
        'Qu’est-ce qui manque pour terminer PAY-123 ?',
        'Quels tickets de la version 2.4 ont été clos par dérogation ?',
        'Quels critères livrés ne sont plus prouvés ?',
        'Rédige les critères d’acceptation de ce ticket. (propositions, à valider par un humain)',
      ],
    },
    architecture: {
      title: 'Comment ça tient',
      lede:
        'Un domaine pur, des ports, des adaptateurs. Le chemin de décision n’importe jamais @forge/* : ' +
        'il se teste en mémoire — et il tourne dans un navigateur, comme cette page le prouve.',
      flowTitle: 'Les chemins',
      fastTitle: 'Pourquoi le validateur répond en moins d’une seconde',
      fastBody:
        'Il ne calcule rien. Chaque écriture — preuve attachée, résumé de CI, dérogation — recalcule la ' +
        'couverture et la range. Le validateur lit une ligne, compose le message, répond.',
      limitsTitle: 'Ce que l’app annonce ne pas couvrir',
      limits: [
        'Les transitions en masse, certaines automatisations et certains appels d’API contournent le validateur : un contrôle nocturne liste les tickets clos sans couverture.',
        'Les modèles de Forge ne lisent que du texte : une image prouve qu’une pièce existe, pas ce qu’elle montre.',
        'Une preuve de test est liée à un commit : un nouveau commit la rend « à reconfirmer » jusqu’au prochain passage vert.',
      ],
    },
    judges: {
      title: 'Testez en dix minutes',
      lede: 'Aucun dépôt, aucun outil de CI : le projet de démo et son ticket sont préchargés.',
      stepsTitle: 'Le parcours',
      ciCommandTitle: 'Une ligne en fin de pipeline',
      linksTitle: 'Pour aller plus loin',
    },
    footer: {
      built: 'Conçu pour Codegeist 2026 par Baptiste Faisy, avec une flotte d’agents de code sous contrat.',
      license: 'Licence MIT',
      contest: 'Codegeist 2026 · Apps for Software Teams',
    },
    langLabel: 'English',
  };
