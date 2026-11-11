/**
 * Câblage de test du lot L4 : un `AppDeps` complet bâti à partir des fakes
 * partagés, et une requête de web trigger correctement signée.
 *
 * `tests/helpers/` est gelé : ce fichier vit dans la zone du lot
 * (`tests/ingest/`) et n'est jamais recopié ailleurs (zéro duplication).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../../src/deps.js';
import type { CiWebRequest } from '../../src/handlers/ingest.js';
import { computeHmacSha256 } from '../../src/ingest/signature.js';
import { hashCiKey } from '../../src/ingest/webtrigger.js';
import { FIXED_NOW } from '../helpers/fake-clock.js';
import type { Pay123Scenario } from '../helpers/scenario.js';

/** L'instant fixe des tests : l'horloge réelle n'est jamais lue. */
export const NOW_ISO = FIXED_NOW;

/** La clé de projet utilisée par les tests ; seule son empreinte est en base. */
export const CI_KEY = 'ci-key-pay-project';

/** Empreinte rangée dans `settings.ciKeyHash` (SPEC §10). */
export const CI_KEY_HASH = hashCiKey(CI_KEY);

/** Horodatage frais, en secondes, aligné sur l'horloge fixe des tests. */
export const FRESH_TIMESTAMP = String(Math.floor(Date.parse(NOW_ISO) / 1000));

/** `AppDeps` complet à partir du scénario PAY-123 (tous les ports sont des fakes). */
export function depsFromScenario(scenario: Pay123Scenario): AppDeps {
  return {
    store: scenario.store,
    coverage: scenario.coverage,
    jira: scenario.jira,
    checker: scenario.checker,
    llm: scenario.llm,
    identity: scenario.identity,
    queue: scenario.queue,
    clock: scenario.clock,
    ids: scenario.ids,
    logger: scenario.logger,
  };
}

export interface SignedRequestOptions {
  readonly key?: string;
  readonly timestamp?: string;
  readonly signature?: string;
  readonly method?: string;
  readonly path?: string;
  readonly query?: Record<string, string>;
  readonly extraHeaders?: Record<string, string>;
}

/** Construit une requête de web trigger signée (ou volontairement mal signée). */
export function signedRequest(body: string, options: SignedRequestOptions = {}): CiWebRequest {
  const key = options.key ?? CI_KEY;
  const timestamp = options.timestamp ?? FRESH_TIMESTAMP;
  const signature = options.signature ?? computeHmacSha256(key, timestamp, body);
  return {
    method: options.method ?? 'POST',
    path: options.path ?? '/ci-results',
    headers: {
      'content-type': 'application/json',
      'x-ci-key': key,
      'x-ci-timestamp': timestamp,
      'x-ci-signature': signature,
      ...(options.extraHeaders ?? {}),
    },
    body,
    query: options.query ?? {},
  };
}
