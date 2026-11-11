/**
 * Dossier de preuve d'une version (SPEC §4, §17 lot S, FP-17).
 *
 * Le dossier est un instantané figé : une version, ses tickets, et pour chaque
 * critère son exigence, sa preuve, son attestant, sa date, son commit et ses
 * dérogations. Il se relit d'un bloc et s'exporte en Markdown, collable tel
 * quel dans Confluence (SPEC §14 FP-17).
 *
 * Deux choix de lecture, hérités du SPEC §20 :
 * - rien ne se supprime : une dérogation révoquée n'apparaît pas, mais elle
 *   reste en base ;
 * - un ticket sans couverture n'est pas une erreur : il apparaît avec zéro
 *   critère prouvé, pour que le dossier dise la vérité plutôt que d'échouer.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes. Domaine pur.
 */
import type { Clock, CoverageEngine, JiraGateway, ProofStore } from '../ports.js';
import type {
  Coverage,
  CriterionState,
  DossierIssue,
  DossierTotals,
  Evidence,
  IssueRef,
  Language,
  ReleaseDossier,
  Waiver,
} from '../types.js';
import { reportMessage } from '../i18n/reports.js';

/** Ce dont le dossier a besoin, injecté. */
export interface DossierDeps {
  store: ProofStore;
  jira: JiraGateway;
  clock: Clock;
  /** La couverture se lit par le moteur, jamais recalculée ici (SPEC §22.10). */
  coverage: CoverageEngine;
}

/** La version dont on veut le dossier de preuve. */
export interface VersionInput {
  projectId: string;
  projectKey: string;
  versionId: string;
  versionName: string;
  language?: Language;
}

/** La preuve retenue d'un critère, telle qu'elle s'affiche dans le dossier. */
interface ProofLine {
  evidence: string;
  attester: string;
  commit: string;
  date: string;
}

/** Les sept compteurs du dossier, calculés, jamais estimés. */
export function computeDossierTotals(issues: readonly DossierIssue[]): DossierTotals {
  const totals: DossierTotals = {
    issues: issues.length,
    criteria: 0,
    proven: 0,
    machineVerified: 0,
    attested: 0,
    declared: 0,
    waived: 0,
  };
  for (const issue of issues) {
    totals.criteria += issue.total;
    totals.proven += issue.proven;
    totals.waived += issue.waived;
    for (const state of issue.criteria) {
      if (!state.proven || state.bestStrength === null) continue;
      if (state.bestStrength === 'machine-verified') totals.machineVerified += 1;
      else if (state.bestStrength === 'attested') totals.attested += 1;
      else totals.declared += 1;
    }
  }
  return totals;
}

/** Les dérogations encore actives d'un ticket (SPEC §12.4). */
function activeWaivers(waivers: readonly Waiver[]): Waiver[] {
  return waivers.filter((waiver) => waiver.revokedAt === '');
}

/** Assemble un ticket du dossier : ses critères, ses preuves, ses dérogations. */
export function buildDossierIssue(
  issue: IssueRef,
  coverage: Coverage | null,
  waivers: readonly Waiver[],
): DossierIssue {
  return {
    issueKey: issue.key,
    summary: issue.summary,
    total: coverage?.total ?? 0,
    proven: coverage?.proven ?? 0,
    waived: coverage?.waived ?? 0,
    waivers: activeWaivers(waivers),
    criteria: coverage?.criteria ?? [],
  };
}

/** La dérogation active d'un critère, s'il y en a une. */
function waiverOf(state: CriterionState, waivers: readonly Waiver[]): Waiver | null {
  if (!state.waived) return null;
  return waivers.find((waiver) => waiver.criterionId === state.criterionId) ?? null;
}

/**
 * Lit la couverture d'un ticket : le moteur d'abord, le store en repli
 * (un dossier ne doit pas échouer parce qu'un recalcul est indisponible).
 */
async function readCoverage(deps: DossierDeps, issue: IssueRef): Promise<Coverage | null> {
  const fromEngine = await deps.coverage.read(issue.id);
  if (fromEngine !== null) return fromEngine;
  return deps.store.getCoverage(issue.id);
}

/** Construit le dossier de preuve d'une version, ticket par ticket. */
export async function buildVersionDossier(
  deps: DossierDeps,
  input: VersionInput,
): Promise<ReleaseDossier> {
  const issues = await deps.jira.listIssuesOfVersion(input.projectId, input.versionId);
  const dossierIssues: DossierIssue[] = [];
  for (const issue of issues) {
    const coverage = await readCoverage(deps, issue);
    const waivers = await deps.store.listWaiversByIssue(issue.id);
    dossierIssues.push(buildDossierIssue(issue, coverage, waivers));
  }
  return {
    versionId: input.versionId,
    versionName: input.versionName,
    projectKey: input.projectKey,
    generatedAt: deps.clock.now(),
    issues: dossierIssues,
    totals: computeDossierTotals(dossierIssues),
  };
}

/**
 * Le dossier d'une version : celui déjà figé en base s'il existe, sinon
 * construit puis mémorisé. Un dossier publié ne se réécrit pas tout seul.
 */
