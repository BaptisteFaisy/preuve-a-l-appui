/**
 * Section « Screens » du site public — lot `site/sections-b`.
 *
 * Les quatre écrans Forge (cartes) + deux maquettes HTML/CSS du vrai panneau :
 * la matrice critères × preuves (avec ses quatre gestes et un bouton désactivé
 * sur un critère déjà prouvé) et le champ de couverture « 2 / 4 » en pastille
 * colorée. Les maquettes rendent le VRAI viewmodel de l'app
 * (`src/viewmodel/*`) sur le jeu de démo PAY-123 (`src/sample/pay-123.ts`) :
 * rien n'est inventé, aucun texte en dur (SPEC §16, §20).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { DemoSnapshotData } from '../../../src/demo-contract.js';
import type { Coverage, Language } from '../../../src/types.js';
import { stringsFor } from '../i18n/index.js';
import { text } from '../../../src/i18n/index.js';
import { UI_MESSAGES } from '../../../src/i18n/ui.js';
import { createInitialDemoCoverage, DEMO_ISSUE_KEY } from '../../../src/sample/pay-123.js';
import { buildCoverageFieldViewModel } from '../../../src/viewmodel/coverage.js';
import { buildMatrixViewModel } from '../../../src/viewmodel/matrix.js';
import type { MatrixRowViewModel } from '../../../src/viewmodel/matrix.js';
import { bundledSnapshot } from '../demo/live-snapshot.js';
import { DossierBlock } from './parts/DossierBlock.js';
import { ProjectPageMock, type ProjectPageLive } from './parts/ProjectPageMock.js';
import { SettingsMock } from './parts/SettingsMock.js';
import './Screens.css';

/** Une des quatre cartes d'écran : nom, module Forge dans un <code>, texte. */
function ScreenCard(props: { name: string; module: string; body: string }): ReactElement {
  return (
    <article className="card screens-card">
      <h3 className="screens-card-name">{props.name}</h3>
      <code className="screens-card-module">{props.module}</code>
      <p className="screens-card-body">{props.body}</p>
    </article>
  );
}

/** Cellule « preuves » d'une ligne : force colorée + référence + fraîcheur. */
function EvidenceCell(props: { row: MatrixRowViewModel; lang: Language }): ReactElement {
  const { row, lang } = props;
  if (row.evidences.length === 0) {
    return <td className="screens-td screens-td-none">{text(UI_MESSAGES, 'ui.common.none', lang)}</td>;
  }
  return (
    <td className="screens-td">
      <ul className="screens-evlist">
        {row.evidences.map((e) => (
          <li key={e.id} className="screens-evitem">
            <span className={`screens-pill screens-pill--${e.strengthColor}`}>{e.strengthLabel}</span>
            <span className="screens-evref">{e.reference}</span>
            {e.freshness === 'fresh' ? null : (
              <span className="screens-lozenge screens-lozenge--inprogress">{e.freshnessLabel}</span>
            )}
          </li>
        ))}
      </ul>
    </td>
  );
}

/** Les quatre gestes + historique ; attester/déroger désactivés si déjà prouvé. */
function GestureCell(props: { row: MatrixRowViewModel; lang: Language }): ReactElement {
  const { row, lang } = props;
  const label = (key: string) => text(UI_MESSAGES, key, lang);
  return (
    <td className="screens-td">
      <div className="screens-gestures">
        <button type="button" className="screens-btn">{label('ui.matrix.action.attach')}</button>
        <button type="button" className="screens-btn screens-btn--primary" disabled={!row.canAttest}>
          {label('ui.matrix.action.attest')}
        </button>
        <button type="button" className="screens-btn">{label('ui.matrix.action.requestAttestation')}</button>
        <button type="button" className="screens-btn" disabled={!row.canWaive}>
          {label('ui.matrix.action.waive')}
        </button>
      </div>
    </td>
  );
}

/** Une ligne de la matrice : code (en-tête de ligne), texte, requis, preuves, état, gestes. */
function MatrixRow(props: { row: MatrixRowViewModel; lang: Language }): ReactElement {
  const { row, lang } = props;
  return (
    <tr className="screens-tr">
      <th scope="row" className="screens-th-row">{row.code}</th>
      <td className="screens-td">
        <span className="screens-crittext">{row.text}</span>
        {row.hasDefect ? (
          <span className="screens-defect">{`${row.defectLabel} — ${row.expectedProof}`}</span>
        ) : null}
      </td>
      <td className="screens-td">
        <span className="screens-type">{row.typeLabel}</span>
        <span className="screens-lozenge screens-lozenge--default">{row.requiredStrengthLabel}</span>
      </td>
      <EvidenceCell row={row} lang={lang} />
      <td className="screens-td">
        <span className={`screens-lozenge screens-lozenge--${row.statusAppearance}`}>{row.statusLabel}</span>
      </td>
      <GestureCell row={row} lang={lang} />
    </tr>
  );
}

