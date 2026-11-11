/**
 * Registre des sept outils Rovo / MCP (SPEC §15).
 *
 * Une ligne par clé d'action : verbe, entrées déclarées exactement comme le
 * `manifest.yml` gelé (types limités à string / integer / number / boolean,
 * SPEC §19), et l'implémentation. `dispatch.ts` route via cette table.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps.js';
import type { ActorContext } from '../ports.js';
import { attachEvidence } from './attach-evidence.js';
import { getProofStatus } from './get-proof-status.js';
import { getReleaseProof } from './get-release-proof.js';
import { listCriteria } from './list-criteria.js';
import { proposeCriteria } from './propose-criteria.js';
import { requestAttestation } from './request-attestation.js';
import { suggestEvidence } from './suggest-evidence.js';

/** Les sept clés du SPEC §15, dans l'ordre du tableau. */
export const ACTION_KEYS = [
  'list-criteria',
  'get-proof-status',
  'attach-evidence',
  'propose-criteria',
  'request-attestation',
  'suggest-evidence',
  'get-release-proof',
] as const;

export type ActionKey = (typeof ACTION_KEYS)[number];

/** Types d'entrée autorisés par Rovo (SPEC §19) + `csv` pour les listes. */
export type InputKind = 'string' | 'integer' | 'number' | 'boolean' | 'csv';

export interface ActionInputSpec {
  readonly name: string;
  readonly kind: InputKind;
  readonly required: boolean;
}

export type ActionHandler = (
  payload: Record<string, unknown>,
  deps: AppDeps,
  context: ActorContext,
) => Promise<unknown>;

export interface ActionTool {
  readonly key: ActionKey;
  /** Verbe déclaré au manifest : GET lit, CREATE écrit (SPEC §15). */
  readonly verb: 'GET' | 'CREATE';
  readonly inputs: readonly ActionInputSpec[];
  readonly run: ActionHandler;
}

function requiredString(name: string): ActionInputSpec {
  return { name, kind: 'string', required: true };
}

function optionalString(name: string): ActionInputSpec {
  return { name, kind: 'string', required: false };
}

/** Entrée `csv` : chaîne séparée par des virgules au manifest (SPEC §19). */
function requiredCsv(name: string): ActionInputSpec {
  return { name, kind: 'csv', required: true };
}

export const ACTION_TOOLS: Readonly<Record<ActionKey, ActionTool>> = {
  'list-criteria': {
    key: 'list-criteria',
    verb: 'GET',
    inputs: [requiredString('issueKey')],
    run: listCriteria,
  },
  'get-proof-status': {
    key: 'get-proof-status',
    verb: 'GET',
    inputs: [requiredString('issueKey')],
    run: getProofStatus,
  },
  'attach-evidence': {
    key: 'attach-evidence',
    verb: 'CREATE',
    inputs: [
      requiredString('issueKey'),
      requiredString('criterionId'),
      requiredString('type'),
      requiredString('reference'),
      optionalString('note'),
    ],
    run: attachEvidence,
  },
  'propose-criteria': {
    key: 'propose-criteria',
    verb: 'CREATE',
    inputs: [requiredString('issueKey'), requiredCsv('criteria')],
    run: proposeCriteria,
  },
  'request-attestation': {
    key: 'request-attestation',
    verb: 'CREATE',
    inputs: [requiredString('issueKey'), requiredString('criterionId'), requiredString('what')],
    run: requestAttestation,
  },
  'suggest-evidence': {
    key: 'suggest-evidence',
    verb: 'GET',
    inputs: [requiredString('issueKey'), requiredCsv('testNames')],
    run: suggestEvidence,
  },
  'get-release-proof': {
    key: 'get-release-proof',
    verb: 'GET',
    inputs: [requiredString('versionId')],
    run: getReleaseProof,
  },
};

/** Vrai si `name` est l'une des sept clés d'action. */
export function isActionKey(name: string): name is ActionKey {
  return (ACTION_KEYS as readonly string[]).includes(name);
}
