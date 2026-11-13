/**
 * Les chiffres clés de la vitrine, calculés depuis les données réelles (lot
 * `site-vitrine-confiance`).
 *
 * Pur et sans JSX : ce module se teste sans navigateur. Chaque chiffre de
 * l'app est LIS dans l'instantané embarqué (`bundledSnapshot()`), jamais
 * recopié ; chaque chiffre du dépôt vient de `sources.ts`, avec sa date de
 * mesure et son lien. Un instantané absent ou sans dossier retire les
 * chiffres de l'app — la bande n'affiche alors que ce qui reste vrai.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { DemoSnapshotData } from '../../../../../src/demo-contract.js';
import type { Language, Strength } from '../../../../../src/types.js';
import { text } from '../../../../../src/i18n/index.js';
import { REPORT_MESSAGES, strengthLabel } from '../../../../../src/i18n/reports.js';
import { reopeningShare } from '../../../../../src/domain/stats.js';
import { VITRINE } from '../../../i18n/vitrine.js';
import {
  GREEN_TESTS_FLOOR,
  GREEN_TESTS_MEASURED,
  PACKAGE_SOURCE_URL,
  REPO_MEASURED_ON,
  REPO_URL,
  RUNTIME_DEPENDENCIES,
  SNAPSHOT_SOURCE_URL,
} from './sources.js';

/** Les réouvertures lues dans l'historique, pour une force de preuve. */
export interface ReopeningFacts {
  readonly strength: Strength;
  readonly reopened: number;
  readonly closed: number;
}

/** Ce que l'instantané réel dit, et rien de plus. */
export interface LiveFacts {
  readonly tickets: number;
  readonly version: string;
  readonly projectKey: string;
  readonly criteriaTotal: number;
  readonly proven: number;
  readonly machineVerified: number;
  readonly attested: number;
  readonly living: number;
  readonly measuredOn: string;
  readonly waivers: number | null;
  readonly waiverGranters: number | null;
  readonly reopening: ReopeningFacts | null;
}

/** Un chiffre affiché : sa valeur, son libellé, son détail et sa source. */
export interface FigureItem {
  readonly id: string;
  readonly value: string;
  readonly label: string;
  readonly detail: string;
  readonly source: string;
  readonly href: string;
}

/** La bande complète : ses chiffres, sa date, son avertissement éventuel. */
export interface FigureBand {
  readonly items: readonly FigureItem[];
  readonly measuredOn: string | null;
  readonly repoMeasuredOn: string;
  readonly notice: string | null;
}

/** Les dérogations accordées et le nombre de personnes qui les ont accordées. */
function waiverFacts(snapshot: DemoSnapshotData): { count: number; granters: number } | null {
  const byGranter = snapshot.stats?.waiversByGranter;
  if (byGranter !== undefined && byGranter.length > 0) {
    const count = byGranter.reduce((total, entry) => total + entry.count, 0);
    return { count, granters: byGranter.length };
  }
  if (snapshot.waivers.length === 0) return null;
  const granters = new Set(snapshot.waivers.map((waiver) => waiver.grantedBy));
  return { count: snapshot.waivers.length, granters: granters.size };
}

/** La force de preuve qui porte les réouvertures mesurées. */
function reopeningFacts(snapshot: DemoSnapshotData): ReopeningFacts | null {
  const rates = snapshot.stats?.reopenings ?? [];
  return rates.reduce<ReopeningFacts | null>(
    (top, rate) =>
      rate.reopened > (top?.reopened ?? 0)
        ? { strength: rate.strength, reopened: rate.reopened, closed: rate.closed }
        : top,
    null,
  );
}

/** Les chiffres lus dans l'instantané réel, ou `null` s'il n'y en a pas. */
export function liveFacts(snapshot: DemoSnapshotData | null): LiveFacts | null {
  const dossier = snapshot?.dossier ?? null;
  if (snapshot === null || dossier === null) return null;
  const waivers = waiverFacts(snapshot);
  return {
    tickets: dossier.totals.issues,
    version: dossier.versionName,
    projectKey: dossier.projectKey,
    criteriaTotal: dossier.totals.criteria,
    proven: dossier.totals.proven,
    machineVerified: dossier.totals.machineVerified,
    attested: dossier.totals.attested,
    living: snapshot.living.length,
    measuredOn: snapshot.generatedAt,
    waivers: waivers?.count ?? null,
    waiverGranters: waivers?.granters ?? null,
    reopening: reopeningFacts(snapshot),
  };
}

