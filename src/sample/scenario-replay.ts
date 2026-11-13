/**
 * Rejeu d'un scénario de démonstration (lot `bootstrap-scenario`).
 *
 * Le socle gelé `src/sample/scenario.ts` dit la FORME d'une histoire de ticket ;
 * ce fichier sait la JOUER : des critères propres au ticket, des preuves de
 * plusieurs types, des gestes humains, des paires test ↔ critère, des
 * révisions de critère.
 *
 * Trois règles tiennent :
 * - le domaine tranche (SPEC §9.4, §12.4) : une attestation ou une dérogation
 *   refusée n'est **pas** écrite, et le résultat dit combien ont été refusées ;
 * - une preuve d'amorçage reste **déclarée** : c'est le vrai web trigger
 *   `ci-results` qui la fera monter en `machine-verified` (SPEC §9.1) ;
 * - une révision passe par le domaine (`changeCriterionText`) : version 2 du
 *   critère et preuves antérieures passées « à revoir » (SPEC §8.4).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { AppDeps } from '../deps';
import type {
  Actor,
  Attestation,
  Criterion,
  Evidence,
  IssueRef,
  ProjectSettings,
  TestLink,
  Waiver,
} from '../types';
import { changeCriterionText } from '../domain/criteria-change';
import { canAttest } from '../domain/independence';
import { confirmLink } from '../domain/matching';
import { validateWaiverCandidate } from '../domain/waivers';
import { emptyScenario } from './scenario';
import type { DemoScenario, ScenarioAttestation, ScenarioWaiver } from './scenario';

/**
 * Les gestes humains de la démo : des attestations et des dérogations, avec la
 * personne qui les a faites. Ancien champ `flow` du corps d'amorçage, encore
 * accepté : il reste prioritaire pour les gestes.
 */
export interface BootstrapFlow {
  /** Attestations : le code du critère et le compte qui atteste. */
  readonly attest?: readonly { readonly code: string; readonly accountId: string }[];
  /** Dérogations : le code du critère, le compte, son rôle et le motif. */
  readonly waive?: readonly {
    readonly code: string;
    readonly accountId: string;
    readonly role: string;
    readonly reason: string;
  }[];
}

/** Gestes demandés : écrits, et refusés (le domaine a tranché). */
export interface GestureOutcome {
  /** Gestes réellement écrits. */
  readonly written: number;
  /** Gestes refusés : rien n'a été écrit pour ceux-là. */
  readonly refused: number;
}

/** Le rejeu des révisions : les critères à jour, et le nombre de versions créées. */
export interface RevisionOutcome {
  readonly criteria: Criterion[];
  readonly count: number;
}

/** Note d'attestation quand le scénario n'en donne pas. */
const DEFAULT_ATTESTATION_NOTE = 'Attestation verifiee manuellement.';

/** Justification des paires test ↔ critère (SPEC §11). */
const LINK_RATIONALE = 'Rattachement proposé par l’agent, confirmé par l’opérateur.';

/** Identifiants dérivés du ticket réel : deux tickets ne se marchent pas dessus. */
export function rekey(issueId: string, sampleId: string): string {
  return `${issueId}-${sampleId}`;
}

/**
 * Le scénario effectif : le champ `flow` (héritage) reste prioritaire pour les
 * attestations et les dérogations ; le scénario fournit le reste (critères,
 * preuves, paires, révisions). Sans `flow`, les gestes viennent du scénario.
 */
export function mergeScenario(
  flow: BootstrapFlow | undefined,
  scenario: DemoScenario | undefined,
): DemoScenario {
  const base = scenario ?? emptyScenario();
  if (flow === undefined) return base;
  return {
    ...base,
    attest: (flow.attest ?? []).map((one) => ({
      code: one.code,
      accountId: one.accountId,
      note: '',
    })),
    waive: (flow.waive ?? []).map((one) => ({
      code: one.code,
      accountId: one.accountId,
      role: one.role,
      reason: one.reason,
    })),
  };
}

