/**
 * Maquette 3 — les réglages du projet (écran Forge `jira:projectSettingsPage`).
 *
 * Rend le VRAI view-model de l'app (`buildSettingsViewModel`,
 * `src/viewmodel/settings.ts`) sur les réglages de démonstration PAY-123
 * (`createDemoSettings()`, `src/sample/pay-123.ts`) : sélecteur de mode,
 * politique sans critère, grille des forces exigées par type de critère
 * (FP-05), rôles qui attestent et dérogent, commande de CI à copier et langue
 * du projet. Aucun texte en dur : les libellés viennent de
 * `text(UI_MESSAGES, …)` et, pour le peu que l'app ne produit pas, de
 * `SCREENS_EXTRA` (site/src/i18n/screens-extra.ts).
 *
 * Lot `site-toutes-features`. Règle : fichiers < 500 lignes, fonctions < 50.
 */
import type { ReactElement } from 'react';
import type { Language, ProjectSettings } from '../../../../src/types.js';
import { text } from '../../../../src/i18n/index.js';
import { UI_MESSAGES } from '../../../../src/i18n/ui.js';
import { requiresCrossEvidence } from '../../../../src/domain/requirements.js';
import { createDemoSettings, DEMO_PROJECT_ID } from '../../../../src/sample/pay-123.js';
import { buildSettingsViewModel } from '../../../../src/viewmodel/settings.js';
import type { GateModeOptionViewModel, RequirementRowViewModel } from '../../../../src/viewmodel/settings.js';
import { stringsFor } from '../../i18n/index.js';
import { SCREENS_EXTRA } from '../../i18n/screens-extra.js';
import '../screens-mocks.css';

/** Le sélecteur de mode du validateur : trois options, une seule marquée. */
function ModeSelector(props: { options: readonly GateModeOptionViewModel[]; lang: Language }): ReactElement {
  const { options, lang } = props;
  const extra = SCREENS_EXTRA[lang];
  return (
    <div className="screens-modes" role="group" aria-label={text(UI_MESSAGES, 'ui.settings.section.gateMode', lang)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`screens-mode${option.isSelected ? ' screens-mode--selected' : ''}`}
          aria-pressed={option.isSelected}
        >
          <span className="screens-mode-label">
            {option.label}
            {option.isSelected ? <span className="screens-lozenge screens-lozenge--moved">{extra.settingsSelected}</span> : null}
          </span>
          <span className="screens-mode-desc">{option.description}</span>
        </button>
      ))}
    </div>
  );
}

/** Une ligne de la grille des exigences : un rang par type de critère (FP-05). */
function RequirementRow(props: { row: RequirementRowViewModel; settings: ProjectSettings; lang: Language }): ReactElement {
  const { row, settings, lang } = props;
  const extra = SCREENS_EXTRA[lang];
  const requirement = settings.requirements[row.type];
  const yesNo = (value: boolean) => text(UI_MESSAGES, value ? 'ui.common.yes' : 'ui.common.no', lang);
  return (
    <tr className="screens-tr">
      <th scope="row" className="screens-th-row">{row.typeLabel}</th>
      <td className="screens-td">{row.acceptedStrengths}</td>
      <td className="screens-td">{row.attesterRole}</td>
      <td className="screens-td">
        <span className="screens-crittext">{row.constraintsLabel}</span>
        {requiresCrossEvidence(requirement) ? (
          <span className="screens-xbadge">
            {extra.crossEvidence.replace('{n}', String(requirement.minDistinctTypes))}
          </span>
        ) : null}
      </td>
      <td className="screens-td">{yesNo(row.minor)}</td>
    </tr>
  );
}

/** La grille des forces exigées, un rang par type de critère. */
function RequirementsTable(props: { rows: readonly RequirementRowViewModel[]; settings: ProjectSettings; lang: Language }): ReactElement {
  const { rows, settings, lang } = props;
  const head = (key: string) => text(UI_MESSAGES, key, lang);
  return (
    <div className="screens-tablescroll">
      <table className="screens-table">
        <caption className="screens-subcap">{head('ui.settings.section.requirements')}</caption>
        <thead>
          <tr>
            <th scope="col">{head('ui.matrix.col.type')}</th>
            <th scope="col">{head('ui.settings.col.accepted')}</th>
            <th scope="col">{head('ui.settings.col.attesterRole')}</th>
            <th scope="col">{head('ui.settings.col.constraints')}</th>
            <th scope="col">{head('ui.settings.col.minor')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <RequirementRow key={row.type} row={row} settings={settings} lang={lang} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Les rôles qui attestent, dérogent, reviennent la sécurité et les données. */
function RolesTable(props: { settings: ProjectSettings; lang: Language }): ReactElement {
  const { settings, lang } = props;
  const rows: readonly [string, readonly string[]][] = [
    ['ui.settings.roles.attest', settings.roles.attest],
    ['ui.settings.roles.waive', settings.roles.waive],
    ['ui.settings.roles.security', settings.roles.security],
    ['ui.settings.roles.data', settings.roles.data],
  ];
  return (
    <table className="screens-table screens-roles">
      <caption className="screens-subcap">{text(UI_MESSAGES, 'ui.settings.section.roles', lang)}</caption>
      <tbody>
        {rows.map(([key, roles]) => (
          <tr key={key} className="screens-tr">
            <th scope="row" className="screens-th-row">{text(UI_MESSAGES, key, lang)}</th>
            <td className="screens-td">{roles.join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Le bloc CI : la commande d'une ligne générée par l'app, à copier. */
function CiBlock(props: { ciCommand: string; lang: Language }): ReactElement {
  const { ciCommand, lang } = props;
  return (
    <div className="screens-ci">
      <span className="screens-subcap">{text(UI_MESSAGES, 'ui.settings.ci.commandTitle', lang)}</span>
      <code className="screens-code">{ciCommand}</code>
      <button type="button" className="screens-btn">{text(UI_MESSAGES, 'ui.settings.ci.copy', lang)}</button>
    </div>
  );
}

/** Maquette des réglages du projet : tout vient du view-model réel. */
export function SettingsMock({ lang }: { lang: Language }): ReactElement {
  const t = stringsFor(lang);
  const extra = SCREENS_EXTRA[lang];
  const settings = createDemoSettings();
  const vm = buildSettingsViewModel(settings, DEMO_PROJECT_ID, lang);
  return (
    <figure className="screens-mock">
      <figcaption className="screens-mock-cap">
        <span className="screens-mock-title">{t.screens.items[2].name}</span>
        <span className="screens-lozenge screens-lozenge--moved">{vm.modeLabel}</span>
      </figcaption>
      <div className="screens-body">
        <h3 className="screens-subtitle">{text(UI_MESSAGES, 'ui.settings.section.gateMode', lang)}</h3>
        <ModeSelector options={vm.modeOptions} lang={lang} />
        <h3 className="screens-subtitle">{text(UI_MESSAGES, 'ui.settings.section.missingCriteria', lang)}</h3>
        <p className="screens-para">{vm.missingCriteriaLabel}</p>
        <RequirementsTable rows={vm.requirements} settings={settings} lang={lang} />
        <RolesTable settings={settings} lang={lang} />
        <CiBlock ciCommand={vm.ciCommand} lang={lang} />
        <p className="screens-para">
          <span className="screens-para-label">{`${extra.settingsLanguage} : `}</span>
          <span className="screens-value">{vm.language.toUpperCase()}</span>
        </p>
        <p className="screens-note">{extra.settingsShows}</p>
      </div>
    </figure>
  );
}
