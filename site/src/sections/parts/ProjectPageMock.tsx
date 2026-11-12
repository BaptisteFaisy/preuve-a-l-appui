/**
 * Maquette 4 — la page projet (écran Forge `jira:projectPage`).
 *
 * Rend le VRAI view-model de l'app (`buildProjectPageViewModel`,
 * `src/viewmodel/project.ts`) sur des données d'entrée dérivées du sample réel
 * PAY-123 (`src/sample/pay-123.ts`) et assemblées par les VRAIS domaines
 * (`buildProofStats`, `src/domain/stats.ts`). Le sample ne fournit ni preuve
 * vivante ni historique de réouvertures : ces deux jeux sont construits ici de
 * façon déterministe et documentée (voir `createProjectDemoData`).
 *
 * Aucun texte en dur : les libellés viennent de `text(UI_MESSAGES, …)` et,
 * pour le peu que l'app ne produit pas, de `SCREENS_EXTRA`.
 *
 * Lot `site-toutes-features`. Règle : fichiers < 500 lignes, fonctions < 50.
 */
import type { ReactElement } from 'react';
import type {
  Coverage,
  GranterCount,
  Language,
  LivingProof,
  ProofStats,
  ReopeningRate,
  Waiver,
} from '../../../../src/types.js';
import { text } from '../../../../src/i18n/index.js';
import { UI_MESSAGES } from '../../../../src/i18n/ui.js';
import { buildProofStats, reopeningShare } from '../../../../src/domain/stats.js';
import type { ReopenEvent } from '../../../../src/domain/stats.js';
import {
  createDemoWaiver,
  createInitialDemoCoverage,
  DEMO_ACTORS,
  DEMO_COMPONENT,
  DEMO_ISSUE_KEY,
  DEMO_NOW,
  DEMO_PROJECT_ID,
  DEMO_TEST_LOG,
  DEMO_TEST_REFUSAL,
} from '../../../../src/sample/pay-123.js';
import { buildProjectPageViewModel } from '../../../../src/viewmodel/project.js';
import type {
  GranterStatItem,
  LivingProofItemViewModel,
  ProjectIssueItemViewModel,
  ProjectWaiverItemViewModel,
  StrengthStatItem,
} from '../../../../src/viewmodel/project.js';
import { stringsFor } from '../../i18n/index.js';
import { SCREENS_EXTRA } from '../../i18n/screens-extra.js';
import '../screens-mocks.css';

/* ---------------------------------------------------- données de la maquette */

/**
 * Commit du premier run sur la branche principale après livraison de la
 * version 2.4 (`DEMO_FIX_VERSION`). Le sample ne suit que la branche
 * `feature/PAY-123-…` ; la preuve vivante (SPEC §13) vit sur `main`, donc ce
 * commit est construit, déterministe, sans équivalent dans le sample.
 */
export const DEMO_MAIN_COMMIT = 'c8f21a7b64d94e05ab31';

/** Date du run principal qui a changé l'état des preuves vivantes (lendemain
 * de `DEMO_NOW`, cohérente avec `since`/`commit` de `src/domain/living.ts`). */
export const DEMO_LIVING_SINCE = '2026-11-12T06:00:00.000Z';

/** Fenêtre des statistiques : depuis le 1er janvier, `aggregateWaiversByGranter`
 * filtre les dérogations antérieures (SPEC §14). */
export const DEMO_STATS_SINCE = '2026-01-01T00:00:00.000Z';

/** Un ticket clos hors validateur sur la fenêtre : construit, déterministe —
 * le sample ne fournit pas d'équivalent (SPEC §14 FP-18). */
export const DEMO_CLOSED_WITHOUT_VALIDATOR = 1;

/**
 * Historique de réouvertures par force de preuve. Il se déduit de Jira, pas de
 * la base de l'app (`collectStats`, SPEC §14) : le sample n'en fournit pas, on
 * le construit de façon déterministe pour illustrer la mesure du SPEC §26 —
 * plus la preuve est faible, plus le ticket rouvre (0/6, 1/5, 2/3).
 */
export const DEMO_REOPENS: readonly ReopenEvent[] = [
  ...Array.from({ length: 6 }, () => ({ strength: 'machine-verified' as const, reopened: false })),
  ...Array.from({ length: 4 }, (_, i) => ({ strength: 'attested' as const, reopened: i === 0 })),
  ...Array.from({ length: 3 }, (_, i) => ({ strength: 'declared' as const, reopened: i < 2 })),
];

