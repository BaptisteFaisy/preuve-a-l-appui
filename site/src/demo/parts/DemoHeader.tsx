/**
 * En-tête de la démo : titre, promesse, et le champ de couverture tel que
 * l'app l'écrit sur le ticket (`src/viewmodel/coverage.ts`) — « 2 / 4 »,
 * coloré, exactement comme dans Jira (SPEC §12.3, §16.2).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../../src/types.js';
import { stringsFor } from '../../i18n/index.js';
import type { DemoSnapshot } from '../state.js';
import { ISSUE_KEY } from '../world.js';

export interface DemoHeaderProps {
  readonly lang: Language;
  readonly snapshot: DemoSnapshot;
}

export function DemoHeader({ lang, snapshot }: DemoHeaderProps): ReactElement {
  const t = stringsFor(lang).demo;
  return (
    <header className="demo-head">
      <div>
        <h2 id="demo-title">{t.title}</h2>
        <p className="lede">{t.lede}</p>
        <p className="demo-engine">
          <code>{t.engineNote}</code> · <code>{ISSUE_KEY}</code>
        </p>
      </div>
      <div className="demo-score" data-tone={snapshot.field.tone} title={snapshot.field.tooltip}>
        <span className="demo-score-label">{t.coverage}</span>
        <strong>{snapshot.field.label}</strong>
      </div>
    </header>
  );
}
