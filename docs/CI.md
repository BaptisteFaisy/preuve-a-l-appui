# CI — « Fait, preuve à l'appui »

## Les checks

| check | workflow | ce qu'il interdit |
|---|---|---|
| `ci` | `.github/workflows/ci.yml` | types faux, tests rouges, fichier > 500 lignes, fonction > 50 lignes, manifeste incohérent, doc vide ou illisible, garde de CI en échec |
| `ci-budget` | `.github/workflows/ci-budget.yml` | un job sans `timeout-minutes`, ou au-delà de 5 min sur une PR |
| `couche0` | `.github/workflows/couche0.yml` | fichier modifié hors du `## Scope` de la PR, motif interdit (poussée forcée, déclencheur à privilèges, clé en clair), workflow de garde modifié sans la mention `SAMVISION_ALLOW_GUARD_BUMP` |

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

## Budget : 5 minutes

Chaque job porte `timeout-minutes: 5` : la CI rend son verdict en 5 minutes maximum (règle du 24 octobre 2026). Les runners self-hosted sont persistants — `node_modules` est conservé et le cache npm est partagé : l'installation n'a lieu que si `package-lock.json` a changé. Un run trop long n'est pas « lent », il est cassé : on optimise ou on découpe, **jamais** on n'allonge un timeout.
