/**
 * Les gestes avancés de la démo : ceux qui rendent visibles les
 * fonctionnalités que le panneau de base ne montre pas (FP-02, FP-03, FP-13,
 * FP-14, FP-15, FP-17, FP-20, FP-21).
 *
 * Même discipline que `actions.ts` : chaque geste appelle le VRAI module de
 * l'app — action MCP (`world.tool`), geste du panneau (`world.resolver`) ou
 * domaine pur (`src/domain/*`) — sur les doubles en mémoire de la suite de
 * tests. Aucune règle n'est réimplémentée ici. Ce que l'app sait dire elle-même
 * (`result.text`) est affiché tel quel ; le reste passe par les gabarits de
 * `site/src/i18n/demo-extra.ts`, donc dans les deux langues.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Actor, Criterion, Language, ProjectSettings } from '../../../src/types.js';
import { changeCriterionText } from '../../../src/domain/criteria-change.js';
import { validateCriteria } from '../../../src/domain/criteria-import.js';
import { canAttest, designatedRoles } from '../../../src/domain/independence.js';
import { deterministicPairs } from '../../../src/domain/matching.js';
import { competentRole } from '../../../src/actions/request-attestation.js';
import { requiresCrossEvidence } from '../../../src/domain/requirements.js';
import { getOrGenerateDossier } from '../../../src/domain/dossier.js';
import { DEMO_EXTRA, fill } from '../i18n/demo-extra.js';
import type { GestureResult } from './actions.js';
import type { DemoWorld } from './world.js';

/** Un geste avancé : son identifiant et les fonctionnalités qu'il montre. */
export interface AdvancedAction {
  readonly id: string;
  readonly feature: string;
}

export const ADVANCED_ACTIONS: readonly AdvancedAction[] = [
  { id: 'import-criteria', feature: 'FP-02' },
  { id: 'stale-on-change', feature: 'FP-13' },
  { id: 'suggest-pairs', feature: 'FP-14 · FP-20' },
  { id: 'request-attestation', feature: 'FP-15' },
  { id: 'release-proof', feature: 'FP-17' },
  { id: 'other-evidence-types', feature: 'FP-03' },
  { id: 'cross-evidence', feature: 'FP-21' },
];

/** Les tests proposés au rapprochement : ils partagent les mots des critères. */
const PAIR_TEST_NAMES = 'paiement par carte expirée refusé,e mail de refus envoyé au client';

/** La documentation attachée par le geste « autre type de preuve ». */
const DOC_REFERENCE = 'pay/docs/politique-de-remboursement';

/** Ce que renvoie une action MCP : un texte déjà localisé par l'app. */
interface ActionText {
  readonly text?: string;
  readonly strength?: string;
  readonly criteria?: readonly { id: string; code: string }[];
}

const asText = (value: unknown): ActionText => (value ?? {}) as ActionText;
const done = (detail: string): GestureResult => ({ outcome: 'ok', detail });
const note = (detail: string): GestureResult => ({ outcome: 'info', detail });
const denied = (detail: string): GestureResult => ({ outcome: 'refused', detail });

/** Détail composé par le site, dans la langue demandée. */
function say(language: Language, id: string, vars: Record<string, string | number>): string {
  return fill(DEMO_EXTRA[language].details[id] ?? '', vars);
}

/** Refus composé par le site, dans la langue demandée. */
function fail(language: Language, cause: string, vars: Record<string, string | number>): GestureResult {
  return denied(fill(DEMO_EXTRA[language].failures[cause] ?? cause, vars));
}

/** Un acteur humain du scénario, et l'agent, pour les deux contextes Forge. */
function people(world: DemoWorld): { human: Actor; agentId: string } {
  return { human: world.scenario.actors.tester, agentId: world.scenario.actors.agent.accountId };
}

/** Le critère visé par un geste, cherché par son code stable. */
async function criterionByCode(world: DemoWorld, code: string): Promise<Criterion | undefined> {
  const criteria = await world.deps.store.listCriteriaByIssue(world.scenario.issue.id);
  return criteria.find((criterion) => criterion.code === code);
}

