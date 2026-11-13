/**
 * L'instantané public bâti sur l'état réel de l'app (lot `app-donnees-reelles`).
 *
 * Deux propriétés se prouvent ici, celles qui ont mordu en production :
 *  - la preuve vivante d'un projet se lit par sa CLÉ (la table `living_proof`
 *    range la clé du ticket, pas l'id numérique de Jira) — sinon la liste est
 *    toujours vide et chaque run recrée un doublon ;
 *  - le récap « dérogations par personne » ne fuite aucun identifiant de
 *    compte : `aggregateWaiversByGranter` remplit `displayName` avec
 *    l'`accountId` brut, que l'anonymisation ne touche pas.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { buildDemoSnapshot, resolveGranterNames } from '../../src/demo-snapshot.js';
import type { DemoSnapshotData } from '../../src/demo-contract.js';
import type {
  CriterionState,
  DossierIssue,
  ProofStats,
  ReleaseDossier,
} from '../../src/types.js';
import {
  criterionState,
  dossier,
  dossierIssue,
  livingProof,
  testEvidence,
  waiver,
} from '../db/fixtures.js';
import { ISSUE_KEY, OWNER, TEST_REFUSAL } from '../helpers/builders.js';
import { createPay123Scenario, type Pay123Scenario } from '../helpers/scenario.js';

/** Un instantané de test : seulement de quoi lire l'état pseudo-anonymisé. */
async function snapshotOf(scenario: Pay123Scenario): Promise<DemoSnapshotData> {
  const snapshot = await buildDemoSnapshot(
    { store: scenario.store, jira: scenario.jira, clock: scenario.clock },
    { issueKey: ISSUE_KEY, site: 'demo.exemple' },
  );
  if (snapshot === null) throw new Error('instantané nul');
  return snapshot;
}

/** Des statistiques minimales portant un accordeur (accountId brut). */
function statsWithGranter(accountId: string): ProofStats {
  return {
    projectId: 'PAY',
    since: '1970-01-01 00:00:00',
    coverageByStrength: { declared: 0, attested: 0, 'machine-verified': 0 },
    waiversByGranter: [{ accountId, displayName: accountId, count: 1 }],
    closedWithoutValidator: 0,
    reopenings: [],
  };
}

describe('resolveGranterNames — le récap ne cite jamais un accountId', () => {  it('remplace l’accountId brut par le nom résolu de l’acteur', () => {
    // Après anonymisation, l'accountId est devenu la référence `actor-4` ;
    // `displayName` portait encore l'identifiant brut, que l'anonymisation ne
    // touche pas. On le remplace par le nom de l'acteur.
    const stats = statsWithGranter('actor-4');
    const actors = [
      { ref: 'actor-4', displayName: 'Sam PO', agent: false, roles: ['Product Owner'] },
    ];
    const resolved = resolveGranterNames(stats, actors);
    expect(resolved?.waiversByGranter[0]?.displayName).toBe('Sam PO');
    // La référence stable reste dans `accountId` (ce n'est pas un identifiant).
    expect(resolved?.waiversByGranter[0]?.accountId).toBe('actor-4');
  });

  it('laisse vide plutôt que de laisser filer un identifiant inconnu', () => {
    const resolved = resolveGranterNames(statsWithGranter('actor-9'), []);
    expect(resolved?.waiversByGranter[0]?.displayName).toBe('actor-9');
  });

  it('rend null quand les statistiques le sont', () => {
    expect(resolveGranterNames(null, [])).toBeNull();
  });
});

describe('buildDemoSnapshot — la preuve vivante se lit par la clé du projet', () => {
  let scenario: Pay123Scenario;

  beforeEach(async () => {
    scenario = await createPay123Scenario();
  });

  it('retrouve la preuve vivante rangée sous la clé du ticket', async () => {
    await scenario.store.saveLivingProof(
      livingProof({
        id: 'liv-pay-1',
        issueKey: ISSUE_KEY,
        criterionId: 'crit-1',
        testName: TEST_REFUSAL,
        state: 'unproven',
      }),
    );

    const snapshot = await snapshotOf(scenario);
    expect(snapshot.living).toHaveLength(1);
    expect(snapshot.living[0]?.testName).toBe(TEST_REFUSAL);
    expect(snapshot.living[0]?.state).toBe('unproven');
  });

  it('ne laisse aucun identifiant de compte, même dans les dérogations', async () => {
    await scenario.store.saveWaiver(
      waiver({ id: 'wai-pay-1', criterionId: 'crit-1', grantedBy: OWNER, revokedAt: '' }),
    );

    const snapshot = await snapshotOf(scenario);
    const raw = JSON.stringify(snapshot);
    // Les comptes du scénario ne doivent jamais sortir en clair.
    expect(raw).not.toContain(OWNER);
    expect(raw).not.toContain('user-dev');
    // La dérogation figure bien, pseudo-anonymisée, avec le nom résolu.
    expect(snapshot.waivers).toHaveLength(1);
    expect(snapshot.waivers[0]?.grantedBy.startsWith('actor-')).toBe(true);
  });
});
describe('la taille de l’instantané — la limite de propriété Jira', () => {
  /** Un dossier de version bien garni : douze tickets, quatre critères, deux preuves. */
  function bigDossier(): ReleaseDossier {
    const issues: DossierIssue[] = [];
    for (let ticket = 1; ticket <= 12; ticket += 1) {
      const criteria: CriterionState[] = [];
      for (let criterion = 1; criterion <= 4; criterion += 1) {
        criteria.push(
          criterionState({
            criterionId: `crit-${ticket}-${criterion}`,
            code: `AC-${criterion}`,
            text: `Critère ${criterion} du ticket ${ticket}, assez long pour peser`,
            evidences: [
              testEvidence({ id: `ev-${ticket}-${criterion}-1` }),
              testEvidence({ id: `ev-${ticket}-${criterion}-2` }),
            ],
          }),
        );
      }
      issues.push(
        dossierIssue({
          issueKey: `PRF-${ticket}`,
          summary: `Résumé du ticket ${ticket} du projet de démonstration`,
          criteria,
        }),
      );
    }
    return dossier({ versionId: '2.4', versionName: '2.4', issues, totals: { issues: 12, criteria: 48, proven: 24, waived: 0, machineVerified: 12, attested: 12, declared: 0 } });
  }

  it('reste sous les 32 768 octets d’une propriété Jira', async () => {
    const h = await createPay123Scenario();
    await h.store.saveDossier(bigDossier());

    const snapshot = await snapshotOf(h);
    const size = JSON.stringify(snapshot).length;

    // Jira refuse une propriété de ticket plus longue que 32 768 octets :
    // au-delà, l'app ne pourrait plus publier son instantané, et le site
    // servirait des données périmées sans le dire.
    expect(size).toBeLessThan(32_768);
  });

  it('garde les totaux et les tickets du dossier, mais pas le détail des critères', async () => {
    const h = await createPay123Scenario();
    await h.store.saveDossier(bigDossier());

    const snapshot = await snapshotOf(h);
    expect(snapshot.dossier?.issues).toHaveLength(12);
    expect(snapshot.dossier?.totals.issues).toBe(12);
    expect(snapshot.dossier?.issues[0]?.issueKey).toBe('PRF-1');
    // Le détail des critères n'est pas dans l'instantané public : il est dans
    // l'app, et l'outil `get-release-proof` le rend à la demande.
    expect(Object.keys(snapshot.dossier?.issues[0] ?? {})).not.toContain('criteria');
  });
});
