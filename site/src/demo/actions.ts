/**
 * Les gestes de la démo : chacun appelle le VRAI handler de l'app.
 *
 * Aucune règle n'est réimplémentée ici — ce fichier ne fait qu'appeler
 * `src/handlers/*` et `src/domain/*` avec les doubles en mémoire de la suite de
 * tests, puis relire la couverture que le moteur a rangée. C'est ce qui fait
 * que la démo prouve quelque chose : si une règle change dans l'app, la démo
 * change avec elle.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { GateMode, GateVerdict, Language } from '../../../src/types.js';
import type { DemoWorld } from './world.js';
import { ISSUE_ID, ISSUE_KEY, PROJECT_ID } from './world.js';

/** Une ligne du journal de la démo : ce que l'app a fait, et pourquoi. */
export interface DemoLogEntry {
  readonly id: number;
  readonly label: string;
  readonly detail: string;
  readonly outcome: 'ok' | 'refused' | 'info';
}

/** Résultat d'un geste : réussi, refusé (avec la raison) ou informatif. */
export interface GestureResult {
  readonly outcome: 'ok' | 'refused' | 'info';
  readonly detail: string;
}

const ok = (detail: string): GestureResult => ({ outcome: 'ok', detail });
const refused = (detail: string): GestureResult => ({ outcome: 'refused', detail });
const info = (detail: string): GestureResult => ({ outcome: 'info', detail });

/** Réponse d'un geste du panneau : `{ ok, reason? }` ou `{ ok, … }`. */
interface GestureResponse {
  ok?: boolean;
  reason?: string;
  strength?: string;
  waiverId?: string;
  attestationId?: string;
  evidenceId?: string;
}

function describe(response: unknown, successText: string): GestureResult {
  const res = (response ?? {}) as GestureResponse;
  if (res.ok === false) return refused(res.reason || 'refusé');
  if (res.strength) return ok(`${successText} — force obtenue : ${res.strength}`);
  return ok(successText);
}

/** Attache un test à un critère, comme le ferait l'agent ou le développeur. */
export async function attachTest(
  world: DemoWorld,
  criterionId: string,
  testName: string,
  actorId: string,
): Promise<GestureResult> {
  const response = await world.resolver.call('attach-evidence', {
    issueId: ISSUE_ID,
    projectId: PROJECT_ID,
    accountId: actorId,
    criterionId,
    type: 'test',
    reference: testName,
  });
  return describe(response, `test « ${testName} » attaché`);
}

/** Atteste un critère : l'indépendance est vérifiée par le domaine (§9.4). */
export async function attest(
  world: DemoWorld,
  criterionId: string,
  actorId: string,
): Promise<GestureResult> {
  const response = await world.resolver.call('attest-criterion', {
    issueId: ISSUE_ID,
    projectId: PROJECT_ID,
    accountId: actorId,
    criterionId,
    note: 'Vérifié à la main sur l’environnement de démo.',
  });
  return describe(response, 'attestation enregistrée');
}

/** Déroge un critère : motif et rôle vérifiés par le domaine (§12.4). */
export async function waive(
  world: DemoWorld,
  criterionId: string,
  reason: string,
  actorId: string,
): Promise<GestureResult> {
  const response = await world.resolver.call('waive-criterion', {
    issueId: ISSUE_ID,
    projectId: PROJECT_ID,
    accountId: actorId,
    criterionId,
    reason,
  });
  return describe(response, 'dérogation accordée');
}

/** Fait arriver un résumé de CI : le consommateur réel met à jour les preuves. */
export async function runPipeline(world: DemoWorld, mainBranch: boolean): Promise<GestureResult> {
  const summary = { ...world.scenario.ciSummary, mainBranch };
  await world.ci({ runId: `run-demo-${Date.now()}`, projectId: PROJECT_ID, summary });
  const coverage = await world.recompute();
  const detail = coverage
    ? `pipeline traité : ${coverage.proven} / ${coverage.total} critères prouvés`
    : 'pipeline traité';
  return info(detail);
}

/** Tente la transition vers « Terminé » : verdict réel du validateur. */
export async function tryDone(world: DemoWorld, mode?: GateMode): Promise<GateVerdict> {
  return world.transition(mode);
}

/** Change le mode du projet (strict / souple / observation) via le panneau. */
export async function setMode(world: DemoWorld, mode: GateMode): Promise<GestureResult> {
  await world.resolver.call('save-project-settings', { projectId: PROJECT_ID, mode });
  return info(`mode du projet : ${mode}`);
}

/** Change la langue du projet : les messages de l'app suivent (§20). */
export async function setLanguage(world: DemoWorld, language: Language): Promise<void> {
  await world.resolver.call('save-project-settings', { projectId: PROJECT_ID, language });
}

/** Interroge l'agent : `get-proof-status` via MCP, marqué agent (§15, §19). */
export async function askAgent(world: DemoWorld, actorId: string): Promise<GestureResult> {
  const context = world.agentContext(actorId);
  const answer = (await world.tool('get-proof-status', { issueKey: ISSUE_KEY }, context)) as {
    proven?: number;
    total?: number;
    failing?: readonly { code?: string; expected?: string }[];
  };
  const failing = (answer.failing ?? []).map((item) => item.code ?? '?').join(', ');
  return info(
    `agent : ${answer.proven ?? 0} / ${answer.total ?? 0} prouvés` +
      (failing ? ` — manquants : ${failing}` : ' — rien ne manque'),
  );
}

/** Un agent tente d'attester via MCP : refus explicite (§15, §22 point 11). */
export async function agentTriesToAttest(
  world: DemoWorld,
  criterionId: string,
  actorId: string,
): Promise<GestureResult> {
  const context = world.agentContext(actorId);
  try {
    await world.tool(
      'attach-evidence',
      { issueKey: ISSUE_KEY, criterionId, type: 'attestation', reference: 'self-attested' },
      context,
    );
    return ok('accepté (inattendu)');
  } catch (error) {
    return refused(error instanceof Error ? error.message : String(error));
  }
}
