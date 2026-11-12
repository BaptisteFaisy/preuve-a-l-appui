# La démo en direct : données réelles du site de démonstration

> Lot `app-donnees-reelles`. Le site public rejoue le vrai moteur sur l'état
> **réel** de l'app installée sur le site de démonstration Jira, au lieu du seul
> jeu embarqué. Ce document décrit le contrat, la procédure d'amorçage et les
> règles de vie privée. Rien ici n'est nécessaire pour faire tourner les tests.

## 1. Principe

```
GitHub Pages (statique)                     Forge (site de démonstration)
site/src/demo/remote.ts  ──GET──────────▶   webtrigger demo-data
                       ◀─────JSON──────     src/handlers/demo-data.ts
                                            └─ src/demo-snapshot.ts (contrat)
                                               └─ Forge SQL + API Jira
```

Le site appelle un seul point d'entrée, en lecture seule, sans secret. Il
hydrate un magasin en mémoire avec l'instantané reçu, puis **rejoue exactement
les mêmes modules** que le jeu embarqué (`src/domain/*`, `src/handlers/*`,
`src/viewmodel/*`). Si l'appel échoue (réseau, app non déployée, CORS), le site
bascule sur le jeu PAY-123 embarqué et le dit à l'écran : la page ne casse
jamais, et la provenance est toujours affichée.

Les gestes de la démo modifient la copie en mémoire, jamais le vrai site : un
site statique public n'a pas de secret à présenter pour écrire, et n'en aura
pas. C'est annoncé dans l'interface.

## 2. Contrat

`src/demo-snapshot.ts` est la seule définition de la forme échangée : le
handler la produit, le site la consomme, `tests/handlers/demo-data.test.ts` la
verrouille (liste exacte des clés de premier niveau).

| Champ | Contenu |
|---|---|
| `generatedAt`, `site` | horodatage du serveur et site Jira d'origine (provenance affichée) |
| `project`, `issue` | projet et ticket réels, lus dans Jira |
| `settings` | réglages du projet — **`ciKeyHash` vidé** |
| `criteria`, `evidences`, `attestations`, `waivers` | l'état rangé en base |
| `coverage` | la ligne de couverture lue par le validateur (SPEC §22 point 10) |
| `living`, `stats`, `dossier` | preuve vivante, statistiques, dossier de version |
| `ci` | dernier run de CI retrouvé (`?repo=&branch=`), pour rejouer un vrai résumé |
| `actors` | personnes rencontrées : référence, nom affiché, rôles projet |

## 3. Vie privée

Le site est public. Trois règles, vérifiées par un test :

1. **Aucun identifiant de compte Atlassian ne sort**, à quelque profondeur que
   ce soit. `anonymizeDeep` parcourt tableaux et objets et remplace la valeur
   de tout champ listé dans `ACCOUNT_FIELDS` (`addedBy`, `createdBy`,
   `grantedBy`, `attesterAccountId`, `accountId`, `assigneeAccountId`,
   `reporterAccountId`, `changedBy`, `confirmedBy`) par une référence stable
   `actor-N`. `replacedBy` n'en fait pas partie : c'est un identifiant de
   preuve. Une seule implémentation pour toutes les structures — aucune ne peut
   fuiter parce qu'un niveau aurait été oublié.
2. **La clé de CI ne sort pas** : `settings.ciKeyHash` est vidé à la sortie.
3. **Les noms affichés restent** : ils sont déjà publics dans Jira. Un compte
   que Jira ne résout pas n'est pas deviné — sa référence sert de nom.

Les identifiants réels ne reviennent jamais côté site : les règles
d'indépendance (SPEC §9.4) sont évaluées sur les références, de façon
cohérente des deux côtés (`issue.assigneeRef` et les preuves partagent la même
table).

## 4. Amorçage (une fois, par l'opérateur)

L'écriture n'est pas publique : elle exige le jeton porté par la variable d'app
`FORGE_USER_VAR_DEMO_BOOTSTRAP_TOKEN` (comparaison en temps constant,
`safeCompareHex`). Variable absente → le `POST` répond `403 bootstrap-disabled`.

```bash
# 1. Jeton d'amorçage (une fois par environnement ; Forge SQL est par environnement)
forge variables set FORGE_USER_VAR_DEMO_BOOTSTRAP_TOKEN "<jeton>" -e development

# 2. Amorcer le scénario du SPEC §7 sur un ticket réel
curl -fsS -X POST "$DEMO_DATA_URL" \
  -H "content-type: application/json" -H "x-bootstrap-token: <jeton>" \
  --data '{"action":"bootstrap","issueKey":"<CLE-1>","ciKey":"<cle-ci>",
           "cast":{"developer":"<accountId>","tester":"<accountId>","owner":"<accountId>"}}'
```

L'amorçage écrit les réglages du projet (empreinte SHA-256 de la clé de CI),
les quatre critères, trois preuves **déclarées**, réécrit la section
« Critères d'acceptation » de la description, puis laisse le moteur calculer la
couverture. Il est idempotent : un ticket déjà amorcé n'est pas recréé.

Les preuves de test ne montent en `machine-verified` qu'au passage du vrai
pipeline, par le web trigger signé `ci-results` (SPEC §10) :

```bash
SIGNATURE=$(python3 - <<'PY'
import hmac, hashlib, os, time
body = open('/tmp/ci.json', 'rb').read()
ts = str(int(time.time()))
print(ts, hmac.new(os.environb[b'CI_KEY'], f'{ts}.'.encode() + body, hashlib.sha256).hexdigest())
PY
)
```

## 5. Déploiement

```bash
forge deploy                                     # development
forge install --site <site>.atlassian.net -p jira -e development --confirm-scopes --non-interactive
forge webtrigger create -f demo-data -s <site>.atlassian.net -p jira -e development --non-interactive
```

Le premier `install` sur un environnement vierge ne prend **pas** `--upgrade`.
L'URL obtenue est de la forme
`https://<installationId>.webtrigger.atlassian.app/public/<jeton>` : c'est elle
que le site appelle (variable de build `VITE_PROOF_DEMO_URL`, avec une valeur
par défaut commitée — l'URL est publique par nature, elle ne donne accès qu'à
de la lecture pseudonymisée).
