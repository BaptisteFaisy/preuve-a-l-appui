/**
 * Construction d'un `AppDeps` de test pour les handlers du lot L3.
 *
 * Un seul endroit (zéro duplication) : assemble le vrai moteur de couverture
 * ou un double, les fakes du harness partagé et une horloge injectée.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../../src/deps.js';
import type { CoverageEngine } from '../../src/ports.js';
import {
  createFakeClock,
  createFakeIds,
  createRecordingLogger,
  type FakeClock,
  type RecordingLogger,
} from '../helpers/fake-clock.js';
import {
  createFakeCoverageEngine,
  createFakeEvidenceChecker,
  createFakeIdentity,
  createFakeJira,
  createFakeLlm,
  createFakeQueue,
  type FakeJira,
} from '../helpers/fake-gateways.js';
import type { FakeStore } from '../helpers/fake-store.js';

export interface L3TestDeps {
  deps: AppDeps;
  clock: FakeClock;
  logger: RecordingLogger;
}

/** `AppDeps` complet câblé sur les fakes ; `coverage` permet d'injecter le moteur réel. */
export function buildL3Deps(
  store: FakeStore,
  jira: FakeJira = createFakeJira(),
  coverage?: CoverageEngine,
): L3TestDeps {
  const clock = createFakeClock();
  const logger = createRecordingLogger();
  const deps: AppDeps = {
    store,
    coverage: coverage ?? createFakeCoverageEngine(store),
    jira,
    checker: createFakeEvidenceChecker(),
    llm: createFakeLlm(),
    identity: createFakeIdentity(),
    queue: createFakeQueue(),
    clock,
    ids: createFakeIds('id'),
    logger,
  };
  return { deps, clock, logger };
}
