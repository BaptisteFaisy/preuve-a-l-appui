/**
 * Le bloc d'âge des données (lot `site-demo-live`) : depuis quand ce que montre
 * la démo, et le bouton qui relit l'instantané publié.
 *
 * Le site public était figé à sa construction ; ce bloc dit au visiteur
 * l'horodatage auquel l'app a écrit ses données, celui auquel le navigateur les
 * a relues, et leur âge en direct. Le bouton relance la lecture du fichier
 * publié — c'est la partie « live » de la démo, sans scénario ni rejeu.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { useEffect, useState, type ReactElement } from 'react';
import type { Language } from '../../../../src/types.js';
import { LIVE_STRINGS, fillText } from '../../i18n/live.js';
import { FRESHNESS_TICK_MS } from '../config.js';
import { ageLabel, ageTone, stampLabel } from '../freshness.js';
import type { DemoSnapshot } from '../state.js';

export interface DataFreshnessProps {
  readonly lang: Language;
  readonly snapshot: DemoSnapshot;
  /** Relance la lecture des données réelles (le monde est reconstruit). */
  readonly onReload: () => Promise<void>;
}

/** L'horloge du bloc : l'âge affiché avance tout seul, sans geste du visiteur. */
function useNow(stepMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(timer);
  }, [stepMs]);
  return now;
}

/** Une ligne datée : « écrites par l'app le 13 nov. 18:09 (il y a 21 h) ». */
function DatedLine(props: {
  readonly template: string;
  readonly iso: string;
  readonly now: number;
  readonly lang: Language;
}): ReactElement | null {
  const { template, iso, now, lang } = props;
  const stamp = stampLabel(iso, lang);
  if (stamp === '') return null;
  const text = fillText(template, { stamp, age: ageLabel(iso, now, lang) });
  return <li>{text}</li>;
}

export function DataFreshness({ lang, snapshot, onReload }: DataFreshnessProps): ReactElement {
  const live = LIVE_STRINGS[lang];
  const now = useNow(FRESHNESS_TICK_MS);
  const [pending, setPending] = useState(false);
  const source = snapshot.source;
  const busy = snapshot.busy || pending;

  /** Relit, et rend le bouton indisponible le temps de la relecture. */
  async function reload(): Promise<void> {
    setPending(true);
    try {
      await onReload();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="demo-freshness" data-tone={ageTone(source.generatedAt, now)}>
      <p className="demo-freshness-title">{live.ageTitle}</p>
      <ul className="demo-freshness-lines">
        <DatedLine template={live.produced} iso={source.generatedAt} now={now} lang={lang} />
        <DatedLine template={live.reloaded} iso={source.readAt} now={now} lang={lang} />
      </ul>
      <button type="button" className="button secondary" onClick={() => void reload()} disabled={busy}>
        {busy ? live.reloading : live.reload}
      </button>
      <p className="demo-freshness-note">
        <code>{live.gestures}</code>
      </p>
    </div>
  );
}
