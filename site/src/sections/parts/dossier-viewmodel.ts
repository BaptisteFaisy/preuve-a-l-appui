/**
 * Vue-modèle du bloc « dossier de preuve » du site public (lot `site-dossier`).
 *
 * Le site montre TOUT le projet de démonstration, pas seulement le ticket
 * vedette : la source est le dossier figé par l'app installée
 * (`snapshot.dossier`, un `ReleaseDossier` — SPEC §17, FP-17), dont chaque
 * ticket (`DossierIssue`) porte sa couverture, ses dérogations et ses
 * critères prouvés.
 *
 * Règles tenues ici :
 * - aucun chiffre ni texte inventé : tout vient du dossier réel ;
 * - aucun identifiant de compte : les seules personnes nommées sont celles
 *   de `snapshot.actors`, résolues par leur référence (`actor-1`…→ nom
 *   affiché) ; une référence inconnue n'est jamais affichée ;
 * - les couleurs de couverture et d'état viennent des view-models de l'app
 *   (`computeCoverageTone`, `LozengeAppearance`), jamais d'un code couleur
 *   recopié ici.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { DemoSnapshotData, SnapshotActor } from '../../../../src/demo-contract.js';
import type { DossierIssue, DossierTotals, Language } from '../../../../src/types.js';
import { reportMessage } from '../../../../src/i18n/reports.js';
import { text } from '../../../../src/i18n/index.js';
import { UI_MESSAGES } from '../../../../src/i18n/ui.js';
import { computeCoverageTone } from '../../../../src/viewmodel/coverage.js';
import type { CoverageColorTone } from '../../../../src/viewmodel/coverage.js';
import type { LozengeAppearance } from '../../../../src/viewmodel/matrix.js';
import { DOSSIER_STRINGS } from '../../i18n/dossier.js';

/** L'état lisible d'un ticket du dossier. */
export type DossierStateKind = 'delivered' | 'in-progress' | 'waived';

/** Une dérogation du dossier, avec son accordant déjà résolu. */
export interface DossierWaiverView {
  readonly reason: string;
  /** Nom d'affichage de l'accordant ; `null` si la référence est inconnue. */
  readonly granter: string | null;
}

/** Un ticket du dossier, prêt à être rendu. */
export interface DossierIssueView {
  readonly issueKey: string;
  readonly summary: string;
  readonly proven: number;
  readonly total: number;
  readonly coverageLabel: string;
  readonly coverageTone: CoverageColorTone;
  /** Texte d'explication de la couverture, dans la langue du site. */
  readonly coverageTooltip: string;
  readonly waiverCount: number;
  readonly waivers: readonly DossierWaiverView[];
  readonly state: DossierStateKind;
}

/** Le dossier complet, prêt à être rendu. */
export interface DossierView {
  readonly versionName: string;
  readonly projectKey: string;
  readonly generatedAt: string;
  readonly issues: readonly DossierIssueView[];
  readonly totals: DossierTotals;
}

/**
 * Le nom d'affichage d'une personne, résolu par les acteurs de l'instantané.
 * Une référence inconnue ne rend RIEN : jamais de pseudonyme, jamais
 * d'identifiant de compte (garde du lot).
 */
export function displayNameOf(
  actors: readonly SnapshotActor[],
  ref: string,
): string | null {
  if (ref === '') return null;
  const actor = actors.find((candidate) => candidate.ref === ref);
  return actor === undefined ? null : actor.displayName;
}

/** L'état lisible d'un ticket : dérogé, livré, sinon en cours. */
export function dossierStateOf(issue: DossierIssue): DossierStateKind {
  if (issue.waived > 0 || issue.waivers.length > 0) return 'waived';
  if (issue.total > 0 && issue.proven >= issue.total) return 'delivered';
  return 'in-progress';
}

/** L'apparence de la pastille d'état, celle des view-models de l'app. */
export function dossierAppearanceOf(state: DossierStateKind): LozengeAppearance {
  if (state === 'delivered') return 'success';
  if (state === 'waived') return 'moved';
  return 'inprogress';
}

/** Le libellé de l'état d'un ticket, dans la langue du site. */
export function dossierStateLabel(state: DossierStateKind, lang: Language): string {
  const extra = DOSSIER_STRINGS[lang];
  if (state === 'delivered') return extra.stateDelivered;
  if (state === 'waived') return reportMessage('reports.dossier.state.waived', lang);
  return extra.stateInProgress;
}

/** La couverture « n / m » d'un ticket, comme le champ de couverture de l'app. */
export function dossierCoverageOf(
  issue: DossierIssue,
  lang: Language,
  state: DossierStateKind,
): { readonly label: string; readonly tone: CoverageColorTone; readonly tooltip: string } {
  if (issue.total === 0) {
    const empty = text(UI_MESSAGES, 'ui.coverage.empty', lang);
    return { label: empty, tone: computeCoverageTone(0, 0), tooltip: empty };
  }
  return {
    label: `${issue.proven} / ${issue.total}`,
    tone: computeCoverageTone(issue.proven, issue.total),
    tooltip: text(UI_MESSAGES, 'ui.coverage.tooltip', lang, {
      proven: issue.proven,
      total: issue.total,
      status: dossierStateLabel(state, lang),
    }),
  };
}

/** Les dérogations d'un ticket, l'accordant résolu par les acteurs. */
function waiverViews(
  issue: DossierIssue,
  actors: readonly SnapshotActor[],
): DossierWaiverView[] {
  return issue.waivers.map((waiver) => ({
    reason: waiver.reason,
    granter: displayNameOf(actors, waiver.grantedBy),
  }));
}

/** Un ticket du dossier, projeté pour l'affichage. */
function issueView(
  issue: DossierIssue,
  actors: readonly SnapshotActor[],
  lang: Language,
): DossierIssueView {
  const state = dossierStateOf(issue);
  const coverage = dossierCoverageOf(issue, lang, state);
  const waivers = waiverViews(issue, actors);
  return {
    issueKey: issue.issueKey,
    summary: issue.summary,
    proven: issue.proven,
    total: issue.total,
    coverageLabel: coverage.label,
    coverageTone: coverage.tone,
    coverageTooltip: coverage.tooltip,
    waiverCount: waivers.length,
    waivers,
    state,
  };
}

/**
 * Le dossier de la version, projeté pour l'affichage. Renvoie `null` quand
 * l'instantané n'en porte pas (ou n'en porte aucun ticket) : le bloc ne
 * s'affiche alors pas, sans rien laisser deviner.
 */
export function buildDossierView(
  snapshot: DemoSnapshotData | null,
  lang: Language,
): DossierView | null {
  const dossier = snapshot === null ? null : snapshot.dossier;
  if (dossier === null || dossier.issues.length === 0) return null;
  const actors = snapshot === null ? [] : snapshot.actors;
  return {
    versionName: dossier.versionName,
    projectKey: dossier.projectKey,
    generatedAt: dossier.generatedAt,
    totals: dossier.totals,
    issues: dossier.issues.map((issue) => issueView(issue, actors, lang)),
  };
}
