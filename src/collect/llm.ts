/**
 * Adaptateur `LlmGateway` : Forge LLMs, texte seulement (SPEC §8.2, §11, §19).
 *
 * Trois responsabilités :
 *   1. découper les critères d'une description (`parseCriteria`) ;
 *   2. classer un critère parmi les 7 types reconnus (`classifyCriterion`) ;
 *   3. suggérer des paires test ↔ critère (`suggestPairs`).
 *
 * Exigences fortes :
 *   - Texte seulement : jamais d'image (SPEC §19) ;
 *   - Sortie JSON validée et bornée ;
 *   - Repli déterministe documenté : en cas de panne réseau, de modèle absent,
 *     de délai dépassé ou de JSON invalide, une réponse neutre et valide est
 *     renvoyée (jamais d'exception qui remonterait au validateur ou au domaine).
 *   - L'import de `@forge/llm` est différé pour ne pas planter hors runtime.
 *
 * Seul `src/collect/` importe `@forge/llm` (docs/CONTRACTS.md §4bis).
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Criterion, CriterionType, Language, ParsedCriterion } from '../types.js';
import { CRITERION_TYPES } from '../types.js';
import type { LlmGateway, SuggestedPair } from '../ports.js';
import { DEFAULT_TIMEOUT_MS, withTimeout } from './http.js';
import { text as translateText } from '../i18n/index.js';
import { ADAPTATEURS_MESSAGES } from '../i18n/adaptateurs.js';

export const DEFAULT_LLM_MODEL = 'claude-sonnet-4-5';

/** Bornes de sortie du modèle : jamais de liste ouverte (SPEC §20, légèreté). */
export const MAX_PARSED_CRITERIA = 50;
export const MAX_SUGGESTED_TESTS = 50;

/** Client minimal Forge LLM injectable pour tester sans réseau ni runtime. */
export interface ForgeLlmClient {
  chat(prompt: {
    model: string;
    temperature?: number;
    max_completion_tokens?: number;
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  }): Promise<{ choices: { message?: { content?: unknown } }[] }>;
}

export interface LlmGatewayOptions {
  /** Client injecté pour les tests (sans option : chargement dynamique `@forge/llm`). */
  client?: ForgeLlmClient;
  /** Modèle demandé (défaut : claude-sonnet-4-5). */
  model?: string;
  /** Délai maximal d'un appel au modèle (ms). */
  timeoutMs?: number;
}

/* ------------------------------------------------------------- extraction */

/** Extrait le texte d'un message LLM (chaîne directe ou fragments d'objets). */
export function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      const item = part as { text?: unknown } | null;
      return typeof item?.text === 'string' ? item.text : '';
    })
    .join('');
}

