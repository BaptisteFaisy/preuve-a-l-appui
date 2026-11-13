/**
 * Forme canonique des critères d'acceptation (SPEC §8.1, §8.2, FP-01).
 *
 * Un critère a un code stable (`AC-1`, `AC-2`…) indépendant de son texte, un
 * type inféré ou choisi parmi les sept catégories, une force exigée héritée
 * de ce type (surchargeable par critère) et un numéro de version.
 *
 * Ce fichier tient aussi la section markdown que l'app réécrit dans la
 * description pour rester lisible sans l'app (SPEC §8.2) : elle se relit à
 * l'identique par `parseCriteria`, d'où l'import idempotent.
 *
 * Domaine pur : aucun import `@forge/*`, horloge et générateur d'ids injectés.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { defaultStrengthForType } from '../defaults';
import {
  criteriaMessage,
  criterionStatusLabel,
  criterionTypeLabel,
} from '../i18n/criteria';
import type { Clock, IdGenerator, LlmGateway } from '../ports';
import type {
  Actor,
  Criterion,
  CriterionRevision,
  CriterionType,
  Language,
  ProjectSettings,
  Strength,
} from '../types';

/* --------------------------------------------------------------- codes AC-n */

/** Extrait le numéro d'un code `AC-12` ; `null` si le code n'en est pas un. */
export function parseCodeNumber(code: string): number | null {
  const match = /^AC-(\d+)$/.exec(code.trim());
  if (match === null) return null;
  const parsed = Number.parseInt(match[1] ?? '', 10);
  return Number.isNaN(parsed) || parsed < 1 ? null : parsed;
}

/**
 * Prochain code libre d'un ticket : `AC-1` si le ticket n'a aucun critère,
 * sinon le plus grand numéro déjà attribué + 1 (les `superseded` comptent,
 * SPEC §8.1). Stable même quand un texte change : le code ne dépend pas du
 * texte, seulement des codes déjà pris.
 */
export function nextCode(criteria: readonly Pick<Criterion, 'code'>[]): string {
  let max = 0;
  for (const criterion of criteria) {
    const number = parseCodeNumber(criterion.code);
    if (number !== null && number > max) max = number;
  }
  return `AC-${max + 1}`;
}

/** Trie des critères par numéro de code (`AC-2` avant `AC-10`), puis par id. */
export function sortCriteriaByCode(criteria: readonly Criterion[]): Criterion[] {
  return [...criteria].sort((a, b) => {
    const left = parseCodeNumber(a.code) ?? Number.MAX_SAFE_INTEGER;
    const right = parseCodeNumber(b.code) ?? Number.MAX_SAFE_INTEGER;
    return left - right || a.code.localeCompare(b.code) || a.id.localeCompare(b.id);
  });
}

/* ------------------------------------------------------- inférence de type */

/** Une règle d'inférence : un type et les motifs qui le reconnaissent. */
interface TypeRule {
  readonly type: CriterionType;
  readonly patterns: readonly RegExp[];
}

/**
 * Heuristique déterministe (mots-clés FR/EN) vers l'un des sept types
 * (SPEC §8.1). L'ordre arbitre les égalités : la sécurité et la performance
 * priment, le fonctionnel est le repli.
 */
const TYPE_RULES: readonly TypeRule[] = [
  {
    type: 'security',
    patterns: [
      /s[ée]curit|security|authentification|authentication|autorisation|authorization|mot de passe|password|\bxss\b|\bcsrf\b|injection|chiffr|encrypt|jwt|oauth|\brbac\b|permission|habilitation|certificat|signature|hmac|secret/i,
    ],
  },
  {
    type: 'performance',
    patterns: [
      /performance|latence|latency|temps de r[ée]ponse|response time|d[ée]bit|throughput|\bp9[59]\b|m[ée]moire|\bmemory\b|\bcpu\b|rendement|en moins de \d|under \d+ ?(ms|s)|\d+ ?(ms|secondes|seconds)\b/i,
    ],
  },
  {
    type: 'accessibility',
    patterns: [
      /accessibilit|accessibility|\ba11y\b|\bwcag\b|\baria\b|lecteur d.[ée]cran|screen ?reader|contraste|contrast|navigation (au )?clavier|keyboard|tabulation|\btabindex\b/i,
    ],
  },
  {
    type: 'data',
    patterns: [
      /migration|donn[ée]s|\bdata\b|base de donn[ée]es|database|sch[ée]ma|sauvegarde|backup|anonymis|\brgpd\b|\bgdpr\b|conservation|int[ée]grit[ée] des donn|export|import csv|\bsql\b|partition/i,
    ],
  },
  {
    type: 'documentation',
    patterns: [
      /documentation|document[ée]|documenter|\bdocs?\b|guide|manuel|notice|changelog|release notes|\breadme\b|confluence|\bwiki\b|page d.aide|help page|\badr\b/i,
    ],
  },
  {
    type: 'regression',
    patterns: [
      /r[ée]gression|non[- ]r[ée]gression|ne (casse|change) pas|does(n.t| not) (break|change)|restent? (verts?|passants?)|keep[s]? (passing|working)|continuent? (de |à )?(fonctionner|passer)|existants? (ne|continue)|d[ée]j[àà] (livr[ée]|support[ée])/i,
    ],
  },
];

