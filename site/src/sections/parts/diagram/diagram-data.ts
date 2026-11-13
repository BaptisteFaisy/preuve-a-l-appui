/**
 * La géométrie du schéma « comment ça marche » (lot `site-vitrine-confiance`).
 *
 * Le schéma est un SVG inline : sa mise en page est écrite ici, en coordonnées
 * de viewBox, et non calculée à l'exécution (le SVG ne mesure pas son texte).
 * Une seule source de vérité pour les deux sorties : l'image (SVG) et la liste
 * textuelle qui l'accompagne — l'équivalent textuel, lisible par un lecteur
 * d'écran comme par un moteur de recherche.
 *
 * Le cadre est étroit (340 unités) pour rester lisible sur mobile : à 312 px
 * de large, un titre de 12,5 unités fait encore ~11,5 px. Les libellés, eux,
 * viennent de `site/src/i18n/vitrine.ts` — aucune chaîne en dur ici.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Lang } from '../../../i18n/index.js';
import { VITRINE } from '../../../i18n/vitrine.js';
import type { DiagramBoxText, DiagramNodeTexts } from '../../../i18n/vitrine.js';

/** La tonalité d'un bloc, portée par une classe CSS (jamais la couleur seule). */
export type BoxTone = 'flow' | 'gate' | 'ok' | 'refused' | 'human';

/** Un bloc du schéma : sa place, ses lignes, sa tonalité. */
export interface DiagramBox {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly title: readonly string[];
  readonly detail: readonly string[];
  readonly tone: BoxTone;
}

/** Un trait du schéma : son chemin et sa nature. */
export interface DiagramLink {
  readonly id: string;
  readonly d: string;
  readonly dashed: boolean;
}

/** Le modèle complet du schéma, dans une langue. */
export interface DiagramModel {
  readonly width: number;
  readonly height: number;
  readonly boxes: readonly DiagramBox[];
  readonly links: readonly DiagramLink[];
  readonly laneMain: string;
  readonly laneBranch: string;
  readonly title: string;
  readonly desc: string;
  /** Le même chemin, une ligne par étape : l'équivalent textuel du schéma. */
  readonly steps: readonly string[];
  /** Les étapes de la branche humaine, dans le même ordre que l'image. */
  readonly branchSteps: readonly string[];
}

/* --------------------------------------------------------------- géométrie */

/** Largeur du cadre : assez étroite pour rester lisible sur un téléphone. */
const VIEW_WIDTH = 340;
const MAIN_X = 8;
const MAIN_W = 190;
const BRANCH_X = 216;
const BRANCH_W = 116;
const OUTCOME_GAP = 10;
const OUTCOME_W = (MAIN_W - OUTCOME_GAP) / 2;
const GAP = 18;
const FORK = 24;
const TOP = 28;
const LANE_Y = 18;

const PAD_TOP = 8;
const PAD_BOTTOM = 9;
const TITLE_LH = 14;
const DETAIL_LH = 12;
const TITLE_ASCENT = 12;

/** Les tailles de police du schéma (partagées par le SVG et ses tests). */
export const FONT_SIZES = { title: 12.5, detail: 10, lane: 8 } as const;

/** La hauteur d'un bloc : marges + lignes de titre + lignes de détail. */
export function boxHeight(titleLines: number, detailLines: number): number {
  const titles = TITLE_LH * titleLines;
  const details = detailLines === 0 ? 0 : DETAIL_LH * (detailLines - 1) + 10;
  return PAD_TOP + titles + details + PAD_BOTTOM;
}

/** Les lignes de base du texte d'un bloc : titres puis détails. */
export function baselines(box: DiagramBox): {
  readonly titles: readonly number[];
  readonly details: readonly number[];
} {
  const titles = box.title.map((_, index) => box.y + PAD_TOP + TITLE_ASCENT + index * TITLE_LH);
  const last = box.y + box.h - PAD_BOTTOM;
  const details = box.detail.map((_, index) => last - (box.detail.length - 1 - index) * DETAIL_LH);
  return { titles, details };
}

/** Le centre horizontal d'un bloc. */
function centreOf(box: DiagramBox): number {
  return box.x + box.w / 2;
}

/** Le bloc, avec ses lignes de titre et de détail. */
function makeBox(
  id: string,
  x: number,
  y: number,
  w: number,
  text: DiagramBoxText,
  tone: BoxTone,
): DiagramBox {
  return {
    id,
    x,
    y,
    w,
    h: boxHeight(text.title.length, text.detail.length),
    title: text.title,
    detail: text.detail,
    tone,
  };
}

/** Les sept étapes du flux principal, dans l'ordre du flux réel de l'app. */
export const MAIN_NODES = [
  'ciSummary',
  'webTrigger',
  'queue',
  'consumer',
  'proofs',
  'coverage',
  'validator',
] as const;

/** Les sept blocs du flux principal, empilés. */
function mainBoxes(nodes: DiagramNodeTexts): DiagramBox[] {
  const boxes: DiagramBox[] = [];
  let y = TOP;
  for (const id of MAIN_NODES) {
    const tone: BoxTone = id === 'validator' ? 'gate' : 'flow';
    const box = makeBox(id, MAIN_X, y, MAIN_W, nodes[id], tone);
    boxes.push(box);
    y += box.h + GAP;
  }
  return boxes;
}