export async function getOrGenerateDossier(
  deps: DossierDeps,
  input: VersionInput,
): Promise<ReleaseDossier> {
  const existing = await deps.store.getDossier(input.versionId);
  if (existing !== null) return existing;
  const dossier = await buildVersionDossier(deps, input);
  await deps.store.saveDossier(dossier);
  return dossier;
}

/** La preuve d'un critère : référence, attestant, commit, date (SPEC §9). */
function proofLineOf(state: CriterionState, language: Language): ProofLine {
  const best: Evidence | undefined =
    state.evidences.find((evidence) => evidence.id === state.bestEvidenceId) ?? state.evidences[0];
  if (best === undefined) {
    const none = reportMessage('reports.dossier.none', language);
    return { evidence: none, attester: none, commit: none, date: none };
  }
  return {
    evidence: best.reference === '' ? best.type : best.reference,
    attester: best.addedByAgent ? reportMessage('reports.dossier.agent', language) : best.addedBy,
    commit: best.commit === '' ? reportMessage('reports.dossier.none', language) : best.commit,
    date: best.at === '' ? reportMessage('reports.dossier.none', language) : best.at.slice(0, 10),
  };
}

/** L'état d'un critère, dans la langue du projet (SPEC §20). */
function stateLabel(state: CriterionState, language: Language): string {
  if (state.proven) return reportMessage('reports.dossier.state.proven', language);
  if (state.waived) return reportMessage('reports.dossier.state.waived', language);
  return reportMessage('reports.dossier.state.unproven', language);
}

/** La dérogation d'un critère, motif et signataire compris (§12.4). */
function waiverLabel(
  state: CriterionState,
  waivers: readonly Waiver[],
  language: Language,
): string {
  const waiver = waiverOf(state, waivers);
  if (waiver === null) return reportMessage('reports.dossier.none', language);
  return reportMessage('reports.dossier.waiverLine', language, {
    reason: waiver.reason,
    granter: waiver.grantedBy,
  });
}

/** Échappe le séparateur de colonnes Markdown d'une cellule. */
function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** Les en-têtes du tableau de critères (SPEC §14 FP-17 : les six colonnes). */
function tableHeader(language: Language): string[] {
  const columns = ['criterion', 'strength', 'state', 'evidence', 'attester', 'commit', 'date', 'waiver'];
  const labels = columns.map((column) =>
    reportMessage(`reports.dossier.column.${column}`, language),
  );
  return [`| ${labels.join(' | ')} |`, `|${columns.map(() => '---').join('|')}|`];
}

/** Le rendu Markdown d'un ticket du dossier. */
function renderIssue(issue: DossierIssue, language: Language): string[] {
  const lines = [
    reportMessage('reports.dossier.issueHeading', language, {
      issueKey: issue.issueKey,
      summary: issue.summary,
    }),
    '',
    reportMessage('reports.dossier.issueCoverage', language, {
      proven: issue.proven,
      total: issue.total,
      waived: issue.waived,
    }),
    '',
    ...tableHeader(language),
  ];
  for (const state of issue.criteria) {
    const proof = proofLineOf(state, language);
    lines.push(
      `| ${cell(`${state.code} — ${state.text}`)} | ${state.requiredStrength} | ${stateLabel(state, language)} | ${cell(proof.evidence)} | ${cell(proof.attester)} | ${cell(proof.commit)} | ${proof.date} | ${cell(waiverLabel(state, issue.waivers, language))} |`,
    );
  }
  lines.push('');
  return lines;
}

/** Le résumé de la version : les sept totaux, jamais une estimation. */
function renderSummary(dossier: ReleaseDossier, language: Language): string[] {
  return [
    `## ${reportMessage('reports.dossier.summary', language)}`,
    '',
    `- ${reportMessage('reports.dossier.issues', language, { count: dossier.totals.issues })}`,
    `- ${reportMessage('reports.dossier.criteria', language, { count: dossier.totals.criteria })}`,
    `- ${reportMessage('reports.dossier.proven', language, { count: dossier.totals.proven })}`,
    `  - ${reportMessage('reports.strength.machine-verified', language)} : ${dossier.totals.machineVerified}`,
    `  - ${reportMessage('reports.strength.attested', language)} : ${dossier.totals.attested}`,
    `  - ${reportMessage('reports.strength.declared', language)} : ${dossier.totals.declared}`,
    `- ${reportMessage('reports.dossier.waived', language, { count: dossier.totals.waived })}`,
    '',
  ];
}

/**
 * Exporte le dossier en Markdown, prêt pour Confluence (SPEC §14 FP-17) :
 * chaque critère y porte son exigence, sa preuve, son attestant, sa date,
 * son commit et sa dérogation.
 */
export function renderDossierMarkdown(dossier: ReleaseDossier, language: Language = 'en'): string {
  const lines = [
    `# ${reportMessage('reports.dossier.title', language, {
      versionName: dossier.versionName,
      projectKey: dossier.projectKey,
    })}`,
    '',
    reportMessage('reports.dossier.generatedAt', language, { date: dossier.generatedAt }),
    '',
    ...renderSummary(dossier, language),
    `## ${reportMessage('reports.dossier.detail', language)}`,
    '',
  ];
  for (const issue of dossier.issues) lines.push(...renderIssue(issue, language));
  return lines.join('\n').trimEnd();
}
