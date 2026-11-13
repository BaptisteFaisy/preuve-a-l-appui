/**
 * Prouve que le harness de test tient ses promesses (docs/CONTRACTS.md §5).
 *
 * Vérifie :
 * - aller-retour de chaque table du `ProofStore` (critères, preuves,
 *   dérogations, couverture, réglages, runs CI, liens, living, reporting) ;
 * - règles d'intégrité (pas de suppression physique : `replacedBy`, `revokedAt`) ;
 * - le scénario PAY-123 construit bien 4 critères dont 2 prouvés par machine,
 *   1 déclaration d'agent seule et 1 sans preuve ;
 * - l'horloge et les identifiants sont strictement déterministes ;
 * - les journaux d'appels de Jira, de la CI et du checker enregistrent tout.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import {
  AGENT,
  aCiSummary,
  aCoverage,
  aCriterion,
  aCriterionRevision,
  anAttestation,
  anEvidence,
  aLivingProof,
  aTestLink,
  aTestRun,
  aWaiver,
  BRANCH,
  ISSUE_ID,
  ISSUE_KEY,
  PROJECT_ID,
  REPO,
  settings,
  TESTER,
  TEST_LOG,
  TEST_REFUSAL,
} from './builders.js';
import { createFakeClock, createFakeIds, createRecordingLogger } from './fake-clock.js';
import {
  createFakeEvidenceChecker,
  createFakeIdentity,
  createFakeJira,
  createFakeLlm,
  createFakeQueue,
} from './fake-gateways.js';
import { createFakeStore } from './fake-store.js';
import { createPay123Scenario } from './scenario.js';

describe('harness : horloge, identifiants et journal', () => {
  it('fournit une horloge figée qui avance à la demande', () => {
    const clock = createFakeClock('2026-11-11T08:00:00.000Z');
    expect(clock.now()).toBe('2026-11-11T08:00:00.000Z');
    clock.advanceMinutes(15);
    expect(clock.now()).toBe('2026-11-11T08:15:00.000Z');
    clock.set('2026-11-12T00:00:00.000Z');
    expect(clock.now()).toBe('2026-11-12T00:00:00.000Z');
  });

  it('génère des identifiants déterministes par préfixe', () => {
    const ids = createFakeIds('x');
    expect(ids.next('crit')).toBe('crit_1');
    expect(ids.next('crit')).toBe('crit_2');
    expect(ids.next('ev')).toBe('ev_1');
    expect(ids.issued).toEqual(['crit_1', 'crit_2', 'ev_1']);
  });

  it('enregistre les lignes du journal avec leur niveau', () => {
    const logger = createRecordingLogger();
    logger.log('info', 'démarrage');
    logger.log('warn', 'attention', { code: 42 });
    expect(logger.atLevel('info')).toEqual(['démarrage']);
    expect(logger.atLevel('warn')).toEqual(['attention']);
    expect(logger.entries[1]?.meta).toEqual({ code: 42 });
  });
});

describe('harness : ProofStore en mémoire', () => {
  it('tient les critères, leur historique et le calcul du prochain code', async () => {
    const store = createFakeStore();
    expect(await store.nextCriterionCode(ISSUE_ID)).toBe('AC-1');

    await store.saveCriterion(aCriterion({ id: 'c1', code: 'AC-1' }));
    await store.saveCriterion(aCriterion({ id: 'c2', code: 'AC-2' }));
    expect(await store.nextCriterionCode(ISSUE_ID)).toBe('AC-3');

    await store.addCriterionRevision(aCriterionRevision({ criterionId: 'c1', version: 1 }));
    await store.addCriterionRevision(aCriterionRevision({ criterionId: 'c1', version: 2 }));
    const revisions = await store.listCriterionRevisions('c1');
    expect(revisions).toHaveLength(2);
    expect(revisions.map((r) => r.version)).toEqual([1, 2]);

    expect(await store.getCriterionByCode(ISSUE_ID, 'AC-2')).toMatchObject({ id: 'c2' });
  });

  it('gère les preuves, les attestations et la mise à revoir sans rien effacer', async () => {
    const store = createFakeStore();
    await store.saveEvidence(anEvidence({ id: 'e1', criterionId: 'c1', criterionVersion: 1 }));
    await store.saveEvidence(anEvidence({ id: 'e2', criterionId: 'c1', criterionVersion: 2 }));
    await store.addAttestation(anAttestation({ id: 'a1', criterionId: 'c1', evidenceId: 'e1' }));

    const touched = await store.markEvidencesToReconfirm('c1', 2);
    expect(touched).toBe(1);
    expect((await store.getEvidence('e1'))?.freshness).toBe('to-reconfirm');
    expect((await store.getEvidence('e2'))?.freshness).toBe('fresh');

    const attestations = await store.listAttestations('c1');
    expect(attestations).toHaveLength(1);
    expect(store.__tables.evidence.size).toBe(2);
  });

  it('gère les dérogations par révocation (jamais de suppression physique)', async () => {
    const store = createFakeStore();
    store.linkIssue('c1-issue', PROJECT_ID);
    await store.saveCriterion(aCriterion({ id: 'c1', issueId: 'c1-issue' }));
    await store.saveWaiver(aWaiver({ id: 'w1', criterionId: 'c1', at: '2026-11-10T00:00:00.000Z' }));

    const list = await store.listWaiversByProject(PROJECT_ID, '2026-11-01T00:00:00.000Z');
    expect(list).toHaveLength(1);

    const revoked = await store.revokeWaiver('w1', '2026-11-11T12:00:00.000Z');
    expect(revoked).toBe(true);
    // Une deuxième révocation est sans effet (idempotent, simule UPDATE … WHERE revoked_at = '')
    expect(await store.revokeWaiver('w1', '2026-11-11T13:00:00.000Z')).toBe(false);
    expect(store.__tables.waivers.get('w1')?.revokedAt).toBe('2026-11-11T12:00:00.000Z');
  });

  it('tient la couverture, les réglages et les tickets clos hors validateur', async () => {
    const store = createFakeStore();
    await store.saveSettings(settings({ projectId: PROJECT_ID, ciKeyHash: 'h-123' }));
    expect(await store.findProjectByCiKeyHash('h-123')).toMatchObject({ projectId: PROJECT_ID });

    store.recordClosed('closed-1', PROJECT_ID);
    store.recordClosed('closed-2', PROJECT_ID);
    await store.saveCoverage(aCoverage({ issueId: 'closed-2', passes: true }));

    const missed = await store.listClosedWithoutCoverage(PROJECT_ID, 10);
    expect(missed).toEqual(['closed-1']);
  });

  it('enregistre les pipelines CI et retrouve le dernier par branche', async () => {
    const store = createFakeStore();
    await store.saveTestRun(aTestRun({ id: 'r1', receivedAt: '2026-11-10T10:00:00.000Z' }));
    await store.saveTestRun(aTestRun({ id: 'r2', receivedAt: '2026-11-10T11:00:00.000Z' }));
    await store.addTestResults('r2', [
      { name: TEST_REFUSAL, state: 'passed', durationMs: 12 },
    ]);

    const latest = await store.latestRunForBranch('pay/paiements', 'feature/PAY-123-refusal-email');
    expect(latest?.id).toBe('r2');
    const outcomes = await store.latestOutcomesForBranch(
      'pay/paiements',
      'feature/PAY-123-refusal-email',
    );
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.name).toBe(TEST_REFUSAL);
  });

  it('tient les paires test ↔ critère et la preuve vivante après clôture', async () => {
    const store = createFakeStore();
    store.linkIssue('PAY-123', PROJECT_ID);
    await store.saveLink(aTestLink({ id: 'l1', testName: 't1', status: 'confirmed' }));
    await store.saveLink(aTestLink({ id: 'l2', testName: 't1', status: 'proposed' }));
    const confirmed = await store.listConfirmedLinksByTest('t1');
    expect(confirmed).toHaveLength(1);

    await store.saveLivingProof(aLivingProof({ id: 'lp1', state: 'proven' }));
    await store.saveLivingProof(aLivingProof({ id: 'lp2', state: 'regressed' }));
    const unproven = await store.listUnprovenLiving(PROJECT_ID);
    expect(unproven).toHaveLength(1);
    expect(unproven[0]?.id).toBe('lp2');
  });

  it('calcule des statistiques cohérentes depuis les tables', async () => {
    const store = createFakeStore();
    store.linkIssue('i1', PROJECT_ID);
    await store.saveCoverage(
      aCoverage({
        issueId: 'i1',
        criteria: [
          {
            criterionId: 'c1',
            code: 'AC-1',
            text: '',
            type: 'functional',
            version: 1,
            requiredStrength: 'machine-verified',
            bestEvidenceId: 'e1',
            bestStrength: 'machine-verified',
            proven: true,
            waived: false,
            minor: false,
            defect: null,
            expected: '',
            evidences: [],
            waiverId: '',
          },
        ],
      }),
    );
    const stats = await store.computeStats(PROJECT_ID, '2026-11-01T00:00:00.000Z');
    expect(stats.coverageByStrength['machine-verified']).toBe(1);
  });
});

describe('harness : passerelles externes pilotables et journal d’appels', () => {
  it('JiraGateway enregistre chaque lecture et écriture', async () => {
    const jira = createFakeJira();
    await jira.getIssue('PAY-123');
    await jira.rewriteDescriptionSection('10001', 'nouvelle section');
    await jira.setCoverageField('10001', 'Preuves', 2, 4);

    expect(jira.journal.methods()).toEqual([
      'getIssue',
      'rewriteDescriptionSection',
      'setCoverageField',
    ]);
    expect(jira.rewrites).toHaveLength(1);
    expect(jira.coverageFields[0]).toEqual({
      issueId: '10001',
      label: 'Preuves',
      proven: 2,
      total: 4,
    });
  });

  it('EvidenceChecker teste la présence des pièces et des rapports', async () => {
    const checker = createFakeEvidenceChecker({
      attachments: ['10001::capture.png'],
      reports: ['10001::rep::AC-1'],
      links: ['https://status.pay.com'],
      documentation: { 'https://wiki/page': '2026-11-11T09:00:00.000Z' },
    });
    expect(await checker.attachmentExists('10001', 'capture.png')).toBe(true);
    expect(await checker.attachmentExists('10001', 'autre.png')).toBe(false);
    expect(await checker.reportSection('10001', 'rep', 'AC-1')).toBe(true);
    expect(await checker.linkReachable('https://status.pay.com')).toBe(true);
    expect(await checker.documentationPage('https://wiki/page', '2026-11-11T08:00:00.000Z')).toBe(
      true,
    );
  });

  it('LlmGateway rejoue les réponses scriptées', async () => {
    const llm = createFakeLlm({
      types: ['security', 'regression'],
    });
    expect(await llm.classifyCriterion('chiffrement')).toBe('security');
    expect(await llm.classifyCriterion('rejouer')).toBe('regression');
    expect(await llm.classifyCriterion('autre')).toBe('functional');
  });

  it('IdentityGateway marque comme agent tout appel MCP', async () => {
    const identity = createFakeIdentity();
    const human = await identity.actorOf({
      accountId: 'u1',
      moduleId: 'panel',
      fromMcp: false,
      cloudId: 'cloud',
    });
    const agent = await identity.actorOf({
      accountId: 'u1',
      moduleId: 'mcp-tool',
      fromMcp: true,
      cloudId: 'cloud',
    });
    expect(human.agent).toBe(false);
    expect(agent.agent).toBe(true);
  });

  it('JobQueue conserve les messages et un journal d’appels complet', async () => {
    const queue = createFakeQueue();
    const message = { runId: 'r1', projectId: PROJECT_ID, summary: aCiSummary() };
    await queue.publish(message);

    expect(queue.published).toHaveLength(1);
    expect(queue.published[0]?.runId).toBe('r1');
    // Le journal est complet : une entrée par appel, méthode et arguments.
    expect(queue.journal.methods()).toEqual(['publish']);
    expect(queue.journal.count('publish')).toBe(1);
    expect(queue.journal.argsOf('publish')[0]?.[0]).toBe(message);
    expect(queue.journal.of('publish')[0]?.args).toEqual([message]);
  });
});

describe('harness : scénario PAY-123 (SPEC §7)', () => {
  it('construit un ticket à 4 critères avec la répartition exacte du cahier des charges', async () => {
    const scenario = await createPay123Scenario();

    expect(scenario.issue.key).toBe('PAY-123');
    expect(scenario.criteria).toHaveLength(4);
    const codes = scenario.criteria.map((c) => c.code);
    expect(codes).toEqual(['AC-1', 'AC-2', 'AC-3', 'AC-4']);

    // 2 preuves de test vérifiées par machine
    expect(scenario.evidences).toHaveLength(3);
    const machine = scenario.evidences.filter((e) => e.strength === 'machine-verified');
    expect(machine).toHaveLength(2);
    expect(machine.map((e) => e.reference)).toEqual([TEST_REFUSAL, TEST_LOG]);

    // 1 preuve déclarée par l'agent sur AC-3
    const declared = scenario.evidences.find((e) => e.criterionId === 'crit-3');
    expect(declared?.strength).toBe('declared');
    expect(declared?.addedByAgent).toBe(true);

    // AC-4 n'a aucune preuve dans le store
    const ac4Evidences = await scenario.store.listEvidencesByCriterion('crit-4');
    expect(ac4Evidences).toEqual([]);

    // Dérogation prête pour débloquer AC-4 (§7.4)
    expect(scenario.possibleWaiver.criterionId).toBe('crit-4');
    expect(scenario.possibleWaiver.reason).toContain('PAY-140');

    // Les résultats de CI sont bien en base
    const outcomes = await scenario.store.latestOutcomesForBranch(
      'pay/paiements',
      'feature/PAY-123-refusal-email',
    );
    expect(outcomes.map((o) => o.name)).toEqual([TEST_REFUSAL, TEST_LOG]);
  });

  it('journalise tout le chemin d’entrée de la CI (SPEC §10, §17)', async () => {
    const scenario = await createPay123Scenario();

    const found = await scenario.jira.findIssueByBranch(PROJECT_ID, BRANCH);
    expect(found?.key).toBe(ISSUE_KEY);
    await scenario.queue.publish({
      runId: 'run-1',
      projectId: PROJECT_ID,
      summary: scenario.ciSummary,
    });
    await scenario.coverage.recompute(ISSUE_ID);
    await scenario.jira.setCoverageField(ISSUE_ID, 'Preuves', 2, 4);

    // Chaque journal est complet : toutes les méthodes, dans l'ordre.
    expect(scenario.jira.journal.methods()).toEqual(['findIssueByBranch', 'setCoverageField']);
    expect(scenario.queue.journal.methods()).toEqual(['publish']);
    expect(scenario.coverage.journal.methods()).toEqual(['recompute']);
    expect(scenario.jira.journal.argsOf('setCoverageField')[0]).toEqual([
      ISSUE_ID,
      'Preuves',
      2,
      4,
    ]);

    // Le pipeline et ses deux résultats sont bien rangés.
    expect((await scenario.store.latestRunForBranch(REPO, BRANCH))?.id).toBe('run-1');
    expect(await scenario.store.listTestResults('run-1')).toHaveLength(2);
  });

  it('marque comme agent tout ce qui arrive par MCP (SPEC §19)', async () => {
    const scenario = await createPay123Scenario();
    const viaMcp = await scenario.identity.actorOf({
      accountId: AGENT,
      moduleId: 'attach-evidence',
      fromMcp: true,
      cloudId: 'cloud-1',
    });
    const viaPanel = await scenario.identity.actorOf({
      accountId: TESTER,
      moduleId: 'issuePanel',
      fromMcp: false,
      cloudId: 'cloud-1',
    });
    expect(viaMcp).toMatchObject({ agent: true, roles: [] });
    expect(viaPanel).toMatchObject({ agent: false });
    expect(scenario.identity.journal.count('actorOf')).toBe(2);
  });
});
