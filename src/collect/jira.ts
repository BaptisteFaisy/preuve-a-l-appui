/**
 * Souche — adaptateur : lecture des tickets, réécriture de la section critères, champ de couverture, rôles, notifications (SPEC §8.2, §12.3).
 *
 * Propriétaire : lot L9 (docs/CONTRACTS.md). C'est le seul endroit du dépôt
 * autorisé à importer `@forge/api` / `@forge/llm` : le domaine reste pur.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { JiraGateway } from '../ports.js';
import { stubOf } from '../db/stub.js';

export function createJiraGateway(): JiraGateway {
  return stubOf<JiraGateway>('createJiraGateway', 'L9');
}
