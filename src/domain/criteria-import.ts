/**
 * Import des critères depuis la description (SPEC §8.2, §8.3, FP-02).
 *
 * Trois formes déterministes reconnues **sans LLM** :
 * 1. cases à cocher (`- [ ] …`, `- [x] …`, `* [ ] …`) ;
 * 2. liste sous un titre « Critères d'acceptation » / « Acceptance criteria » ;
 * 3. scénarios « Étant donné … quand … alors … » / « Given … When … Then … ».
 *
 * Le découpage est toujours validé par un humain : un import crée des critères
 * `proposed` quand l'auteur est un agent (`propose-criteria`, SPEC §15) et
 * `active` quand l'auteur est un humain qui valide. Un agent ne peut jamais
 * valider (SPEC §8.3, §19). L'import est idempotent : relire une description
 * déjà importée ne duplique pas les critères déjà tenus par l'app.
 *
 * Domaine pur : aucun import `@forge/*`.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Clock, CriterionStore, IdGenerator, JiraGateway, LlmGateway } from '../ports';
import type {
  Actor,
  Criterion,
  CriterionType,
  IssueRef,
  Language,
  ParsedCriterion,
  ProjectSettings,
} from '../types';
import { criteriaMessage } from '../i18n/criteria';
import {
  buildCriterion,
  inferType,
  nextCode,
  normalizeCriterionText,
  renderCriteriaSection,
  sortCriteriaByCode,
} from './criteria';

/* ------------------------------------------------------------- découpage */

const CRITERIA_HEADING_RE =
  /^(?:#{1,6}\s*|\*{1,2})?\s*(?:crit[eè]res?\s+d['’]acceptation|acceptance\s+criteria)\s*[:*]?\s*$/i;
const ANY_HEADING_RE = /^#{1,6}\s+\S/;
const CHECKBOX_RE = /^\s*[-*+]\s+\[[ xX]\]\s+(.+?)\s*$/;
const BULLET_RE = /^\s*(?:[-*+]|\d+[.)])\s+(.+?)\s*$/;
const CODE_PREFIX_RE = /^\**\s*(AC-\d+)\s*\**\s*(?:[:—–-]\s*|\s+)(.+)$/;
const SECTION_SUMMARY_RE = /^[*_]\s*\d+\s+(?:criterion|critère)/i;
/**
 * Marqueurs de scénario (SPEC §8.2, forme 3). Deux pièges JavaScript dictent
 * leur écriture : le drapeau `i` seul ne replie pas `É` sur `é` sans le
 * drapeau `u`, et `\b` ne reconnaît pas les lettres accentuées comme des
 * lettres — la fin de mot est donc un lookahead Unicode.
 */
const GIVEN_RE = /^(?:[ée]tant donn[ée]|etant donne|soit|given)(?![\p{L}\p{N}])/iu;
const WHEN_RE = /^(?:quand|lorsque|when)(?![\p{L}\p{N}])/iu;
const THEN_RE = /^(?:alors|then)(?![\p{L}\p{N}])/iu;
const AND_RE = /^(?:et|and)(?![\p{L}\p{N}])/iu;
const BULLET_PREFIX_RE = /^\s*[-*+]\s+/;

/** Forme ASCII minuscule d'une ligne : sert à repérer la langue d'un scénario. */
function markerForm(line: string): string {
  return line
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .trim();
}

/** Retire le code, la mise en forme et l'étiquette ajoutés par la section. */
function cleanParsedText(raw: string): string {
  return raw
    .trim()
    .replace(/\s*[—–-]\s*\*\([^)]*\)\*\s*$/i, '')
    .replace(/\s*\*\([^)]*\)\*\s*$/i, '')
    .replace(/^\*\*(.+?)\*\*/, '$1')
    .replace(CODE_PREFIX_RE, '$2')
    .replace(/^\[[a-z-]+\]\s*/i, '')
    .trim();
}

/** Une ligne de description devient un critère candidat, ou rien. */
function toParsed(rawText: string, origin: ParsedCriterion['origin']): ParsedCriterion | null {
  const text = cleanParsedText(rawText);
  if (text.length === 0) return null;
  return { text, type: inferType(text), origin };
}

