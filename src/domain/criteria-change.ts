/**
 * Changement d'un critère et réécriture de la description (SPEC §8.2, §8.4,
 * §21, FP-13).
 *
 * Trois règles tiennent ce fichier :
 * - un texte modifié incrémente `version`, écrit une `CriterionRevision` et
 *   fait passer les preuves des versions antérieures en « à revoir » ;
 * - un texte inchangé ne crée **pas** de version (aucune écriture) ;
 * - la section « Critères d'acceptation » de la description est réécrite sans
 *   toucher au reste du texte : le ticket reste lisible hors de l'app.
 *
 * Domaine pur : aucun import `@forge/*`, horloge injectée, preuves manipulées
 * via un port minimal que le `EvidenceStore` de `src/ports.ts` satisfait.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Clock, JiraGateway } from '../ports.js';
import type {
  Actor,
  Criterion,
  CriterionRevision,
  Evidence,
  Freshness,
  Language,
} from '../types.js';
import { criteriaMessage } from '../i18n/criteria.js';
import { isSameCriterionText, renderCriteriaSection } from './criteria.js';

/**
 * Port minimal pour passer les preuves en « à revoir » (SPEC §8.4) : le
 * `EvidenceStore` complet le satisfait structurellement, un test peut n'en
 * injecter que ces deux méthodes.
 */
export interface EvidenceFreshnessPort {
  listEvidencesByCriterion(criterionId: string): Promise<Evidence[]>;
  markEvidencesToReconfirm(criterionId: string, fromVersion: number): Promise<number>;
}

/** Ce dont `changeCriterionText` a besoin pour écrire et dater. */
export interface TextChangeDeps {
  saveCriterion(criterion: Criterion): Promise<void>;
  addCriterionRevision(revision: CriterionRevision): Promise<void>;
  /** Absent : le changement est calculé sans toucher aux preuves. */
  evidence?: EvidenceFreshnessPort;
  clock: Clock;
}

export interface TextChangeRequest {
  criterion: Criterion;
  newText: string;
  actor: Actor;
  language?: Language;
}

export interface TextChangeResult {
  /** Le critère à jour ; inchangé si le texte ne bouge pas. */
  criterion: Criterion;
  /** `null` quand le texte est identique : aucune version créée. */
  revision: CriterionRevision | null;
  /** Identifiants des preuves passées en « à revoir ». */
  toReconfirmEvidenceIds: string[];
  /** Vrai quand une nouvelle version a été écrite. */
  changed: boolean;
}

/**
 * Change le texte d'un critère (SPEC §8.4) : `version + 1`, une ligne
 * d'historique, et les preuves des versions antérieures passent en
 * `to-reconfirm` — un clic les confirme si le changement était cosmétique,
 * sinon elles tombent.
 *
 * Le code, le type, la force exigée et `createdAt` ne bougent pas : le code
 * reste stable même quand le texte change (SPEC §8.1). Un agent peut demander
 * le changement, mais la trace porte son compte (`changedBy`).
 */
export async function changeCriterionText(
  request: TextChangeRequest,
  deps: TextChangeDeps,
): Promise<TextChangeResult> {
  const { criterion, actor } = request;
  const language = request.language ?? 'en';
  const text = request.newText.trim().replace(/\s+/g, ' ');
  if (text.length === 0) {
    throw new Error(
      criteriaMessage('criteria.error.emptyText', language, { code: criterion.code }),
    );
  }
  if (isSameCriterionText(text, criterion.text)) {
    return { criterion, revision: null, toReconfirmEvidenceIds: [], changed: false };
  }

  const at = deps.clock.now();
  const version = criterion.version + 1;
  const updated: Criterion = { ...criterion, text, version, updatedAt: at };
  const revision: CriterionRevision = {
    criterionId: criterion.id,
    version,
    text,
    type: criterion.type,
    changedBy: actor.accountId,
    at,
  };
  await deps.saveCriterion(updated);
  await deps.addCriterionRevision(revision);
  const toReconfirmEvidenceIds = await markPreviousVersionsToReconfirm(updated, deps);
  return { criterion: updated, revision, toReconfirmEvidenceIds, changed: true };
}

