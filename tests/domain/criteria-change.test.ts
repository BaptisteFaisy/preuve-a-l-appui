/**
 * Changement de texte et réécriture de la description (SPEC §8.2, §8.4, FP-13).
 *
 * Règles testées :
 * - texte modifié → version + 1, CriterionRevision écrite, preuves des versions
 *   antérieures passées en « à revoir » (to-reconfirm) ;
 * - texte inchangé → pas de version, pas d'écriture ;
 * - section réécrite sans perdre le reste de la description (contexte, notes) ;
 * - cas limite SPEC §21 : critère non applicable (on ne supprime rien, fraîcheur lisible).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  changeCriterionText,
  findCriteriaSection,
  freshnessSummary,
  publishCriteriaSection,
  rewriteCriteriaSection,
  type EvidenceFreshnessPort,
} from '../../src/domain/criteria-change.js';
import { renderCriteriaSection } from '../../src/domain/criteria.js';
import { createFakeClock } from '../../tests/helpers/fake-clock.js';
import { createFakeJira } from '../../tests/helpers/fake-gateways.js';
import {
  aCriterion,
  AGENT,
  anActor,
  anEvidence,
  DEVELOPER,
  ISSUE_ID,
} from '../../tests/helpers/builders.js';
import type { Criterion, CriterionRevision, Evidence } from '../../src/types.js';

let savedCriteria: Criterion[];
let savedRevisions: CriterionRevision[];
let evidences: Evidence[];
const clock = createFakeClock('2026-11-11T09:00:00.000Z');
const human = anActor({ accountId: DEVELOPER, agent: false });
const agent = anActor({ accountId: AGENT, agent: true, roles: [] });

beforeEach(() => {
  savedCriteria = [];
  savedRevisions = [];
  evidences = [];
  clock.set('2026-11-11T09:00:00.000Z');
});

function fakeEvidencePort(): EvidenceFreshnessPort {
  return {
    async listEvidencesByCriterion(criterionId: string) {
      return evidences.filter((evidence) => evidence.criterionId === criterionId);
    },
    async markEvidencesToReconfirm(criterionId: string, fromVersion: number) {
      let count = 0;
      for (const evidence of evidences) {
        if (
          evidence.criterionId === criterionId &&
          evidence.criterionVersion < fromVersion &&
          evidence.freshness === 'fresh'
        ) {
          evidence.freshness = 'to-reconfirm';
          count += 1;
        }
      }
      return count;
    },
  };
}

function deps() {
  return {
    async saveCriterion(criterion: Criterion) {
      savedCriteria.push(criterion);
    },
    async addCriterionRevision(revision: CriterionRevision) {
      savedRevisions.push(revision);
    },
    evidence: fakeEvidencePort(),
    clock,
  };
}

describe('changement de texte d’un critère (SPEC §8.4)', () => {
  it('incrémente la version et écrit une révision d’historique', async () => {
    const criterion = aCriterion({ version: 1, text: 'Texte initial' });
    const result = await changeCriterionText(
      { criterion, newText: 'Texte modifié et clarifié', actor: human },
      deps(),
    );
    expect(result.changed).toBe(true);
    expect(result.criterion.version).toBe(2);
    expect(result.criterion.text).toBe('Texte modifié et clarifié');
    expect(result.revision?.version).toBe(2);
    expect(result.revision?.changedBy).toBe(DEVELOPER);
    expect(result.revision?.at).toBe(clock.now());
    expect(savedCriteria).toHaveLength(1);
    expect(savedRevisions).toHaveLength(1);
  });

  it('ne crée aucune version si le texte est inchangé (espaces compris)', async () => {
    const criterion = aCriterion({ version: 1, text: 'Texte initial' });
    const result = await changeCriterionText(
      { criterion, newText: '  Texte   initial  ', actor: human },
      deps(),
    );
    expect(result.changed).toBe(false);
    expect(result.criterion.version).toBe(1);
    expect(result.revision).toBeNull();
    expect(savedCriteria).toHaveLength(0);
    expect(savedRevisions).toHaveLength(0);
  });

  it('garde le code stable, ainsi que le type et la force exigée (SPEC §8.1)', async () => {
    const criterion = aCriterion({
      code: 'AC-1',
      type: 'security',
      requiredStrength: 'attested',
      version: 1,
      text: 'Le mot de passe est masqué',
    });
    const result = await changeCriterionText(
      { criterion, newText: 'Le mot de passe est masqué à la saisie', actor: human },
      deps(),
    );
    expect(result.criterion.code).toBe('AC-1');
    expect(result.criterion.type).toBe('security');
    expect(result.criterion.requiredStrength).toBe('attested');
  });

  it('fait passer les preuves fraîches de la version antérieure en « à revoir »', async () => {
    const criterion = aCriterion({ id: 'crit-1', version: 1, text: 'Texte v1' });
    evidences.push(
      anEvidence({ id: 'ev-v1', criterionId: 'crit-1', criterionVersion: 1, freshness: 'fresh' }),
      anEvidence({ id: 'ev-v2', criterionId: 'crit-1', criterionVersion: 2, freshness: 'fresh' }),
    );
    const result = await changeCriterionText(
      { criterion, newText: 'Texte v2', actor: human },
      deps(),
    );
    expect(result.toReconfirmEvidenceIds).toEqual(['ev-v1']);
    expect(evidences.find((evidence) => evidence.id === 'ev-v1')?.freshness).toBe('to-reconfirm');
    expect(evidences.find((evidence) => evidence.id === 'ev-v2')?.freshness).toBe('fresh');
  });

  it('ne touche pas aux preuves d’autres critères', async () => {
    const criterion = aCriterion({ id: 'crit-1', version: 1, text: 'Texte v1' });
    evidences.push(
      anEvidence({ id: 'ev-autre', criterionId: 'crit-autre', criterionVersion: 1, freshness: 'fresh' }),
    );
    const result = await changeCriterionText(
      { criterion, newText: 'Texte v2', actor: human },
      deps(),
    );
    expect(result.toReconfirmEvidenceIds).toEqual([]);
    expect(evidences[0].freshness).toBe('fresh');
  });

  it('ne re-compte pas les preuves déjà à revoir ou périmées', async () => {
    const criterion = aCriterion({ id: 'crit-1', version: 1, text: 'Texte v1' });
    evidences.push(
      anEvidence({ id: 'ev-deja', criterionId: 'crit-1', criterionVersion: 1, freshness: 'to-reconfirm' }),
      anEvidence({ id: 'ev-stale', criterionId: 'crit-1', criterionVersion: 1, freshness: 'stale' }),
    );
    const result = await changeCriterionText(
      { criterion, newText: 'Texte v2', actor: human },
      deps(),
    );
    expect(result.toReconfirmEvidenceIds).toEqual([]);
    expect(evidences[0].freshness).toBe('to-reconfirm');
    expect(evidences[1].freshness).toBe('stale');
  });

  it('refuse un texte vide avec une erreur qui nomme le critère', async () => {
    const criterion = aCriterion({ code: 'AC-3', text: 'Valide' });
    await expect(
      changeCriterionText({ criterion, newText: '   ', actor: human }, deps()),
    ).rejects.toThrowError(/AC-3/);
  });

  it('trace l’agent comme auteur du changement quand c’est lui qui demande', async () => {
    const criterion = aCriterion({ version: 1, text: 'Texte initial' });
    const result = await changeCriterionText(
      { criterion, newText: 'Texte reformulé par l’agent', actor: agent },
      deps(),
    );
    expect(result.revision?.changedBy).toBe(AGENT);
  });
});

describe('réécriture de la section dans la description (SPEC §8.2)', () => {
  const INITIAL_DESCRIPTION = [
    '# Titre du ticket',
    '',
    'Contexte du ticket et note d’architecture.',
    '',
    '## Critères d’acceptation',
    '- [ ] **AC-1** — Ancien texte (v1 · Fonctionnel · Actif)',
    '',
    '## Liens',
    '- https://exemple.com',
  ].join('\n');

  it('repère la section dans la description', () => {
    const pos = findCriteriaSection(INITIAL_DESCRIPTION);
    expect(pos).not.toBeNull();
    const lines = INITIAL_DESCRIPTION.split('\n');
    expect(lines[pos!.start]).toBe('## Critères d’acceptation');
  });

  it('réécrit la section sans perdre le contexte ni les notes après', () => {
    const newSection = renderCriteriaSection(
      [aCriterion({ code: 'AC-1', text: 'Nouveau texte', version: 2 })],
      'fr',
    );
    const rewritten = rewriteCriteriaSection(INITIAL_DESCRIPTION, newSection);
    expect(rewritten).toContain('Contexte du ticket et note d’architecture.');
    expect(rewritten).toContain('Nouveau texte');
    expect(rewritten).toContain('## Liens');
    expect(rewritten).toContain('https://exemple.com');
    expect(rewritten).not.toContain('Ancien texte');
  });

  it('ajoute la section si le ticket n’en avait pas', () => {
    const without = 'Contexte seul, aucune section.';
    const section = renderCriteriaSection([aCriterion({ code: 'AC-1' })], 'fr');
    const rewritten = rewriteCriteriaSection(without, section);
    expect(rewritten).toContain('Contexte seul, aucune section.');
    expect(rewritten).toContain("## Critères d'acceptation");
  });

  it('écrit la section via JiraGateway', async () => {
    const jira = createFakeJira();
    const ok = await publishCriteriaSection(
      jira,
      ISSUE_ID,
      [aCriterion({ code: 'AC-1' })],
      'fr',
    );
    expect(ok).toBe(true);
    expect(jira.rewrites).toHaveLength(1);
    expect(jira.rewrites[0].issueId).toBe(ISSUE_ID);
    expect(jira.rewrites[0].section).toContain('AC-1');
  });
});

describe('cas limites du SPEC §21', () => {
  it('critère non applicable : on ne supprime rien, fraîcheur lisible', () => {
    const list = [
      anEvidence({ freshness: 'fresh' }),
      anEvidence({ freshness: 'to-reconfirm' }),
      anEvidence({ freshness: 'stale' }),
    ];
    const summary = freshnessSummary(list);
    expect(summary.fresh).toBe(1);
    expect(summary['to-reconfirm']).toBe(1);
    expect(summary.stale).toBe(1);
  });
});
