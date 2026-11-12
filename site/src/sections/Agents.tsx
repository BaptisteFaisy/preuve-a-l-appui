/**
 * Section « Agents » du site public — lot `site/sections-b`.
 *
 * Titre + accroche, l'encadré d'interdits (la règle la plus importante pour un
 * jury), le tableau des sept outils MCP (clé en <code>, verbe en pastille,
 * retour) et les quatre questions que l'agent sait traiter, présentées comme
 * des amorces de conversation. Tout le texte vient de `t.agents.*`
 * (site/src/i18n) : rien d'en dur, aucun JS ajouté (SPEC §14, §20).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../src/types.js';
import { stringsFor } from '../i18n/index.js';
import './Agents.css';

/** Icône d'interdiction, purement décorative (le texte porte le sens). */
function ForbiddenIcon(): ReactElement {
  return (
    <svg className="agents-forbidden-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** L'encadré d'interdits : aucun outil ne peut attester, déroger ni valider. */
function ForbiddenCallout(props: { text: string }): ReactElement {
  return (
    <aside className="agents-forbidden">
      <ForbiddenIcon />
      <p className="agents-forbidden-text">{props.text}</p>
    </aside>
  );
}

/** Une ligne du tableau des outils : clé en <code>, verbe en pastille, retour. */
function ToolRow(props: { toolKey: string; verb: string; returns: string }): ReactElement {
  const verbClass = props.verb === 'GET' ? 'agents-verb--get' : 'agents-verb--create';
  return (
    <tr>
      <th scope="row" className="agents-tool-key">
        <code>{props.toolKey}</code>
      </th>
      <td className="agents-tool-verb">
        <span className={`agents-verb ${verbClass}`}>{props.verb}</span>
      </td>
      <td className="agents-tool-returns">{props.returns}</td>
    </tr>
  );
}

export function Agents({ lang }: { lang: Language }): ReactElement {
  const t = stringsFor(lang);
  const a = t.agents;
  return (
    <section id="Agents" aria-labelledby="Agents-title">
      <div className="wrap">
        <h2 id="Agents-title">{a.title}</h2>
        <p className="lede">{a.lede}</p>
        <ForbiddenCallout text={a.forbidden} />

        <h3 className="agents-subtitle">{a.toolsTitle}</h3>
        <div className="agents-tablescroll">
          <table className="agents-table">
            <caption className="visually-hidden">{a.toolsTitle}</caption>
            <thead>
              <tr>
                <th scope="col">{a.toolsHead[0]}</th>
                <th scope="col">{a.toolsHead[1]}</th>
                <th scope="col">{a.toolsHead[2]}</th>
              </tr>
            </thead>
            <tbody>
              {a.tools.map((tool) => (
                <ToolRow key={tool.key} toolKey={tool.key} verb={tool.verb} returns={tool.returns} />
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="agents-subtitle">{a.questionsTitle}</h3>
        <ul className="agents-questions">
          {a.questions.map((question) => (
            <li key={question} className="agents-question">
              <span className="agents-question-bubble">{question}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
