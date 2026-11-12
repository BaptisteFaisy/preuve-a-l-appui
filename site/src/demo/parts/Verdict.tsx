/**
 * Le verdict du validateur, affiché tel que l'app le produit.
 *
 * Le message n'est jamais reformulé par le site : c'est la chaîne renvoyée par
 * `evaluateGate` (SPEC §7.2, §12.1), donc celle que Jira affichera sur la
 * transition. Deux critères nommés au plus, renvoi au panneau pour le reste
 * (SPEC §19).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { GateVerdict } from '../../../../src/types.js';

export interface VerdictProps {
  readonly lang: 'en' | 'fr';
  readonly verdict: GateVerdict | null;
  readonly passedText: string;
}

export function VerdictPanel({ lang, verdict, passedText }: VerdictProps): ReactElement | null {
  if (!verdict) return null;
  const title = verdict.result
    ? lang === 'fr'
      ? 'Transition autorisée'
      : 'Transition allowed'
    : lang === 'fr'
      ? 'Transition bloquée par le validateur'
      : 'Transition blocked by the validator';
  return (
    <div className={`demo-verdict ${verdict.result ? 'is-ok' : 'is-blocked'}`} role="status" aria-live="polite">
      <h3>{title}</h3>
      <pre>{verdict.result ? passedText : verdict.errorMessage}</pre>
    </div>
  );
}

export type { GateVerdict };
