# La démo en direct : données réelles du site de démonstration

> Lot `app-donnees-reelles`. Le site public rejoue le vrai moteur sur l'état
> **réel** de l'app installée sur le site de démonstration Jira, au lieu du seul
> jeu embarqué. Ce document décrit le contrat, la procédure d'amorçage et les
> règles de vie privée. Rien ici n'est nécessaire pour faire tourner les tests.

## 1. Principe

```
Forge (site de démonstration)                     GitHub Pages (statique)
couverture recalculée                            site/src/demo/live-snapshot.ts
   └─ instantané pseudonymisé                      └─ importe site/public/live-snapshot.json
      └─ propriété Jira du ticket                     └─ réhydrate le monde de la démo
         proof-live-snapshot                               └─ même moteur, mêmes règles
```

L'app écrit son état pseudonymisé dans une **propriété du ticket Jira**, à
chaque écriture de couverture. L'outil `tools/refresh-live-snapshot.mjs` lit
cette propriété et la versionne dans `site/public/live-snapshot.json` ; le site
l'importe **à la construction**. La page reste entièrement statique : pas de
`fetch` à l'exécution, pas de CORS, pas d'egress — et surtout **pas de web
trigger dynamique dans l'app**, sans quoi elle perdrait l'éligibilité
« Runs on Atlassian » (voir §6).

Le site réhydrate un magasin en mémoire avec cet instantané, puis **rejoue
exactement les mêmes modules** que le jeu embarqué (`src/domain/*`,
`src/handlers/*`, `src/viewmodel/*`). Sans instantané (fichier absent), il
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

## 5. Déploiement et rafraîchissement

```bash
forge deploy -e production                       # ou -e development
forge install --site <site>.atlassian.net -p jira -e production --confirm-scopes --non-interactive
```

Le premier `install` sur un environnement vierge ne prend **pas** `--upgrade`.
Un changement de scope ou de type de déclencheur est une version majeure :
`forge deploy --approve MAJOR_VERSION_RULE`.

Puis, pour rafraîchir les données que montre le site (une commande) :

```bash
node tools/refresh-live-snapshot.mjs              # → site/public/live-snapshot.json
```

Le jeton Atlassian est lu dans `ATLASSIAN_API_TOKEN` ou dans
`~/.atlassian-api-token` ; le ticket et le site se règlent par
`ATLASSIAN_ISSUE` et `ATLASSIAN_SITE`.

## 6. Éligibilité « Runs on Atlassian »

Le programme exige que l'app **n'ait aucun déclencheur dynamique** : seule une
réponse construite à l'exécution peut faire sortir des données du tenant. Les
deux déclencheurs de l'app sont donc statiques — la réponse est l'une des
sorties déclarées dans `manifest.yml` :

| Déclencheur | Sorties |
|---|---|
| `ci-results` | accepted / unauthorized / invalid-payload / payload-too-large / method-not-allowed |
| `bootstrap` | ok / migrated / forbidden / invalid-payload / not-found / method-not-allowed |

`tools/lib/manifest-checks.mjs` (via `tools/check-manifest.mjs`) refuse tout
déclencheur dynamique : la CI protège l'éligibilité.

Vérification :

```bash
forge eligibility -e production
# ✔ The version of your app [2.0.0] that's deployed to [production]
#   is eligible for the Runs on Atlassian program.
```

Le site public n'est plus lisible en direct depuis l'app : c'est le prix du
badge. Le compromis retenu — l'app publie dans le ticket, l'outil lit, le site
embarque — garde les données réellement produites par l'app, sans exposition
d'egress.
