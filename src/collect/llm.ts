/**
 * Souche — adaptateur : Forge LLMs, texte seulement : import des critères et rapprochement tests ↔ critères (SPEC §8.2, §11, §19).
 *
 * Propriétaire : lot L9 (docs/CONTRACTS.md). C'est le seul endroit du dépôt
 * autorisé à importer `@forge/api` / `@forge/llm` : le domaine reste pur.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { LlmGateway } from '../ports.js';
import { stubOf } from '../db/stub.js';

export function createLlmGateway(): LlmGateway {
  return stubOf<LlmGateway>('createLlmGateway', 'L9');
}
