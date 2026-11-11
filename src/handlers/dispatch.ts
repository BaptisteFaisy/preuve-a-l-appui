/**
 * Point d'entrée des `action` et `rovo:mcp` (SPEC §15) — lot L5.
 *
 * Rôle : router chaque clé d'action vers son outil (registre `src/actions/`),
 * valider les entrées déclarées au `manifest.yml` gelé, et refuser
 * explicitement tout ce qui permettrait à un agent d'attester, de déroger,
 * de valider un critère ou de modifier la grille d'exigences (SPEC §22 point 11).
 *
 * Le marquage « agent » de tout appel MCP est garanti par le contexte :
 * `context.fromMcp` est posé par `src/index.ts` (fichier gelé) et propagé tel
 * quel aux outils, qui produisent un acteur `agent: true` (SPEC §19).
 *
 * Signature exportée GELÉE (docs/CONTRACTS.md §3) : `runAction(name, payload,
 * deps, context)`. Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { actionText } from '../actions/common.js';
import { ACTION_KEYS, ACTION_TOOLS, isActionKey } from '../actions/registry.js';
import type { ActionKey } from '../actions/registry.js';
import { ActionError } from '../actions/types.js';
import type { AppDeps } from '../deps.js';
import type { ActorContext } from '../ports.js';

export { ACTION_KEYS, ActionError };
export type { ActionKey };

/**
 * Radicaux interdits hors registre (SPEC §15) : attester, déroger, valider,
 * toucher à la grille. `request-attestation` est une clé légitime du registre
 * et n'arrive jamais ici — on ne classe que les noms INCONNUS.
 */
const FORBIDDEN_PATTERN = /attest|waiv|derog|validat|requirement|grille|settings/i;

/** Un nom inconnu qui tente un geste réservé à l'humain : erreur explicite. */
function classifyUnknown(name: string): 'forbidden' | 'unknown' {
  return FORBIDDEN_PATTERN.test(name) ? 'forbidden' : 'unknown';
}

/** Entrées obligatoires : présentes, du bon type, non vides (SPEC §19). */
function validateInputs(key: ActionKey, payload: Record<string, unknown>): void {
  for (const spec of ACTION_TOOLS[key].inputs) {
    const value = payload[spec.name];
    if (!spec.required) continue;
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new ActionError(
        actionText('err.missing.input', 'en', { name: spec.name }),
        `missing-${spec.name}`,
      );
    }
  }
}

/** Exécute un outil. Aucun ne permet d'attester, de déroger ni de valider. */
export async function runAction(
  name: string,
  payload: Record<string, unknown>,
  deps: AppDeps,
  context: ActorContext,
): Promise<unknown> {
  const key = typeof name === 'string' ? name.trim() : '';
  if (!isActionKey(key)) {
    const verdict = classifyUnknown(key);
    const message =
      verdict === 'forbidden'
        ? actionText('err.forbidden.action', 'en')
        : actionText('err.unknown.action', 'en', { name: key });
    throw new ActionError(message, verdict === 'forbidden' ? 'forbidden-action' : 'unknown-action');
  }

  validateInputs(key, payload);
  return ACTION_TOOLS[key].run(payload, deps, context);
}
