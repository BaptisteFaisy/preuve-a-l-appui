/**
 * Tests du cycle de vie des preuves (SPEC §9, §8.4, §9.3, §20, §22 points
 * 7-8, FP-03, FP-04, FP-13).
 *
 * Un test par comportement : le geste unique d'attachement, la force
 * calculée, le remplacement (jamais de suppression), la fraîcheur après un
 * nouveau commit, la péremption après changement de critère, la
 * reconfirmation en un clic.
 */
import { describe, expect, it } from 'vitest';
import {
  attachEvidence,
  countsAsProof,
  expireOnCriterionChange,
  reconfirmEvidence,
  refreshOnCommit,
  type AttachEvidenceDeps,
} from '../../src/domain/evidence.js';
import type { Evidence } from '../../src/types.js';
import {
  aCriterion,
  anEvidence,
  aTestOutcome,
  COMMIT,
  DEVELOPER,
  ISSUE_ID,
  TESTER,
  TEST_REFUSAL,
} from '../helpers/builders.js';
import { createFakeClock, createFakeIds, createRecordingLogger } from '../helpers/fake-clock.js';
import { createFakeEvidenceChecker } from '../helpers/fake-gateways.js';
import { createFakeStore } from '../helpers/fake-store.js';
import { createPay123Scenario } from '../helpers/scenario.js';

function makeDeps(): AttachEvidenceDeps {
  return {
    store: createFakeStore(),
    clock: createFakeClock(),
    ids: createFakeIds('ev'),
  };
}

const GREEN_RUN = { outcomes: [aTestOutcome({ name: TEST_REFUSAL })], commit: COMMIT };

describe('attachEvidence — un seul geste (SPEC §20, FP-03)', () => {
  it('n’exige aucun champ obligatoire hors le critère visé et le type', async () => {
    const deps = makeDeps();
    const result = await attachEvidence(
      { criterionId: 'crit-1', type: 'link', addedBy: TESTER },
      deps,
    );
    expect(result.evidence.criterionId).toBe('crit-1');
    expect(result.evidence.reference).toBe('');
    expect(result.evidence.note).toBe('');
    expect(result.evidence.commit).toBe('');
    expect(result.evidence.freshness).toBe('fresh');
    expect(result.evidence.addedByAgent).toBe(false);
  });

  it('renvoie la preuve enregistrée et la force obtenue', async () => {
    const deps = makeDeps();
    const result = await attachEvidence(
      { criterionId: 'crit-1', type: 'attestation', reference: 'clic', addedBy: TESTER },
      deps,
    );
    expect(result.strength).toBe('attested');
    expect(result.evidence.strength).toBe('attested');
    const stored = await deps.store.getEvidence(result.evidence.id);
    expect(stored).toEqual(result.evidence);
  });

  it('horodate avec l’horloge injectée et numérote avec le générateur d’ids', async () => {
    const deps = makeDeps();
    const result = await attachEvidence(
      { criterionId: 'crit-1', type: 'link', reference: 'https://x', addedBy: TESTER },
      deps,
    );
    expect(result.evidence.at).toBe(deps.clock.now());
    expect(result.evidence.id).toBe('ev_1');
  });

  it('prend la version du critère lu, défaut 1', async () => {
    const deps = makeDeps();
    const criterion = aCriterion({ version: 3 });
    const withCriterion = await attachEvidence(
      { criterionId: criterion.id, type: 'link', addedBy: TESTER },
      deps,
      criterion,
    );
    const without = await attachEvidence(
      { criterionId: 'crit-1', type: 'link', addedBy: TESTER },
      deps,
    );
    expect(withCriterion.evidence.criterionVersion).toBe(3);
    expect(without.evidence.criterionVersion).toBe(1);
  });

  it('marque addedByAgent quand la preuve vient d’un agent (SPEC §19)', async () => {
    const deps = makeDeps();
    const result = await attachEvidence(
      {
        criterionId: 'crit-3',
        type: 'agent-report',
        reference: 'report#ac-3',
        addedBy: 'agent-coder',
        addedByAgent: true,
      },
      deps,
      aCriterion({ id: 'crit-3', code: 'AC-3', issueId: ISSUE_ID }),
    );
    expect(result.evidence.addedByAgent).toBe(true);
    expect(result.strength).toBe('declared');
  });
});

