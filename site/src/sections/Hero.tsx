/**
 * Ouverture du site : la promesse, la preuve d'éligibilité, les chiffres
 * mesurés, puis la matrice du ticket de démonstration.
 *
 * La maquette n'est pas un dessin : elle affiche les vrais critères du jeu
 * PAY-123 (`src/sample/pay-123.ts`), les vrais libellés de force et de défaut
 * (`src/i18n/gate.ts`) et le vrai libellé du champ de couverture
 * (`coverageFieldLabel`). Ce que le visiteur voit ici est ce que l'app écrit
 * dans Jira.
 *
 * Sous la promesse : le badge « Runs on Atlassian » et la bande de chiffres
 * clés (lot `site-vitrine-confiance`) — les chiffres de l'app sont lus dans
 * l'instantané réel, ceux du dépôt portent leur source.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Criterion, Language } from '../../../src/types.js';
import { coverageFieldLabel } from '../../../src/domain/coverage.js';
import { text } from '../../../src/i18n/index.js';
import { GATE_MESSAGES } from '../../../src/i18n/gate.js';
import { DOCS_MESSAGES } from '../../../src/i18n/docs.js';
import { createDemoCriteria, DEMO_ISSUE_KEY } from '../../../src/sample/pay-123.js';
import { stringsFor } from '../i18n/index.js';
import { KeyFigures } from './parts/diagram/KeyFigures.js';
import { RunsOnAtlassian } from './parts/diagram/RunsOnAtlassian.js';
import { REPO_URL } from './parts/diagram/sources.js';
import './Hero.css';

/** Une ligne de la maquette : critère réel + état illustratif du §7.2. */
interface MockRow {
  readonly criterion: Criterion;
  readonly tone: 'ok' | 'warn' | 'bad';
  readonly stateKey: string;
  readonly vars: Record<string, string>;
}

/** Les quatre lignes du SPEC §7.2 : deux prouvées, une faible, une absente. */
function mockRows(): MockRow[] {
  const [ac1, ac2, ac3, ac4] = createDemoCriteria();
  return [
    { criterion: ac1!, tone: 'ok', stateKey: 'strength.machine-verified', vars: {} },
    { criterion: ac2!, tone: 'ok', stateKey: 'strength.machine-verified', vars: {} },
    {
      criterion: ac3!,
      tone: 'warn',
      stateKey: 'gate.defect.weakStrength',
      vars: { expected: 'strength.attested', got: 'strength.declared' },
    },
    { criterion: ac4!, tone: 'bad', stateKey: 'gate.defect.noEvidence', vars: {} },
  ];
}

function MockState({ row, lang }: { row: MockRow; lang: Language }): ReactElement {
  const label =
    row.stateKey === 'gate.defect.weakStrength'
      ? text(GATE_MESSAGES, row.stateKey, lang, {
          expected: text(GATE_MESSAGES, row.vars.expected ?? '', lang),
          got: text(GATE_MESSAGES, row.vars.got ?? '', lang),
        })
      : text(GATE_MESSAGES, row.stateKey, lang);
  return <span className={`tag ${row.tone}`}>{label}</span>;
}

/** La matrice PAY-123, telle que le panneau du ticket l'affiche. */
function MatrixMock({ lang }: { lang: Language }): ReactElement {
  const t = stringsFor(lang);
  const rows = mockRows();
  return (
    <figure className="hero-mock">
      <figcaption>
        <code>{DEMO_ISSUE_KEY}</code> · {t.demo.colProofs}{' '}
        <strong>{coverageFieldLabel(2, 4, lang)}</strong>
      </figcaption>
      <table>
        <thead>
          <tr>
            <th scope="col">{t.demo.colCriterion}</th>
            <th scope="col">{t.demo.colRequired}</th>
            <th scope="col">{t.demo.colState}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.criterion.id}>
              <th scope="row">
                <code>{row.criterion.code}</code> {text(DOCS_MESSAGES, `sample.criterion.${row.criterion.code.toLowerCase().replace('-', '')}.text`, lang)}
              </th>
              <td>{text(GATE_MESSAGES, `strength.${row.criterion.requiredStrength}`, lang)}</td>
              <td>
                <MockState row={row} lang={lang} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function Hero({ lang }: { lang: Language }): ReactElement {
  const t = stringsFor(lang).hero;
  return (
    <section id="top" className="hero">
      <div className="wrap hero-grid">
        <div>
          <p className="hero-kicker">{t.kicker}</p>
          <h1>
            {t.title}
            <em>{t.titleEmphasis}</em>
          </h1>
          <p className="lede">{t.lede}</p>
          <RunsOnAtlassian lang={lang} />
          <p className="hero-actions">
            <a className="button" href="#demo">
              {t.ctaDemo}
            </a>
            <a className="button secondary" href={REPO_URL} rel="noreferrer">
              {t.ctaRepo}
            </a>
          </p>
        </div>
        <MatrixMock lang={lang} />
      </div>
      <div className="wrap">
        <KeyFigures lang={lang} />
      </div>
    </section>
  );
}
