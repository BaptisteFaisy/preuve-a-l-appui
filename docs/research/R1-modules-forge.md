# R1 — Modules Forge utilisés par « Fait, preuve à l'appui »

> Recherche documentaire réalisée le **11 novembre 2026** sur le schéma local
> `@forge/manifest` (version 1.5.1, identique à celle de `rayon-impact`) et
> sur la documentation officielle Atlassian Developer.
>
> Ce document répond aux deux exigences de recherche de la tâche :
> 1. Ce que le schéma dit réellement pour chacun des modules utilisés : forme
>    exacte, champs obligatoires, ce qui est en *Preview*.
> 2. L'état de la vérification documentaire pour les 6 points du §19 « À valider
>    par un prototype ».

---

## 1. Ce que le schéma officiel dit réellement pour chaque module

### 1.1 `jira:workflowValidator`

- **Statut Atlassian** : *Preview* (depuis 2024, consolidé en 2025/2026).
- **Emplacement dans le schéma** : `definitions.ModuleSchema.properties["jira:workflowValidator"]`.
- **Champs obligatoires** : `name` (string 1..255), `description` (string 1..1000), `key` (`^[a-zA-Z0-9_-]+$`).
- **Liaison à la fonction** : champ `function` (string, regex `^[a-zA-Z0-9-_]+$`). Le schéma accepte également l'alternative `expression` (Jira expression) pour les validateurs sans fonction hébergée.
- **Support des types de projets** : dans la documentation Atlassian, `projectTypes` accepte `company-managed` et `team-managed`. Le validateur s'applique par défaut aux projets gérés par l'entreprise ; le déclarer explicitement pour les projets gérés par l'équipe garantit sa présence sur les deux familles de projets Jira Software et JSM.
- **Configuration** : le composant de configuration d'un validateur est optionnel dans le schéma. Lorsqu'il est présent, il est limité à **32 Ko** de données stockées dans le workflow.
- **Comportement plateforme documenté** : la fonction du validateur reçoit un objet `{ issueKey, configuration, transition: { fromStatus, toStatus } }` et **doit renvoyer** `{ result: boolean, errorMessage?: string }`. Quand `result === false`, Jira interrompt immédiatement la transition et n'exécute aucune post-fonction. La fonction **ne reçoit pas l'identité de l'utilisateur** qui opère la transition.

### 1.2 `jira:issuePanel`

- **Statut** : Standard (General Availability, UI Kit 2).
- **Champs obligatoires** (variante UI Kit 2 / `resource`) : `title` (string 1..255), `resource` (string, max 23 car.), `icon` (string, chemin relatif ou URL absolue), `key`.
- **Rendu UI Kit 2** : `render: native` combiné avec `resolver: { function: <key> }`.
- **Ce que le schéma accepte en plus** : `allowMultiple` (boolean), `config: { function: <key> }`, `viewportSize` (`small | medium | large | xlarge`).
- **Contexte reçu côté front** : hook `useProductContext()` fournissant `extension: { type, issue: { id, key, type }, project: { id, key } }`.

### 1.3 `jira:customField`

- **Statut** : Standard.
- **Champs obligatoires** : `name` (string 1..100), `description` (string 1..10000), `type` (`number | string | user | group | datetime | object`), `key`.
- **Pour le type `string` (retenu pour « Preuves 3 / 4 »)** :
  - `readOnly: true` est formellement prévu par le schéma.
  - `formatter: { expression: string }` permet le rendu natif sans charger de ressource React : une expression Jira lit la valeur depuis une propriété de ticket, ce qui évite toute latence réseau à l'affichage.
  - Optionnel : `validation: { expression, errorMessage }`, `collection: none | list`.
- **Rendu retenu** : `type: string`, `readOnly: true`, `formatter: { expression: 'issue.properties["proof-coverage-label"]' }`. L'écriture se fait par l'API REST Jira / Forge Storage, jamais par le champ lui-même.

### 1.4 `jira:projectSettingsPage` et `jira:projectPage`

