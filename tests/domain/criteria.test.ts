/**
 * Forme canonique des critères (SPEC §8.1, §8.2) : codes `AC-n` stables,
 * inférence de type déterministe, force exigée héritée du type, section
 * markdown réécrite dans la description.
 *
 * Règle : un test par comportement, horloge et ids injectés, fakes partagés.
 */
import { describe, expect, it } from 'vitest';
import {
  buildCriterion,
  inferType,
  inferTypeWithLlm,
  isSameCriterionText,
  nextCode,
  normalizeCriterionText,
  parseCodeNumber,
  renderCriteriaSection,
  requiredStrengthForType,
  sortCriteriaByCode,
} from '../../src/domain/criteria.js';
import { createFakeClock, createFakeIds } from '../../tests/helpers/fake-clock.js';
import {
  aCriterion,
  AGENT,
  anActor,
  DEVELOPER,
  ISSUE_ID,
  settings,
} from '../../tests/helpers/builders.js';
import { createFakeLlm } from '../../tests/helpers/fake-gateways.js';

const clock = createFakeClock();
const ids = createFakeIds('crit');
const human = anActor({ accountId: DEVELOPER, agent: false });
const agent = anActor({ accountId: AGENT, agent: true, roles: [] });

describe('codes AC-n stables (SPEC §8.1)', () => {
  it('lit le numéro d’un code AC-n', () => {
    expect(parseCodeNumber('AC-1')).toBe(1);
    expect(parseCodeNumber('AC-42')).toBe(42);
  });

  it('rend null pour un code qui n’en est pas un', () => {
    expect(parseCodeNumber('AC-')).toBeNull();
    expect(parseCodeNumber('XX-3')).toBeNull();
    expect(parseCodeNumber('')).toBeNull();
  });

  it('commence à AC-1 sur un ticket sans critère', () => {
    expect(nextCode([])).toBe('AC-1');
  });

  it('continue après le plus grand numéro, pas après le dernier texte', () => {
    expect(nextCode([{ code: 'AC-1' }, { code: 'AC-3' }, { code: 'AC-2' }])).toBe('AC-4');
  });

  it('compte les critères remplacés : un code n’est jamais réattribué', () => {
    const superseded = aCriterion({ id: 'crit-old', code: 'AC-2', status: 'superseded' });
    expect(nextCode([aCriterion({ code: 'AC-1' }), superseded])).toBe('AC-3');
  });

  it('ignore les codes illisibles sans lever', () => {
    expect(nextCode([{ code: 'AC-1' }, { code: 'n’importe quoi' }])).toBe('AC-2');
  });

  it('trie par numéro de code, AC-2 avant AC-10', () => {
    const sorted = sortCriteriaByCode([
      aCriterion({ id: 'c10', code: 'AC-10' }),
      aCriterion({ id: 'c2', code: 'AC-2' }),
      aCriterion({ id: 'c1', code: 'AC-1' }),
    ]);
    expect(sorted.map((criterion) => criterion.code)).toEqual(['AC-1', 'AC-2', 'AC-10']);
  });
});

describe('inférence de type déterministe (SPEC §8.1)', () => {
  it('reconnaît la sécurité', () => {
    expect(inferType('Le refus est notifié sans exposer le mot de passe')).toBe('security');
  });

  it('reconnaît la performance', () => {
    expect(inferType('Le refus est notifié en moins de 200 ms')).toBe('performance');
  });

  it('reconnaît l’accessibilité', () => {
    expect(inferType('Le refus est annoncé par un lecteur d’écran')).toBe('accessibility');
  });

  it('reconnaît les données et migrations', () => {
    expect(inferType('La migration des paiements refusés est rejouable')).toBe('data');
  });

  it('reconnaît la documentation', () => {
    expect(inferType('Le guide d’exploitation est mis à jour dans Confluence')).toBe('documentation');
  });

  it('reconnaît la non-régression', () => {
    expect(inferType('Les paiements déjà acceptés continuent de fonctionner')).toBe('regression');
  });

  it('retombe sur fonctionnel quand aucun mot-clé ne tranche', () => {
    expect(inferType('Le paiement par carte expirée est refusé')).toBe('functional');
    expect(inferType('   ')).toBe('functional');
  });

  it('donne toujours le même type pour le même texte', () => {
    const text = 'La limite de refus est réglable par l’administrateur';
    expect(inferType(text)).toBe(inferType(text));
  });

  it('n’appelle le LLM que si l’heuristique retombe sur fonctionnel', async () => {
    const llm = createFakeLlm({ defaultType: 'data' });
    expect(await inferTypeWithLlm('Le mot de passe est chiffré', llm)).toBe('security');
    expect(llm.journal.count('classifyCriterion')).toBe(0);
    expect(await inferTypeWithLlm('Le libellé du refus est clair', llm)).toBe('data');
    expect(llm.journal.count('classifyCriterion')).toBe(1);
  });

  it('garde l’heuristique quand le LLM est en panne', async () => {
    const llm = createFakeLlm({ types: [new Error('modèle indisponible')] });
    await expect(inferTypeWithLlm('Le libellé du refus est clair', llm)).resolves.toBe('functional');
  });
});