/** Les deux issues du validateur : transition acceptée, ou refus motivé. */
function outcomeBoxes(nodes: DiagramNodeTexts, top: number): DiagramBox[] {
  return [
    makeBox('accepted', MAIN_X, top, OUTCOME_W, nodes.accepted, 'ok'),
    makeBox('refused', MAIN_X + OUTCOME_W + OUTCOME_GAP, top, OUTCOME_W, nodes.refused, 'refused'),
  ];
}

/** La branche « l'agent propose, un humain atteste », à droite du flux. */
function branchBoxes(nodes: DiagramNodeTexts): DiagramBox[] {
  const agent = makeBox('agentProposes', BRANCH_X, TOP, BRANCH_W, nodes.agentProposes, 'human');
  const human = makeBox(
    'humanAttests',
    BRANCH_X,
    TOP + agent.h + GAP,
    BRANCH_W,
    nodes.humanAttests,
    'human',
  );
  return [agent, human];
}

/** Les traits de descente d'une colonne : `from` → `to`, tout droit. */
function stackLinks(prefix: string, from: DiagramBox, to: DiagramBox): DiagramLink[] {
  const x = centreOf(from);
  return [
    { id: `${prefix}-${from.id}`, d: `M ${x} ${from.y + from.h} V ${to.y - 3}`, dashed: false },
  ];
}

/** La fourche du validateur : un tronc, puis deux branches vers les issues. */
function forkLinks(gate: DiagramBox, accepted: DiagramBox, refused: DiagramBox): DiagramLink[] {
  const x = centreOf(gate);
  const bottom = gate.y + gate.h;
  const middle = bottom + FORK / 2;
  const toAccepted = `M ${x} ${bottom} V ${middle} H ${centreOf(accepted)} V ${accepted.y - 3}`;
  const toRefused = `M ${x} ${bottom} V ${middle} H ${centreOf(refused)} V ${refused.y - 3}`;
  return [
    { id: 'fork-accepted', d: toAccepted, dashed: false },
    { id: 'fork-refused', d: toRefused, dashed: false },
  ];
}

/** La branche humaine rejoint la couverture : c'est un apport, trait pointillé. */
function branchLink(human: DiagramBox, coverage: DiagramBox): DiagramLink {
  const lane = centreOf(human);
  const join = coverage.y + coverage.h / 2;
  const edge = coverage.x + coverage.w + 3;
  return {
    id: 'branch-join',
    d: `M ${lane} ${human.y + human.h} V ${join} H ${edge}`,
    dashed: true,
  };
}

/** Tous les traits du schéma, à partir des blocs placés. */
function buildLinks(boxes: readonly DiagramBox[]): DiagramLink[] {
  const byId = new Map(boxes.map((box) => [box.id, box]));
  const main = MAIN_NODES.map((id) => byId.get(id)).filter(
    (box): box is DiagramBox => box !== undefined,
  );
  const links: DiagramLink[] = [];
  for (let index = 0; index < main.length - 1; index += 1) {
    links.push(...stackLinks('flow', main[index]!, main[index + 1]!));
  }
  const gate = byId.get('validator');
  const accepted = byId.get('accepted');
  const refused = byId.get('refused');
  const agent = byId.get('agentProposes');
  const human = byId.get('humanAttests');
  const coverage = byId.get('coverage');
  if (gate && accepted && refused) links.push(...forkLinks(gate, accepted, refused));
  if (agent && human) links.push(...stackLinks('branch', agent, human));
  if (human && coverage) links.push(branchLink(human, coverage));
  return links;
}

/** Une étape en une ligne : le titre, puis le détail. */
function stepLine(box: DiagramBox): string {
  const head = box.title.join(' ');
  const tail = box.detail.join(' · ');
  const line = tail.length === 0 ? head : `${head} — ${tail}`;
  return line.replace(/\s+/g, ' ').trim();
}

/** Le schéma complet, dans une langue. */
export function buildDiagram(lang: Lang): DiagramModel {
  const t = VITRINE[lang].diagram;
  const main = mainBoxes(t.nodes);
  const gate = main[main.length - 1]!;
  const outcomes = outcomeBoxes(t.nodes, gate.y + gate.h + FORK);
  const branch = branchBoxes(t.nodes);
  const boxes = [...main, ...outcomes, ...branch];
  const last = outcomes[0]!;
  return {
    width: VIEW_WIDTH,
    height: last.y + last.h + 16,
    boxes,
    links: buildLinks(boxes),
    laneMain: t.laneMain,
    laneBranch: t.laneBranch,
    title: t.svgTitle,
    desc: t.svgDesc,
    steps: [...main, ...outcomes].map(stepLine),
    branchSteps: branch.map(stepLine),
  };
}

/** La position verticale des libellés de voies. */
export const LANE_BASELINE = LANE_Y;

/** L'abscisse des libellés de la voie de droite. */
export const BRANCH_LANE_X = BRANCH_X;
