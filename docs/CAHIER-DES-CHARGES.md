# Fait, preuve à l'appui — cahier des charges

> Codegeist 2026 · catégorie **Apps for Software Teams**
> Bonus visés : Agents Rovo, MCP, Marketplace (Teamwork Graph en option)
> Version 1 du 11 novembre 2026 · soumission avant le mardi 22 décembre 2026, 21 h (Paris)

## 1. L'idée en une phrase

Un ticket ne passe à « Terminé » que si chacun de ses critères d'acceptation est relié à une preuve d'une force suffisante ; un validateur de workflow bloque sinon en nommant le critère manquant, et les preuves restent surveillées après la livraison.

## 2. Le problème

« Terminé » est une déclaration. Rien, dans Jira, ne relie cette déclaration à ce qui était demandé.

Trois dérives en découlent :

- **Le critère oublié.** Quatre critères d'acceptation, trois réellement traités ; le quatrième réapparaît sous forme de bug dans deux sprints.
- **La preuve implicite.** « J'ai testé, ça marche. » Aucune trace de ce qui a été testé, par qui, sur quelle version du code.
- **La preuve qui s'évapore.** Le test qui prouvait un critère est modifié, désactivé ou supprimé six mois plus tard. Personne ne sait que le critère n'est plus garanti.

Les agents de code rendent le sujet urgent. Un agent déclare « terminé » avec aplomb, et son compte rendu est plausible par construction. Le relecteur n'a pas le temps de tout revérifier. Il lui faut une règle simple : pas de preuve, pas de « Terminé ».

## 3. Utilisateurs

| Qui | Moment | Attente |
|---|---|---|
| Développeur ou agent de code | En finissant un ticket | Savoir quelle preuve manque, et pouvoir l'attacher en un geste |
| Product owner | En rédigeant, puis en recevant le ticket | Que « terminé » veuille dire « ce que j'ai demandé est vérifié » |
| Testeur, relecteur | Pendant la vérification | Attester un critère sans rédiger un rapport |
| Tech lead | Réglage du projet | Exiger des preuves fortes là où ça compte, légères ailleurs |
| Qualité, audit | Avant une livraison ou un contrôle | Un dossier : chaque exigence, sa preuve, sa date |

## 4. Vocabulaire du produit

- **Critère** : une condition d'acceptation du ticket, avec un identifiant stable (`AC-1`).
- **Preuve** : un élément vérifiable relié à un critère : test, capture, attestation, section de compte rendu.
- **Force** : le niveau de confiance d'une preuve. Trois forces : **vérifiée par machine**, **attestée par un tiers**, **déclarée**.
- **Exigence de preuve** : la force minimale demandée pour un type de critère.
- **Couverture** : la part des critères dont la preuve atteint la force exigée.
- **Preuve périmée** : une preuve antérieure à un changement du critère ou du code.
- **Dérogation** : l'acceptation, motivée et signée, d'un critère sans preuve suffisante.
- **Preuve vivante** : une preuve qui continue d'être vérifiée après la clôture du ticket.
- **Dossier de preuve** : l'ensemble critères, preuves, attestations et dérogations d'un ticket ou d'une version.

## 5. Principes

1. **La preuve s'attache à un critère, pas au ticket.** « Les tests passent » ne prouve rien de précis.
2. **Toutes les preuves ne se valent pas**, et l'app le dit au lieu de les compter.
3. **Celui qui fait n'atteste pas.** Un agent ne peut que déclarer.
4. **Une preuve a une date et un commit.** Le code change, la preuve se périme.
5. **Le blocage explique.** Le message nomme le critère et la preuve attendue.
6. **Prouver doit coûter moins qu'expliquer.** Un geste, pas un formulaire.

## 6. Périmètre

Priorités : **M** = indispensable pour la soumission, **S** = souhaitable, **C** = après le hackathon.

| Lot | Contenu |
|---|---|
| MVP (22 décembre) | Critères structurés, six types de preuves, trois forces, exigences par type de critère, matrice sur le ticket, validateur de workflow, dérogations, entrée des résultats de CI, outils MCP, agent Rovo |
| V1 | Rapprochement automatique tests ↔ critères, preuves périmées, attestation demandée à un tiers, champ « Preuves 3/4 », dossier de preuve par version |
| Vision | Preuve vivante après clôture, preuve avant code, preuve croisée, preuve visible par le client |

