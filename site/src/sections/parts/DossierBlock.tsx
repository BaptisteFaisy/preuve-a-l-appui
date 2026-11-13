/**
 * Bloc « dossier de preuve » — TOUT le projet de démonstration (lot
 * `site-dossier`).
 *
 * Jusque-là le site ne montrait que le ticket vedette (PRF-1) : le reste du
 * projet de démonstration n'apparaissait nulle part. Ce bloc rend le dossier
 * de preuve figé par l'app installée (`snapshot.dossier`) ticket par ticket —
 * clé, résumé, couverture « n / m », dérogations et état — pour qu'un jury
 * voie l'environnement complet, pas une vitrine.
 *
 * Rien n'est inventé : chaque ligne vient du dossier réel, chaque libellé
 * vient de l'app (`src/i18n/ui.ts`, `src/i18n/reports.ts`) ou des textes du
 * site (`site/src/i18n/dossier.ts`). Si l'instantané ne porte pas de
 * dossier, le bloc ne s'affiche pas et le site ne casse pas.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { DemoSnapshotData } from '../../../../src/demo-contract.js';
import type { Language } from '../../../../src/types.js';
import { text } from '../../../../src/i18n/index.js';
import { reportMessage } from '../../../../src/i18n/reports.js';
import { UI_MESSAGES } from '../../../../src/i18n/ui.js';
import { DOSSIER_STRINGS } from '../../i18n/dossier.js';
import {
  buildDossierView,
  dossierAppearanceOf,
  dossierStateLabel,
} from './dossier-viewmodel.js';
import type { DossierIssueView, DossierView, DossierWaiverView } from './dossier-viewmodel.js';
import '../Screens.css';
import '../screens-mocks.css';

/** Les dérogations actives d'un ticket : leur nombre et leur motif. */
function WaiverCell(props: {
  waivers: readonly DossierWaiverView[];
  count: number;
}): ReactElement {
  const { waivers, count } = props;
  return (
    <>
      <span className="screens-value">{count}</span>
      {count === 0 ? null : (
        <ul className="screens-evlist">
          {waivers.map((waiver, index) => (
            <li key={`${index}-${waiver.reason}`} className="screens-evitem">
              <span className="screens-evref">{waiver.reason}</span>
              {waiver.granter === null ? null : <span className="screens-type">{waiver.granter}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Une ligne du tableau : le ticket, sa couverture, ses dérogations, son état. */
function DossierRow(props: { issue: DossierIssueView; lang: Language }): ReactElement {
  const { issue, lang } = props;
  return (
    <tr className="screens-tr">
      <th scope="row" className="screens-th-row">{issue.issueKey}</th>
      <td className="screens-td">{issue.summary}</td>
      <td className="screens-td">
        <span
          className={`screens-coverage screens-coverage--${issue.coverageTone}`}
          title={issue.coverageTooltip}
        >
          {issue.coverageLabel}
        </span>
      </td>
      <td className="screens-td">
        <WaiverCell waivers={issue.waivers} count={issue.waiverCount} />
      </td>
      <td className="screens-td">
        <span className={`screens-lozenge screens-lozenge--${dossierAppearanceOf(issue.state)}`}>
          {dossierStateLabel(issue.state, lang)}
        </span>
      </td>
    </tr>
  );
}

/** Le tableau des tickets du dossier : une ligne par ticket, colonnes titrées. */
function DossierTable(props: { view: DossierView; lang: Language }): ReactElement {
  const { view, lang } = props;
  const extra = DOSSIER_STRINGS[lang];
  const head = (key: string) => text(UI_MESSAGES, key, lang);
  return (
    <div className="screens-tablescroll">
      <table className="screens-table">
        <caption className="screens-subcap">{reportMessage('reports.dossier.detail', lang)}</caption>
        <thead>
          <tr>
            <th scope="col">{head('ui.project.col.issue')}</th>
            <th scope="col">{extra.colSummary}</th>
            <th scope="col">{head('ui.project.col.coverage')}</th>
            <th scope="col">{extra.colWaivers}</th>
            <th scope="col">{head('ui.matrix.col.status')}</th>
          </tr>
        </thead>
        <tbody>
          {view.issues.map((issue) => (
            <DossierRow key={issue.issueKey} issue={issue} lang={lang} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Les totaux de la version et la date de figeage du dossier. */
function DossierSummary(props: { view: DossierView; lang: Language }): ReactElement {
  const { view, lang } = props;
  const totals = view.totals;
  const parts = [
    reportMessage('reports.dossier.issues', lang, { count: totals.issues }),
    reportMessage('reports.dossier.criteria', lang, { count: totals.criteria }),
    reportMessage('reports.dossier.proven', lang, { count: totals.proven }),
    reportMessage('reports.dossier.waived', lang, { count: totals.waived }),
  ];
  return (
    <>
      <p className="screens-para">
        <span className="screens-para-label">{`${reportMessage('reports.dossier.summary', lang)} — `}</span>
        <span className="screens-value">{parts.join(' · ')}</span>
      </p>
      <p className="screens-para">
        <span className="screens-value">
          {reportMessage('reports.dossier.generatedAt', lang, { date: view.generatedAt.slice(0, 10) })}
        </span>
      </p>
    </>
  );
}

/**
 * Le bloc dossier. Renvoie `null` quand l'instantané ne porte pas de
 * dossier : la page reste entière, le bloc simplement absent.
 */
export function DossierBlock(props: {
  lang: Language;
  snapshot: DemoSnapshotData | null;
}): ReactElement | null {
  const { lang, snapshot } = props;
  const view = buildDossierView(snapshot, lang);
  if (view === null) return null;
  const extra = DOSSIER_STRINGS[lang];
  const title = reportMessage('reports.dossier.title', lang, {
    versionName: view.versionName,
    projectKey: view.projectKey,
  });
  return (
    <>
      <h3 className="screens-subtitle" id="dossier-title">
        {extra.blockTitle}
      </h3>
      <figure className="screens-mock" id="dossier">
        <figcaption className="screens-mock-cap">
          <span className="screens-mock-title">{title}</span>
          <span className="screens-lozenge screens-lozenge--moved">
            {reportMessage('reports.dossier.criteria', lang, { count: view.totals.criteria })}
          </span>
        </figcaption>
        <div className="screens-body">
          <DossierTable view={view} lang={lang} />
          <DossierSummary view={view} lang={lang} />
          <p className="screens-note">{extra.shows}</p>
        </div>
      </figure>
    </>
  );
}
