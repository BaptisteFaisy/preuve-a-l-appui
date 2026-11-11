/**
 * Découpage de la section « Critères d'acceptation » d'une description Jira
 * (SPEC §8.2) : aller-retour ADF ↔ texte, sans jamais toucher au reste.
 *
 * Découpé depuis `jira.ts` pour tenir la limite de 500 lignes par fichier et
 * 50 lignes par fonction. Ce module est pur : aucun import `@forge/*`, donc
 * testable sans runtime ni réseau.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */

/** Nœud ADF minimal : l'app ne lit que `type`, `attrs.level`, `content`, `text`. */
export interface AdfNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
  text?: string;
}

export interface AdfDocument {
  type: string;
  version: number;
  content: AdfNode[];
}

/** Titres reconnus pour la section critères, en français et en anglais (§20). */
const CRITERIA_HEADING = /^(?:crit[èe]res?\s+d['’]?\s*acceptation|acceptance\s+criteria)\s*$/i;

/** Ligne de titre Markdown : `## Titre`. */
const MARKDOWN_HEADING = /^(#{1,6})\s+(.*)$/;

/** Puce Markdown ou Unicode : `- x`, `* x`, `• x`. */
const BULLET_LINE = /^[-*•]\s+(.*)$/;

/** Texte visible d'un nœud ADF (récursif) ; une chaîne passe telle quelle. */
export function adfTextOf(node: unknown): string {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  const value = node as Partial<AdfNode>;
  if (typeof value.text === 'string') return value.text;
  if (!Array.isArray(value.content)) return '';
  return value.content.map(adfTextOf).join('').trim();
}

/** Description ADF → texte brut, un bloc par ligne (lu par le domaine). */
export function adfToPlainText(input: unknown): string {
  if (typeof input === 'string') return input;
  if (!input || typeof input !== 'object') return '';
  const doc = input as Partial<AdfDocument>;
  if (!Array.isArray(doc.content)) return adfTextOf(input);
  return doc.content
    .map((node) => renderNodeAsText(node))
    .filter((line) => line.trim().length > 0)
    .join('\n');
}

function renderNodeAsText(node: AdfNode): string {
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return (node.content ?? [])
      .map((item) => `- ${adfTextOf(item)}`)
      .join('\n');
  }
  if (node.type === 'heading') {
    return `## ${adfTextOf(node)}`;
  }
  return adfTextOf(node);
}

function isCriteriaHeading(node: AdfNode): boolean {
  return node.type === 'heading' && CRITERIA_HEADING.test(adfTextOf(node).trim());
}

function levelOf(node: AdfNode): number {
  const raw = node.attrs?.['level'];
  return typeof raw === 'number' ? raw : 2;
}

/** Une section décomposée : titre explicite (ou nul) et lignes de corps. */
export interface SectionParts {
  heading: string | null;
  body: string[];
}

/** Découpe la section fournie par l'appelant : titre Markdown puis lignes. */
export function splitSection(section: string): SectionParts {
  const lines = section
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  const first = lines[0]?.trim() ?? '';
  const match = MARKDOWN_HEADING.exec(first);
  if (match) {
    return { heading: match[2]!.trim(), body: lines.slice(1).map((line) => line.trim()) };
  }
  return { heading: null, body: lines.map((line) => line.trim()) };
}

function bulletNodes(lines: string[]): AdfNode {
  return {
    type: 'bulletList',
    content: lines.map((line) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: line }] }],
    })),
  };
}

/** Corps de la section → nœuds ADF (listes à puces groupées, reste en paragraphes). */
export function bodyToAdfNodes(body: readonly string[]): AdfNode[] {
  const nodes: AdfNode[] = [];
  let bullets: string[] = [];
  const flush = (): void => {
    if (bullets.length > 0) {
      nodes.push(bulletNodes(bullets));
      bullets = [];
    }
  };
  for (const line of body) {
    const bullet = BULLET_LINE.exec(line);
    if (bullet) bullets.push(bullet[1]!.trim());
    else {
      flush();
      nodes.push({ type: 'paragraph', content: [{ type: 'text', text: line }] });
    }
  }
  flush();
  return nodes;
}

/** Section → nœuds ADF ; `fallbackHeading` garde le titre déjà en place. */
export function sectionToAdfNodes(section: string, fallbackHeading: string | null, level: number): AdfNode[] {
  const parts = splitSection(section);
  const title = parts.heading ?? fallbackHeading;
  const nodes: AdfNode[] = [];
  if (title !== null && title.length > 0) {
    nodes.push({ type: 'heading', attrs: { level }, content: [{ type: 'text', text: title }] });
  }
  nodes.push(...bodyToAdfNodes(parts.body));
  return nodes;
}

/** Remplace la section critères d'un document ADF ; l'ajoute en fin sinon. */
export function replaceCriteriaInAdf(input: unknown, section: string): AdfDocument {
  const doc = asDocument(input);
  const nodes = [...doc.content];
  const start = nodes.findIndex(isCriteriaHeading);
  if (start === -1) {
    const added = sectionToAdfNodes(section, null, 2);
    return { ...doc, content: [...nodes, ...added] };
  }
  const level = levelOf(nodes[start]!);
  const title = adfTextOf(nodes[start]).trim() || null;
  const end = sectionEnd(nodes, start, level);
  const replacement = sectionToAdfNodes(section, title, level);
  return { ...doc, content: [...nodes.slice(0, start), ...replacement, ...nodes.slice(end)] };
}

function asDocument(input: unknown): AdfDocument {
  const doc = (input && typeof input === 'object' ? input : {}) as Partial<AdfDocument>;
  return {
    type: 'doc',
    version: typeof doc.version === 'number' ? doc.version : 1,
    content: Array.isArray(doc.content) ? doc.content : [],
  };
}

/** Fin de la section : le prochain titre de niveau égal ou supérieur. */
function sectionEnd(nodes: readonly AdfNode[], start: number, level: number): number {
  for (let index = start + 1; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    if (node.type === 'heading' && levelOf(node) <= level) return index;
  }
  return nodes.length;
}

/** Repère la section critères dans une description texte (repli sans ADF). */
export function findCriteriaHeadingLine(lines: readonly string[]): number {
  return lines.findIndex((line) => {
    const match = MARKDOWN_HEADING.exec(line.trim());
    return CRITERIA_HEADING.test((match ? match[2]! : line).trim());
  });
}

/** Variante texte brut : ne remplace que la section critères, titre conservé. */
export function replaceCriteriaInText(description: string, section: string): string {
  const lines = description.split(/\r?\n/);
  const start = findCriteriaHeadingLine(lines);
  if (start === -1) {
    const kept = description.trimEnd();
    return kept.length > 0 ? `${kept}\n\n${section.trim()}` : section.trim();
  }
  const level = (MARKDOWN_HEADING.exec(lines[start]!.trim())?.[1] ?? '##').length;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = MARKDOWN_HEADING.exec(lines[index]!.trim());
    if (match && match[1]!.length <= level) {
      end = index;
      break;
    }
  }
  const parts = splitSection(section);
  const title = parts.heading ?? lines[start]!.trim().replace(/^#{1,6}\s+/, '');
  const block = [`#`.repeat(level) + ` ${title}`, ...parts.body].join('\n');
  return [...lines.slice(0, start), block, ...lines.slice(end)].join('\n');
}

/** Corps ADF d'un commentaire Jira v3 (notification, SPEC §9.4). */
export function textToAdf(text: string): AdfDocument {
  return {
    type: 'doc',
    version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}