describe('attachEvidence — la force est calculée, jamais déclarée (SPEC §9.1, §22)', () => {
  it('test vert dans les résultats de CI sur le commit de la branche : machine-verified', async () => {
    const deps = makeDeps();
    const result = await attachEvidence(
      {
        criterionId: 'crit-1',
        type: 'test',
        reference: TEST_REFUSAL,
        commit: COMMIT,
        run: GREEN_RUN,
        addedBy: DEVELOPER,
      },
      deps,
    );
    expect(result.strength).toBe('machine-verified');
    expect(result.evidence.verified).toBe(true);
  });

  it('test attaché sans résultats de CI : déclaré, non vérifié', async () => {
    const deps = makeDeps();
    const result = await attachEvidence(
      { criterionId: 'crit-1', type: 'test', reference: TEST_REFUSAL, commit: COMMIT, addedBy: DEVELOPER },
      deps,
    );
    expect(result.strength).toBe('declared');
    expect(result.evidence.verified).toBe(false);
  });

  it('test échoué dans les résultats : aucune preuve valable (§22 point 3)', async () => {
    const deps = makeDeps();
    const result = await attachEvidence(
      {
        criterionId: 'crit-1',
        type: 'test',
        reference: TEST_REFUSAL,
        commit: COMMIT,
        run: { outcomes: [aTestOutcome({ name: TEST_REFUSAL, state: 'failed' })], commit: COMMIT },
        addedBy: DEVELOPER,
      },
      deps,
    );
    expect(result.evidence.verified).toBe(false);
    expect(result.strength).toBe('declared');
  });

  it('capture attestée par un tiers : force attestée (§9.1)', async () => {
    const deps = { ...makeDeps(), checker: createFakeEvidenceChecker({ attachments: [`${ISSUE_ID}::shot.png`] }) };
    const result = await attachEvidence(
      {
        criterionId: 'crit-3',
        type: 'attachment',
        reference: 'shot.png',
        addedBy: TESTER,
        hasValidAttestation: true,
      },
      deps,
      aCriterion({ id: 'crit-3', code: 'AC-3', issueId: ISSUE_ID }),
    );
    expect(result.strength).toBe('attested');
    expect(result.evidence.verified).toBe(true);
  });

  it('joue le scénario PAY-123 : la testeuse atteste AC-3 en un geste (§7.3)', async () => {
    const scenario = await createPay123Scenario();
    const deps: AttachEvidenceDeps = {
      store: scenario.store,
      clock: scenario.clock,
      ids: scenario.ids,
      checker: scenario.checker,
    };
    const ac3 = scenario.criteria[2];
    const result = await attachEvidence(
      {
        criterionId: ac3.id,
        type: 'attachment',
        reference: 'att-screenshot-1',
        note: 'Refus déclenché, e-mail reçu.',
        addedBy: TESTER,
        hasValidAttestation: true,
      },
      deps,
      ac3,
    );
    expect(result.strength).toBe('attested');
    expect(result.evidence.verified).toBe(true);
    const listed = await scenario.store.listEvidencesByCriterion(ac3.id);
    expect(listed.map((row) => row.id)).toContain(result.evidence.id);
  });
});

describe('intégrité — remplacer, jamais supprimer (SPEC §20)', () => {
  it('le remplacement garde l’ancienne preuve, replacedBy et stale', async () => {
    const deps = makeDeps();
    const old: Evidence = anEvidence({ id: 'ev-old' });
    await deps.store.saveEvidence(old);
    const result = await attachEvidence(
      {
        criterionId: old.criterionId,
        type: 'test',
        reference: 'test renommé',
        commit: COMMIT,
        run: GREEN_RUN,
        addedBy: DEVELOPER,
        replacesEvidenceId: 'ev-old',
      },
      deps,
    );
    expect(result.previousEvidence?.replacedBy).toBe(result.evidence.id);
    expect(result.previousEvidence?.freshness).toBe('stale');
    const stillThere = await deps.store.getEvidence('ev-old');
    expect(stillThere).not.toBeNull();
    expect(stillThere?.replacedBy).toBe(result.evidence.id);
    expect(stillThere?.freshness).toBe('stale');
  });

  it('remplacer une preuve inconnue ne casse rien', async () => {
    const deps = makeDeps();
    const result = await attachEvidence(
      { criterionId: 'crit-1', type: 'link', addedBy: TESTER, replacesEvidenceId: 'ev-inconnue' },
      deps,
    );
    expect(result.previousEvidence).toBeNull();
    expect(await deps.store.getEvidence(result.evidence.id)).not.toBeNull();
  });

  it('la nouvelle preuve reste fresh et sans replacedBy', async () => {
    const deps = makeDeps();
    const result = await attachEvidence(
      { criterionId: 'crit-1', type: 'link', addedBy: TESTER },
      deps,
    );
    expect(result.evidence.freshness).toBe('fresh');
    expect(result.evidence.replacedBy).toBe('');
  });
});