/** Maquette 1 — le panneau du ticket : la matrice et ses quatre gestes. */
function TicketPanelMock(props: { coverage: Coverage; lang: Language }): ReactElement {
  const { coverage, lang } = props;
  const vm = buildMatrixViewModel(coverage, lang, DEMO_ISSUE_KEY);
  const head = (key: string) => text(UI_MESSAGES, key, lang);
  return (
    <figure className="screens-mock">
      <figcaption className="screens-mock-cap">
        <span className="screens-mock-title">{head('ui.matrix.title')}</span>
        <span className={`screens-lozenge ${vm.passes ? 'screens-lozenge--success' : 'screens-lozenge--inprogress'}`}>
          {vm.summaryText}
        </span>
      </figcaption>
      <div className="screens-tablescroll">
        <table className="screens-table">
          <caption className="visually-hidden">{head('ui.matrix.title')}</caption>
          <thead>
            <tr>
              <th scope="col">{head('ui.matrix.col.code')}</th>
              <th scope="col">{head('ui.matrix.col.criterion')}</th>
              <th scope="col">{head('ui.matrix.col.required')}</th>
              <th scope="col">{head('ui.matrix.col.evidences')}</th>
              <th scope="col">{head('ui.matrix.col.status')}</th>
              <th scope="col">{head('ui.matrix.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {vm.rows.map((row) => (
              <MatrixRow key={row.criterionId} row={row} lang={lang} />
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Maquette 2 — le champ de couverture « 2 / 4 » en pastille, comme au tableau. */
function CoverageFieldMock(props: { coverage: Coverage; lang: Language }): ReactElement {
  const { coverage, lang } = props;
  const t = stringsFor(lang);
  const field = buildCoverageFieldViewModel(coverage, lang);
  return (
    <figure className="screens-mock">
      <figcaption className="screens-mock-cap">
        <span className="screens-mock-title">{t.screens.items[1].name}</span>
      </figcaption>
      <table className="screens-board">
        <caption className="visually-hidden">{field.tooltip}</caption>
        <thead>
          <tr>
            <th scope="col">{text(UI_MESSAGES, 'ui.matrix.col.code', lang)}</th>
            <th scope="col">{t.demo.coverage}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="screens-th-row">{DEMO_ISSUE_KEY}</th>
            <td className="screens-td">
              <span
                className={`screens-coverage screens-coverage--${field.tone}`}
                title={field.tooltip}
                role="img"
                aria-label={field.tooltip}
              >
                {field.label}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </figure>
  );
}

/**
 * La page projet sur les données RÉELLES quand l'instantané est présent : ses
 * dérogations (récap par personne) et ses preuves vivantes viennent de l'app
 * installée, résolues par les acteurs qu'elle a nommés. À défaut d'instantané
 * exploitable, la maquette garde le jeu embarqué PAY-123.
 */
function liveProject(snapshot: DemoSnapshotData | null): ProjectPageLive | undefined {
  if (snapshot === null || snapshot.coverage === null || snapshot.stats === null) {
    return undefined;
  }
  const names = new Map(snapshot.actors.map((actor) => [actor.ref, actor.displayName]));
  return {
    data: {
      coverages: [snapshot.coverage],
      waivers: snapshot.waivers,
      living: snapshot.living,
      stats: snapshot.stats,
    },
    nameOf: (accountId) => names.get(accountId) ?? accountId,
  };
}

export function Screens({ lang }: { lang: Language }): ReactElement {
  const t = stringsFor(lang);
  const coverage = createInitialDemoCoverage();
  const snapshot = bundledSnapshot();
  return (
    <section id="screens" aria-labelledby="screens-title">
      <div className="wrap">
        <h2 id="screens-title">{t.screens.title}</h2>
        <p className="lede">{t.screens.lede}</p>
        <div className="grid screens-cards">
          {t.screens.items.map((item) => (
            <ScreenCard key={item.module} name={item.name} module={item.module} body={item.body} />
          ))}
        </div>
        <TicketPanelMock coverage={coverage} lang={lang} />
        <CoverageFieldMock coverage={coverage} lang={lang} />
        <SettingsMock lang={lang} />
        <ProjectPageMock lang={lang} live={liveProject(snapshot)} />
        <DossierBlock lang={lang} snapshot={snapshot} />
      </div>
    </section>
  );
}
