/**
 * Section « Recipe » du site public — souche posée par le socle du site.
 *
 * Propriétaire : lot `site/contenu`. Le contrat est gelé : le composant
 * exporté porte ce nom et accepte `{ lang }` (SPEC §20 : anglais et
 * français). Les textes viennent de `site/src/i18n/`, jamais en dur.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../src/types.js';
import { stringsFor } from '../i18n/index.js';

export function Recipe({ lang }: { lang: Language }): ReactElement {
  const t = stringsFor(lang);
  return (
    <section id="Recipe" aria-labelledby="Recipe-title">
      <div className="wrap">
        <h2 id="Recipe-title">{t.hero.titleEmphasis}</h2>
        <p className="lede">Section « Recipe » à écrire (lot site/contenu).</p>
      </div>
    </section>
  );
}
