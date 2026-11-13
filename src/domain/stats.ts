/**
 * Statistiques de preuve (SPEC §14 FP-18, §12.4, §26).
 *
 * Trois mesures, celles qui rendent la qualité des « Terminé » visible :
 * - la couverture par force : quelle part des critères prouvés l'est par
 *   machine, par attestation, ou par simple déclaration ;
 * - les réouvertures selon la force de la preuve : c'est la mesure qui dit si
 *   une preuve déclarée tient (SPEC §26, « preuves de complaisance ») ;
 * - les dérogations par projet et par personne : une règle dérogée en
 *   permanence est une règle à revoir (SPEC §12.4).
 *
 * Le calcul est pur ; la lecture de la base et la résolution des noms
 * d'affichage passent par les ports (`ProofStore`, `JiraGateway`).
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Clock, JiraGateway, ProofStore } from '../ports';
import type {
  Coverage,
  GranterCount,
  ProofStats,
  ReopeningRate,
  Strength,
  TicketStatusHistory,
  Waiver,
} from '../types';
import { isClosedStatus } from './status';

/** Les trois forces, de la plus forte à la plus faible, pour l'affichage. */
export const STRENGTHS_DISPLAY_ORDER: readonly Strength[] = [
  'machine-verified',
  'attested',
  'declared',
];

/** Une clôture suivie de sa réouverture éventuelle (SPEC §14 FP-18). */
export interface ReopenEvent {
  strength: Strength;
  reopened: boolean;
}

/** Les données brutes d'un calcul de statistiques. */
export interface StatsSource {
  projectId: string;
  since: string;
  coverages: readonly Coverage[];
  waivers: readonly Waiver[];
  closedWithoutValidator: number;
  reopens?: readonly ReopenEvent[];
}

/** Ce dont la collecte a besoin : la persistance, Jira (noms), l'horloge. */
export interface StatsDeps {
  store: ProofStore;
  jira: JiraGateway;
  clock: Clock;
}

/** Les trois compteurs à zéro, un par force. */
export function emptyCoverageByStrength(): Record<Strength, number> {
  return { declared: 0, attested: 0, 'machine-verified': 0 };
}

/** Répartit les critères prouvés selon la force de leur meilleure preuve. */
export function aggregateCoverageByStrength(
  coverages: readonly Coverage[],
): Record<Strength, number> {
  const counts = emptyCoverageByStrength();
  for (const coverage of coverages) {
    for (const state of coverage.criteria) {
      if (!state.proven || state.bestStrength === null) continue;
      counts[state.bestStrength] += 1;
    }
  }
  return counts;
}

/** Nombre total de critères prouvés, toutes forces confondues. */
export function provenCriteria(coverages: readonly Coverage[]): number {
  return coverages.reduce((total, coverage) => total + coverage.proven, 0);
}

/**
 * Dérogations accordées par personne depuis `since` : les dérogations
 * révoquées ne comptent plus, celles qui n'expirent jamais comptent (§12.4).
 */
export function aggregateWaiversByGranter(
  waivers: readonly Waiver[],
  since: string,
): GranterCount[] {
  const byGranter = new Map<string, number>();
  for (const waiver of waivers) {
    if (waiver.revokedAt !== '') continue;
    if (waiver.at < since) continue;
    byGranter.set(waiver.grantedBy, (byGranter.get(waiver.grantedBy) ?? 0) + 1);
  }
  return [...byGranter.entries()]
    .map(([accountId, count]) => ({ accountId, displayName: accountId, count }))
    .sort((left, right) => right.count - left.count || left.accountId.localeCompare(right.accountId));
}

/** Taux de réouverture par force de preuve, forces les plus fortes d'abord. */
export function reopeningRates(events: readonly ReopenEvent[]): ReopeningRate[] {
  const counts = new Map<Strength, { closed: number; reopened: number }>();
  for (const strength of STRENGTHS_DISPLAY_ORDER) counts.set(strength, { closed: 0, reopened: 0 });
  for (const event of events) {
    const entry = counts.get(event.strength);
    if (entry === undefined) continue;
    entry.closed += 1;
    if (event.reopened) entry.reopened += 1;
  }
  return STRENGTHS_DISPLAY_ORDER.map((strength) => {
    const entry = counts.get(strength) ?? { closed: 0, reopened: 0 };
    return { strength, closed: entry.closed, reopened: entry.reopened };
  });
}