- **Statut** : Standard.
- **Champs obligatoires** : `title` (string 1..255), `resource` (string max 23 car.), `key`.
- **Câblage UI Kit 2** : `render: native` + `resolver: { function: <key> }` + `icon: resource:<iconKey>;<relativePath>`.
- **Options documentées** : `layout: native | basic` (défaut `native`), `displayConditions` (visibilité conditionnelle selon les permissions Jira).
- **Sous-pages (`pages` / `sections`)** : acceptées par le schéma mais documentées comme réservées à Custom UI via `view.createHistory()`. Non utilisées pour notre UI Kit 2.

### 1.5 `webtrigger`

- **Statut** : Standard.
- **Champs obligatoires** : `key`, `function`.
- **Propriétés étendues (CLI Forge 14.x)** :
  - `urlFormat: v2` : génère une URL stable indépendante de l'environnement, sans paramètre de query obligatoire.
  - `response: { type: dynamic }` : permet au handler de construire sa propre réponse HTTP (code statut, en-têtes, corps JSON) au lieu d'une réponse 200 vide imposée par la plateforme.
- **Sécurité** : aucun mécanisme d'authentification n'est fourni par défaut par Forge ; la documentation impose une vérification de signature du corps par l'application (clé de projet hashée, SPEC §10). Timeout : **55 secondes** maximum, charge utile entrante jusqu'à **5 Mo**.

### 1.6 `consumer`

- **Statut** : Standard (depuis l'API `@forge/events` v2).
- **Champs obligatoires** : `key`, `queue` (nom de la file), `function` (clé du module `function`).
- **Piège historique** : l'ancienne version v1 utilisait `resolver: { function, method }`. Depuis `@forge/events` 2.x, seule la forme directe `function: <key>` est recommandée.
- **Timeout** : le module `consumer` lui-même n'a **pas** de champ `timeoutSeconds`. Le délai maximal (jusqu'à **900 secondes** = 15 minutes) se déclare sur le module `function` référencé.
- **Limites de la file** : 50 événements par push, 200 Ko de charge utile combinée par requête, 500 événements par minute par installation. Livraison *at-least-once* avec fenêtre de rétention de 24 h (extensible à 96 h).

### 1.7 `trigger`

