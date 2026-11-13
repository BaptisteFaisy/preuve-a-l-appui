/**
 * Le corps du simulateur : le formulaire, le résultat et la mention « tout
 * reste dans cette page ».
 *
 * Ce composant ne calcule rien : il reçoit l'état produit par `engine.ts`
 * (donc par l'app) et renvoie les choix du visiteur. Il est séparé de la
 * section pour pouvoir être rendu avec un état déjà bâti — c'est ce que font
 * les tests, sans navigateur.
 *
 * Accessibilité : après un geste, le focus est posé sur la zone de résultat
 * (`tabIndex={-1}`), qui est aussi une zone vivante : un lecteur d'écran lit
 * la décision de l'app sans que le visiteur ait à chercher.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import type { Language } from '../../../../../src/types.js';
import { SIMULATOR_STRINGS } from '../../../i18n/simulator.js';
import type { SimulatorChoice, SimulatorRuntime } from './engine.js';
import { SimulatorForm } from './SimulatorForm.js';
import { SimulatorResult } from './SimulatorResult.js';

export interface SimulatorBodyProps {
  readonly lang: Language;
  readonly runtime: SimulatorRuntime;
  readonly choice: SimulatorChoice;
  readonly busy: boolean;
  readonly onChoose: (patch: Partial<SimulatorChoice>) => void;
  readonly onAttach: () => void;
  readonly onReset: () => void;
}

export function SimulatorBody(props: SimulatorBodyProps): ReactElement {
  const t = SIMULATOR_STRINGS[props.lang];
  const resultRef = useRef<HTMLDivElement | null>(null);
  const outcome = props.runtime.outcome;

  useEffect(() => {
    if (outcome) resultRef.current?.focus();
  }, [outcome]);

  return (
    <div className="simulator-body">
      <p className="simulator-issue">
        <strong>
          {t.issueLabel} : {props.runtime.view.issueKey}
        </strong>{' '}
        — {t.sameAsDemo}
      </p>
      <SimulatorForm
        lang={props.lang}
        view={props.runtime.view}
        choice={props.choice}
        busy={props.busy}
        onChoose={props.onChoose}
        onAttach={props.onAttach}
        onReset={props.onReset}
      />
      <div className="simulator-result-region" ref={resultRef} tabIndex={-1}>
        <SimulatorResult
          lang={props.lang}
          view={props.runtime.view}
          choice={props.choice}
          outcome={outcome}
          verdict={props.runtime.verdict}
        />
      </div>
      <p className="simulator-note">{t.inMemory}</p>
    </div>
  );
}