/** Les critères du scénario, rattachés au ticket réel. */
/**
 * Une empreinte courte et stable du texte du critère : deux histoires
 * différentes n'ont jamais le même identifiant, donc l'ancienne ne peut pas
 * être écrasée par la nouvelle (elle est « superseded », SPEC §8.3). Rejouer
 * le même scénario donne les mêmes identifiants : l'amorçage reste
 * idempotent.
 */
function storyTag(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).slice(0, 6);
}

export function criteriaFromScenario(
  issue: IssueRef,
  author: string,
  at: string,
  scenario: DemoScenario,
): Criterion[] {
  return scenario.criteria.map((criterion) => ({
    id: rekey(issue.id, `crit-${criterion.code}-${storyTag(criterion.text)}`),
    issueId: issue.id,
    code: criterion.code,
    text: criterion.text,
    type: criterion.type,
    requiredStrength: criterion.requiredStrength,
    version: 1,
    status: criterion.status,
    createdBy: author,
    createdAt: at,
    updatedAt: at,
  }));
}

/**
 * Les preuves du scénario, rattachées au ticket réel et laissées
 * **déclarées** : c'est le vrai web trigger `ci-results` qui les fera monter en
 * `machine-verified` (SPEC §9.1). Qui les a attachées suit le scénario :
 * l'agent, ou la personne du ticket.
 */
export function evidencesFromScenario(
  issue: IssueRef,
  author: string,
  developer: string,
  at: string,
  scenario: DemoScenario,
  criteria: readonly Criterion[],
): Evidence[] {
  const byCode = new Map(criteria.map((criterion) => [criterion.code, criterion]));
  const evidences: Evidence[] = [];
  scenario.evidences.forEach((wanted, index) => {
    const criterion = byCode.get(wanted.criterion);
    if (criterion === undefined) return;
    const byAgent = wanted.addedBy === 'agent';
    evidences.push({
      id: rekey(issue.id, `ev-${wanted.criterion}-${index + 1}`),
      criterionId: criterion.id,
      criterionVersion: criterion.version,
      type: wanted.type,
      reference: wanted.reference,
      note: wanted.note,
      strength: 'declared',
      commit: '',
      freshness: 'fresh',
      verified: false,
      addedBy: byAgent ? author : developer,
      addedByAgent: byAgent,
      at,
      replacedBy: '',
    });
  });
  return evidences;
}

/**
 * Les paires test ↔ critère : celles du scénario quand il en donne (statut
 * `proposed` ou `confirmed`), sinon celles déduites des preuves de test.
 */
export async function applyTestLinks(
  deps: AppDeps,
  criteria: readonly Criterion[],
  evidences: readonly Evidence[],
  scenario: DemoScenario,
): Promise<number> {
  if (scenario.links.length > 0) {
    return applyScenarioLinks(deps, criteria, scenario);
  }
  return applyDeducedLinks(deps, criteria, evidences);
}

/** Les paires du scénario, avec le statut qu'il demande. */
async function applyScenarioLinks(
  deps: AppDeps,
  criteria: readonly Criterion[],
  scenario: DemoScenario,
): Promise<number> {
  let count = 0;
  const at = deps.clock.now();
  for (const wanted of scenario.links) {
    const criterion = criteria.find((one) => one.code === wanted.code);
    if (criterion === undefined) continue;
    const link: TestLink = {
      id: deps.ids.next('lnk'),
      criterionId: criterion.id,
      testName: wanted.testName,
      status: 'proposed',
      confidence: 0.9,
      rationale: LINK_RATIONALE,
      confirmedBy: '',
      at,
    };
    const saved =
      wanted.status === 'confirmed' ? confirmLink(link, criterion.createdBy, at) : link;
    await deps.store.saveLink(saved);
    count += 1;
  }
  return count;
}

/**
 * Les paires déduites des preuves de test (SPEC §11) : c'est ce qui fait vivre
 * une preuve après la clôture. L'agent propose, l'opérateur confirme.
 */