describe('force exigée héritée du type (SPEC §9.2)', () => {
  it('prend la force la plus forte de la grille du projet', () => {
    expect(requiredStrengthForType('functional', settings())).toBe('machine-verified');
    expect(requiredStrengthForType('security', settings())).toBe('attested');
  });

  it('retombe sur la grille par défaut sans réglages projet', () => {
    expect(requiredStrengthForType('regression')).toBe('machine-verified');
    expect(requiredStrengthForType('documentation')).toBe('machine-verified');
  });
});

describe('construction d’un critère canonique (SPEC §8.1, §8.3)', () => {
  it('donne la version 1, le code fourni et l’horodatage de l’horloge injectée', () => {
    const { criterion, revision } = buildCriterion(
      {
        issueId: ISSUE_ID,
        code: 'AC-1',
        text: '  Le paiement par carte   expirée est refusé  ',
        author: human,
      },
      clock,
      ids,
    );
    expect(criterion.version).toBe(1);
    expect(criterion.code).toBe('AC-1');
    expect(criterion.text).toBe('Le paiement par carte expirée est refusé');
    expect(criterion.createdAt).toBe(clock.now());
    expect(revision.version).toBe(1);
    expect(revision.criterionId).toBe(criterion.id);
  });

  it('passe un critère d’agent en proposé, jamais en actif', () => {
    const { criterion } = buildCriterion(
      { issueId: ISSUE_ID, code: 'AC-2', text: 'Le refus est journalisé', author: agent },
      clock,
      ids,
    );
    expect(criterion.status).toBe('proposed');
    expect(criterion.createdBy).toBe(AGENT);
  });

  it('valide directement un critère créé par un humain', () => {
    const { criterion } = buildCriterion(
      { issueId: ISSUE_ID, code: 'AC-3', text: 'Le refus est journalisé', author: human },
      clock,
      ids,
    );
    expect(criterion.status).toBe('active');
  });

  it('refuse un texte vide avec une erreur nommée', () => {
    expect(() =>
      buildCriterion({ issueId: ISSUE_ID, code: 'AC-4', text: '   ', author: human }, clock, ids),
    ).toThrowError(/AC-4/);
  });

  it('respecte un type et une force imposés par l’humain', () => {
    const { criterion } = buildCriterion(
      {
        issueId: ISSUE_ID,
        code: 'AC-5',
        text: 'Le refus est journalisé',
        type: 'documentation',
        requiredStrength: 'declared',
        author: human,
      },
      clock,
      ids,
    );
    expect(criterion.type).toBe('documentation');
    expect(criterion.requiredStrength).toBe('declared');
  });
});

describe('section markdown réécrite dans la description (SPEC §8.2)', () => {
  it('titre la section dans la langue du projet', () => {
    expect(renderCriteriaSection([], 'fr')).toContain("## Critères d'acceptation");
    expect(renderCriteriaSection([], 'en')).toContain('## Acceptance criteria');
  });

  it('écrit une case à cocher par critère, avec code, type et version', () => {
    const section = renderCriteriaSection(
      [aCriterion({ code: 'AC-1', type: 'security', version: 2, status: 'active' })],
      'fr',
    );
    expect(section).toContain('- [ ] **AC-1** — Le paiement par carte expirée est refusé');
    expect(section).toContain('v2 · Sécurité · Actif');
  });

  it('ne rend pas les critères remplacés, gardés en historique', () => {
    const section = renderCriteriaSection(
      [aCriterion({ id: 'old', code: 'AC-1', status: 'superseded' })],
      'fr',
    );
    expect(section).not.toContain('**AC-1**');
    expect(section).toContain('0 critère(s)');
  });

  it('se relit sans perte : la section rend les mêmes textes (import idempotent)', () => {
    const criteria = [
      aCriterion({ id: 'c1', code: 'AC-1', text: 'Le paiement par carte expirée est refusé' }),
      aCriterion({ id: 'c2', code: 'AC-2', text: 'Un paiement déjà refusé ne repasse pas' }),
    ];
    const section = renderCriteriaSection(criteria, 'fr');
    expect(section.split('\n').filter((line) => line.startsWith('- [ ]'))).toHaveLength(2);
    expect(isSameCriterionText('Le paiement   par carte expirée est refusé', criteria[0].text)).toBe(
      true,
    );
    expect(normalizeCriterionText('  AC-1  Le refus ')).toBe('ac-1 le refus');
  });
});
