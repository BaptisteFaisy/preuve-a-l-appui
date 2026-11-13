/**
 * Le panneau des gestes avancés de la démo.
 *
 * Il ne contient aucune règle : il liste les gestes de `../advanced.ts` (chacun
 * portant le code de la fonctionnalité du cahier des charges qu'il montre),
 * appelle `onRun`, et affiche le résultat que l'app a réellement produit —
 * vert si le geste passe, rouge si l'app refuse, neutre si c'est informatif.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../../src/types.js';
import { DEMO_EXTRA } from '../../i18n/demo-extra.js';
import type { GestureResult } from '../actions.js';
import { ADVANCED_ACTIONS } from '../advanced.js';
import '../advanced.css';

export interface AdvancedPanelProps {
  readonly lang: Language;
  readonly results: Readonly<Record<string, GestureResult>>;
  readonly busy: boolean;
  readonly onRun: (id: string) => void;
}

/** Un geste : son code de fonctionnalité, son libellé, son dernier résultat. */
function AdvancedAction(props: {
  id: string;
  feature: string;
  label: string;
  busy: boolean;
  result: GestureResult | undefined;
  onRun: (id: string) => void;
}): ReactElement {
  const { id, feature, label, busy, result, onRun } = props;
  return (
    <li className="demo-adv-item">
      <button
        type="button"
        className="demo-adv-btn"
        disabled={busy}
        onClick={() => onRun(id)}
        aria-describedby={`demo-adv-result-${id}`}
      >
        <span className="demo-adv-fp" aria-hidden="true">
          {feature}
        </span>
        <span className="demo-adv-label">{label}</span>
      </button>
      <p
        className={result === undefined ? 'demo-adv-result demo-adv-result--empty' : `demo-adv-result demo-adv-result--${result.outcome}`}
        id={`demo-adv-result-${id}`}
        role="status"
        aria-live="polite"
      >
        {result?.detail ?? ''}
      </p>
    </li>
  );
}

export function AdvancedPanel(props: AdvancedPanelProps): ReactElement {
  const { lang, results, busy, onRun } = props;
  const t = DEMO_EXTRA[lang];
  return (
    <section className="demo-advanced" aria-labelledby="demo-advanced-title">
      <h3 className="demo-advanced-title" id="demo-advanced-title">
        {t.title}
      </h3>
      <p className="demo-advanced-lede">{t.lede}</p>
      <ul className="demo-adv-list" role="list">
        {ADVANCED_ACTIONS.map((action) => (
          <AdvancedAction
            key={action.id}
            id={action.id}
            feature={action.feature}
            label={t.labels[action.id] ?? action.id}
            busy={busy}
            result={results[action.id]}
            onRun={onRun}
          />
        ))}
      </ul>
    </section>
  );
}
