# Fait, preuve à l'appui — architecture

> Comment l'app tient sa promesse : pas de « Terminé » sans preuve suffisante.
> Le cahier des charges est dans [CAHIER-DES-CHARGES.md](CAHIER-DES-CHARGES.md)
> (le « SPEC ») ; les renvois `§n` pointent vers ses sections.

## 1. Trois plans, une règle

```
┌────────────────────────── runtime Forge ──────────────────────────┐
│  validateur · écrans · web trigger · file · déclencheurs · MCP     │
└───────────────┬───────────────────────────────────────────────────┘
                │ ports (src/ports.ts)
┌───────────────▼──────────────┐        ┌──────────────────────────┐
│  domaine pur (src/domain)    │        │ adaptateurs (src/db,      │
│  critères · preuves · forces │◀───────│ src/collect) : Forge SQL, │
│  couverture · gate · fraîcheur│       │ Jira, Confluence, LLM     │
└──────────────────────────────┘        └──────────────────────────┘
```

Le domaine ne sait pas qu'il tourne dans Forge : il reçoit des données et des
ports. Toute la logique de décision (quelle force, quel défaut, quel message)
est donc testable en mémoire, sans réseau, en quelques secondes.

## 2. Les sept points d'entrée

| Module Forge | Handler | Rôle |
|---|---|---|
| `jira:workflowValidator` | `src/handlers/validator.ts` | bloque ou laisse passer la transition |
| `jira:issuePanel`, `jira:customField`, `jira:projectSettingsPage`, `jira:projectPage` | `src/handlers/resolver.ts` | les quatre écrans |
| `webtrigger` (`ci-results`) | `src/handlers/ingest.ts` | reçoit le résumé de CI, signe, met en file |
| `consumer` (`proof-ci`) | `src/handlers/consumer.ts` | met à jour preuves, fraîcheur, couverture, preuve vivante |
| `trigger` (`avi:jira:updated:issue`) | `src/handlers/events.ts` | critères modifiés dans la description |
| `scheduledTrigger` | `src/handlers/scheduled.ts` | contrôle nocturne des clôtures hors validateur |
| `action` + `rovo:mcp` | `src/handlers/dispatch.ts` | les sept outils pour les agents |

`src/index.ts` ne fait que les câbler : aucune logique n'y vit.

## 3. Le validateur répond vite parce qu'il ne calcule rien

Chaque écriture (preuve attachée, résultat de CI, dérogation, critère modifié)
recalcule la couverture et la range dans la table `coverage`. Le validateur lit
**une ligne**, compose le message et répond (§17). C'est ce qui tient la
contrainte « moins d'une seconde » (§20) malgré l'absence de durée maximale
documentée (§19).

## 4. La force d'une preuve n'est jamais déclarée, elle est calculée

| Type | Ce qui est fourni | Force obtenue | Vérification de l'app |
|---|---|---|---|
| Test automatisé | nom complet du test | vérifiée par machine | présent, vert, sur un commit de la branche |
| Page de documentation | lien Confluence | vérifiée par machine | existe, modifiée après l'ouverture du ticket |
| Attestation | un clic, note et pièce facultatives | attestée | l'attestant n'est ni l'assigné ni un agent |
| Capture ou vidéo | pièce jointe ou lien | déclarée | la pièce existe |
| Compte rendu d'agent | section du compte rendu | déclarée | la section existe et cite le critère |
| Lien libre | tableau de bord, commit, PR | déclarée | joignable si l'app peut le vérifier |

Une capture accompagnée d'une attestation prend la force de l'attestation.
L'app ne lit pas les images : le modèle disponible dans Forge ne traite que du
texte (§9.1, §19).

## 5. Fraîcheur et indépendance

Une preuve de test est liée à un commit : un nouveau commit sur la branche la
passe en « à reconfirmer » jusqu'au prochain passage vert (§9.3). Un changement
du texte d'un critère incrémente sa version et passe ses preuves « à revoir »
(§8.4). L'assigné ne peut pas attester son propre travail, un agent ne peut
jamais attester, et les types Sécurité et Données exigent un rôle désigné (§9.4).

## 6. Preuve vivante

Sur la branche principale, les paires confirmées test ↔ critère restent
surveillées après la clôture : un test qui échoue signale une régression du
critère livré, un test ignoré ou disparu signale que le critère n'est plus
prouvé (§13). C'est le cas que produisent les agents pressés.

## 7. Ce que l'app annonce ne pas couvrir

Le validateur n'est pas appelé par les transitions en masse, certaines
automatisations et certains appels d'API (§19). L'app le dit : un contrôle
nocturne liste les tickets passés à « Terminé » sans couverture (§20).
