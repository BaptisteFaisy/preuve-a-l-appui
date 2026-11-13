/**
 * Le résultat du simulateur : ce que l'app a fait du geste, ce qu'elle
 * retient comme force, l'état du critère, la couverture et le verdict.
 *
 * Tout ce qui est affiché vient de l'app : la force retenue par le moteur de
 * couverture, les libellés de la matrice (`src/viewmodel/matrix.ts`), le
 * champ « n / m » (`src/viewmodel/coverage.ts`) et le message du validateur
 * (`src/handlers/validator.ts`). Le site n'ajoute qu'un titre et le texte du
 * refus — le refus lui-même est la réponse de l'app.
 *
 * Accessibilité : la zone du résultat est un `role="status"` vivant
 * (`aria-live="polite"`), l'état n'est jamais porté par la couleur seule
 * (chaque état a son texte et son signe), et les preuves sont listées avec
 * leurs intitulés.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { GateVerdict, Language } from '../../../../../src/types.js';
import { SIMULATOR_STRINGS } from '../../../i18n/simulator.js';
import type { GestureResult } from '../../../demo/actions.js';
import type { SimulatorChoice } from './engine.js';
import type { SimulatorCriterion, SimulatorView } from './viewmodel.js';

export interface SimulatorResultProps {
  readonly lang: Language;
  readonly view: SimulatorView;
  readonly choice: SimulatorChoice;
  readonly outcome: GestureResult | null;
  readonly verdict: GateVerdict | null;
}

/** Le signe qui accompagne l'état : jamais la couleur seule. */
function signOf(criterion: SimulatorCriterion): string {
  if (criterion.proven) return '✓';
  if (criterion.status === 'waived') return '—';
  return '✗';
}

/** Le geste : accepté ou refusé, avec la raison donnée par l'app. */
function OutcomeLine(props: SimulatorResultProps): ReactElement | null {
  const t = SIMULATOR_STRINGS[props.lang];
  const outcome = props.outcome;
  if (!outcome) return null;
  const refused = outcome.outcome === 'refused';
  return (
    <p
      className="simulator-outcome"
      role="status"
      aria-live="polite"
      data-tone={refused ? 'bad' : 'ok'}
    >
      <span aria-hidden="true">{refused ? '✗' : '✓'}</span>{' '}
      <strong>{refused ? t.outcomeRefused : t.outcomeOk}</strong>
      {refused && outcome.detail ? ` ${outcome.detail}` : ''}
    </p>
  );
}

/** La force du critère : celle exigée et celle que l'app retient. */
function StrengthBlock(props: SimulatorResultProps): ReactElement | null {
  const t = SIMULATOR_STRINGS[props.lang];
  const criterion = props.view.criteria.find((one) => one.code === props.choice.criterionCode);
  if (!criterion) return null;
  return (
    <div className="simulator-block">
      <h3>{t.strengthTitle}</h3>
      <p className="simulator-criterion">
        <strong>{criterion.code}</strong> — {criterion.text}
      </p>
      <dl className="simulator-facts">
        <dt>{t.requiredStrength}</dt>
        <dd>{criterion.requiredStrengthLabel}</dd>
        <dt>{t.keptStrength}</dt>
        <dd>{criterion.bestStrengthLabel || '—'}</dd>
        <dt>{t.stateLabel}</dt>
        <dd data-tone={criterion.proven ? 'ok' : 'bad'}>
          <span aria-hidden="true">{signOf(criterion)}</span> {criterion.statusLabel}
          {criterion.defectLabel ? ` — ${criterion.defectLabel}` : ''}
        </dd>
      </dl>
    </div>
  );
}

/** Les preuves du critère, telles que l'app les formate. */
function ProofsBlock(props: SimulatorResultProps): ReactElement | null {
  const t = SIMULATOR_STRINGS[props.lang];
  const criterion = props.view.criteria.find((one) => one.code === props.choice.criterionCode);
  if (!criterion) return null;
  return (
    <div className="simulator-block">
      <h3>{t.proofsTitle}</h3>
      {criterion.proofs.length === 0 ? (
        <p className="simulator-none">{t.noProof}</p>
      ) : (
        <ul className="simulator-proofs">
          {criterion.proofs.map((proof) => (
            <li key={proof.id}>
              <span className="tag">{proof.typeLabel}</span>{' '}
              <span className="tag">{proof.strengthLabel}</span>{' '}
              <code>{proof.reference}</code>{' '}
              <span className="simulator-freshness">
                {proof.freshnessLabel}
                {proof.addedByAgent ? ` · ${t.addedByAgent}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** La couverture : le champ « n / m » que l'app écrit sur le ticket. */
function CoverageBlock(props: SimulatorResultProps): ReactElement {
  const t = SIMULATOR_STRINGS[props.lang];
  return (
    <div className="simulator-block">
      <h3>{t.coverageTitle}</h3>
      <p className="simulator-coverage">
        <strong>{props.view.coverageLabel}</strong> — {props.view.coverageText}
      </p>
    </div>
  );
}

/** Le verdict : ce que le validateur répondrait à la transition. */
function VerdictBlock(props: SimulatorResultProps): ReactElement | null {
  const t = SIMULATOR_STRINGS[props.lang];
  const verdict = props.verdict;
  if (!verdict) return null;
  return (
    <div
      className="simulator-verdict"
      data-tone={verdict.result ? 'ok' : 'bad'}
      role="status"
      aria-live="polite"
    >
      <h3>
        <span aria-hidden="true">{verdict.result ? '✓' : '✗'}</span>{' '}
        {verdict.result ? t.verdictPassed : t.verdictBlocked}
      </h3>
      {!verdict.result && verdict.errorMessage ? <p>{verdict.errorMessage}</p> : null}
    </div>
  );
}

export function SimulatorResult(props: SimulatorResultProps): ReactElement {
  return (
    <div className="simulator-result">
      <OutcomeLine {...props} />
      <StrengthBlock {...props} />
      <ProofsBlock {...props} />
      <CoverageBlock {...props} />
      <VerdictBlock {...props} />
    </div>
  );
}
