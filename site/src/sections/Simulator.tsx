/**
 * La section « simulateur » du site public (lot `site-simulateur`).
 *
 * Le visiteur y choisit un critère du ticket RÉEL embarqué dans le site, un
 * type de preuve et la personne qui l'attache ; l'app calcule alors la force
 * retenue, la couverture « n / m » et le verdict de la transition. Cette
 * section ne contient aucune règle : le monde, les gestes et l'état viennent
 * de `parts/simulator/` (donc de `src/domain`, `src/handlers`,
 * `src/viewmodel` et de l'instantané réel).
 *
 * Elle est insérée entre la démo (`#demo`) et les écrans (`#screens`), sur le
 * même ticket que la démo.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../src/types.js';
import { SIMULATOR_STRINGS } from '../i18n/simulator.js';
import { SimulatorBody } from './parts/simulator/SimulatorBody.js';
import { useSimulator } from './parts/simulator/useSimulator.js';
import './Simulator.css';

export interface SimulatorProps {
  readonly lang: Language;
}

export function Simulator({ lang }: SimulatorProps): ReactElement {
  const t = SIMULATOR_STRINGS[lang];
  const sim = useSimulator(lang);

  return (
    <section id="simulator" className="simulator" aria-labelledby="simulator-title">
      <div className="wrap">
        <h2 id="simulator-title">{t.title}</h2>
        <p className="lede">{t.lede}</p>
        {sim.runtime ? (
          <SimulatorBody
            lang={lang}
            runtime={sim.runtime}
            choice={sim.choice}
            busy={sim.busy}
            onChoose={sim.choose}
            onAttach={() => void sim.attach()}
            onReset={() => void sim.reset()}
          />
        ) : (
          <p className="simulator-loading" aria-busy="true">
            {t.loading}
          </p>
        )}
      </div>
    </section>
  );
}
