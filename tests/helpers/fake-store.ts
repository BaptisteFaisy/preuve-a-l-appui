/**
 * Faux `ProofStore` complet en mémoire (Map/Array, zéro dépendance).
 *
 * Un seul endroit assemble les neuf interfaces de stockage de `src/ports.ts`,
 * chacune dans son fichier par zone (comme `src/db/*`) :
 * `fake-store-criteria`, `-evidence`, `-project`, `-ci`, `-insights`.
 *
 * Accès pour les assertions :
 * - `store.__tables.<table>` : les tables brutes (`criteria`, `evidence`, …) ;
 * - `store.linkIssue()` : relie un ticket à un projet (listes par projet) ;
 * - `store.recordClosed()` : déclare un ticket clos hors validateur ;
 * - `store.seedStats()` : force un jeu de statistiques exact ;
 * - `store.clear()` : vide tout entre deux tests.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ProofStore } from '../../src/ports.js';
import type { ProofStats } from '../../src/types.js';
import { livingStore, testLinkStore, testRunStore } from './fake-store-ci.js';
import { createTables, type FakeStoreTables } from './fake-store-core.js';
import { criterionStore } from './fake-store-criteria.js';
import { evidenceStore } from './fake-store-evidence.js';
import { reportingStore } from './fake-store-insights.js';
import { coverageStore, settingsStore, waiverStore } from './fake-store-project.js';

export interface FakeStore extends ProofStore {
  /** Tables internes : ce qui est écrit se lit directement en test. */
  readonly __tables: FakeStoreTables;
  /** Relie un ticket (id **ou** clé) à un projet. */
  linkIssue(issueIdOrKey: string, projectId: string): FakeStore;
  /** Déclare un ticket clos (contrôle nocturne, SPEC §20). */
  recordClosed(issueId: string, projectId: string): FakeStore;
  /** Force les statistiques d'un projet. */
  seedStats(stats: ProofStats): FakeStore;
  /** Vide toutes les tables. */
  clear(): FakeStore;
}

export function createFakeStore(): FakeStore {
  const tables = createTables();
  const store: FakeStore = {
    __tables: tables,
    ...criterionStore(tables),
    ...evidenceStore(tables),
    ...waiverStore(tables),
    ...coverageStore(tables),
    ...settingsStore(tables),
    ...testRunStore(tables),
    ...testLinkStore(tables),
    ...livingStore(tables),
    ...reportingStore(tables),
    linkIssue(issueIdOrKey, projectId) {
      tables.issueProject.set(issueIdOrKey, projectId);
      return store;
    },
    recordClosed(issueId, projectId) {
      tables.closedIssues.set(issueId, projectId);
      return store;
    },
    seedStats(stats) {
      tables.seededStats.set(stats.projectId, stats);
      return store;
    },
    clear() {
      for (const table of Object.values(tables)) table.clear();
      return store;
    },
  };
  return store;
}