async function applyDeducedLinks(
  deps: AppDeps,
  criteria: readonly Criterion[],
  evidences: readonly Evidence[],
): Promise<number> {
  let count = 0;
  for (const evidence of evidences) {
    if (evidence.type !== 'test') continue;
    const criterion = criteria.find((one) => one.id === evidence.criterionId);
    if (criterion === undefined) continue;
    const link = confirmLink(
      {
        id: deps.ids.next('lnk'),
        criterionId: criterion.id,
        testName: evidence.reference,
        status: 'proposed',
        confidence: 0.9,
        rationale: LINK_RATIONALE,
        confirmedBy: '',
        at: deps.clock.now(),
      },
      evidence.addedBy,
      deps.clock.now(),
    );
    await deps.store.saveLink(link);
    count += 1;
  }
  return count;
}

/**
 * Les attestations demandées : le domaine tranche (l'agent et l'assigné ne
 * peuvent pas attester), puis l'app écrit la preuve et l'attestation.
 */
export async function applyAttestations(
  deps: AppDeps,
  issue: IssueRef,
  criteria: readonly Criterion[],
  settings: ProjectSettings,
  attestations: readonly ScenarioAttestation[],
): Promise<GestureOutcome> {
  let written = 0;
  for (const wanted of attestations) {
    const criterion = criteria.find((one) => one.code === wanted.code);
    if (criterion === undefined) continue;
    const roles = await deps.jira.projectRoles(issue.projectId, wanted.accountId);
    const actor: Actor = {
      accountId: wanted.accountId,
      displayName: wanted.accountId,
      agent: false,
      roles,
    };
    if (!canAttest(actor, issue, criterion, settings).allowed) continue;
    await writeAttestation(deps, criterion, wanted, roles);
    written += 1;
  }
  return { written, refused: attestations.length - written };
}

/** La preuve et l'attestation d'un critère attesté par un humain. */
async function writeAttestation(
  deps: AppDeps,
  criterion: Criterion,
  wanted: ScenarioAttestation,
  roles: readonly string[],
): Promise<void> {
  const note = wanted.note.trim() === '' ? DEFAULT_ATTESTATION_NOTE : wanted.note;
  const evidenceId = deps.ids.next('ev');
  const evidence: Evidence = {
    id: evidenceId,
    criterionId: criterion.id,
    criterionVersion: criterion.version,
    type: 'attestation',
    reference: 'manual-check',
    note,
    strength: 'attested',
    commit: '',
    freshness: 'fresh',
    verified: true,
    addedBy: wanted.accountId,
    addedByAgent: false,
    at: deps.clock.now(),
    replacedBy: '',
  };
  await deps.store.saveEvidence(evidence);
  const attestation: Attestation = {
    id: deps.ids.next('att'),
    criterionId: criterion.id,
    evidenceId,
    attesterAccountId: wanted.accountId,
    role: roles[0] ?? '',
    note,
    attachmentRef: '',
    at: deps.clock.now(),
  };
  await deps.store.addAttestation(attestation);
}

/**
 * Les dérogations demandées : le domaine tranche (rôle autorisé, motif
 * obligatoire), puis l'app écrit la dérogation.
 */
export async function applyWaivers(
  deps: AppDeps,
  issue: IssueRef,
  criteria: readonly Criterion[],
  settings: ProjectSettings,
  waivers: readonly ScenarioWaiver[],
): Promise<GestureOutcome> {
  let written = 0;
  for (const wanted of waivers) {
    const criterion = criteria.find((one) => one.code === wanted.code);
    if (criterion === undefined) continue;
    const roles = await deps.jira.projectRoles(issue.projectId, wanted.accountId);
    const verdict = validateWaiverCandidate({
      criterionId: criterion.id,
      grantedBy: wanted.accountId,
      role: wanted.role,
      reason: wanted.reason,
      actorIsAgent: false,
      actorRoles: roles,
      rolesPolicy: settings.roles,
    });
    if (!verdict.valid) continue;
    await deps.store.saveWaiver(waiverOf(deps, criterion, wanted));
    written += 1;
  }
  return { written, refused: waivers.length - written };
}

