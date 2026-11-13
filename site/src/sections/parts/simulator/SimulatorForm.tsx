/**
 * Le formulaire du simulateur : le critère, le type de preuve, la personne et
 * la référence. Rien n'y est décidé : le formulaire ne fait que porter le
 * choix du visiteur jusqu'aux vrais gestes de l'app.
 *
 * Accessibilité : chaque champ a son étiquette reliée par `for`/`id`, les
 * listes sont des `<select>` natifs (clavier et lecteur d'écran compris),
 * l'aide du champ « référence » est reliée par `aria-describedby`.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { EvidenceType, Language } from '../../../../../src/types.js';
import { SIMULATOR_STRINGS } from '../../../i18n/simulator.js';
import type { SimulatorChoice } from './engine.js';
import type { SimulatorView } from './viewmodel.js';

export interface SimulatorFormProps {
  readonly lang: Language;
  readonly view: SimulatorView;
  readonly choice: SimulatorChoice;
  readonly busy: boolean;
  readonly onChoose: (patch: Partial<SimulatorChoice>) => void;
  readonly onAttach: () => void;
  readonly onReset: () => void;
}

/** Le critère visé : son code, son texte et la force que l'app exige. */
function CriterionField(props: SimulatorFormProps): ReactElement {
  const t = SIMULATOR_STRINGS[props.lang];
  return (
    <label className="simulator-field" htmlFor="simulator-criterion">
      <span>{t.criterionLabel}</span>
      <select
        id="simulator-criterion"
        value={props.choice.criterionCode}
        disabled={props.busy}
        onChange={(event) => props.onChoose({ criterionCode: event.target.value })}
      >
        {props.view.criteria.map((criterion) => (
          <option key={criterion.code} value={criterion.code}>
            {criterion.code} — {criterion.text} ({criterion.requiredStrengthLabel})
          </option>
        ))}
      </select>
    </label>
  );
}

/** Le type de preuve : les six du domaine, libellés par l'app. */
function TypeField(props: SimulatorFormProps): ReactElement {
  const t = SIMULATOR_STRINGS[props.lang];
  return (
    <label className="simulator-field" htmlFor="simulator-type">
      <span>{t.typeLabel}</span>
      <select
        id="simulator-type"
        value={props.choice.type}
        disabled={props.busy}
        onChange={(event) => props.onChoose({ type: event.target.value as EvidenceType })}
      >
        {props.view.types.map((option) => (
          <option key={option.type} value={option.type}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Qui attache : l'agent, l'assignée, la testeuse, le product owner. */
function ActorField(props: SimulatorFormProps): ReactElement {
  const t = SIMULATOR_STRINGS[props.lang];
  return (
    <label className="simulator-field" htmlFor="simulator-actor">
      <span>{t.actorLabel}</span>
      <select
        id="simulator-actor"
        value={props.choice.role}
        disabled={props.busy}
        onChange={(event) =>
          props.onChoose({ role: event.target.value as SimulatorChoice['role'] })
        }
      >
        {props.view.actors.map((actor) => (
          <option key={actor.role} value={actor.role}>
            {actor.label} — {actor.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** La référence : ce que l'app va vérifier (test, page, fichier, lien). */
function ReferenceField(props: SimulatorFormProps): ReactElement {
  const t = SIMULATOR_STRINGS[props.lang];
  return (
    <label className="simulator-field" htmlFor="simulator-reference">
      <span>{t.referenceLabel}</span>
      <input
        id="simulator-reference"
        type="text"
        value={props.choice.reference}
        disabled={props.busy}
        aria-describedby="simulator-reference-hint"
        onChange={(event) => props.onChoose({ reference: event.target.value })}
      />
      <span className="simulator-hint" id="simulator-reference-hint">
        {t.referenceHint}
      </span>
    </label>
  );
}

export function SimulatorForm(props: SimulatorFormProps): ReactElement {
  const t = SIMULATOR_STRINGS[props.lang];
  return (
    <form
      className="simulator-form"
      onSubmit={(event) => {
        event.preventDefault();
        props.onAttach();
      }}
    >
      <div className="simulator-fields">
        <CriterionField {...props} />
        <TypeField {...props} />
        <ActorField {...props} />
        <ReferenceField {...props} />
      </div>
      <div className="simulator-buttons">
        <button type="submit" className="button" disabled={props.busy}>
          {t.submit}
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={props.busy}
          onClick={props.onReset}
        >
          {t.reset}
        </button>
      </div>
    </form>
  );
}