## 7. Parcours détaillés

### 7.1 Un agent termine un ticket

1. L'agent appelle `list-criteria` sur PAY-123 : quatre critères, chacun avec la force exigée.
2. Il écrit le code et les tests, puis appelle `attach-evidence` trois fois : un test nommé pour `AC-1`, un autre pour `AC-2`, une section de son compte rendu pour `AC-3`.
3. Le pipeline tourne. Ses résultats arrivent dans l'app : les deux tests existent et passent sur le commit de la PR. `AC-1` et `AC-2` deviennent « vérifiés par machine ».
4. `AC-3` exigeait une attestation. La déclaration de l'agent ne suffit pas : le critère reste ouvert, et l'agent appelle `request-attestation`.
5. `AC-4` n'a rien. L'agent le signale dans son compte rendu.

### 7.2 La transition bloquée

La développeuse tente de passer le ticket à « Terminé ». Jira refuse :

```
2 critères sans preuve suffisante.
AC-3 « L'e-mail de refus est envoyé » : attestation d'un tiers attendue, déclaration reçue.
AC-4 « La limite est réglable par l'administrateur » : aucune preuve.
```

### 7.3 L'attestation

La testeuse ouvre le ticket, déclenche un refus de paiement, reçoit l'e-mail. Dans la matrice, elle clique **J'ai vérifié** sur `AC-3` et joint une capture. Dix secondes.

### 7.4 La dérogation

`AC-4` est repoussé à un autre ticket. Le product owner accorde une dérogation sur ce critère, motif « reporté dans PAY-140 ». La transition passe. La dérogation figure dans le dossier.

### 7.5 Six mois plus tard

Un agent, sur un autre ticket, désactive le test qui prouvait `AC-1`. Au pipeline suivant, l'app constate que le test n'est plus exécuté. PAY-123 reçoit le signalement « AC-1 n'est plus prouvé depuis le commit `e41f` » et l'équipe est prévenue.

## 8. Les critères

### 8.1 Une forme canonique

L'app tient les critères dans une structure à elle, rattachée au ticket, éditée dans son panneau :

| Champ | Contenu |
|---|---|
| Identifiant | `AC-1`, stable même si le texte change |
| Texte | La condition |
| Type | Fonctionnel, non-régression, performance, sécurité, accessibilité, données, documentation |
| Force exigée | Héritée du type, modifiable par critère |
| Version | Incrémentée à chaque modification du texte |

### 8.2 Import

À la première ouverture, l'app propose d'importer les critères depuis la description :

- cases à cocher ;
- liste sous un titre « Critères d'acceptation » ;
- scénarios « Étant donné, quand, alors ».

L'utilisateur valide le découpage. Ensuite, la structure de l'app fait foi ; elle réécrit la section de la description pour rester lisible sans l'app.

### 8.3 Critères manquants

Un ticket sans critère ne peut rien prouver. Selon le réglage du projet :

- le validateur bloque (« aucun critère défini ») ;
- ou l'app propose des critères tirés de la description, à valider par un humain. Un agent peut les proposer par `propose-criteria` ; il ne peut pas les valider.

### 8.4 Quand un critère change

Modifier le texte d'un critère incrémente sa version. Les preuves attachées à l'ancienne version passent en « à revoir » : un clic les confirme si le changement était cosmétique, sinon elles tombent.

## 9. Les preuves

### 9.1 Types et force

| Type | Ce qui est fourni | Force | Vérification faite par l'app |
|---|---|---|---|
| Test automatisé | Nom complet du test | Vérifiée par machine | Le test figure dans les résultats de CI, il passe, sur un commit de la branche du ticket |
| Page de documentation | Lien vers une page Confluence | Vérifiée par machine | La page existe et a été modifiée après le début du ticket |
| Attestation | Un clic « j'ai vérifié », note facultative, pièce jointe facultative | Attestée | L'attestant n'est ni l'assigné ni un agent |
| Capture ou vidéo | Pièce jointe du ticket ou lien | Déclarée | La pièce existe |
| Compte rendu d'agent | Section du compte rendu | Déclarée | La section existe et cite le critère |
| Lien libre | Tableau de bord, commit, PR | Déclarée | Le lien est joignable si l'app peut le vérifier |

Une capture accompagnée d'une attestation prend la force de l'attestation.