- **Statut** : Standard.
- **Champs obligatoires** : `key`, `function`, `events` (tableau non vide).
- **Événement retenu** : `avi:jira:updated:issue` (notifié lorsque la description d'un ticket est modifiée, pour réimporter ou versionner les critères).
- **Filtrage** : la documentation Atlassian privilégie `filter: { appIsLicensed: true, ignoreSelf: true }`. Le schéma local supporte encore l'ancien format `predicate` (JSON Predicates spec) ; pour rester compatible avec la CLI 14.2 sans régression, un filtre simple ou l'absence de filtre complexe est la solution la plus robuste.
- **Délai plateforme** : les événements peuvent mettre jusqu'à **3 minutes** à atteindre l'app.

### 1.8 `scheduledTrigger`

- **Statut** : Standard.
- **Champs obligatoires** : `key`, `function`, `interval`.
- **Intervalles autorisés par le schéma** : `fiveMinute`, `hour`, `day`, `week`. Aucun intervalle arbitraire ni cron n'est supporté par Forge.
- **Choix retenu** : `interval: day` pour le contrôle nocturne des tickets clos sans couverture (SPEC §13, §20).
- **Limites plateforme** : 5 modules `scheduledTrigger` au plus par app (dont un seul en `fiveMinute`). Les exécutions en échec **ne sont pas rejouées** avant le tour suivant.

### 1.9 `sql`

- **Statut** : Standard (Forge SQL / TiDB).
- **Champs obligatoires** : `key`, `engine: mysql` (seule valeur autorisée).
- **Contrainte capitale** : **aucune déclaration de table ni de colonne dans le manifest**. Tout le schéma vit en DDL exécuté via `migrationRunner` (`@forge/sql`) orchestré par un consumer ou un trigger d'installation.
- **Limites** : 1 GiB de stockage en production, 200 tables max, pas de clés étrangères formelles, pas de transaction multi-requêtes documentée, timeout de 5 s par `SELECT` et 10 s par écriture.

### 1.10 `llm`

- **Statut** : Standard (Forge LLMs).
- **Champs obligatoires** : `key`, `model` (tableau non vide). Seule la famille `claude` est acceptée aujourd'hui.
- **Particularité** : aucun scope OAuth n'est requis dans `permissions.scopes` ; le droit est accordé au niveau de l'installation par le consentement administrateur.
- **Limites** : texte uniquement (aucun support d'image en entrée ni sortie), 100 requêtes par minute, 500 000 jetons par minute par installation.

### 1.11 `action`

- **Statut** : Standard (moteur Rovo et MCP).
- **Champs obligatoires** : `key`, `name`, `function`, `actionVerb`, `description`, `inputs`.
- **Verbes autorisés** : `GET`, `CREATE`, `UPDATE`, `DELETE`, `TRIGGER`. Les règles d'automatisation Jira n'invoquent que les actions `GET`.
- **Entrées (`inputs`)** : uniquement `string`, `integer`, `number`, `boolean`. **Aucun type `array` ni `object`**. Les listes doivent transiter par des chaînes délimitées (CSV). Chaque entrée exige `title`, `type`, `required` (booléen) et `description`.
- **Sortie (`output`)** : aucune déclaration dans le manifest ; la fonction retourne du JSON ou du texte brut, que le LLM ou le client MCP met en forme.
- **Timeout** : borné à **55 secondes** (non extensible).

### 1.12 `rovo:agent` et `rovo:mcp`

- **Statut** : `rovo:agent` est Standard ; `rovo:mcp` est en **Preview** (Octobre 2026).
- **Contraintes `rovo:agent`** : `name` plafonné à 30 caractères, `prompt` obligatoire (en ligne ou via `resource:<key>;<path>`), liste d'actions référençant des clés de module `action`.
- **Contraintes `rovo:mcp`** : **un seul module `rovo:mcp` par app**, `name` plafonné à 30 caractères, **50 outils au plus** listés dans `tools`. Chaque outil doit pointer une clé du module `action` déclarée dans le même manifest.
- **Exposition externe** : désactivée par défaut ; un administrateur Atlassian doit l'activer par site dans `admin.atlassian.com` (Connected apps). L'URL de connexion MCP est `https://mcp.atlassian.com/forge/<appId>`.

---

## 2. Tableau des 6 points du §19 (« À valider par un prototype »)

| Point du §19 | Question posée | État de la vérification documentaire (11/11/2026) | Décision d'architecture prise |
|---|---|---|---|
| **1. Durée maximale de la fonction du validateur** | La documentation officielle ne donne pas la limite d'exécution d'un workflow validator (5 s, 25 s ou 55 s ?). | **Non documenté** sur la page du module `jira:workflowValidator`. La page générique *Invocation limits* donne 55 s pour les fonctions synchrones, mais les opérations de transition Jira timeoutent souvent côté navigateur bien avant (5 à 10 s). | **La fonction du validateur ne calcule rien** : elle lit une seule ligne pré-calculée en base (`coverage` du ticket), compose le message d'erreur et répond en moins de 100 ms. Si la base est inaccessible, repli sur la propriété de ticket indexée. |
| **2. Comportement lors des transitions en masse, par automatisation ou par API** | Est-ce que le validateur Forge est invoqué lors des transitions faites par Jira Automation, REST API v3 ou modification en masse ? | **Partiellement documenté** : Jira Automation exécute les validateurs de workflow standard, mais saute certains validateurs d'app si l'action spécifie « bypass validators ». Pour les bulk transitions, les validateurs synchrones peuvent saturer les quotas concurrents de l'app. | **Étanchéité annoncée + garde nocturne** : l'app annonce clairement ce qu'elle garantit. Un déclencheur planifié (`scheduledTrigger: nightly-audit`, intervalle `day`) audite chaque nuit tous les tickets passés à « Terminé » le jour même et liste ceux qui n'ont pas de dossier complet. |
| **3. Longueur maximale du message d'erreur** | Quelle est la taille maximale du champ `errorMessage` renvoyé par le validateur avant troncature par l'UI Jira ? | **Non documenté formellement** ; l'UI Jira dialogue affiche confortablement environ 300 à 500 caractères avant de déborder ou de tronquer avec une ellipse. | **Message calibré** : le validateur nomme au maximum **deux critères en défaut** avec leur preuve attendue, et termine par la mention « +N autres à consulter dans le panneau du ticket ». |
| **4. Écriture d'un champ d'app en lecture seule** | Comment mettre à jour un `jira:customField` marqué `readOnly: true` depuis le backend ? | **Vérifié dans le schéma et la doc** : un champ `readOnly: true` peut avoir un `formatter.expression` qui lit dynamiquement une propriété du ticket (ex. `issue.properties["proof-coverage-label"]`). L'app écrit la propriété via `PUT /rest/api/3/issue/{id}/properties/...` avec son scope `write:jira-work`. | **Solution retenue** : `type: string`, `readOnly: true`, expression de formatage branchée sur `issue.properties["proof-coverage-label"]`. Aucun formulaire d'édition utilisateur n'est exposé. |
| **5. Identité transmise à une action lors d'un appel MCP externe** | Comment distinguer un appel venant d'un humain (via Rovo Studio) d'un appel provenant d'un client MCP externe (Claude Code, Cursor) ? | **Vérifié dans la documentation Rovo MCP** : le contexte d'invocation d'un client MCP externe passe soit par un compte machine/app (`api.asApp()`), soit par un compte utilisateur OAuth 2.1 où `context.moduleKey` est préfixé par la configuration MCP. La documentation note que `context.principal` peut être absent ou non résolu pour les clients tiers non interactifs. | **Règle stricte de sécurité** : tout appel routé via `rovo:mcp` ou portant un marqueur d'origine MCP est classé avec `agent: true` par `IdentityGateway`. Aucun outil MCP n'expose d'opération d'attestation, de dérogation ou de validation de critère (§15, §22 point 11). |
| **6. Nouvel éditeur de workflow disponible sur le site de démonstration** | Les validateurs par fonction Forge ne s'ajoutent que dans le **nouvel éditeur de workflow**. Est-il activé sur tous les tenants Cloud ? | **Vérifié dans la documentation** : Atlassian déploie le nouvel éditeur par défaut sur les sites créés en 2025/2026, mais certains anciens sites restent sur l'éditeur classique (qui n'accepte que les validateurs par Jira Expression). | **Double stratégie** : le validateur par fonction `validateProof` est le livrable principal pour Codegeist. En cas de site de démo réfractaire, la solution de repli documentée au §19 est un validateur par expression Jira lisant `issue.properties["proof-gate-passed"] == true`. |

---

## 3. Synthèse des écarts relevés entre le cahier (§17) et le schéma réel

1. **`jira:workflowValidator`** : l'esquisse du §17 mentionne `projectTypes: [company-managed, team-managed]`. Le schéma Forge 1.5.1 ne contient pas la clé `projectTypes` au niveau du schéma statique mais la CLI Forge l'interprète ; notre manifest la déclare et le garde la tolère.
2. **`webtrigger`** : l'esquisse du §17 annonce `urlFormat: v2` et `response: { type: dynamic }`. Le schéma 1.5.1 n'avait que `additionalProperties: true` sur webtrigger ; ces options sont formellement documentées depuis Forge CLI 10+ et fonctionnent parfaitement à l'exécution.
3. **`consumer`** : l'esquisse du §17 plaçait la file ; le point clé validé par la recherche est que `timeoutSeconds: 900` se déclare sur le module **`function`** correspondant et non pas sur le bloc `consumer`.
4. **`app.compatibility` et `app.runtime`** : le schéma local 1.5.1 ne valide pas ces champs (antérieur à la CLI 14.2 qui a introduit la gestion fine multi-produits). Le garde `check-manifest.mjs` isole ces deux blocs avant la passe JSON Schema et effectue sa propre validation stricte sur leurs valeurs.
