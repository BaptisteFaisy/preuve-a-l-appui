/**
 * Graphe de dépendances : un seul endroit où le runtime Forge est construit.
 *
 * Les handlers reçoivent `AppDeps` et n'importent jamais `@forge/*` eux-mêmes :
 * c'est ce qui permet de tout tester avec les fakes de `tests/helpers/`
 * (docs/CONTRACTS.md §5). Fichier gelé.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SqlClient } from './db/sql-client.js';
import { createForgeSqlClient } from './db/sql-client.js';
import { createStore } from './db/repo.js';
import { createJiraGateway } from './collect/jira.js';
import { createEvidenceChecker } from './collect/checker.js';
import { createLlmGateway } from './collect/llm.js';
import { createIdentityGateway } from './collect/identity.js';
import { createCoverageEngine } from './domain/coverage-engine.js';
import type {
  Clock,
  CoverageEngine,
  EvidenceChecker,
  IdentityGateway,
  IdGenerator,
  JiraGateway,
  JobQueue,
  LlmGateway,
  Logger,
  ProofStore,
} from './ports.js';

/** Tout ce dont un handler a besoin, injecté, jamais global. */
export interface AppDeps {
  store: ProofStore;
  /** Recalcul de la couverture — implémenté par le lot L3 (SPEC §12.3). */
  coverage: CoverageEngine;
  jira: JiraGateway;
  checker: EvidenceChecker;
  llm: LlmGateway;
  identity: IdentityGateway;
  queue: JobQueue;
  clock: Clock;
  ids: IdGenerator;
  logger: Logger;
}

/** Horloge réelle : tous les horodatages de l'app passent par là. */
export const systemClock: Clock = { now: () => new Date().toISOString() };

/** Identifiants réels : préfixe + date + aléa, lisibles dans les logs. */
export function createSystemIds(): IdGenerator {
  let counter = 0;
  return {
    next(prefix: string) {
      counter += 1;
      const stamp = Date.now().toString(36);
      const spin = counter.toString(36).padStart(3, '0');
      return `${prefix}_${stamp}${spin}`;
    },
  };
}

/** Journal préfixé, pour retrouver l'app dans les logs Forge. */
export function createLogger(): Logger {
  const line = (message: string) => `[preuve-a-l-appui] ${message}`;
  return {
    log(level, message, meta) {
      if (level === 'error') console.error(line(message), meta ?? '');
      else if (level === 'warn') console.warn(line(message), meta ?? '');
      else console.log(line(message), meta ?? '');
    },
  };
}

/** Construit le graphe réel ; `queue` vient de l'appelant (module Forge). */
export function createAppDeps(queue: JobQueue, sql?: SqlClient): AppDeps {
  const client = sql ?? createForgeSqlClient();
  const clock = systemClock;
  const logger = createLogger();
  const store = createStore(client);
  return {
    store,
    coverage: createCoverageEngine({ store, clock, logger }),
    jira: createJiraGateway(),
    checker: createEvidenceChecker(),
    llm: createLlmGateway(),
    identity: createIdentityGateway(),
    queue,
    clock,
    ids: createSystemIds(),
    logger,
  };
}