L'app ne « lit » pas les captures : le modèle disponible dans Forge ne traite que du texte. Une image prouve qu'une pièce existe, pas ce qu'elle montre. C'est pourquoi sa force reste « déclarée » tant qu'un tiers n'a pas attesté.

### 9.2 Exigences par défaut

| Type de critère | Force exigée |
|---|---|
| Fonctionnel | Vérifiée par machine, ou attestée |
| Non-régression | Vérifiée par machine |
| Performance | Attestée, avec lien de mesure |
| Sécurité | Attestée par un rôle désigné |
| Accessibilité | Attestée |
| Données, migration | Attestée, par quelqu'un d'autre que l'auteur |
| Documentation | Vérifiée par machine |

Chaque projet ajuste la grille. Un projet peut aussi exiger deux preuves de types différents pour une catégorie (preuve croisée, lot C).

### 9.3 Fraîcheur

Une preuve de test est liée au commit sur lequel le test a passé. Si de nouveaux commits arrivent sur la branche du ticket, la preuve devient « à reconfirmer » jusqu'au prochain passage vert. Le validateur ne retient que les preuves fraîches.

### 9.4 Indépendance

- L'assigné du ticket ne peut pas attester ses propres critères.
- Un agent ne peut jamais attester.
- Pour les types Sécurité et Données, l'attestant doit avoir le rôle de projet désigné.

## 10. Recevoir les résultats de CI

L'app n'a pas besoin de lire le dépôt. Elle a besoin de savoir quels tests ont tourné, avec quel résultat, sur quel commit.

Un point d'entrée (web trigger) reçoit, en fin de pipeline, un résumé : dépôt, branche, commit, liste des tests avec leur état (passé, échoué, ignoré). Une commande d'une ligne ajoutée au pipeline suffit ; elle fonctionne avec n'importe quelle CI.

- Authentification : clé de projet et signature du corps.
- Taille : résumé seul (noms et états), pas les journaux. Au-delà de 5 Mo, envoi en plusieurs lots.
- Rattachement au ticket : par la clé contenue dans le nom de la branche.

## 11. Rapprocher tests et critères (lot S)

Attacher chaque test à la main lasse vite. Quand les résultats de CI arrivent :

1. L'app repère les tests nouveaux ou modifiés sur la branche.
2. Un modèle de langage compare leurs noms au texte des critères et propose des paires, avec une confiance et une phrase de justification.
3. Un humain confirme d'un clic. Les paires confirmées sont mémorisées : aux passages suivants, la preuve se met à jour seule.

Une paire proposée et non confirmée ne compte jamais comme preuve.

## 12. Le blocage

### 12.1 Le validateur

Un validateur de workflow, ajouté par l'administrateur sur les transitions vers « Terminé ». À chaque tentative, il lit la couverture déjà calculée et répond :

- **passe** si chaque critère a une preuve fraîche de force suffisante, ou une dérogation valide ;
- **bloque** sinon, avec la liste des critères en défaut et la preuve attendue pour chacun.

Le validateur ne reçoit pas l'identité de la personne qui fait la transition. Les dérogations se donnent donc **avant**, dans le panneau du ticket, pas au moment de la transition.

### 12.2 Trois sévérités, au choix du projet

| Mode | Effet |
|---|---|
| Strict | Aucune transition sans couverture complète ou dérogation |
| Souple | La transition passe si seuls des critères de type mineur manquent ; ils restent signalés |
| Observation | Rien n'est bloqué ; l'app mesure ce qu'elle aurait bloqué |

### 12.3 Avant « Terminé »

Le blocage final arrive trop tard s'il surprend. La couverture est donc visible partout :

- dans la matrice du ticket ;
- dans un champ « Preuves : 3 / 4 », affichable sur les tableaux et utilisable en JQL ;
- dans la réponse de l'outil `get-proof-status`, que l'agent consulte avant de déclarer son travail fini.

### 12.4 Dérogations

Accordées par un rôle désigné, critère par critère, avec un motif. Elles ne s'héritent pas : une dérogation sur `AC-4` ne couvre pas `AC-5`. Leur nombre par projet et par personne est affiché ; une règle dérogée en permanence est une règle à revoir.

## 13. Preuve vivante (vision)

Une fois le ticket clos, les paires confirmées test ↔ critère restent enregistrées. À chaque résultat de CI sur la branche principale :

