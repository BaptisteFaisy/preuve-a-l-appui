/**
 * ViewModel pur pour la page projet « Preuves » (SPEC §16.4, §13, §14).
 *
 * Transforme les données consolidées du projet : tickets en cours,
 * dérogations actives, critères livrés non prouvés (living proof)
 * et statistiques de couverture / réouverture.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { text } from '../i18n/index';
import { UI_MESSAGES } from '../i18n/ui';
import type {
  Coverage,
  Language,
  LivingProof,
  ProofStats,
  Waiver,
} from '../types';
import { buildCoverageFieldViewModel, type CoverageFieldViewModel } from './coverage';

export interface ProjectIssueItemViewModel {
  readonly issueId: string;
  readonly issueKey: string;
  readonly coverage: CoverageFieldViewModel;
  readonly passes: boolean;
}

export interface ProjectWaiverItemViewModel {
  readonly id: string;
  readonly criterionId: string;
  readonly grantedBy: string;
  readonly role: string;
  readonly reason: string;
  readonly atFormatted: string;
  readonly isRevoked: boolean;
}

export interface LivingProofItemViewModel {
  readonly id: string;
  readonly issueKey: string;
  readonly criterionId: string;
  readonly testName: string;
  readonly state: string;
  readonly component: string;
  readonly commit: string;
  readonly sinceFormatted: string;
}

export interface StrengthStatItem {
  readonly strength: string;
  readonly strengthLabel: string;
  readonly count: number;
}

export interface GranterStatItem {
  readonly accountId: string;
  readonly displayName: string;
  readonly count: number;
}

export interface ProjectPageViewModel {
  readonly projectId: string;
  readonly issues: readonly ProjectIssueItemViewModel[];
  readonly waivers: readonly ProjectWaiverItemViewModel[];
  readonly unprovenLiving: readonly LivingProofItemViewModel[];
  readonly stats: {
    readonly proofsByStrength: readonly StrengthStatItem[];
    readonly waiversByGranter: readonly GranterStatItem[];
    readonly closedWithoutValidator: number;
  } | null;
  readonly activeWaiversCount: number;
  readonly unprovenLivingCount: number;
}

function formatWaiverItem(waiver: Waiver): ProjectWaiverItemViewModel {
  return {
    id: waiver.id,
    criterionId: waiver.criterionId,
    grantedBy: waiver.grantedBy,
    role: waiver.role,
    reason: waiver.reason,
    atFormatted: waiver.at ? waiver.at.slice(0, 10) : '',
    isRevoked: waiver.revokedAt !== '',
  };
}

function formatLivingItem(living: LivingProof): LivingProofItemViewModel {
  return {
    id: living.id,
    issueKey: living.issueKey,
    criterionId: living.criterionId,
    testName: living.testName,
    state: living.state,
    component: living.component,
    commit: living.commit,
    sinceFormatted: living.since ? living.since.slice(0, 10) : '',
  };
}

function formatStats(stats: ProofStats | null, language: Language) {
  if (!stats) return null;
  const strengths = ['machine-verified', 'attested', 'declared'] as const;
  const proofsByStrength: StrengthStatItem[] = strengths.map((s) => ({
    strength: s,
    strengthLabel: text(UI_MESSAGES, `strength.${s}`, language),
    count: stats.coverageByStrength[s] ?? 0,
  }));

  const waiversByGranter: GranterStatItem[] = stats.waiversByGranter.map((g) => ({
    accountId: g.accountId,
    displayName: g.displayName || g.accountId,
    count: g.count,
  }));

  return {
    proofsByStrength,
    waiversByGranter,
    closedWithoutValidator: stats.closedWithoutValidator,
  };
}

export function buildProjectPageViewModel(params: {
  projectId: string;
  coverages: readonly Coverage[];
  waivers: readonly Waiver[];
  living: readonly LivingProof[];
  stats: ProofStats | null;
  language: Language;
}): ProjectPageViewModel {
  const { projectId, coverages, waivers, living, stats, language } = params;

  const issues: ProjectIssueItemViewModel[] = coverages.map((cov) => ({
    issueId: cov.issueId,
    issueKey: cov.issueKey,
    coverage: buildCoverageFieldViewModel(cov, language),
    passes: cov.passes,
  }));

  const formattedWaivers = waivers.map(formatWaiverItem);
  const activeWaivers = formattedWaivers.filter((w) => !w.isRevoked);

  const unprovenLiving = living
    .filter((l) => l.state !== 'proven')
    .map(formatLivingItem);

  return {
    projectId,
    issues,
    waivers: formattedWaivers,
    unprovenLiving,
    stats: formatStats(stats, language),
    activeWaiversCount: activeWaivers.length,
    unprovenLivingCount: unprovenLiving.length,
  };
}
