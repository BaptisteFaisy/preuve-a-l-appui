/**
 * En-tête de la démo : titre, promesse, champ de couverture et provenance des
 * données, telle que l'app l'écrit sur le ticket (`src/viewmodel/coverage.ts`)
 * — « 2 / 4 », coloré, exactement comme dans Jira (SPEC §12.3, §16.2).
 *
 * Le bandeau de provenance dit d'où viennent les données : relues dans
 * l'instantané publié par l'app installée sur le site de démonstration, ou le
 * jeu embarqué quand la relecture échoue (lots `site-donnees-reelles`,
 * `site-demo-live`). Le bloc d'âge, lui, dit depuis quand.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../../src/types.js';
import { LIVE_STRINGS, fillText } from '../../i18n/live.js';
import { stringsFor } from '../../i18n/index.js';
import type { DemoSnapshot } from '../state.js';
import { DataFreshness } from './DataFreshness.js';

export interface DemoHeaderProps {
  readonly lang: Language;
  readonly snapshot: DemoSnapshot;
  /** Relance la lecture des données réelles. */
  readonly onReload: () => Promise<void>;
}

/** Le bandeau : d'où viennent les données affichées, et pourquoi elles diffèrent. */
function Provenance(props: { lang: Language; snapshot: DemoSnapshot }): ReactElement {
  const { lang, snapshot } = props;
  const live = LIVE_STRINGS[lang];
  const source = snapshot.source;
  const isLive = source.kind === 'live' && source.error === '';
  const body = isLive
    ? fillText(live.liveBody, { site: source.site, issue: snapshot.issueKey })
    : fillText(live.embeddedBody, { reason: source.error === '' ? '?' : source.error });
  return (
    <p className="demo-source" data-kind={isLive ? 'live' : 'embedded'}>
      <span className="demo-source-tag">{isLive ? live.liveTitle : live.embeddedTitle}</span>
      <span className="demo-source-body">{body}</span>
    </p>
  );
}

export function DemoHeader({ lang, snapshot, onReload }: DemoHeaderProps): ReactElement {
  const t = stringsFor(lang).demo;
  return (
    <header className="demo-head">
      <div>
        <h2 id="demo-title">{fillText(t.title, { issue: snapshot.issueKey })}</h2>
        <p className="lede">{t.lede}</p>
        <p className="demo-engine">
          <code>{t.engineNote}</code> · <code>{snapshot.issueKey}</code>
        </p>
        <Provenance lang={lang} snapshot={snapshot} />
        <DataFreshness lang={lang} snapshot={snapshot} onReload={onReload} />
      </div>
      <div className="demo-score" data-tone={snapshot.field.tone} title={snapshot.field.tooltip}>
        <span className="demo-score-label">{t.coverage}</span>
        <strong>{snapshot.field.label}</strong>
      </div>
    </header>
  );
}