- le test **passe** : rien à dire ;
- le test **échoue** : le critère livré est en régression ; le ticket d'origine est signalé et un bug est proposé ;
- le test est **ignoré** ou **absent** alors qu'il existait : le critère n'est plus prouvé. C'est le cas le plus sournois, et celui que produisent les agents pressés.

Un écran liste les « critères livrés qui ne sont plus prouvés », par composant. C'est une traçabilité exigences ↔ tests qui se tient à jour toute seule.

## 14. Exigences fonctionnelles

| N° | Exigence | Priorité |
|---|---|---|
| FP-01 | Tenir des critères structurés par ticket, avec identifiants stables et versions | M |
| FP-02 | Importer les critères depuis la description, avec validation humaine | M |
| FP-03 | Attacher une preuve à un critère, parmi les six types du § 9.1 | M |
| FP-04 | Calculer la force de chaque preuve et la couverture du ticket | M |
| FP-05 | Régler la force exigée par type de critère et par projet | M |
| FP-06 | Recevoir un résumé de résultats de CI et vérifier les preuves de type test | M |
| FP-07 | Bloquer la transition vers « Terminé » avec un message nommant chaque critère en défaut | M |
| FP-08 | Interdire l'attestation par l'assigné et par un agent | M |
| FP-09 | Accorder des dérogations motivées, critère par critère | M |
| FP-10 | Afficher la matrice critères × preuves sur le ticket | M |
| FP-11 | Outils MCP du § 15 et agent Rovo | M |
| FP-12 | Modes strict, souple, observation | M |
| FP-13 | Marquer périmées les preuves antérieures à un changement de critère ou de code | S |
| FP-14 | Proposer des paires tests ↔ critères, à confirmer | S |
| FP-15 | Demander une attestation à une personne, avec notification | S |
| FP-16 | Champ « Preuves n / m » sur le ticket | S |
| FP-17 | Dossier de preuve d'une version, exporté dans Confluence | S |
| FP-18 | Statistiques : couverture par force, réouvertures selon la force des preuves | S |
| FP-19 | Preuve vivante après clôture | C |
| FP-20 | Preuve avant code : enregistrer le test prévu pour chaque critère avant d'écrire | C |
| FP-21 | Preuve croisée pour les critères critiques | C |

## 15. Outils MCP et agent Rovo

### Outils, exposés par `rovo:mcp`

| Clé | Verbe | Entrées | Retour |
|---|---|---|---|
| `list-criteria` | GET | `issueKey` | Critères, type, force exigée, état |
| `get-proof-status` | GET | `issueKey` | Couverture, critères en défaut, preuve attendue pour chacun |
| `attach-evidence` | CREATE | `issueKey`, `criterionId`, `type`, `reference`, `note` | Preuve enregistrée, force obtenue |
| `propose-criteria` | CREATE | `issueKey`, `criteria` | Propositions en attente de validation humaine |
| `request-attestation` | CREATE | `issueKey`, `criterionId`, `what` | Demande adressée au rôle compétent |
| `suggest-evidence` | GET | `issueKey`, `testNames` | Paires proposées avec confiance |
| `get-release-proof` | GET | `versionId` | Couverture d'une version, dérogations |

Aucun outil ne permet à un agent d'attester, de déroger ni de valider des critères. Ces gestes n'existent que dans l'interface, pour un humain.

### Agent « Preuve à l'appui »

- « Qu'est-ce qui manque pour terminer PAY-123 ? »
- « Quels tickets de la version 2.4 ont été clos par dérogation ? »
- « Quels critères livrés ne sont plus prouvés ? »
- « Rédige les critères d'acceptation de ce ticket. » (propositions à valider)

## 16. Écrans

1. **Panneau du ticket** (`jira:issuePanel`). La matrice : une ligne par critère, sa force exigée, ses preuves, son état. Boutons : attacher, attester, demander une attestation, déroger. Historique des versions de critères.
2. **Champ de couverture** (`jira:customField`). « 3 / 4 », coloré.
3. **Réglages du projet** (`jira:projectSettingsPage`). Grille des exigences, rôles qui attestent et dérogent, mode, clé du point d'entrée de CI avec la commande à copier.
4. **Page projet « Preuves »** (`jira:projectPage`). Tickets en cours et leur couverture, dérogations, critères livrés non prouvés, statistiques.
5. **Configuration du validateur** dans l'éditeur de workflow : mode et types de critères concernés.

