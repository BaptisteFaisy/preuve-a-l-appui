/**
 * Assemblage du `ProofStore` : une fabrique par table, un lot par fabrique.
 *
 * Fichier gelé (docs/CONTRACTS.md §4). Il ne contient aucune requête : chaque
 * adaptateur vit dans son fichier, chez son lot, et partage `SqlClient`.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient } from './sql-client';
import type { ProofStore } from '../ports';
import { createCriterionStore } from './criteria';
import { createEvidenceStore } from './evidence';
import { createWaiverStore } from './waivers';
import { createCoverageStore } from './coverage';
import { createSettingsStore } from './settings';
import { createTestRunStore } from './testruns';
import { createLivingStore } from './living';
import { createTestLinkStore } from './links';
import { createReportingStore } from './reporting';

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