/** Forme 1 : cases à cocher, où qu'elles soient dans la description. */
function parseCheckboxLines(lines: readonly string[]): ParsedCriterion[] {
  const items: ParsedCriterion[] = [];
  for (const line of lines) {
    const match = CHECKBOX_RE.exec(line);
    if (match?.[1] === undefined) continue;
    const item = toParsed(match[1], 'checkbox');
    if (item !== null) items.push(item);
  }
  return items;
}

/** Forme 2 : puces ou numéros sous un titre « Critères d'acceptation ». */
function parseListUnderHeading(lines: readonly string[]): ParsedCriterion[] {
  const items: ParsedCriterion[] = [];
  let inSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (CRITERIA_HEADING_RE.test(trimmed)) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    if (ANY_HEADING_RE.test(trimmed)) break;
    if (CHECKBOX_RE.test(line) || SECTION_SUMMARY_RE.test(trimmed)) continue;
    const match = BULLET_RE.exec(line);
    if (match?.[1] === undefined) continue;
    const item = toParsed(match[1], 'list');
    if (item !== null) items.push(item);
  }
  return items;
}

type ClauseKind = 'given' | 'when' | 'then';
type ScenarioMarker = ClauseKind | 'and';

interface ScenarioBuffer {
  language: Language;
  parts: string[];
  clauses: Partial<Record<ClauseKind, string[]>>;
}

function newScenarioBuffer(language: Language): ScenarioBuffer {
  return { language, parts: [], clauses: {} };
}

function pushClause(buffer: ScenarioBuffer, clause: ClauseKind, text: string): void {
  const list = buffer.clauses[clause] ?? [];
  list.push(text);
  buffer.clauses[clause] = list;
  buffer.parts.push(text);
}

/** Le marqueur d'une ligne de scénario, ou `null` si ce n'en est pas une. */
function scenarioMarkerOf(body: string): ScenarioMarker | null {
  if (GIVEN_RE.test(body)) return 'given';
  if (WHEN_RE.test(body)) return 'when';
  if (THEN_RE.test(body)) return 'then';
  if (AND_RE.test(body)) return 'and';
  return null;
}

/** La regex du marqueur reconnu, pour retirer son mot de liaison du texte. */
function markerPattern(marker: ScenarioMarker): RegExp {
  if (marker === 'given') return GIVEN_RE;
  if (marker === 'when') return WHEN_RE;
  if (marker === 'then') return THEN_RE;
  return AND_RE;
}

/** Retire le mot de liaison initial d'une clause (« Quand … » → « … »). */
function stripConnector(body: string, marker: ScenarioMarker): string {
  return body.replace(markerPattern(marker), '').replace(/^[\s:,]+/, '').trim();
}

function scenarioText(buffer: ScenarioBuffer): string {
  const join = (clause: ClauseKind): string => (buffer.clauses[clause] ?? []).join(', ');
  return buffer.language === 'en'
    ? `Given ${join('given')}, when ${join('when')}, then ${join('then')}`
    : `Étant donné ${join('given')}, quand ${join('when')}, alors ${join('then')}`;
}

function flushScenario(buffer: ScenarioBuffer, items: ParsedCriterion[]): void {
  const given = buffer.clauses.given ?? [];
  const when = buffer.clauses.when ?? [];
  const then = buffer.clauses.then ?? [];
  if (given.length === 0 || when.length === 0 || then.length === 0) return;
  const item = toParsed(scenarioText(buffer), 'scenario');
  if (item !== null) items.push(item);
}