## 17. Architecture Forge

Une app installée sur Jira (Confluence optionnel pour le dossier de preuve).

```yaml
# Esquisse, à valider avec forge lint
modules:
  jira:workflowValidator:
    - key: proof-gate
      name: Fait, preuve à l'appui
      description: Bloque la transition si un critère n'a pas de preuve suffisante
      function: validateProof
      projectTypes: [company-managed, team-managed]
  jira:issuePanel:
  jira:customField:          # couverture, lecture seule
  jira:projectSettingsPage:
  jira:projectPage:
  webtrigger:
    - key: ci-results        # résumé de résultats de CI
      function: ingestResults
      urlFormat: v2
      response: { type: dynamic }
  consumer:                  # vérification des preuves, rapprochement, preuve vivante
  trigger:                   # avi:jira:updated:issue (critères modifiés dans la description)
  sql:
  llm:                       # import des critères, rapprochement tests ↔ critères
  rovo:agent:
  action:
  rovo:mcp:
```

### Pourquoi le validateur répond vite

La fonction du validateur ne calcule rien. Elle lit une ligne : la couverture du ticket, tenue à jour à chaque preuve attachée et à chaque résultat de CI. Elle compose le message et répond.

### Déroulement à l'arrivée de résultats de CI

1. Le web trigger vérifie la signature, range le résumé dans la file, répond aussitôt.
2. Le consommateur retrouve le ticket par la branche, met à jour les preuves de type test (passées, échouées, ignorées, absentes) et leur fraîcheur.
3. Il recalcule la couverture et le champ du ticket.
4. Sur la branche principale, il met à jour les preuves vivantes des tickets clos.

## 18. Modèle de données (Forge SQL)

| Table | Colonnes principales |
|---|---|
| `criterion` | id, issue_id, code (AC-1), text, type, required_strength, version, status |
| `criterion_history` | criterion_id, version, text, changed_by, at |
| `evidence` | id, criterion_id, criterion_version, type, reference, strength, commit, fresh, added_by, added_by_agent, at |
| `attestation` | id, criterion_id, attester_account_id, role, note, attachment_ref, at |
| `waiver` | id, criterion_id, granted_by, reason, at |
| `test_run` | id, repo, branch, commit, received_at |
| `test_result` | run_id, test_name, state |
| `test_link` | criterion_id, test_name, confirmed_by, confidence, at |
| `coverage` | issue_id, total, proven, waived, blocking_json, updated_at |
| `settings` | project_id, requirements_json, mode, roles_json, ci_key_hash |

## 19. Contraintes vérifiées et points à valider

### Vérifié dans la documentation (10 et 11 novembre 2026)

- `jira:workflowValidator` est en Preview. Il s'implémente par fonction ou par expression Jira.
- La fonction reçoit la clé du ticket, la configuration du validateur, les statuts de départ et d'arrivée et les champs modifiés. Elle renvoie `result` (booléen) et `errorMessage`.
- La fonction ne reçoit pas l'utilisateur qui effectue la transition.
- Projets gérés par l'entreprise par défaut ; projets gérés par l'équipe en le déclarant dans `projectTypes`.
- Les validateurs par fonction ne se créent et ne se modifient que dans le nouvel éditeur de workflow ; leur configuration est limitée à 32 Ko.
- Quand un validateur échoue, la transition n'a pas lieu et les post-fonctions ne s'exécutent pas.
- Forge LLMs ne traite que du texte : pas d'analyse d'image.
- Web trigger : aucune authentification par défaut, 55 s, charge utile de 5 Mo.
- `rovo:mcp` : en Preview, 50 outils au plus, accès externe activé par un administrateur ; entrées d'action limitées aux chaînes, entiers, nombres et booléens.

### À valider par un prototype la première semaine

| Point | Pourquoi | Solution de repli |
|---|---|---|
| Durée maximale de la fonction du validateur | La doc ne la donne pas | Lecture d'une seule ligne ; validateur par expression lisant une propriété du ticket |
| Comportement lors des transitions en masse, par automatisation ou par API | Non documenté ; conditionne l'étanchéité du blocage | Annoncer la limite ; contrôle nocturne des tickets clos sans couverture |
| Longueur maximale du message d'erreur | Format du § 7.2 | Deux critères nommés, le reste dans le panneau |
| Écriture d'un champ d'app en lecture seule | Champ « Preuves n / m » | Propriété de ticket indexée |
| Identité transmise à une action lors d'un appel MCP externe | Distinguer agent et humain, interdire l'attestation | Marquer comme « agent » tout ce qui vient de MCP |
| Nouvel éditeur de workflow disponible sur le site de démonstration | Nécessaire pour poser le validateur | Validateur par expression |