/**
 * Infère le type d'un critère depuis son texte, sans LLM ni aléa : le même
 * texte donne toujours le même type. Repli : `functional`.
 */
export function inferType(text: string): CriterionType {
  const normalized = text.trim();
  if (normalized.length === 0) return 'functional';
  for (const rule of TYPE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) return rule.type;
  }
  return 'functional';
}

/**
 * Complément optionnel (SPEC §8.1) : le LLM n'est consulté que si
 * l'heuristique retombe sur `functional`, et sa panne ne change rien.
 */
export async function inferTypeWithLlm(
  text: string,
  llm?: Pick<LlmGateway, 'classifyCriterion'>,
): Promise<CriterionType> {
  const heuristic = inferType(text);
  if (heuristic !== 'functional' || llm === undefined) return heuristic;
  try {
    return await llm.classifyCriterion(text);
  } catch {
    return heuristic;
  }
}

/* ------------------------------------------------------------- construction */

/** Force exigée d'un type : la grille du projet prime, sinon le défaut (§9.2). */
export function requiredStrengthForType(
  type: CriterionType,
  settings?: Pick<ProjectSettings, 'requirements'>,
): Strength {
  const strongest = settings?.requirements[type].accepted[0];
  return strongest ?? defaultStrengthForType(type);
}

/** Ce qu'il faut pour construire un critère canonique (SPEC §8.1). */
export interface BuildCriterionInput {
  issueId: string;
  code: string;
  text: string;
  type?: CriterionType;
  requiredStrength?: Strength;
  author: Actor;
  settings?: Pick<ProjectSettings, 'requirements'>;
  language?: Language;
}

/** Un critère canonique et la première ligne de son historique. */
export interface BuiltCriterion {
  criterion: Criterion;
  revision: CriterionRevision;
}

/**
 * Construit un `Criterion` version 1 et sa révision initiale.
 * Statut : `proposed` quand l'auteur est un agent, `active` quand un humain
 * valide (SPEC §8.3 — un agent ne peut pas valider).
 */
export function buildCriterion(
  input: BuildCriterionInput,
  clock: Clock,
  ids: IdGenerator,
): BuiltCriterion {
  const cleaned = input.text.trim().replace(/\s+/g, ' ');
  const language = input.language ?? 'en';
  if (cleaned.length === 0) {
    throw new Error(criteriaMessage('criteria.error.emptyText', language, { code: input.code }));
  }
  const type = input.type ?? inferType(cleaned);
  const now = clock.now();
  const criterion: Criterion = {
    id: ids.next('crit'),
    issueId: input.issueId,
    code: input.code,
    text: cleaned,
    type,
    requiredStrength: input.requiredStrength ?? requiredStrengthForType(type, input.settings),
    version: 1,
    status: input.author.agent ? 'proposed' : 'active',
    createdBy: input.author.accountId,
    createdAt: now,
    updatedAt: now,
  };
  return {
    criterion,
    revision: {
      criterionId: criterion.id,
      version: 1,
      text: cleaned,
      type,
      changedBy: input.author.accountId,
      at: now,
    },
  };
}

/* ------------------------------------------------------- section de texte */

/** Compare deux textes de critère en ignorant casse et espaces superflus. */
export function isSameCriterionText(left: string, right: string): boolean {
  return normalizeCriterionText(left) === normalizeCriterionText(right);
}

export function normalizeCriterionText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Étiquette d'une ligne : version, type et état, dans la langue du projet. */
function criterionTag(criterion: Criterion, language: Language): string {
  const type = criterionTypeLabel(criterion.type, language);
  const status = criterionStatusLabel(criterion.status, language);
  return `v${criterion.version} · ${type} · ${status}`;
}

/**
 * La section markdown que l'app réécrit dans la description (SPEC §8.2).
 * Chaque critère est une case à cocher `- [ ] **AC-n** — texte` : c'est la
 * première forme reconnue par `parseCriteria`, donc la relecture de cette
 * section rend exactement les mêmes textes (import idempotent). Les critères
 * `superseded` ne sont pas rendus : ils restent dans l'historique (SPEC §20).
 */
export function renderCriteriaSection(
  criteria: readonly Criterion[],
  language: Language,
): string {
  const counted = criteria.filter((criterion) => criterion.status !== 'superseded');
  const lines = [`## ${criteriaMessage('criteria.section.title', language)}`, ''];
  if (counted.length === 0) {
    lines.push(criteriaMessage('criteria.section.empty', language));
  }
  for (const criterion of sortCriteriaByCode(counted)) {
    const tag = criterionTag(criterion, language);
    lines.push(`- [ ] **${criterion.code}** — ${criterion.text} *(${tag})*`);
  }
  const summary = criteriaMessage('criteria.section.summary', language, { count: counted.length });
  lines.push('', `*${summary}*`);
  return lines.join('\n');
}