/** Forme 3 : scénarios « Étant donné / quand / alors », sur une ou plusieurs lignes. */
function parseScenarioLines(lines: readonly string[]): ParsedCriterion[] {
  const items: ParsedCriterion[] = [];
  let buffer = newScenarioBuffer('fr');
  let current: ClauseKind | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0 || ANY_HEADING_RE.test(line) || CRITERIA_HEADING_RE.test(line)) {
      flushScenario(buffer, items);
      buffer = newScenarioBuffer(buffer.language);
      current = null;
      continue;
    }
    const body = line.replace(BULLET_PREFIX_RE, '');
    const marker = scenarioMarkerOf(body);
    if (marker === 'given') {
      flushScenario(buffer, items);
      buffer = newScenarioBuffer(/^(?:soit|given)/.test(markerForm(body)) ? 'en' : 'fr');
      pushClause(buffer, 'given', stripConnector(body, 'given'));
      current = 'given';
      continue;
    }
    if (current === null || buffer.parts.length === 0) continue;
    if (marker === 'when' || marker === 'then') {
      pushClause(buffer, marker, stripConnector(body, marker));
      current = marker;
      continue;
    }
    if (marker === 'and') {
      // Une liaison « et … » prolonge la clause courante, liaison comprise :
      // le critère rendu reste lisible tel qu'il était écrit.
      pushClause(buffer, current, body.trim());
      continue;
    }
    pushClause(buffer, current, body);
  }
  flushScenario(buffer, items);
  return items;
}

/**
 * Découpe une description en critères candidats (SPEC §8.2). Déterministe :
 * le même texte rend toujours la même liste, dans le même ordre (scénarios,
 * cases à cocher, liste sous titre), sans doublon de texte.
 */