/**
 * Passe en « à revoir » les preuves des versions strictement antérieures
 * (SPEC §8.4). Celles déjà `to-reconfirm` ou `stale` ne sont pas recomptées :
 * on n'écrase pas un état plus ancien, et rien n'est supprimé (SPEC §20).
 */
async function markPreviousVersionsToReconfirm(
  criterion: Criterion,
  deps: TextChangeDeps,
): Promise<string[]> {
  if (deps.evidence === undefined) return [];
  const evidences = await deps.evidence.listEvidencesByCriterion(criterion.id);
  const targeted = evidences
    .filter((evidence) => evidence.criterionVersion < criterion.version)
    .filter((evidence) => evidence.freshness === 'fresh')
    .map((evidence) => evidence.id);
  if (targeted.length === 0) return [];
  await deps.evidence.markEvidencesToReconfirm(criterion.id, criterion.version);
  return [...new Set(targeted)].sort();
}

/* --------------------------------------------- section dans la description */

const SECTION_HEADING_RE =
  /^#{1,6}\s+(?:crit[eè]res?\s+d['’]acceptation|acceptance\s+criteria)\s*:?\s*$/i;
const NEXT_HEADING_RE = /^#{1,6}\s+\S/;

/** Position d'une section : de son titre à la ligne avant le prochain titre. */
export function findCriteriaSection(description: string): { start: number; end: number } | null {
  const lines = description.split('\n');
  const start = lines.findIndex((line) => SECTION_HEADING_RE.test(line.trim()));
  if (start < 0) return null;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (NEXT_HEADING_RE.test((lines[index] ?? '').trim())) {
      end = index;
      break;
    }
  }
  return { start, end };
}

/**
 * Remplace la section de critères d'une description en gardant tout le reste
 * (contexte, notes, liens) : c'est ce que l'app écrit dans Jira pour rester
 * lisible hors de l'app (SPEC §8.2). Sans section existante, elle est ajoutée.
 */
export function rewriteCriteriaSection(description: string, section: string): string {
  const clean = section.replace(/\s+$/, '');
  const found = findCriteriaSection(description);
  if (found === null) {
    const head = description.replace(/\s+$/, '');
    return head.length === 0 ? `${clean}\n` : `${head}\n\n${clean}\n`;
  }
  const lines = description.split('\n');
  const head = lines.slice(0, found.start).join('\n').replace(/\s+$/, '');
  const after = lines.slice(found.end);
  while (after.length > 0 && (after[0] ?? '').trim() === '') after.shift();
  const tail = after.join('\n').replace(/\s+$/, '');
  const parts = [head, clean, tail].filter((part) => part.length > 0);
  return `${parts.join('\n\n')}\n`;
}

/** Rend la section puis l'écrit dans Jira via le port (SPEC §8.2). */
export async function publishCriteriaSection(
  jira: Pick<JiraGateway, 'rewriteDescriptionSection'>,
  issueId: string,
  criteria: readonly Criterion[],
  language: Language,
): Promise<boolean> {
  return jira.rewriteDescriptionSection(issueId, renderCriteriaSection(criteria, language));
}

/* ------------------------------------------------------------- cas limites */

/**
 * Cas limite SPEC §21 « critère non applicable » : on ne supprime rien. Le
 * critère reste au dossier avec sa version, et c'est une dérogation motivée
 * « sans objet » (lot L3) qui le couvre. Cette aide rend seulement lisible
 * l'état des preuves pour l'écran et le message.
 */
export function freshnessSummary(evidences: readonly Evidence[]): Record<Freshness, number> {
  const summary: Record<Freshness, number> = { fresh: 0, 'to-reconfirm': 0, stale: 0 };
  for (const evidence of evidences) summary[evidence.freshness] += 1;
  return summary;
}
