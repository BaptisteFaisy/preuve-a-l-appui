# Plan de validation des points plateforme (SPEC §19)

Six points que la documentation Atlassian ne tranche pas, vérifiés
« sur pièce » la première semaine (11 – 17 novembre, SPEC §25) avec un
prototype minimal installé sur le site de démonstration. Chaque ligne donne le
point, pourquoi il compte, la solution de repli déjà prévue au contrat et
l'état d'avancement.

État des lieux : le socle est mergé sur `main` (contrat gelé, manifest,
persistance, harnais de test, CI) ; les validateurs et écrans sont en souche,
leur corps arrive avec les lots L3, L5, L6 et L9 (voir
[CONTRACTS.md](CONTRACTS.md)). Aucune des six validations n'est donc encore
close ; ce fichier est mis à jour à chaque prototype concluant.

## Les six points

### 1. Durée maximale de la fonction du validateur

- **Pourquoi.** La documentation ne donne aucun plafond de temps pour
  `jira:workflowValidator` ; tout le design « le validateur ne calcule rien,
  il lit une ligne » (SPEC §17) en dépend.
- **Repli.** Lecture d'une seule ligne de couverture ; en dernier recours,
  validateur par expression Jira lisant une propriété du ticket.
- **Prototype.** Mesurer le temps de réponse du validateur en souche, puis
  avec une vraie lecture SQL, sur le site de démo (lot L3).
- **État.** À valider — lot L3 en cours.

### 2. Transitions en masse, par automatisation ou par API

- **Pourquoi.** Comportement non documenté : il conditionne l'étanchéité
  réelle du blocage (SPEC §20, « étanchéité annoncée »).
- **Repli.** Annoncer la limite ; le contrôle nocturne
  (`scheduledTrigger`) liste les tickets clos sans couverture.
- **Prototype.** Déclencher une transition en masse et une transition par API
  sur le projet de démo, observer si le validateur s'exécute (lot L3).
- **État.** À valider — lot L3 en cours.

### 3. Longueur maximale du message d'erreur

- **Pourquoi.** Le format du message de blocage (SPEC §7.2) nomme chaque
  critère en défaut ; il faut connaître la troncature réelle.
- **Repli.** Deux critères nommés dans le message, le reste dans le panneau
  du ticket.
- **Prototype.** Provoquer un échec avec beaucoup de critères en défaut et
  mesurer ce qui s'affiche (lot L3, jeu de démo étendu).
- **État.** À valider — lot L3 en cours.

### 4. Écriture d'un champ d'app en lecture seule

- **Pourquoi.** Le champ « Preuves : n / m », utilisable en JQL
  (SPEC §12.3), suppose que l'app peut écrire la valeur.
- **Repli.** Propriété de ticket indexée — c'est déjà la forme retenue dans
  le `manifest.yml` (`jira:customField` en lecture d'une propriété).
- **Prototype.** Écrire la propriété depuis le consommateur et vérifier
  l'affichage du champ et son usage en JQL (lot L6).
- **État.** À valider — repli déjà câblé dans le manifest.

### 5. Identité transmise à une action lors d'un appel MCP externe

- **Pourquoi.** Distinguer agent et humain, et interdire l'attestation par un
  agent (SPEC §15, §22 point 11).
- **Repli.** Tout appel passant par MCP est marqué « agent »
  (`addedByAgent`), quoi qu'il en soit de l'identité réelle.
- **Prototype.** Appeler une action depuis un client MCP externe et inspecter
  le contexte reçu (lot L5, adaptateur identité du lot L9).
- **État.** À valider — le repli est déjà dans le contrat (`Actor.agent`).

### 6. Nouvel éditeur de workflow sur le site de démonstration

- **Pourquoi.** Les validateurs par fonction ne se posent que dans le nouvel
  éditeur (SPEC §19) ; les juges doivent pouvoir l'installer en trois clics
  ([JUDGES.md](JUDGES.md)).
- **Repli.** Validateur par expression Jira, ou workflow d'exemple préconfiguré
  livré avec le projet de démo.
- **Prototype.** Poser le validateur en souche sur le site de démo et vérifier
  le parcours en trois clics (lot L8, démo).
- **État.** À valider — à faire dès l'installation du site de démo.

## Règle de mise à jour

Quand un prototype tranche un point : passer l'état à « validé » ou « repli
activé », dater en toutes lettres, et reporter la conséquence dans
[ARCHITECTURE.md](ARCHITECTURE.md) si le design change. Ce fichier reste en
français ; le résumé pour les juges est dans [JUDGES.md](JUDGES.md).

## Contrôle du manifest par le CLI Forge (mesuré le 11 novembre 2026)

`forge lint` (CLI 15.1.0, Node 26.12.1) a été exécuté sur l'arbre du dépôt :

- avec `app.id: ari:cloud:ecosystem::app/00000000-0000-0000-0000-000000000000`
  le CLI **refuse l'ARI** : `appId` doit vérifier
  `^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$`
  (UUID v4). Un identifiant provisoire tout en zéros casse donc le lint ;
- avec un UUID v4 de forme valide, le contrôle de l'ARI passe et le CLI
  s'arrête sur `Your app could not be found` : le lint interroge le compte
  Atlassian pour résoudre le propriétaire de l'app. **`forge lint` complet
  suppose une app enregistrée** (`forge create`), ce qui reste un geste humain
  côté compte développeur ;
- en attendant, le manifest est validé hors ligne par `node
  tools/check-manifest.mjs`, qui le confronte au schéma JSON publié par
  `@forge/manifest` et contrôle les 7 actions, leurs verbes, leurs types
  d'entrée (SPEC §19), les fonctions référencées et les outils MCP déclarés.