/** Part de réouvertures d'une ligne, en pourcentage arrondi ; 0 si rien de clos. */
export function reopeningShare(rate: ReopeningRate): number {
  if (rate.closed === 0) return 0;
  return Math.round((rate.reopened / rate.closed) * 100);
}

/**
 * Vrai si un ticket a été livré puis rouvert : son historique passe par un
 * statut livré, puis par un statut ouvert (SPEC §14 FP-18).
 */
export function wasReopened(history: TicketStatusHistory): boolean {
  let delivered = false;
  for (const transition of history.transitions) {
    if (isClosedStatus(transition.to)) delivered = true;
    else if (delivered) return true;
  }
  return false;
}

/** La force de la preuve d'un ticket : la meilleure de ses critères prouvés. */
function strengthOf(coverage: Coverage | undefined): Strength {
  let best: Strength = 'declared';
  for (const state of coverage?.criteria ?? []) {
    if (!state.proven || state.bestStrength === null) continue;
    // `STRENGTHS_DISPLAY_ORDER` va de la plus forte à la plus faible : c'est le
    // plus petit indice qui gagne.
    if (STRENGTHS_DISPLAY_ORDER.indexOf(state.bestStrength) < STRENGTHS_DISPLAY_ORDER.indexOf(best)) {
      best = state.bestStrength;
    }
  }
  return best;
}

/**
 * Les réouvertures d'un projet : un événement par ticket livré, dit s'il a
 * été rouvert ensuite. La force est celle de sa preuve (SPEC §14, §26 : plus
 * la preuve est faible, plus le ticket rouvre).
 */
export function reopeningEvents(
  histories: readonly TicketStatusHistory[],
  coverages: readonly Coverage[],
): ReopenEvent[] {
  const byIssueId = new Map(coverages.map((coverage) => [coverage.issueId, coverage]));
  const events: ReopenEvent[] = [];
  for (const history of histories) {
    const delivered =
      history.transitions.some((transition) => isClosedStatus(transition.to)) ||
      isClosedStatus(history.currentStatus);
    if (!delivered) continue;
    events.push({
      strength: strengthOf(byIssueId.get(history.issueId)),
      reopened: wasReopened(history),
    });
  }
  return events;
}

/** Assemble les statistiques d'un projet à partir des données brutes. */
export function buildProofStats(source: StatsSource): ProofStats {
  return {
    projectId: source.projectId,
    since: source.since,
    coverageByStrength: aggregateCoverageByStrength(source.coverages),
    waiversByGranter: aggregateWaiversByGranter(source.waivers, source.since),
    closedWithoutValidator: source.closedWithoutValidator,
    reopenings: reopeningRates(source.reopens ?? []),
  };
}

/** Remplace l'identifiant par le nom affiché, quand Jira le connaît. */
async function withDisplayNames(
  jira: JiraGateway,
  granters: readonly GranterCount[],
): Promise<GranterCount[]> {
  const resolved: GranterCount[] = [];
  for (const granter of granters) {
    const displayName = await jira.displayName(granter.accountId);
    resolved.push({ ...granter, displayName: displayName === '' ? granter.accountId : displayName });
  }
  return resolved;
}

/**
 * Collecte les statistiques d'un projet : les agrégats viennent de
 * `ReportingStore.computeStats` (une requête bornée côté adaptateur), les
 * noms affichés de Jira, les réouvertures de l'appelant (elles se déduisent de
 * l'historique Jira, pas de la base de l'app).
 */
export async function collectStats(
  deps: StatsDeps,
  projectId: string,
  since: string,
  reopens: readonly ReopenEvent[] = [],
): Promise<ProofStats> {
  const base = await deps.store.computeStats(projectId, since);
  return {
    ...base,
    projectId,
    since,
    waiversByGranter: await withDisplayNames(deps.jira, base.waiversByGranter),
    reopenings: reopens.length > 0 ? reopeningRates(reopens) : base.reopenings,
  };
}