/** FP-02 — l'agent propose des critères, un humain les valide (SPEC §8.3). */
async function importCriteria(world: DemoWorld, language: Language): Promise<GestureResult> {
  const { human, agentId } = people(world);
  const answer = asText(
    await world.tool(
      'propose-criteria',
      { issueKey: world.scenario.issue.key, criteria: 'Le motif du refus est journalisé,Un e-mail de refus est envoyé' },
      world.agentContext(agentId),
    ),
  );
  const ids = (answer.criteria ?? []).map((item) => item.id);
  const validated = await validateCriteria(
    ids,
    human,
    { store: world.deps.store, clock: world.deps.clock },
    language,
  );
  await world.recompute();
  return done(
    say(language, 'import-criteria', {
      text: answer.text ?? '',
      codes: validated.map((criterion) => criterion.code).join(', ') || '—',
    }),
  );
}

/** FP-13 — un critère modifié rend ses preuves « à reconfirmer » (SPEC §8.4). */
async function staleOnChange(world: DemoWorld, language: Language): Promise<GestureResult> {
  const { human } = people(world);
  const target = await criterionByCode(world, 'AC-1');
  if (target === undefined) return fail(language, 'unavailable', { what: 'AC-1' });
  const store = world.deps.store;
  const result = await changeCriterionText(
    { criterion: target, newText: `${target.text}, y compris en devises`, actor: human, language },
    {
      saveCriterion: (criterion) => store.saveCriterion(criterion),
      addCriterionRevision: (revision) => store.addCriterionRevision(revision),
      evidence: store,
      clock: world.deps.clock,
    },
  );
  await world.recompute();
  return note(
    say(language, 'stale-on-change', {
      code: target.code,
      version: result.criterion.version,
      count: result.toReconfirmEvidenceIds.length,
    }),
  );
}

/** FP-14 et FP-20 — paires test ↔ critère proposées, à confirmer (SPEC §11). */
async function suggestPairs(world: DemoWorld, language: Language): Promise<GestureResult> {
  const { agentId } = people(world);
  const testNames = PAIR_TEST_NAMES.split(',');
  const answer = await world.tool(
    'suggest-evidence',
    { issueKey: world.scenario.issue.key, testNames: PAIR_TEST_NAMES },
    world.agentContext(agentId),
  );
  const suggested = (answer as { suggestions?: readonly unknown[] }).suggestions ?? [];
  if (suggested.length > 0) return note(asText(answer).text ?? '');
  // Le modèle de la démo ne propose rien : l'app a un repli déterministe,
  // sans réseau (SPEC §19) — c'est lui qui parle ici.
  const criteria = await world.deps.store.listCriteriaByIssue(world.scenario.issue.id, ['active']);
  const pairs = deterministicPairs(criteria, testNames, language);
  const codes = new Map(criteria.map((criterion) => [criterion.id, criterion.code]));
  const listed = pairs
    .map((pair) => `${codes.get(pair.criterionId) ?? '?'} ↔ « ${pair.testName} » (${pair.confidence})`)
    .join(' · ');
  return note(say(language, 'suggest-fallback', { count: pairs.length, pairs: listed || '—' }));
}

/**
 * Le destinataire : celui que le domaine autorise vraiment à attester ce
 * critère (`canAttest`, SPEC §9.4) — jamais l'assigné, jamais un agent. Le
 * rôle affiché est celui que l'app désigne pour ce critère.
 */
function competentRecipient(
  world: DemoWorld,
  settings: ProjectSettings,
  criterion: Criterion,
): { actor: Actor; role: string } | null {
  const issue = world.scenario.issue;
  const cast = world.scenario.actors;
  const candidates: readonly Actor[] = [cast.agent, cast.developer, cast.tester, cast.owner];
  for (const actor of candidates) {
    if (actor.agent) continue;
    if (!canAttest(actor, issue, criterion, settings).allowed) continue;
    const designated = designatedRoles(settings, criterion);
    const role =
      actor.roles.find((held) => designated.includes(held)) ??
      actor.roles.find((held) => settings.roles.attest.includes(held)) ??
      competentRole(settings, criterion);
    return { actor, role };
  }
  return null;
}