## 20. Exigences non fonctionnelles

- **Rapidité.** Validateur en moins d'une seconde. Matrice affichée en moins de 2 s. Preuves mises à jour moins d'une minute après la fin du pipeline.
- **Étanchéité annoncée.** L'app dit ce qu'elle bloque et ce qu'elle ne bloque pas. Les tickets passés à « Terminé » hors validateur sont listés chaque nuit.
- **Légèreté.** Attacher une preuve ou attester : un geste. Aucun champ obligatoire en dehors du critère visé.
- **Intégrité.** Preuves, attestations et dérogations ne sont jamais supprimées ; elles sont remplacées et gardées.
- **Données.** Seuls les noms et états des tests entrent dans l'app. Aucun code, aucun journal.
- **Langues.** Interface en anglais et en français ; soumission en anglais.

## 21. Cas limites

- Ticket sans critère : selon le réglage, blocage ou proposition de critères.
- Critère non applicable finalement : dérogation avec le motif « sans objet » ; ce n'est pas une suppression.
- Test renommé : la paire confirmée est perdue ; l'app propose le rapprochement avec le nouveau nom.
- Même test prouvant plusieurs critères : autorisé, signalé au-delà de trois.
- Ticket sans code (rédaction, configuration) : types de preuves limités à l'attestation, la page et le lien.
- Ticket rouvert : les preuves restent, marquées « à reconfirmer ».
- Sous-tâches : chaque sous-tâche a ses critères ; le parent peut exiger la couverture de ses enfants.
- Pipeline rouge sur un autre test : seules les preuves des tests concernés sont touchées.
- Assigné changé en cours de route : l'ancien assigné ne peut toujours pas attester le travail qu'il a fait.
- Critère modifié après la clôture : nouvelle version, preuve à revoir, ticket signalé.

## 22. Recette

1. Un ticket à quatre critères dont un sans preuve ne peut pas passer à « Terminé » ; le message nomme ce critère.
2. Un test attaché, présent et vert dans les résultats de CI de la branche, donne une preuve « vérifiée par machine ».
3. Le même test, absent ou en échec, ne donne aucune preuve valable.
4. L'assigné ne peut pas attester ; un autre membre du projet le peut.
5. Une preuve déclarée par un agent ne satisfait pas un critère exigeant une attestation.
6. Une dérogation motivée sur le critère manquant débloque la transition et figure dans le dossier.
7. Modifier le texte d'un critère fait passer ses preuves en « à revoir ».
8. Un nouveau commit après une preuve de test la rend « à reconfirmer » jusqu'au passage vert suivant.
9. En mode observation, la transition passe et le blocage évité est compté.
10. `get-proof-status` renvoie les mêmes critères en défaut que le message du validateur.
11. Aucun outil MCP ne permet d'attester ni de déroger.

## 23. Scénario de la vidéo (moins de 5 minutes, en anglais)

| Temps | Contenu |
|---|---|
| 0:00 – 0:30 | Un ticket « terminé », quatre critères, trois faits. Le quatrième revient en bug. |
| 0:30 – 1:10 | La matrice du ticket : critères, forces exigées |
| 1:10 – 2:10 | Un agent attache deux tests et une déclaration ; le pipeline passe ; deux critères virent au vert |
| 2:10 – 2:40 | Tentative de clôture : Jira bloque et nomme les deux critères |
| 2:40 – 3:20 | Attestation en un clic par la testeuse ; dérogation motivée par le product owner ; la clôture passe |
| 3:20 – 4:00 | Six mois plus tard : un test désactivé, le critère livré n'est plus prouvé |
| 4:00 – 4:30 | Dossier de preuve de la version 2.4 |
| 4:30 – 4:50 | Architecture : validateur Forge, entrée de CI, `rovo:mcp` |

## 24. Comment les juges testeront

