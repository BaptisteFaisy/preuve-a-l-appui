/**
 * Souche — adaptateur : identité de l'appelant : humain ou agent, tout appel MCP est marqué agent (SPEC §15, §19).
 *
 * Propriétaire : lot L9 (docs/CONTRACTS.md). C'est le seul endroit du dépôt
 * autorisé à importer `@forge/api` / `@forge/llm` : le domaine reste pur.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { IdentityGateway } from '../ports.js';
import { stubOf } from '../db/stub.js';

export function createIdentityGateway(): IdentityGateway {
  return stubOf<IdentityGateway>('createIdentityGateway', 'L9');
}