/** Nom d'affichage résolu depuis les acteurs du sample (comme Jira le fait). */
export function displayNameOf(accountId: string): string {
  const actor = Object.values(DEMO_ACTORS).find((a) => a.accountId === accountId);
  return actor ? actor.displayName : accountId;
}

function namedGranter(granter: GranterCount): GranterCount {
  return { ...granter, displayName: displayNameOf(granter.accountId) };
}

/**
 * Preuves vivantes des deux tests du sample, suivies sur `main` après
 * livraison : celui d'AC-1 a été désactivé (absent du run → `unproven`,
 * invariant de `livingStateOfTest`) ; celui d'AC-2 passe toujours (`proven`).
 */
function createDemoLivingProofs(): readonly LivingProof[] {
  const base = { issueKey: DEMO_ISSUE_KEY, component: DEMO_COMPONENT, commit: DEMO_MAIN_COMMIT, since: DEMO_LIVING_SINCE };
  return [
    { ...base, id: 'lp-1', criterionId: 'crit-1', testName: DEMO_TEST_REFUSAL, state: 'unproven' },
    { ...base, id: 'lp-2', criterionId: 'crit-2', testName: DEMO_TEST_LOG, state: 'proven' },
  ];
}

/** Dérogations : celle du sample (active) + une première révoquée le même
 * jour, pour montrer que `activeWaiversCount` ne compte que les actives. */
function createDemoWaivers(): readonly Waiver[] {
  const granted = createDemoWaiver();
  return [{ ...granted, id: 'wv-ac4-rev1', revokedAt: DEMO_NOW }, granted];
}

export interface ProjectDemoData {
  readonly coverages: readonly Coverage[];
  readonly waivers: readonly Waiver[];
  readonly living: readonly LivingProof[];
  readonly stats: ProofStats;
}

/** Assemble les entrées de la page projet, stats comprises, via les domaines. */
export function createProjectDemoData(): ProjectDemoData {
  const coverages = [createInitialDemoCoverage()];
  const waivers = createDemoWaivers();
  const stats = buildProofStats({
    projectId: DEMO_PROJECT_ID,
    since: DEMO_STATS_SINCE,
    coverages,
    waivers,
    closedWithoutValidator: DEMO_CLOSED_WITHOUT_VALIDATOR,
    reopens: DEMO_REOPENS,
  });
  return {
    coverages,
    waivers,
    living: createDemoLivingProofs(),
    stats: { ...stats, waiversByGranter: stats.waiversByGranter.map(namedGranter) },
  };
}

/* ---------------------------------------------------------------- composants */

/** Badge de compteur collé à un titre d'onglet. */
function CountBadge(props: { count: number; label: string }): ReactElement {
  return <span className="screens-count" aria-label={props.label}>{props.count}</span>;
}

