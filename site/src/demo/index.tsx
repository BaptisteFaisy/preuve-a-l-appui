/**
 * Démo interactive « PAY-123 » — souche posée par le socle du site.
 *
 * Propriétaire : lot `site/demo`. Le contrat est gelé : `Demo` accepte
 * `{ lang }` et monte une démo qui exécute le VRAI moteur de l'app
 * (`src/domain/*`, `src/handlers/*`) en mémoire, sur le jeu de démonstration
 * `src/sample/pay-123.ts`. Aucun appel réseau, aucun `node:*`.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../src/types.js';
import { stringsFor } from '../i18n/index.js';

export function Demo({ lang }: { lang: Language }): ReactElement {
  const t = stringsFor(lang);
  return (
    <>
      <h2 id="demo-title">{t.demo.title}</h2>
      <p className="lede">{t.demo.lede}</p>
      <p className="tag warn">Démo en cours de construction (lot site/demo).</p>
    </>
  );
}
