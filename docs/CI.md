# CI — « Fait, preuve à l'appui »

## Les checks

| check | workflow | ce qu'il interdit |
|---|---|---|
| `ci` | `.github/workflows/ci.yml` | types faux, tests rouges, fichier > 500 lignes, fonction > 50 lignes, manifeste incohérent, doc vide ou illisible, garde de CI en échec |
| `ci-budget` | `.github/workflows/ci-budget.yml` | un job sans `timeout-minutes`, ou au-delà de 5 min sur une PR |
| `couche0` | `.github/workflows/couche0.yml` | fichier modifié hors du `## Scope` de la PR, motif interdit (poussée forcée, déclencheur à privilèges, clé en clair), workflow de garde modifié sans la mention `SAMVISION_ALLOW_GUARD_BUMP` |
| `eligibility` | `.github/workflows/eligibility.yml` | app inéligible au programme Atlassian « Runs on Atlassian » en production ou en development, job au-delà de 5 min, secret absent, garde local non appelé |

Le check `ci` est exigé par le ruleset de `main` et par la file Mergify : sans lui, la PR n'entre pas dans la file.

## Étapes du job `ci` (dans cet ordre)

1. `npx tsc --noEmit` — aucun type faux sur `src/` et `tests/`.
2. `npx vitest run` — aucun test rouge.
3. `python3 tools/check-file-limits.py` — aucun fichier > 500 lignes.
4. `node tools/check-function-limits.mjs` — aucune fonction > 50 lignes **de code** (les commentaires et le corps des chaînes multilignes ne comptent pas ; fichiers générés exclus).
5. `node tools/check-manifest.mjs` — manifeste Forge cohérent (toléré tant que le script est absent).
6. Sanity docs — tout `.md` / `.mdx` / `.txt` du dépôt est lisible en UTF-8 et non vide.
7. Tests des gardes CI (couche0, agents fireworks) et `bash -n` sur chaque script shell.

## En local, la même vérification

```bash
npm ci --prefer-offline
npm run typecheck && npm test && python3 tools/check-file-limits.py && node tools/check-function-limits.mjs
```

Une seule garde, hors limites : `node tools/check-function-limits.mjs --limite 40 --racine src`.

## Éligibilité « Runs on Atlassian » (check `eligibility`)

L'app est déployée chez un vrai client et **éligible au programme Atlassian « Runs on Atlassian »** : c'est un argument de la candidature, pas un détail. L'éligibilité se perd dès qu'un module fait sortir des données — en pratique un webtrigger dynamique, que la CLI résume par « App is using a webtrigger module that can egress data ». Une seule ligne de `manifest.yml` suffit à la perdre, et aucune autre garde ne le verrait.

Le check `eligibility` (`.github/workflows/eligibility.yml`, sur chaque PR) interroge Atlassian **en production et en development** et échoue si l'une des deux n'est plus éligible. Il affiche la phrase exacte de la CLI et la liste des règles violées, jamais un `exit 1` nu. Comme `forge eligibility` sort en code 0 même quand l'app est inéligible, c'est le garde qui lit la sortie et tranche.

Une seule implémentation : `tools/check-eligibility.mjs`, appelée par le workflow et par `tests/tools/check-eligibility.test.ts`. Le même fichier vérifie aussi, hors ligne (`--check-workflow`), que le workflow est bien branché : déclencheur `pull_request`, `timeout-minutes` ≤ 5, les deux secrets, appel du garde.

Secrets à créer une fois (dépôt → Settings → Secrets, ou CLI) :

```bash
gh secret set FORGE_EMAIL       # login du compte Atlassian propriétaire de l'app
gh secret set FORGE_API_TOKEN   # son API token personnel
```

Le workflow utilise exactement ces deux noms (`secrets.FORGE_EMAIL`, `secrets.FORGE_API_TOKEN`) et `FORGE_DISABLE_ANALYTICS=1` ; la CLI est installée une fois dans `~/.cache/forge-cli/` et réutilisée d'un run à l'autre.

En local, même vérification (identifiants dans l'environnement, jamais dans le dépôt) :

```bash
export FORGE_EMAIL="$(grep -E '^email=' ~/.atlassian-login | cut -d= -f2-)"
export FORGE_API_TOKEN="$(tr -d '\n' < ~/.atlassian-api-token)"
FORGE_DISABLE_ANALYTICS=1 node tools/check-eligibility.mjs        # production + development
node tools/check-eligibility.mjs --check-workflow                  # câblage, hors ligne
```

## Budget : 5 minutes

Chaque job porte `timeout-minutes: 5` : la CI rend son verdict en 5 minutes maximum (règle du 24 octobre 2026). Les runners self-hosted sont persistants — `node_modules` est conservé et le cache npm est partagé : l'installation n'a lieu que si `package-lock.json` a changé. Un run trop long n'est pas « lent », il est cassé : on optimise ou on découpe, **jamais** on n'allonge un timeout.
