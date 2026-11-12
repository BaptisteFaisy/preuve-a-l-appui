/**
 * Le problème : trois dérives, puis l'urgence ajoutée par les agents de code.
 *
 * Contenu issu du SPEC §2 (les trois dérives) et §2 (paragraphe sur les
 * agents). Les icônes sont des glyphes texte, aucune ressource externe.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../src/types.js';
import { stringsFor } from '../i18n/index.js';
import './Problem.css';

/** Une dérive : titre, corps, et un glyphe pour l'œil. */
const GLYPHS = ['①', '②', '③'] as const;

function DriftCard({
  drift,
  glyph,
}: {
  drift: { title: string; body: string };
  glyph: string;
}): ReactElement {
  return (
    <article className="problem-card card">
      <span className="problem-glyph" aria-hidden="true">
        {glyph}
      </span>
      <h3>{drift.title}</h3>
      <p>{drift.body}</p>
    </article>
  );
}

export function Problem({ lang }: { lang: Language }): ReactElement {
  const t = stringsFor(lang).problem;
  return (
    <section id="problem" className="problem">
      <div className="wrap">
        <h2 id="problem-title">{t.title}</h2>
        <p className="lede">{t.lede}</p>

        <div className="grid problem-grid">
          {t.drifts.map((drift, index) => (
            <DriftCard key={drift.title} drift={drift} glyph={GLYPHS[index] ?? '•'} />
          ))}
        </div>

        <blockquote className="problem-agents">
          <p>{t.agents}</p>
        </blockquote>
      </div>
    </section>
  );
}
