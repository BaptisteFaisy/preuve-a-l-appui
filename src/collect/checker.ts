/**
 * Souche — adaptateur : vérifications hors Jira : page Confluence, pièce jointe, section de compte rendu, lien joignable (SPEC §9.1).
 *
 * Propriétaire : lot L9 (docs/CONTRACTS.md). C'est le seul endroit du dépôt
 * autorisé à importer `@forge/api` / `@forge/llm` : le domaine reste pur.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { EvidenceChecker } from '../ports.js';
import { stubOf } from '../db/stub.js';

export function createEvidenceChecker(): EvidenceChecker {
  return stubOf<EvidenceChecker>('createEvidenceChecker', 'L9');
}