export function parseCriteria(description: string, _language: Language = 'en'): ParsedCriterion[] {
  if (description.trim().length === 0) return [];
  const lines = description.split(/\r?\n/);
  const candidates = [
    ...parseScenarioLines(lines),
    ...parseCheckboxLines(lines),
    ...parseListUnderHeading(lines),
  ];
  const seen = new Set<string>();
  const unique: ParsedCriterion[] = [];
  for (const item of candidates) {
    const key = normalizeCriterionText(item.text);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

/**
 * Proposition de critères depuis une description : l'heuristique déterministe
 * d'abord, le LLM seulement en complément quand rien n'est reconnu
 * (SPEC §8.2 — le découpage reste soumis à validation humaine).
 */
export async function proposeFromDescription(
  description: string,
  language: Language,
  llm?: Pick<LlmGateway, 'parseCriteria'>,
): Promise<ParsedCriterion[]> {
  const deterministic = parseCriteria(description, language);
  if (deterministic.length > 0 || llm === undefined) return deterministic;
  try {
    return await llm.parseCriteria(description, language);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------ création */

/** Port minimal de lecture des critères d'un ticket (SPEC §8.3). */
export interface CriteriaQueryPort {
  listCriteriaByIssue(issueId: string, statuses?: readonly string[]): Promise<Criterion[]>;
}

export interface CreateCriterionDraft {
  text: string;
  type?: CriterionType;
}

export interface CreateCriteriaDeps {
  store: Pick<CriterionStore, 'listCriteriaByIssue' | 'saveCriterion' | 'addCriterionRevision'>;
  clock: Clock;
  ids: IdGenerator;
}

export interface CreateCriteriaInput {
  issueId: string;
  drafts: readonly CreateCriterionDraft[];
  author: Actor;
  settings?: Pick<ProjectSettings, 'requirements'>;
  language?: Language;
}

export interface CreateCriteriaResult {
  created: Criterion[];
  /** Textes ignorés parce que déjà tenus par l'app (import idempotent). */
  skipped: string[];
}

/** Un ticket a-t-il des critères qui comptent (`proposed` ou `active`) ? */
export async function hasCriteria(store: CriteriaQueryPort, issueId: string): Promise<boolean> {
  const criteria = await store.listCriteriaByIssue(issueId, ['proposed', 'active']);
  return criteria.length > 0;
}

/** Les critères d'un ticket qui comptent, triés par code. */
export async function listCriteria(
  store: CriteriaQueryPort,
  issueId: string,
  statuses: readonly string[] = ['proposed', 'active'],
): Promise<Criterion[]> {
  return sortCriteriaByCode(await store.listCriteriaByIssue(issueId, statuses));
}

/**
 * Crée des critères sur un ticket (SPEC §8.2, §8.3) : codes `AC-n` stables,
 * type inféré, force exigée héritée du type, version 1, et une première ligne
 * d'historique. Idempotent : un texte déjà tenu (hors `superseded`) est ignoré.
 */
export async function createCriteria(
  input: CreateCriteriaInput,
  deps: CreateCriteriaDeps,
): Promise<CreateCriteriaResult> {
  const existing = await deps.store.listCriteriaByIssue(input.issueId);
  const kept = existing.filter((criterion) => criterion.status !== 'superseded');
  const knownTexts = new Set(kept.map((criterion) => normalizeCriterionText(criterion.text)));
  const pool: Pick<Criterion, 'code'>[] = [...existing];
  const created: Criterion[] = [];
  const skipped: string[] = [];

  for (const draft of input.drafts) {
    const text = draft.text.trim().replace(/\s+/g, ' ');
    if (text.length === 0) continue;
    if (knownTexts.has(normalizeCriterionText(text))) {
      skipped.push(text);
      continue;
    }
    const built = buildCriterion(
      {
        issueId: input.issueId,
        code: nextCode(pool),
        text,
        type: draft.type,
        author: input.author,
        settings: input.settings,
        language: input.language,
      },
      deps.clock,
      deps.ids,
    );
    await deps.store.saveCriterion(built.criterion);
    await deps.store.addCriterionRevision(built.revision);
    knownTexts.add(normalizeCriterionText(text));
    pool.push(built.criterion);
    created.push(built.criterion);
  }
  return { created, skipped };
}

/* --------------------------------------------------------- validation */

/**
 * Un humain valide des critères proposés (SPEC §8.3) : ils passent en
 * `active`. Un agent ne le peut jamais — l'erreur nommée cite le critère.
 */
export async function validateCriteria(
  criterionIds: readonly string[],
  actor: Actor,
  deps: { store: Pick<CriterionStore, 'getCriterion' | 'saveCriterion'>; clock: Clock },
  language: Language = 'en',
): Promise<Criterion[]> {
  const first = criterionIds[0];
  if (actor.agent) {
    const criterion = first === undefined ? null : await deps.store.getCriterion(first);
    throw new Error(
      criteriaMessage('criteria.error.agentCannotValidate', language, {
        code: criterion?.code ?? 'AC-?',
      }),
    );
  }
  const now = deps.clock.now();
  const validated: Criterion[] = [];
  for (const criterionId of criterionIds) {
    const existing = await deps.store.getCriterion(criterionId);
    if (existing === null || existing.status !== 'proposed') continue;
    const updated: Criterion = { ...existing, status: 'active', updatedAt: now };
    await deps.store.saveCriterion(updated);
    validated.push(updated);
  }
  return validated;
}

/* ----------------------------------------------- import depuis un ticket */

export interface ImportCriteriaInput {
  issue: Pick<IssueRef, 'id' | 'key' | 'description'>;
  /** Découpage déjà validé par l'humain ; sinon lu dans la description. */
  drafts?: readonly CreateCriterionDraft[];
  actor: Actor;
  settings?: Pick<ProjectSettings, 'requirements' | 'language'>;
}

export interface ImportCriteriaDeps extends CreateCriteriaDeps {
  llm?: Pick<LlmGateway, 'parseCriteria'>;
  jira?: Pick<JiraGateway, 'rewriteDescriptionSection'>;
}

/**
 * Import complet (SPEC §8.2) : découpage de la description (ou drafts déjà
 * validés), création des critères, puis réécriture de la section dans la
 * description pour que le ticket reste lisible sans l'app.
 */
export async function importCriteria(
  input: ImportCriteriaInput,
  deps: ImportCriteriaDeps,
): Promise<CreateCriteriaResult> {
  const language = input.settings?.language ?? 'en';
  const drafts =
    input.drafts ??
    (await proposeFromDescription(input.issue.description, language, deps.llm));
  const result = await createCriteria(
    {
      issueId: input.issue.id,
      drafts,
      author: input.actor,
      settings: input.settings,
      language,
    },
    deps,
  );
  if (deps.jira !== undefined) {
    const all = await deps.store.listCriteriaByIssue(input.issue.id);
    await deps.jira.rewriteDescriptionSection(input.issue.id, renderCriteriaSection(all, language));
  }
  return result;
}
