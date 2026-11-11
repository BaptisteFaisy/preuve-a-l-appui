/**
 * Le jeu de démo PAY-123 est cohérent (SPEC §7, §22, §24) :
 * - quatre critères, tous avec un identifiant stable ;
 * - deux preuves machine, une déclaration d'agent, un critère sans preuve ;
 * - couverture attendue : 2 / 4 ;
 * - un critère exige une attestation, un autre n'a rien ;
 * - les libellés existent en anglais et en français ;
 * - les docs reprennent les valeurs du jeu de démo, jamais un nombre à la main ;
 * - les liens internes des docs pointent vers des fichiers présents.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DOCS_MESSAGES } from '../../src/i18n/docs.js';
import {
  createDemoAttestation,
  createDemoCiSummary,
  createDemoCriteria,
  createDemoEvidences,
  createDemoIssue,
  createDemoSettings,
  createDemoWaiver,
  createInitialDemoCoverage,
  DEMO_ACTORS,
  DEMO_COMMIT,
  DEMO_ISSUE_KEY,
  DEMO_TEST_LOG,
  DEMO_TEST_REFUSAL,
  loadDemoDataset,
} from '../../src/sample/pay-123.js';
import { createFakeStore } from '../helpers/fake-store.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('jeu de démo PAY-123', () => {
  it('pose quatre critères actifs, chacun avec un identifiant stable', () => {
    const criteria = createDemoCriteria();
    expect(criteria).toHaveLength(4);
    expect(criteria.map((c) => c.code)).toEqual(['AC-1', 'AC-2', 'AC-3', 'AC-4']);
    for (const criterion of criteria) {
      expect(criterion.id).not.toBe('');
      expect(criterion.code).not.toBe('');
      expect(criterion.text.trim().length).toBeGreaterThan(0);
      expect(criterion.status).toBe('active');
      expect(criterion.issueId).toBe(createDemoIssue().id);
    }
  });

  it('attache deux preuves machine, une déclaration, et laisse un critère nu', () => {
    const evidences = createDemoEvidences();
    const machine = evidences.filter((e) => e.strength === 'machine-verified');
    const declared = evidences.filter((e) => e.strength === 'declared' && e.addedByAgent);
    expect(machine).toHaveLength(2);
    expect(declared).toHaveLength(1);
    const provenCriteria = new Set(evidences.map((e) => e.criterionId));
    expect(provenCriteria.has('crit-4')).toBe(false);
    for (const evidence of machine) {
      expect(evidence.type).toBe('test');
      expect(evidence.commit).toBe(DEMO_COMMIT);
      expect(evidence.verified).toBe(true);
    }
  });

  it('exige une attestation sur AC-3, que la déclaration d agent ne satisfait pas', () => {
    const criteria = createDemoCriteria();
    const ac3 = criteria[2];
    expect(ac3.requiredStrength).toBe('attested');
    const report = createDemoEvidences()[2];
    expect(report.criterionId).toBe(ac3.id);
    expect(report.strength).toBe('declared');
  });

  it('calcule une couverture initiale de 2 / 4 qui bloque la transition', () => {
    const coverage = createInitialDemoCoverage();
    expect(coverage.issueKey).toBe(DEMO_ISSUE_KEY);
    expect(coverage.total).toBe(4);
    expect(coverage.proven).toBe(2);
    expect(coverage.waived).toBe(0);
    expect(coverage.passes).toBe(false);
    expect(coverage.wouldBlock).toBe(true);
    expect(coverage.blocking.map((b) => b.code)).toEqual(['AC-3', 'AC-4']);
    expect(coverage.criteria.filter((c) => c.proven)).toHaveLength(2);
  });

  it('prévoit l attestation tierce et la dérogation motivée du scénario', () => {
    const attestation = createDemoAttestation();
    const waiver = createDemoWaiver();
    expect(attestation.criterionId).toBe('crit-3');
    expect(attestation.attesterAccountId).toBe(DEMO_ACTORS.tester.accountId);
    expect(attestation.attesterAccountId).not.toBe(createDemoIssue().assigneeAccountId);
    expect(waiver.criterionId).toBe('crit-4');
    expect(waiver.grantedBy).toBe(DEMO_ACTORS.owner.accountId);
    expect(waiver.reason).not.toBe('');
  });

  it('traduit tous les libellés du jeu de démo en anglais et en français', () => {
    const keys = Object.keys(DOCS_MESSAGES);
    expect(keys.length).toBeGreaterThanOrEqual(10);
    for (const key of keys) {
      const entry = DOCS_MESSAGES[key];
      expect(entry.en.trim().length, `${key} manque en anglais`).toBeGreaterThan(0);
      expect(entry.fr.trim().length, `${key} manque en français`).toBeGreaterThan(0);
    }
  });

  it('se charge intégralement dans un ProofStore', async () => {
    const store = createFakeStore();
    const loaded = await loadDemoDataset(store);
    expect(loaded.issue.key).toBe(DEMO_ISSUE_KEY);
    expect(loaded.settings.projectId).toBe(createDemoSettings().projectId);
    expect(await store.listCriteriaByIssue(loaded.issue.id)).toHaveLength(4);
    expect(await store.listEvidencesByIssue(loaded.issue.id)).toHaveLength(3);
    expect(await store.listTestResults('run-1')).toHaveLength(2);
    expect(await store.getCoverage(loaded.issue.id)).not.toBeNull();
  });
});

/** Les liens markdown relatifs d'un document : cibles locales seulement. */
function relativeLinksOf(markdown: string): string[] {
  const targets: string[] = [];
  const regex = /\[[^\]]*\]\(([^)\s]+)\)/g;
  for (const match of markdown.matchAll(regex)) {
    const target = match[1];
    if (target.startsWith('http://') || target.startsWith('https://')) continue;
    if (target.startsWith('#') || target.startsWith('mailto:')) continue;
    targets.push(target.split('#')[0]);
  }
  return targets;
}

