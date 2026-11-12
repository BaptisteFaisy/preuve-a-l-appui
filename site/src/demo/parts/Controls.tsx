/**
 * Barre de contrôle de la démo : acteur courant, mode du projet, pipeline,
 * transition, agent et remise à zéro. Aucun calcul ici — chaque bouton appelle
 * un geste qui traverse les vrais handlers de l'app.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Actor, GateMode, Language } from '../../../../src/types.js';
import { stringsFor } from '../../i18n/index.js';
import type { DemoSnapshot } from '../state.js';

export interface ControlsProps {
  readonly lang: Language;
  readonly snapshot: DemoSnapshot;
  readonly modes: readonly GateMode[];
  readonly onActor: (accountId: string) => void;
  readonly onMode: (mode: GateMode) => void;
  readonly onCi: (mainBranch: boolean) => void;
  readonly onDone: () => void;
  readonly onAgent: () => void;
  readonly onReset: () => void;
}

/** Sélecteur d'acteur : c'est lui qui décide si un geste est autorisé. */
function ActorSelect({ props }: { props: ControlsProps }): ReactElement {
  const t = stringsFor(props.lang).demo;
  return (
    <label className="demo-field">
      <span>{t.actor}</span>
      <select
        value={props.snapshot.actor.accountId}
        onChange={(event) => props.onActor(event.target.value)}
        disabled={props.snapshot.busy}
      >
        {props.snapshot.actors.map((actor: Actor) => (
          <option key={actor.accountId} value={actor.accountId}>
            {actor.displayName}
            {actor.agent ? ' (agent)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Sélecteur de mode : strict, souple, observation (SPEC §12.2). */
function ModeSelect({ props }: { props: ControlsProps }): ReactElement {
  const t = stringsFor(props.lang).demo;
  return (
    <label className="demo-field">
      <span>{t.mode}</span>
      <select
        value={props.snapshot.mode}
        onChange={(event) => props.onMode(event.target.value as GateMode)}
        disabled={props.snapshot.busy}
      >
        {props.modes.map((mode) => (
          <option key={mode} value={mode}>
            {t.modes[mode]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Les gestes globaux : pipeline, agent, transition, remise à zéro. */
function GlobalActions({ props }: { props: ControlsProps }): ReactElement {
  const t = stringsFor(props.lang).demo;
  const busy = props.snapshot.busy;
  return (
    <div className="demo-buttons">
      <button type="button" className="button secondary" onClick={() => props.onCi(false)} disabled={busy}>
        {t.runCi}
      </button>
      <button type="button" className="button secondary" onClick={props.onAgent} disabled={busy}>
        get-proof-status
      </button>
      <button type="button" className="button" onClick={props.onDone} disabled={busy}>
        {t.tryDone}
      </button>
      <button type="button" className="button secondary" onClick={props.onReset} disabled={busy}>
        {t.reset}
      </button>
    </div>
  );
}

export function Controls(props: ControlsProps): ReactElement {
  return (
    <div className="demo-controls">
      <ActorSelect props={props} />
      <ModeSelect props={props} />
      <GlobalActions props={props} />
    </div>
  );
}