/** La dérogation accordée, telle qu'elle est rangée. */
function waiverOf(deps: AppDeps, criterion: Criterion, wanted: ScenarioWaiver): Waiver {
  return {
    id: deps.ids.next('wv'),
    criterionId: criterion.id,
    grantedBy: wanted.accountId,
    role: wanted.role,
    reason: wanted.reason,
    at: deps.clock.now(),
    expiresAt: '',
    revokedAt: '',
  };
}

/**
 * Les révisions demandées : le domaine change le texte (version 2) et passe
 * les preuves antérieures en « à revoir » (SPEC §8.4). L'agent du cast porte
 * la trace du changement.
 */
export async function applyRevisions(
  deps: AppDeps,
  criteria: readonly Criterion[],
  scenario: DemoScenario,
  actor: Actor,
): Promise<RevisionOutcome> {
  const updated = [...criteria];
  let count = 0;
  for (const wanted of scenario.revisions) {
    const index = updated.findIndex((one) => one.code === wanted.code);
    if (index < 0) continue;
    const result = await changeCriterionText(
      { criterion: updated[index], newText: wanted.text, actor },
      {
        saveCriterion: (criterion) => deps.store.saveCriterion(criterion),
        addCriterionRevision: (revision) => deps.store.addCriterionRevision(revision),
        evidence: deps.store,
        clock: deps.clock,
      },
    );
    if (!result.changed) continue;
    updated[index] = result.criterion;
    count += 1;
  }
  return { criteria: updated, count };
}

/**
 * Ce que devient l'ancienne histoire d'un ticket quand le scénario la
 * remplace : ses critères passent « superseded » (SPEC §8.3 — ils restent,
 * rien n'est supprimé, SPEC §20), ses dérogations sont **révoquées** et ses
 * paires test ↔ critère **rejetées**. Les preuves et attestations de l'ancienne
 * version restent en base mais ne comptent plus : elles appartiennent à des
 * critères qui ne sont plus actifs.
 */
export interface SupersededStory {
  readonly criteria: number;
  readonly waivers: number;
  readonly links: number;
}

/** Les paires de l'ancienne histoire : elles ne doivent plus rien prouver. */
async function rejectPreviousLinks(
  deps: AppDeps,
  previous: readonly Criterion[],
): Promise<number> {
  let count = 0;
  for (const criterion of previous) {
    const links = await deps.store.listLinksByCriterion(criterion.id);
    for (const link of links) {
      if (link.status === 'rejected') continue;
      await deps.store.saveLink({ ...link, status: 'rejected' });
      count += 1;
    }
  }
  return count;
}

/** Les dérogations de l'ancienne histoire : révoquées, donc plus comptées. */
async function revokePreviousWaivers(deps: AppDeps, issue: IssueRef): Promise<number> {
  const waivers = await deps.store.listWaiversByIssue(issue.id);
  let count = 0;
  for (const waiver of waivers) {
    if (waiver.revokedAt !== '') continue;
    await deps.store.revokeWaiver(waiver.id, deps.clock.now());
    count += 1;
  }
  return count;
}

/** L'ancienne histoire prend fin ; la nouvelle s'écrit à côté, jamais dessus. */
export async function supersedePreviousStory(
  deps: AppDeps,
  issue: IssueRef,
  previous: readonly Criterion[],
): Promise<SupersededStory> {
  let criteria = 0;
  for (const criterion of previous) {
    if (criterion.status === 'superseded') continue;
    await deps.store.saveCriterion({ ...criterion, status: 'superseded' });
    criteria += 1;
  }
  const waivers = await revokePreviousWaivers(deps, issue);
  const links = await rejectPreviousLinks(deps, previous);
  return { criteria, waivers, links };
}

/**
 * Vrai si le scénario remplace l'histoire déjà écrite : les codes ou les
 * textes ne sont pas les mêmes. Un scénario identique ne touche à rien.
 */
export function scenarioReplacesStory(
  previous: readonly Criterion[],
  scenario: DemoScenario,
): boolean {
  if (scenario.criteria.length === 0) return false;
  if (previous.length === 0) return false;
  const wanted = new Map(scenario.criteria.map((criterion) => [criterion.code, criterion.text]));
  return previous.some(
    (criterion) => wanted.get(criterion.code) !== criterion.text,
  );
}
