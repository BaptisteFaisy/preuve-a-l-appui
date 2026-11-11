/**
 * Assemblage du `ProofStore` : une fabrique par table, un lot par fabrique.
 *
 * Fichier gelé (docs/CONTRACTS.md §4). Il ne contient aucune requête : chaque
 * adaptateur vit dans son fichier, chez son lot, et partage `SqlClient`.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient } from './sql-client.js';
import type { ProofStore } from '../ports.js';
import { createCriterionStore } from './criteria.js';
import { createEvidenceStore } from './evidence.js';
import { createWaiverStore } from './waivers.js';
import { createCoverageStore } from './coverage.js';
import { createSettingsStore } from './settings.js';
import { createTestRunStore } from './testruns.js';
import { createLivingStore } from './living.js';
import { createTestLinkStore } from './links.js';
import { createReportingStore } from './reporting.js';

/** Le magasin complet de l'app, tel que le voit `createAppDeps`. */
export function createStore(sql: SqlClient): ProofStore {
  return {
    ...createCriterionStore(sql),
    ...createEvidenceStore(sql),
    ...createWaiverStore(sql),
    ...createCoverageStore(sql),
    ...createSettingsStore(sql),
    ...createTestRunStore(sql),
    ...createLivingStore(sql),
    ...createTestLinkStore(sql),
    ...createReportingStore(sql),
  };
}