1. Installer l'app sur le site de démonstration, charger le projet d'exemple.
2. Ajouter le validateur à la transition vers « Terminé » (trois clics, décrits pas à pas) ou utiliser le workflow d'exemple.
3. Tenter de clore un ticket d'exemple, lire le message, attester, déroger, clore.
4. Envoyer un résumé de CI d'exemple avec la commande fournie, voir les preuves changer.
5. Interroger l'agent Rovo ; en option, connecter un client MCP.

Aucun dépôt ni outil de CI n'est nécessaire.

## 25. Plan jusqu'au 22 décembre

| Semaine | Objectif |
|---|---|
| 11 – 17 nov. | Les six validations du § 19 ; un validateur qui bloque d'après une donnée de l'app |
| 18 – 24 nov. | Critères structurés, import, panneau du ticket |
| 25 nov. – 1er déc. | Preuves, forces, couverture, exigences par projet |
| 2 – 8 déc. | Entrée de CI, vérification des tests, fraîcheur, dérogations |
| 9 – 15 déc. | Outils MCP, agent, modes, champ de couverture ; gel des fonctionnalités le 15 |
| 16 – 22 déc. | Recette, vidéo, instructions pour les juges, soumission, dépôt Marketplace |

## 26. Risques

| Risque | Parade |
|---|---|
| Vécu comme de la paperasse | Un geste par preuve, rapprochement automatique, mode observation d'abord |
| Preuves de complaisance | Trois forces distinctes, attestation interdite à l'auteur, statistiques sur les réouvertures |
| Blocage contourné par une autre voie de transition | Limite annoncée, contrôle nocturne, liste des clôtures hors validateur |
| Critères mal écrits, donc improuvables | Types de critères, propositions de reformulation, lien avec le score de préparation du Brief de contexte |
| Trop de dérogations | Compteur visible par projet et par personne |
| Dépendance à la CI | Attestation et lien suffisent pour démarrer ; la CI renforce ensuite |

## 27. La vision poussée à l'extrême

- **Preuve vivante.** Le § 13 : chaque critère livré reste relié au test qui le garantit, indéfiniment.
- **Preuve avant code.** Avant d'écrire, l'agent ou le développeur enregistre le test qui prouvera chaque critère. Ensuite, il le fait passer. Tout changement du critère ou du test en cours de route est visible : on ne déplace plus les poteaux.
- **Preuve croisée.** Pour les critères critiques, deux preuves de natures différentes : un test et une attestation.
- **Preuve visible par le client.** Pour une demande venue du support, le client voit que ce qu'il a demandé est livré et vérifié, sans jargon.
- **Dossier d'audit en un clic.** Pour les secteurs réglementés : exigence, preuve, attestant, date, commit, dérogation, pour chaque ticket d'une version.
- **La qualité des « Terminé » devient mesurable.** Part de critères prouvés par machine, taux de réouverture selon la force des preuves : l'équipe sait ce que valent ses clôtures.

## 28. Liens avec les autres cahiers des charges

- **Brief de contexte (02)** : le compte rendu de l'agent cite les critères couverts ; il devient une source de preuves déclarées.
- **Merge avec contexte (03)** : la règle « critères d'acceptation validés » s'appuie sur la couverture au lieu de cases cochées.
- **Rayon d'impact (01)** : un signal « ticket clos par dérogation » ou « critère non prouvé » dans le dossier de release.
- **Permis d'agir (06)** : désactiver ou supprimer un test est une action soumise à approbation.
- **Échecs de CI avec mémoire (04)** : le même flux de résultats de tests alimente les deux apps.

## 29. Sources

- [Codegeist 2026](https://codegeist2026.devpost.com/) et son [règlement](https://codegeist2026.devpost.com/rules)
- [Module Jira workflow validator](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-workflow-validator/)
- [Modules Jira](https://developer.atlassian.com/platform/forge/manifest-reference/modules/index-jira/)
- [Web trigger](https://developer.atlassian.com/platform/forge/manifest-reference/modules/web-trigger/)
- [Module Rovo MCP](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-mcp/) et [module Action](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-action/)
- [Limites d'invocation](https://developer.atlassian.com/platform/forge/limits-invocation/), [limites SQL](https://developer.atlassian.com/platform/forge/limits-sql/), [limites LLM](https://developer.atlassian.com/platform/forge/limits-llm/)
- [Modèles Forge LLMs](https://developer.atlassian.com/platform/forge/runtime-reference/forge-llms-models/)