/** FP-15 — demande d'attestation au rôle compétent, avec notification (§9.4). */
async function requestAttestation(world: DemoWorld, language: Language): Promise<GestureResult> {
  const settings = await world.deps.store.getSettings(world.scenario.project.projectId);
  const criterion = await criterionByCode(world, 'AC-3');
  if (settings === null || criterion === undefined) {
    return fail(language, 'unavailable', { what: 'AC-3' });
  }
  const recipient = competentRecipient(world, settings, criterion);
  if (recipient === null) {
    return fail(language, 'no-recipient', { roles: designatedRoles(settings, criterion).join(', ') });
  }
  const before = world.scenario.jira.notifications.length;
  await world.resolver.call('request-attestation', {
    issueId: world.scenario.issue.id,
    issueKey: world.scenario.issue.key,
    projectId: world.scenario.project.projectId,
    accountId: recipient.actor.accountId,
    criterionId: criterion.id,
    targetAccount: recipient.actor.accountId,
  });
  return note(
    say(language, 'request-attestation', {
      code: criterion.code,
      who: recipient.actor.displayName,
      role: recipient.role,
      sent: world.scenario.jira.notifications.length - before,
    }),
  );
}

/** FP-17 — le dossier de preuve d'une version, figé puis lu par l'agent (§4). */
async function releaseProof(world: DemoWorld): Promise<GestureResult> {
  const { agentId } = people(world);
  const version = world.scenario.issue.fixVersions[0] ?? '2.4';
  await getOrGenerateDossier(
    {
      store: world.deps.store,
      jira: world.deps.jira,
      clock: world.deps.clock,
      coverage: world.deps.coverage,
    },
    { projectId: world.scenario.project.projectId, projectKey: 'PAY', versionId: version, versionName: version },
  );
  const answer = asText(
    await world.tool('get-release-proof', { versionId: version }, world.agentContext(agentId)),
  );
  return note(answer.text ?? '');
}

/** FP-03 — un autre type de preuve : l'app retient « déclaré », jamais plus. */
async function otherEvidenceTypes(world: DemoWorld, language: Language): Promise<GestureResult> {
  const { human } = people(world);
  const target = await criterionByCode(world, 'AC-4');
  if (target === undefined) return fail(language, 'unavailable', { what: 'AC-4' });
  const answer = asText(
    await world.tool(
      'attach-evidence',
      { issueKey: world.scenario.issue.key, criterionId: target.code, type: 'documentation', reference: DOC_REFERENCE },
      world.panelContext(human.accountId),
    ),
  );
  await world.recompute();
  return note(
    say(language, 'other-evidence-types', { code: target.code, strength: answer.strength ?? 'declared' }),
  );
}

/** FP-21 — preuve croisée : deux types distincts exigés pour un type (§9.2). */
async function crossEvidence(world: DemoWorld, language: Language): Promise<GestureResult> {
  const settings = await world.deps.store.getSettings(world.scenario.project.projectId);
  if (settings === null) return fail(language, 'unavailable', { what: 'settings' });
  const raised = { ...settings.requirements.functional, minDistinctTypes: 2 };
  await world.resolver.call('save-project-settings', {
    projectId: world.scenario.project.projectId,
    requirements: { ...settings.requirements, functional: raised },
  });
  await world.recompute();
  return note(
    `${say(language, 'cross-evidence', { count: raised.minDistinctTypes, type: 'functional' })}` +
      (requiresCrossEvidence(raised) ? '' : ' (!)'),
  );
}

/** Joue un geste avancé ; une erreur de l'app devient un refus explicite. */
export async function runAdvanced(
  world: DemoWorld,
  id: string,
  language: Language,
): Promise<GestureResult> {
  try {
    switch (id) {
      case 'import-criteria':
        return await importCriteria(world, language);
      case 'stale-on-change':
        return await staleOnChange(world, language);
      case 'suggest-pairs':
        return await suggestPairs(world, language);
      case 'request-attestation':
        return await requestAttestation(world, language);
      case 'release-proof':
        return await releaseProof(world);
      case 'other-evidence-types':
        return await otherEvidenceTypes(world, language);
      case 'cross-evidence':
        return await crossEvidence(world, language);
      default:
        return fail(language, 'unknown', { id });
    }
  } catch (error) {
    return denied(error instanceof Error ? error.message : String(error));
  }
}