/** Une date lisible, dans la langue du visiteur, sans dépendre du fuseau. */
export function formatDate(iso: string, lang: Language): string {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
  const parts = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(new Date(iso));
  const pick = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  const day = pick('day');
  const month = pick('month');
  const year = pick('year');
  return lang === 'fr' ? `${day} ${month} ${year}` : `${month} ${day}, ${year}`;
}

/** Le chiffre des dérogations, avec le nombre de personnes. */
function waiverItem(facts: LiveFacts, lang: Language): FigureItem | null {
  const t = VITRINE[lang].figures;
  if (facts.waivers === null || facts.waiverGranters === null) return null;
  return {
    id: 'waivers',
    value: String(facts.waivers),
    label: t.labels.waivers,
    detail: t.labels.waiversBy.replace('{people}', String(facts.waiverGranters)),
    source: t.sources.app,
    href: SNAPSHOT_SOURCE_URL,
  };
}

/** Le chiffre des réouvertures, avec la force de preuve qui les porte. */
function reopeningItem(facts: LiveFacts, lang: Language): FigureItem | null {
  const t = VITRINE[lang].figures;
  const reopening = facts.reopening;
  if (reopening === null) return null;
  // Le détail réutilise la phrase de l'app (`reports.stats.reopening.line`) :
  // même calcul de part, mêmes mots que la page projet du ticket.
  const detail = text(REPORT_MESSAGES, 'reports.stats.reopening.line', lang, {
    label: strengthLabel(reopening.strength, lang),
    reopened: reopening.reopened,
    closed: reopening.closed,
    share: reopeningShare(reopening),
  }).replace(/^[-–]\s*/, '');
  return {
    id: 'reopenings',
    value: String(reopening.reopened),
    label: t.labels.reopenings,
    detail,
    source: t.sources.history,
    href: SNAPSHOT_SOURCE_URL,
  };
}

/** Les chiffres de l'app installée, dans l'ordre d'affichage. */
function liveItems(facts: LiveFacts, lang: Language): FigureItem[] {
  const t = VITRINE[lang].figures;
  const items: FigureItem[] = [
    {
      id: 'tickets',
      value: String(facts.tickets),
      label: t.labels.tickets.replace('{version}', facts.version),
      detail: t.labels.ticketsDetail
        .replace('{version}', facts.version)
        .replace('{project}', facts.projectKey),
      source: t.sources.dossier.replace('{version}', facts.version),
      href: SNAPSHOT_SOURCE_URL,
    },
    {
      id: 'proven',
      value: `${facts.proven} / ${facts.criteriaTotal}`,
      label: t.labels.proven,
      detail: t.labels.provenDetail
        .replace('{machine}', String(facts.machineVerified))
        .replace('{attested}', String(facts.attested)),
      source: t.sources.dossier.replace('{version}', facts.version),
      href: SNAPSHOT_SOURCE_URL,
    },
    {
      id: 'living',
      value: String(facts.living),
      label: t.labels.living,
      detail: t.labels.livingDetail,
      source: t.sources.app,
      href: SNAPSHOT_SOURCE_URL,
    },
  ];
  const waivers = waiverItem(facts, lang);
  if (waivers !== null) items.splice(2, 0, waivers);
  const reopening = reopeningItem(facts, lang);
  if (reopening !== null) items.splice(3, 0, reopening);
  return items;
}

/** Les chiffres du dépôt, écrits en dur avec leur source visible. */
function repoItems(lang: Language): FigureItem[] {
  const t = VITRINE[lang].figures;
  return [
    {
      id: 'tests',
      value: `${GREEN_TESTS_FLOOR}+`,
      label: t.labels.tests,
      detail: `${t.labels.testsDetail} · ${t.labels.testsCount
        .replace('{count}', String(GREEN_TESTS_MEASURED))
        .replace('{date}', formatDate(REPO_MEASURED_ON, lang))}`,
      source: t.sources.repo,
      href: REPO_URL,
    },
    {
      id: 'runtime-deps',
      value: String(RUNTIME_DEPENDENCIES),
      label: t.labels.runtimeDeps,
      detail: t.labels.runtimeDepsDetail,
      source: t.sources.package,
      href: PACKAGE_SOURCE_URL,
    },
  ];
}

/** La bande de chiffres clés : l'app d'abord, le dépôt ensuite. */
export function keyFigures(lang: Language, snapshot: DemoSnapshotData | null): FigureBand {
  const t = VITRINE[lang].figures;
  const facts = liveFacts(snapshot);
  return {
    items: facts === null ? repoItems(lang) : [...liveItems(facts, lang), ...repoItems(lang)],
    measuredOn: facts === null ? null : formatDate(facts.measuredOn, lang),
    repoMeasuredOn: formatDate(REPO_MEASURED_ON, lang),
    notice: facts === null ? t.missingLive : null,
  };
}