describe('cohérence entre les docs et le jeu de démo', () => {
  const docFiles = [
    'README.md',
    'src/sample/README.md',
    'docs/JUDGES.md',
    'docs/VIDEO-SCRIPT.md',
    'docs/VALIDATION-PLAN.md',
    'docs/DEMO-DATA.md',
    'docs/METHODE.md',
  ];

  it('tous les fichiers de docs annoncés existent dans le dépôt', () => {
    for (const rel of docFiles) {
      expect(existsSync(resolve(ROOT, rel)), `${rel} devrait exister`).toBe(true);
    }
  });

  it('chaque lien interne des docs pointe vers un fichier présent', () => {
    for (const rel of docFiles) {
      const content = readFileSync(resolve(ROOT, rel), 'utf-8');
      const base = dirname(resolve(ROOT, rel));
      for (const target of relativeLinksOf(content)) {
        if (target === '') continue;
        expect(existsSync(resolve(base, target)), `${rel} → ${target} cassé`).toBe(true);
      }
    }
  });

  it('le README lie les neuf documents du dépôt', () => {
    const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf-8');
    const required = [
      'docs/CAHIER-DES-CHARGES.md',
      'docs/CONTRACTS.md',
      'docs/ARCHITECTURE.md',
      'docs/CONVENTIONS.md',
      'docs/JUDGES.md',
      'docs/VIDEO-SCRIPT.md',
      'docs/DEMO-DATA.md',
      'docs/METHODE.md',
      'docs/VALIDATION-PLAN.md',
    ];
    for (const doc of required) {
      expect(readme.includes(doc), `README devrait lier ${doc}`).toBe(true);
    }
  });

  it('DEMO-DATA reprend les valeurs du code, jamais un nombre à la main', () => {
    const page = readFileSync(resolve(ROOT, 'docs/DEMO-DATA.md'), 'utf-8');
    const coverage = createInitialDemoCoverage();
    const summary = createDemoCiSummary();
    expect(page).toContain(`${coverage.proven} proven / ${coverage.total} total`);
    expect(page).toContain(DEMO_COMMIT);
    expect(page).toContain(summary.branch);
    expect(page).toContain(DEMO_TEST_REFUSAL);
    expect(page).toContain(DEMO_TEST_LOG);
    expect(page).toContain(DEMO_ISSUE_KEY);
  });

  it('JUDGES envoie le même résumé de CI que le jeu de démo', () => {
    const guide = readFileSync(resolve(ROOT, 'docs/JUDGES.md'), 'utf-8');
    const summary = createDemoCiSummary();
    expect(guide).toContain(`"repo": "${summary.repo}"`);
    expect(guide).toContain(`"branch": "${summary.branch}"`);
    expect(guide).toContain(`"commit": "${summary.commit}"`);
    expect(guide).toContain(DEMO_TEST_REFUSAL);
    expect(guide).toContain(DEMO_TEST_LOG);
  });
});
