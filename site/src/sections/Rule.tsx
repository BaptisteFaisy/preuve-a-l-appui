/**
 * La règle du produit : les trois forces, les six types de preuve et ce que
 * l'app vérifie pour chacun, puis les cinq principes (SPEC §5, §9.1).
 *
 * Les textes viennent du dictionnaire du site ; le tableau reprend la table du
 * SPEC §9.1 ligne à ligne, sans reformulation.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../src/types.js';
import { stringsFor } from '../i18n/index.js';
import './Rule.css';

/** Pastille de force : vert pour la machine, orange pour l'attestation. */
function strengthTone(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith('machine') || lower.startsWith('vérifiée')) return 'ok';
  if (lower.startsWith('attest') || lower.startsWith('attestée')) return 'warn';
  return '';
}

function Strengths({ lang }: { lang: Language }): ReactElement {
  const t = stringsFor(lang).rule;
  return (
    <div className="grid rule-strengths">
      {t.strengths.map((strength, index) => (
        <article className="card rule-strength" key={strength.name}>
          <span className={`tag ${strengthTone(strength.name)}`}>{3 - index}</span>
          <h3>{strength.name}</h3>
          <p className="rule-meaning">{strength.meaning}</p>
          <p className="rule-example">{strength.example}</p>
        </article>
      ))}
    </div>
  );
}

function ProofTypes({ lang }: { lang: Language }): ReactElement {
  const t = stringsFor(lang).ruleTypes;
  return (
    <div className="rule-table-wrap">
      <table className="rule-table">
        <caption>{t.title}</caption>
        <thead>
          <tr>
            {t.head.map((cell) => (
              <th scope="col" key={cell}>
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">{row.name}</th>
              <td>{row.provides}</td>
              <td>
                <span className={`tag ${strengthTone(row.strength)}`}>{row.strength}</span>
              </td>
              <td>{row.check}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="rule-note">{t.note}</p>
    </div>
  );
}

export function Rule({ lang }: { lang: Language }): ReactElement {
  const t = stringsFor(lang).rule;
  return (
    <section id="rule" className="rule">
      <div className="wrap">
        <h2 id="rule-title">{t.title}</h2>
        <p className="lede">{t.lede}</p>

        <h3>{t.strengthsTitle}</h3>
        <Strengths lang={lang} />

        <h3>{t.typesTitle}</h3>
        <ProofTypes lang={lang} />

        <h3>{t.principlesTitle}</h3>
        <ol className="rule-principles">
          {t.principles.map((principle) => (
            <li key={principle}>{principle}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