/** Tente de parser un objet ou tableau JSON, y compris dans un bloc ```json ... ```. */
export function parseJsonBlock<T>(text: string): T | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Essai d'extraction d'un bloc Markdown ```json
    const match = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/* -------------------------------------------------------- replis déterministes */

const TYPE_KEYWORDS: Record<CriterionType, RegExp> = {
  regression: /\b(?:r[eé]gression|non-r[eé]gression|existant|inchang[eé])\b/i,
  performance: /\b(?:performance|latence|temps|d[eé]bit|ms|secondes?|charge)\b/i,
  security: /\b(?:s[eé]curit[eé]|auth|token|chiffr|vuln[eé]rabilit[eé]|droit|permission|r[oô]le)\b/i,
  accessibility: /\b(?:accessibilit[eé]|a11y|wcag|lecteur|contraste|aria)\b/i,
  data: /\b(?:donn[eé]es?|base|sql|migration|sch[eé]ma|table|colonne|int[eé]grit[eé])\b/i,
  documentation: /\b(?:doc|documentation|manuel|guide|confluence|wiki|readme)\b/i,
  functional: /\b(?:doit|pouvoir|affiche|cr[eé]er|modifi|supprim|valide|quand|alors|si)\b/i,
};

/** Repli déterministe de classification (règles par mots-clés, SPEC §8.1). */
export function fallbackClassify(text: string): CriterionType {
  const candidate = text.trim();
  for (const type of CRITERION_TYPES) {
    if (type !== 'functional' && TYPE_KEYWORDS[type].test(candidate)) {
      return type;
    }
  }
  return 'functional';
}

/** Ligne de scénario BDD : `Given/When/Then` ou `Étant donné/Quand/Alors` (§8.2). */
const SCENARIO_LINE =
  /^(?:given|when|then|[ée]tant\s+donn[ée]e?s?|quand|alors)(?=[\s,.;:!?]|$)/i;

/** Repli déterministe d'import : cases à cocher `[ ]`, listes à puces ou scénarios. */
export function fallbackParseCriteria(description: string): ParsedCriterion[] {
  const results: ParsedCriterion[] = [];
  const lines = description.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const checkbox = /^[-*]\s*\[[ xX]\]\s*(.*)$/.exec(trimmed);
    if (checkbox && checkbox[1]!.trim()) {
      const text = checkbox[1]!.trim();
      results.push({ text, type: fallbackClassify(text), origin: 'checkbox' });
      continue;
    }
    const bullet = /^[-*•]\s*(.*)$/.exec(trimmed);
    if (bullet && bullet[1]!.trim()) {
      const text = bullet[1]!.trim();
      results.push({ text, type: fallbackClassify(text), origin: 'list' });
      continue;
    }
    if (SCENARIO_LINE.test(trimmed)) {
      results.push({ text: trimmed, type: 'functional', origin: 'scenario' });
    }
  }
  return results.slice(0, MAX_PARSED_CRITERIA);
}

/** Repli déterministe de rapprochement : inclusion de mots signifiants. */
export function fallbackSuggestPairs(
  criteria: readonly Criterion[],
  testNames: readonly string[],
  language: Language = 'fr',
): SuggestedPair[] {
  const pairs: SuggestedPair[] = [];
  for (const crit of criteria) {
    const words = crit.text
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((w) => w.length >= 4);
    for (const test of testNames) {
      const lowerTest = test.toLowerCase();
      const hits = words.filter((w) => lowerTest.includes(w));
      if (hits.length > 0) {
        const confidence = Math.min(0.9, 0.4 + hits.length * 0.15);
        const terms = hits.slice(0, 3).join(', ');
        pairs.push({
          criterionId: crit.id,
          testName: test,
          confidence,
          rationale: translateText(ADAPTATEURS_MESSAGES, 'llm.pair.fallbackRationale', language, {
            terms,
          }),
        });
      }
    }
  }
  return pairs;
}

/* ------------------------------------------------------------- validation */

function validateCriterionType(type: unknown): CriterionType | null {
  if (typeof type === 'string' && (CRITERION_TYPES as readonly string[]).includes(type.toLowerCase())) {
    return type.toLowerCase() as CriterionType;
  }
  return null;
}

function sanitizeParsedList(raw: unknown): ParsedCriterion[] {
  if (!Array.isArray(raw)) return [];
  const list: ParsedCriterion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    if (!text) continue;
    const type = validateCriterionType(item.type) ?? fallbackClassify(text);
    const originRaw = typeof item.origin === 'string' ? item.origin : 'list';
    const origin =
      originRaw === 'checkbox' || originRaw === 'scenario' ? originRaw : 'list';
    list.push({ text, type, origin });
    if (list.length >= 50) break;
  }
  return list;
}

function sanitizeSuggestedPairs(
  raw: unknown,
  validCriterionIds: Set<string>,
  validTests: Set<string>,
): SuggestedPair[] {
  if (!Array.isArray(raw)) return [];
  const pairs: SuggestedPair[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const criterionId = String(item.criterionId ?? '');
    const testName = String(item.testName ?? '');
    if (!validCriterionIds.has(criterionId) || !validTests.has(testName)) continue;
    const rawConf = Number(item.confidence);
    const confidence = Number.isFinite(rawConf) ? Math.min(1, Math.max(0, rawConf)) : 0.5;
    const rationale = typeof item.rationale === 'string' ? item.rationale.trim() : '';
    pairs.push({ criterionId, testName, confidence, rationale });
  }
  return pairs;
}

/* ------------------------------------------------------------- client Forge */

async function resolveForgeLlmClient(): Promise<ForgeLlmClient | null> {
  try {
    const mod = await import('@forge/llm');
    return {
      chat: (prompt) => mod.chat(prompt as Parameters<typeof mod.chat>[0]),
    };
  } catch {
    return null;
  }
}

async function callModel(
  client: ForgeLlmClient | null,
  model: string,
  timeoutMs: number,
  system: string,
  user: string,
): Promise<string | null> {
  if (!client) return null;
  try {
    const response = await withTimeout(
      () =>
        client.chat({
          model,
          temperature: 0.1,
          max_completion_tokens: 1200,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      timeoutMs,
    );
    const content = response.choices?.[0]?.message?.content;
    return extractText(content);
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------------- fabrique */

async function parseWithModel(
  client: ForgeLlmClient | null,
  model: string,
  timeoutMs: number,
  description: string,
  language: 'en' | 'fr',
): Promise<ParsedCriterion[]> {
  if (!description.trim()) return [];
  const system =
    language === 'fr'
      ? "Tu es un extracteur de critères d'acceptation. Analyse le texte et retourne UNIQUEMENT un tableau JSON: [{\"text\": string, \"type\": \"functional\"|\"regression\"|\"performance\"|\"security\"|\"accessibility\"|\"data\"|\"documentation\", \"origin\": \"checkbox\"|\"list\"|\"scenario\"}]."
      : 'You extract acceptance criteria. Output ONLY a JSON array: [{"text": string, "type": "functional"|"regression"|"performance"|"security"|"accessibility"|"data"|"documentation", "origin": "checkbox"|"list"|"scenario"}].';
  const rawText = await callModel(client, model, timeoutMs, system, description);
  if (rawText) {
    const sanitized = sanitizeParsedList(parseJsonBlock<unknown>(rawText));
    if (sanitized.length > 0) return sanitized;
  }
  return fallbackParseCriteria(description);
}

async function classifyWithModel(
  client: ForgeLlmClient | null,
  model: string,
  timeoutMs: number,
  text: string,
): Promise<CriterionType> {
  if (!text.trim()) return 'functional';
  const system =
    'Classify this acceptance criterion into exactly one type: functional, regression, performance, security, accessibility, data, documentation. Output ONLY JSON: {"type": "<type>"}.';
  const rawText = await callModel(client, model, timeoutMs, system, text);
  if (rawText) {
    const valid = validateCriterionType(parseJsonBlock<{ type?: unknown }>(rawText)?.type);
    if (valid) return valid;
  }
  return fallbackClassify(text);
}

async function suggestWithModel(
  client: ForgeLlmClient | null,
  model: string,
  timeoutMs: number,
  criteria: readonly Criterion[],
  testNames: readonly string[],
): Promise<readonly SuggestedPair[]> {
  if (criteria.length === 0 || testNames.length === 0) return [];
  const validCritIds = new Set(criteria.map((c) => c.id));
  const validTests = new Set(testNames);
  const system =
    'Pair automated tests with acceptance criteria. Return ONLY a JSON array: [{"criterionId": string, "testName": string, "confidence": number (0 to 1), "rationale": string}].';
  const user = JSON.stringify({
    criteria: criteria.map((c) => ({ id: c.id, code: c.code, text: c.text })),
    tests: testNames.slice(0, MAX_SUGGESTED_TESTS),
  });
  const rawText = await callModel(client, model, timeoutMs, system, user);
  if (rawText) {
    const pairs = sanitizeSuggestedPairs(parseJsonBlock<unknown>(rawText), validCritIds, validTests);
    if (pairs.length > 0) return pairs;
  }
  return fallbackSuggestPairs(criteria, testNames);
}

/**
 * Construit l'adaptateur `LlmGateway`.
 * En cas de panne de modèle ou sortie invalide : repli déterministe immédiat.
 */
export function createLlmGateway(options: LlmGatewayOptions = {}): LlmGateway {
  const model = options.model ?? DEFAULT_LLM_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let resolvedClient = options.client ?? null;

  const getClient = async (): Promise<ForgeLlmClient | null> => {
    if (!resolvedClient) resolvedClient = await resolveForgeLlmClient();
    return resolvedClient;
  };

  return {
    parseCriteria: async (description, language) =>
      parseWithModel(await getClient(), model, timeoutMs, description, language),
    classifyCriterion: async (text) =>
      classifyWithModel(await getClient(), model, timeoutMs, text),
    suggestPairs: async (criteria, testNames) =>
      suggestWithModel(await getClient(), model, timeoutMs, criteria, testNames),
  };
}
