/**
 * L'état des gestes avancés de la démo, dans son propre crochet.
 *
 * Chaque geste est joué exactement comme les autres (via `play`, donc avec
 * journal et relecture de l'état réel) ; seul son résultat est conservé en
 * plus, par identifiant, pour rester affiché sous le bouton.
 *
 * Découpé depuis `useDemo.ts` pour tenir la limite de 50 lignes par fonction
 * (docs/CONVENTIONS.md). Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { useCallback, useState } from 'react';
import type { Language } from '../../../src/types.js';
import { DEMO_EXTRA } from '../i18n/demo-extra.js';
import type { GestureResult } from './actions.js';
import { runAdvanced } from './advanced.js';
import { play, type RunContext } from './state.js';

/** Ce que le panneau avancé expose au composant. */
export interface AdvancedApi {
  readonly advanced: Readonly<Record<string, GestureResult>>;
  advancedRun(id: string): Promise<void>;
  clearAdvanced(): void;
}

export function useAdvanced(ctx: RunContext | null, lang: Language): AdvancedApi {
  const [advanced, setAdvanced] = useState<Record<string, GestureResult>>({});

  const advancedRun = useCallback(
    async (id: string): Promise<void> => {
      if (ctx === null) return;
      let captured: GestureResult = { outcome: 'info', detail: '' };
      await play(ctx, DEMO_EXTRA[lang].labels[id] ?? id, async (world) => {
        captured = await runAdvanced(world, id, lang);
        return captured;
      });
      setAdvanced((current) => ({ ...current, [id]: captured }));
    },
    [ctx, lang],
  );

  const clearAdvanced = useCallback(() => setAdvanced({}), []);

  return { advanced, advancedRun, clearAdvanced };
}