describe('fraîcheur après un nouveau commit (SPEC §9.3, §22 point 8)', () => {
  it('un nouveau commit sur la branche passe la preuve de test à reconfirmer', () => {
    const evidence = anEvidence({ type: 'test', commit: COMMIT, freshness: 'fresh' });
    expect(refreshOnCommit(evidence, 'commit-suivant').freshness).toBe('to-reconfirm');
  });

  it('le prochain passage vert sur son commit la revalide', () => {
    const evidence = anEvidence({ type: 'test', commit: COMMIT, freshness: 'to-reconfirm' });
    expect(refreshOnCommit(evidence, COMMIT).freshness).toBe('fresh');
  });

  it('ne touche ni aux preuves remplacées ni aux autres types', () => {
    const stale = anEvidence({ type: 'test', commit: COMMIT, freshness: 'stale' });
    expect(refreshOnCommit(stale, 'autre')).toBe(stale);
    const link = anEvidence({ type: 'link', commit: '' });
    expect(refreshOnCommit(link, 'autre')).toBe(link);
  });

  it('une preuve sans commit déclaré passe à reconfirmer dès le premier run', () => {
    const evidence = anEvidence({ type: 'test', commit: '', freshness: 'fresh' });
    expect(refreshOnCommit(evidence, COMMIT).freshness).toBe('to-reconfirm');
  });
});

describe('péremption après changement de critère (SPEC §8.4, FP-13, §22 point 7)', () => {
  it('une preuve antérieure à la nouvelle version passe à revoir', () => {
    const evidence = anEvidence({ criterionVersion: 1, freshness: 'fresh' });
    expect(expireOnCriterionChange(evidence, 2).freshness).toBe('to-reconfirm');
  });

  it('une preuve de la version courante ou plus récente ne bouge pas', () => {
    const evidence = anEvidence({ criterionVersion: 2 });
    expect(expireOnCriterionChange(evidence, 2)).toBe(evidence);
    expect(expireOnCriterionChange(evidence, 1)).toBe(evidence);
  });

  it('ne ressuscite pas une preuve remplacée', () => {
    const stale = anEvidence({ criterionVersion: 1, freshness: 'stale' });
    expect(expireOnCriterionChange(stale, 3).freshness).toBe('stale');
  });

  it('un clic confirme la preuve à revoir (SPEC §8.4)', () => {
    const toReview = anEvidence({ freshness: 'to-reconfirm' });
    expect(reconfirmEvidence(toReview).freshness).toBe('fresh');
  });

  it('le clic ne change ni une preuve fraîche ni une preuve remplacée', () => {
    const fresh = anEvidence({ freshness: 'fresh' });
    expect(reconfirmEvidence(fresh)).toBe(fresh);
    const stale = anEvidence({ freshness: 'stale' });
    expect(reconfirmEvidence(stale)).toBe(stale);
  });
});

describe('seule une preuve fraîche compte (SPEC §12.1)', () => {
  it('fraîche compte, à reconfirmer et remplacée ne comptent pas', () => {
    expect(countsAsProof(anEvidence({ freshness: 'fresh' }))).toBe(true);
    expect(countsAsProof(anEvidence({ freshness: 'to-reconfirm' }))).toBe(false);
    expect(countsAsProof(anEvidence({ freshness: 'stale' }))).toBe(false);
  });
});

describe('journalisation absente du domaine (pureté)', () => {
  it('attachEvidence n’écrit que dans le store injecté', async () => {
    const store = createFakeStore();
    const logger = createRecordingLogger();
    const deps: AttachEvidenceDeps = {
      store,
      clock: createFakeClock(),
      ids: createFakeIds('ev'),
    };
    await attachEvidence({ criterionId: 'crit-1', type: 'link', addedBy: TESTER }, deps);
    expect(logger.entries).toHaveLength(0);
    expect(store.__tables.evidence.size).toBe(1);
  });
});
