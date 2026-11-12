/**
 * Section « Recipe » du site public : les onze points de la recette
 * d'acceptation (SPEC §22), chacun avec le test qui le prouve.
 *
 * Les textes viennent de `site/src/i18n/` — aucune chaîne en dur. Les liens
 * pointent vers les fichiers de test réellement présents dans le dépôt.
 *
 * Lot `site/sections-c`. Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../src/types.js';
import { stringsFor } from '../i18n/index.js';
import { REPO_FILE_URL } from './parts/liens-c.js';
import './Recipe.css';

interface RecipeItem {
  readonly point: string;
  readonly test: string;
}

/** Un point de la recette : son numéro, son énoncé, le test qui le prouve. */
function RecipePoint({
  index,
  item,
  testLabel,
}: {
  index: number;
  item: RecipeItem;
  testLabel: string;
}): ReactElement {
  const href = `${REPO_FILE_URL}${item.test}.test.ts`;
  return (
    <li className="recipe-item">
      <span className="recipe-num" aria-hidden="true">
        {index + 1}
      </span>
      <p className="recipe-point">{item.point}</p>
      <a className="recipe-test" href={href} target="_blank" rel="noreferrer" aria-label={`${testLabel}: ${item.test}`}>
        <code>{item.test}</code>
      </a>
    </li>
  );
}

export function Recipe({ lang }: { lang: Language }): ReactElement {
  const t = stringsFor(lang);
  return (
    <section id="recipe" aria-labelledby="recipe-title">
      <div className="wrap">
        <h2 id="recipe-title">{t.recipe.title}</h2>
        <p className="lede">{t.recipe.lede}</p>
        <div className="recipe-head">
          <span className="recipe-head-point">{t.recipe.head[0]}</span>
          <span className="recipe-head-test">{t.recipe.head[1]}</span>
        </div>
        <ol className="recipe-list" role="list">
          {t.recipe.items.map((item, index) => (
            <RecipePoint
              key={`${item.test}-${index}`}
              index={index}
              item={item}
              testLabel={t.recipe.head[1]}
            />
          ))}
        </ol>
        <pre className="recipe-howto">
          <code>{t.recipe.howTo}</code>
        </pre>
      </div>
    </section>
  );
}