/** Les tickets en cours et leur couverture « n / m » colorée. */
function IssuesTable(props: { issues: readonly ProjectIssueItemViewModel[]; lang: Language }): ReactElement {
  const { issues, lang } = props;
  const head = (key: string) => text(UI_MESSAGES, key, lang);
  return (
    <table className="screens-table">
      <caption className="screens-subcap">{head('ui.project.tabs.issues')}</caption>
      <thead>
        <tr>
          <th scope="col">{head('ui.project.col.issue')}</th>
          <th scope="col">{head('ui.project.col.coverage')}</th>
          <th scope="col">{head('ui.project.col.gate')}</th>
        </tr>
      </thead>
      <tbody>
        {issues.map((item) => (
          <tr key={item.issueId} className="screens-tr">
            <th scope="row" className="screens-th-row">{item.issueKey}</th>
            <td className="screens-td">
              <span className={`screens-coverage screens-coverage--${item.coverage.tone}`} title={item.coverage.tooltip}>
                {item.coverage.label}
              </span>
            </td>
            <td className="screens-td">
              <span className={`screens-lozenge screens-lozenge--${item.passes ? 'success' : 'removed'}`}>
                {head(item.passes ? 'ui.coverage.passes' : 'ui.coverage.blocks')}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Les dérogations du projet, la révoquée marquée, les actives comptées. */
function WaiversTable(props: { waivers: readonly ProjectWaiverItemViewModel[]; lang: Language }): ReactElement {
  const { waivers, lang } = props;
  const extra = SCREENS_EXTRA[lang];
  const head = (key: string) => text(UI_MESSAGES, key, lang);
  return (
    <table className="screens-table">
      <caption className="screens-subcap">{head('ui.project.tabs.waivers')}</caption>
      <thead>
        <tr>
          <th scope="col">{head('ui.project.col.criterion')}</th>
          <th scope="col">{head('ui.project.col.grantedBy')}</th>
          <th scope="col">{head('ui.project.col.reason')}</th>
          <th scope="col">{head('ui.project.col.date')}</th>
          <th scope="col">{head('ui.project.col.gate')}</th>
        </tr>
      </thead>
      <tbody>
        {waivers.map((waiver) => (
          <tr key={waiver.id} className="screens-tr">
            <th scope="row" className="screens-th-row">{waiver.criterionId}</th>
            <td className="screens-td">
              <span className="screens-crittext">{displayNameOf(waiver.grantedBy)}</span>
              <span className="screens-type">{waiver.role}</span>
            </td>
            <td className="screens-td">{waiver.reason}</td>
            <td className="screens-td">{waiver.atFormatted}</td>
            <td className="screens-td">
              {waiver.isRevoked ? (
                <span className="screens-lozenge screens-lozenge--removed">{extra.revoked}</span>
              ) : (
                <span className="screens-lozenge screens-lozenge--success">{head('ui.matrix.status.waived')}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Traduit l'état brut de preuve vivante exposé par le view-model (string). */
function livingStateLabel(state: string, lang: Language): string {
  const extra = SCREENS_EXTRA[lang];
  if (state === 'proven') return extra.stateProven;
  if (state === 'regressed') return extra.stateRegressed;
  return extra.stateUnproven;
}

/** Les critères livrés qui ne sont plus prouvés (FP-19, SPEC §13). */
function LivingTable(props: { living: readonly LivingProofItemViewModel[]; lang: Language }): ReactElement {
  const { living, lang } = props;
  const head = (key: string) => text(UI_MESSAGES, key, lang);
  const extra = SCREENS_EXTRA[lang];
  return (
    <>
      <p className="screens-para">{head('ui.project.living.warning')}</p>
      <table className="screens-table">
        <caption className="screens-subcap">{head('ui.project.tabs.living')}</caption>
        <thead>
          <tr>
            <th scope="col">{head('ui.project.col.issue')}</th>
            <th scope="col">{head('ui.project.col.testName')}</th>
            <th scope="col">{extra.colState}</th>
            <th scope="col">{head('ui.project.col.component')}</th>
            <th scope="col">{head('ui.project.col.since')}</th>
          </tr>
        </thead>
        <tbody>
          {living.map((item) => (
            <tr key={item.id} className="screens-tr">
              <th scope="row" className="screens-th-row">{`${item.issueKey} · ${item.criterionId}`}</th>
              <td className="screens-td"><span className="screens-evref">{item.testName}</span></td>
              <td className="screens-td">
                <span className="screens-lozenge screens-lozenge--inprogress">{livingStateLabel(item.state, lang)}</span>
              </td>
              <td className="screens-td">{item.component}</td>
              <td className="screens-td">{item.sinceFormatted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Couverture par force : quelle part des critères prouvés l'est par machine,
 * attestation ou simple déclaration (SPEC §14). */
function StrengthStats(props: { items: readonly StrengthStatItem[]; lang: Language }): ReactElement {
  const { items, lang } = props;
  const extra = SCREENS_EXTRA[lang];
  return (
    <table className="screens-table screens-stats">
      <caption className="screens-subcap">{text(UI_MESSAGES, 'ui.project.stats.byStrength', lang)}</caption>
      <thead>
        <tr>
          <th scope="col">{text(UI_MESSAGES, 'ui.matrix.col.required', lang)}</th>
          <th scope="col">{extra.colCount}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.strength} className="screens-tr">
            <th scope="row" className="screens-th-row">{item.strengthLabel}</th>
            <td className="screens-td">{item.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Dérogations par accordeur : une règle dérogée en permanence est à revoir. */
function GranterStats(props: { items: readonly GranterStatItem[]; lang: Language }): ReactElement {
  const { items, lang } = props;
  const extra = SCREENS_EXTRA[lang];
  return (
    <table className="screens-table screens-stats">
      <caption className="screens-subcap">{text(UI_MESSAGES, 'ui.project.stats.waiversByGranter', lang)}</caption>
      <thead>
        <tr>
          <th scope="col">{text(UI_MESSAGES, 'ui.project.col.grantedBy', lang)}</th>
          <th scope="col">{extra.colCount}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.accountId} className="screens-tr">
            <th scope="row" className="screens-th-row">{item.displayName}</th>
            <td className="screens-td">{item.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Taux de réouverture selon la force des preuves (SPEC §14, §26) : calculé
 * par le domaine réel (`reopeningShare`) sur `ProofStats.reopenings`. */
function ReopeningStats(props: { rates: readonly ReopeningRate[]; lang: Language }): ReactElement {
  const { rates, lang } = props;
  const extra = SCREENS_EXTRA[lang];
  return (
    <table className="screens-table screens-stats">
      <caption className="screens-subcap">{text(UI_MESSAGES, 'ui.project.stats.reopeningRate', lang)}</caption>
      <thead>
        <tr>
          <th scope="col">{text(UI_MESSAGES, 'ui.matrix.col.required', lang)}</th>
          <th scope="col">{extra.colClosed}</th>
          <th scope="col">{extra.colReopened}</th>
          <th scope="col">{extra.colShare}</th>
        </tr>
      </thead>
      <tbody>
        {rates.map((rate) => (
          <tr key={rate.strength} className="screens-tr">
            <th scope="row" className="screens-th-row">{text(UI_MESSAGES, `strength.${rate.strength}`, lang)}</th>
            <td className="screens-td">{rate.closed}</td>
            <td className="screens-td">{rate.reopened}</td>
            <td className="screens-td">{`${reopeningShare(rate)} %`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Maquette de la page projet : tout vient du view-model réel. */
export function ProjectPageMock({ lang }: { lang: Language }): ReactElement {
  const t = stringsFor(lang);
  const extra = SCREENS_EXTRA[lang];
  const data = createProjectDemoData();
  const vm = buildProjectPageViewModel({
    projectId: DEMO_PROJECT_ID,
    coverages: data.coverages,
    waivers: data.waivers,
    living: data.living,
    stats: data.stats,
    language: lang,
  });
  return (
    <figure className="screens-mock">
      <figcaption className="screens-mock-cap">
        <span className="screens-mock-title">{t.screens.items[3].name}</span>
        <span className="screens-lozenge screens-lozenge--moved">{text(UI_MESSAGES, 'ui.project.title', lang)}</span>
      </figcaption>
      <div className="screens-body">
        <IssuesTable issues={vm.issues} lang={lang} />
        <div className="screens-subhead">
          <h3 className="screens-subtitle">{text(UI_MESSAGES, 'ui.project.tabs.waivers', lang)}</h3>
          <CountBadge count={vm.activeWaiversCount} label={text(UI_MESSAGES, 'ui.project.tabs.waivers', lang)} />
        </div>
        <WaiversTable waivers={vm.waivers} lang={lang} />
        <div className="screens-subhead">
          <h3 className="screens-subtitle">{text(UI_MESSAGES, 'ui.project.tabs.living', lang)}</h3>
          <CountBadge count={vm.unprovenLivingCount} label={text(UI_MESSAGES, 'ui.project.living.alertTitle', lang)} />
        </div>
        <LivingTable living={vm.unprovenLiving} lang={lang} />
        <div className="screens-subhead">
          <h3 className="screens-subtitle">{text(UI_MESSAGES, 'ui.project.tabs.stats', lang)}</h3>
        </div>
        {vm.stats ? (
          <>
            <StrengthStats items={vm.stats.proofsByStrength} lang={lang} />
            <GranterStats items={vm.stats.waiversByGranter} lang={lang} />
            <ReopeningStats rates={data.stats.reopenings} lang={lang} />
            <p className="screens-para">
              <span className="screens-para-label">{`${text(UI_MESSAGES, 'ui.project.stats.closedWithoutValidator', lang)} : `}</span>
              <span className="screens-value">{vm.stats.closedWithoutValidator}</span>
            </p>
          </>
        ) : null}
        <p className="screens-note">{extra.projectShows}</p>
      </div>
    </figure>
  );
}
