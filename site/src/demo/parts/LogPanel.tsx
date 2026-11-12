/**
 * Journal de la démo : ce que l'app a fait, dans l'ordre, avec le résultat de
 * chaque geste. C'est la trace qui rend la règle visible — un refus y est
 * aussi lisible qu'une réussite (SPEC §5, principe 5).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import { stringsFor } from '../../i18n/index.js';
import type { DemoLogEntry } from '../actions.js';

export interface LogPanelProps {
  readonly lang: 'en' | 'fr';
  readonly entries: readonly DemoLogEntry[];
}

export function LogPanel({ lang, entries }: LogPanelProps): ReactElement {
  const t = stringsFor(lang).demo;
  return (
    <section className="demo-log" aria-label={t.log}>
      <h3>{t.log}</h3>
      {entries.length === 0 ? (
        <p className="demo-none">—</p>
      ) : (
        <ol>
          {entries.map((entry) => (
            <li key={entry.id} data-outcome={entry.outcome}>
              <strong>{entry.label}</strong> <span>{entry.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
