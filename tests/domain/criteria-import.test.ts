/**
 * Import des critères depuis la description (SPEC §8.2, §8.3, FP-02) :
 * les trois formes reconnues, l'idempotence, le statut selon l'auteur,
 * et l'interdiction faite à un agent de valider (SPEC §8.3, §15, §19).
 *
 * Fakes partagés uniquement : store, horloge, ids, LLM, Jira (docs/CONTRACTS.md §5).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createCriteria,
  hasCriteria,
  importCriteria,
  listCriteria,
  parseCriteria,
  proposeFromDescription,
  validateCriteria,
} from '../../src/domain/criteria-import.js';
import { createFakeClock, createFakeIds } from '../../tests/helpers/fake-clock.js';
import { createFakeStore, type FakeStore } from '../../tests/helpers/fake-store.js';
import { createFakeJira, createFakeLlm } from '../../tests/helpers/fake-gateways.js';
import {
  aCriterion,
  AGENT,
  anActor,
  anIssue,
  DEVELOPER,
  ISSUE_ID,
  settings,
} from '../../tests/helpers/builders.js';
import type { Actor } from '../../src/types.js';

const CHECKBOX_DESCRIPTION = [
  'Contexte : le paiement refuse une carte expirée.',
  '',
  '- [ ] Le paiement par carte expirée est refusé',
  '- [x] Un e-mail de refus est envoyé',
  '* [ ] La limite est réglable par l’administrateur',
].join('\n');

const LIST_DESCRIPTION = [
  '## Critères d’acceptation',
  '- Le paiement par carte expirée est refusé',
  '- L’e-mail de refus est envoyé',
  '1. La limite est réglable par l’administrateur',
  '',
  '## Notes',
  '- Ceci n’est pas un critère',
].join('\n');

const SCENARIO_DESCRIPTION = [
  'Étant donné une carte expirée',
  'Quand le paiement est soumis',
  'Alors le paiement est refusé',
  '',
  'Given an expired card',
  'When the payment is submitted',
  'Then the payment is refused',
].join('\n');

let store: FakeStore;
const clock = createFakeClock();
const ids = createFakeIds('crit');
const human: Actor = anActor({ accountId: DEVELOPER, agent: false });
const agent: Actor = anActor({ accountId: AGENT, agent: true, roles: [] });

function deps() {
  return { store, clock, ids };
}

beforeEach(() => {
  store = createFakeStore();
  clock.set('2026-11-11T08:00:00.000Z');
});

describe('les trois formes d’import (SPEC §8.2)', () => {
  it('reconnaît les cases à cocher, cochées ou non, tirets ou astérisques', () => {
    const parsed = parseCriteria(CHECKBOX_DESCRIPTION, 'fr');
    expect(parsed).toHaveLength(3);
    expect(parsed.every((item) => item.origin === 'checkbox')).toBe(true);
    expect(parsed[0]).toMatchObject({ text: 'Le paiement par carte expirée est refusé' });
  });

  it('reconnaît la liste sous un titre « Critères d’acceptation »', () => {
    const parsed = parseCriteria(LIST_DESCRIPTION, 'fr');
    expect(parsed.map((item) => item.text)).toEqual([
      'Le paiement par carte expirée est refusé',
      'L’e-mail de refus est envoyé',
      'La limite est réglable par l’administrateur',
    ]);
    expect(parsed.every((item) => item.origin === 'list')).toBe(true);
  });

  it('reconnaît le titre anglais « Acceptance criteria »', () => {
    const parsed = parseCriteria(
      ['## Acceptance criteria', '- The expired card is refused'].join('\n'),
      'en',
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].origin).toBe('list');
  });

  it('ignore les puces hors de toute section de critères', () => {
    const parsed = parseCriteria(['## Notes', '- Ceci n’est pas un critère'].join('\n'), 'fr');
    expect(parsed).toEqual([]);
  });

  it('reconnaît les scénarios « Étant donné / quand / alors » et « Given / When / Then »', () => {
    const parsed = parseCriteria(SCENARIO_DESCRIPTION, 'fr');
    expect(parsed).toHaveLength(2);
    expect(parsed.every((item) => item.origin === 'scenario')).toBe(true);
    expect(parsed[0].text).toBe(
      'Étant donné une carte expirée, quand le paiement est soumis, alors le paiement est refusé',
    );
  });

  it('regroupe un scénario écrit sur plusieurs lignes', () => {
    const parsed = parseCriteria(
      [
        'Étant donné une carte expirée',
        'et un compte client actif',
        'Quand le paiement est soumis',
        'Alors le paiement est refusé',
        'et un e-mail est envoyé',
      ].join('\n'),
      'fr',
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].text).toContain('et un compte client actif');
    expect(parsed[0].text).toContain('et un e-mail est envoyé');
  });

  it('écarte un scénario sans « alors » : il ne prouve rien', () => {
    const parsed = parseCriteria(
      ['Étant donné une carte expirée', 'Quand le paiement est soumis'].join('\n'),
      'fr',
    );
    expect(parsed).toEqual([]);
  });

  it('ignore une case à cocher vide et une puce vide', () => {
    const parsed = parseCriteria(['- [ ]   ', '- ', '- [ ] Un critère réel'].join('\n'), 'fr');
    expect(parsed.map((item) => item.text)).toEqual(['Un critère réel']);
  });

  it('déduplique un critère présent sous deux formes', () => {
    const parsed = parseCriteria(
      [
        '- [ ] Le paiement est refusé',
        '## Critères d’acceptation',
        '- le paiement est refusé',
      ].join('\n'),
      'fr',
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].origin).toBe('checkbox');
  });

  it('est déterministe : deux lectures rendent exactement la même liste', () => {
    expect(parseCriteria(CHECKBOX_DESCRIPTION, 'fr')).toEqual(
      parseCriteria(CHECKBOX_DESCRIPTION, 'fr'),
    );
  });

  it('rend une liste vide pour une description vide', () => {
    expect(parseCriteria('   \n ', 'fr')).toEqual([]);
  });
});

describe('statut selon l’auteur (SPEC §8.3)', () => {
  it('crée des critères proposés quand l’auteur est un agent', async () => {
    const result = await createCriteria(
      {
        issueId: ISSUE_ID,
        drafts: [{ text: 'Le paiement par carte expirée est refusé' }],
        author: agent,
      },
      deps(),
    );
    expect(result.created).toHaveLength(1);
    expect(result.created[0].status).toBe('proposed');
    expect(result.created[0].code).toBe('AC-1');
    expect(result.created[0].createdBy).toBe(AGENT);
  });

  it('crée des critères actifs quand un humain valide le découpage', async () => {
    const result = await createCriteria(
      {
        issueId: ISSUE_ID,
        drafts: [{ text: 'Le paiement par carte expirée est refusé' }],
        author: human,
      },
      deps(),
    );
    expect(result.created[0].status).toBe('active');
  });

  it('interdit à un agent de valider un critère proposé', async () => {
    const created = await createCriteria(
      { issueId: ISSUE_ID, drafts: [{ text: 'Le refus est journalisé' }], author: agent },
      deps(),
    );
    await expect(
      validateCriteria([created.created[0].id], agent, { store, clock }, 'fr'),
    ).rejects.toThrowError(/AC-1/);
    const stored = await store.getCriterion(created.created[0].id);
    expect(stored?.status).toBe('proposed');
  });

  it('un humain valide : le critère proposé devient actif', async () => {
    const created = await createCriteria(
      { issueId: ISSUE_ID, drafts: [{ text: 'Le refus est journalisé' }], author: agent },
      deps(),
    );
    const validated = await validateCriteria([created.created[0].id], human, { store, clock }, 'fr');
    expect(validated).toHaveLength(1);
    expect(validated[0].status).toBe('active');
    expect(validated[0].updatedAt).toBe(clock.now());
  });

  it('valider deux fois ne change plus rien', async () => {
    const created = await createCriteria(
      { issueId: ISSUE_ID, drafts: [{ text: 'Le refus est journalisé' }], author: agent },
      deps(),
    );
    await validateCriteria([created.created[0].id], human, { store, clock }, 'fr');
    const second = await validateCriteria([created.created[0].id], human, { store, clock }, 'fr');
    expect(second).toEqual([]);
  });
});

describe('import idempotent (SPEC §8.2)', () => {
  it('relire la même description ne duplique pas les critères', async () => {
    const issue = anIssue({ description: CHECKBOX_DESCRIPTION });
    const first = await importCriteria({ issue, actor: human }, deps());
    const second = await importCriteria({ issue, actor: human }, deps());
    expect(first.created).toHaveLength(3);
    expect(second.created).toHaveLength(0);
    expect(second.skipped).toHaveLength(3);
    expect(await store.listCriteriaByIssue(ISSUE_ID)).toHaveLength(3);
  });

  it('ignore un texte déjà tenu malgré des espaces superflus', async () => {
    await createCriteria(
      { issueId: ISSUE_ID, drafts: [{ text: 'Le refus est journalisé' }], author: human },
      deps(),
    );
    const again = await createCriteria(
      { issueId: ISSUE_ID, drafts: [{ text: '  Le refus   est journalisé ' }], author: human },
      deps(),
    );
    expect(again.created).toHaveLength(0);
    expect(again.skipped).toEqual(['Le refus est journalisé']);
  });

  it('réutilise un critère remplacé : le code n’est pas repris, le texte oui', async () => {
    await store.saveCriterion(aCriterion({ id: 'crit-1', code: 'AC-1', status: 'superseded' }));
    const result = await createCriteria(
      { issueId: ISSUE_ID, drafts: [{ text: 'Un critère neuf' }], author: human },
      deps(),
    );
    expect(result.created[0].code).toBe('AC-2');
  });

  it('attribue des codes AC-n stables et croissants', async () => {
    const result = await createCriteria(
      {
        issueId: ISSUE_ID,
        drafts: [{ text: 'Premier critère' }, { text: 'Deuxième critère' }],
        author: human,
      },
      deps(),
    );
    expect(result.created.map((criterion) => criterion.code)).toEqual(['AC-1', 'AC-2']);
    expect(await store.nextCriterionCode(ISSUE_ID)).toBe('AC-3');
  });
});

describe('ticket sans critère (SPEC §8.3, §21)', () => {
  it('hasCriteria est faux avant import, vrai après', async () => {
    expect(await hasCriteria(store, ISSUE_ID)).toBe(false);
    await importCriteria({ issue: anIssue({ description: CHECKBOX_DESCRIPTION }), actor: human }, deps());
    expect(await hasCriteria(store, ISSUE_ID)).toBe(true);
  });

  it('liste les critères triés par code, sans les remplacés', async () => {
    await store.saveCriterion(aCriterion({ id: 'c10', code: 'AC-10' }));
    await store.saveCriterion(aCriterion({ id: 'c2', code: 'AC-2' }));
    await store.saveCriterion(aCriterion({ id: 'old', code: 'AC-1', status: 'superseded' }));
    const listed = await listCriteria(store, ISSUE_ID);
    expect(listed.map((criterion) => criterion.code)).toEqual(['AC-2', 'AC-10']);
  });

  it('un ticket sans code (rédaction) importe des critères attestables (SPEC §21)', async () => {
    const issue = anIssue({
      description: ['## Critères d’acceptation', '- La procédure est documentée dans le guide'].join(
        '\n',
      ),
    });
    const result = await importCriteria({ issue, actor: human }, deps());
    expect(result.created).toHaveLength(1);
    expect(result.created[0].type).toBe('documentation');
    expect(result.created[0].requiredStrength).toBe('machine-verified');
  });

  it('ne crée rien quand aucune forme n’est reconnue et aucun LLM fourni', async () => {
    const result = await importCriteria(
      { issue: anIssue({ description: 'Un texte libre sans structure.' }), actor: agent },
      deps(),
    );
    expect(result.created).toEqual([]);
    expect(await hasCriteria(store, ISSUE_ID)).toBe(false);
  });
});

describe('le LLM n’est qu’un complément (SPEC §8.2, §19)', () => {
  it('tombe sur le LLM quand aucune forme n’est reconnue', async () => {
    const llm = createFakeLlm({
      defaultCriteria: [{ text: 'Le refus est expliqué à l’utilisateur', type: 'functional', origin: 'list' }],
    });
    const drafts = await proposeFromDescription('Texte libre.', 'fr', llm);
    expect(drafts).toHaveLength(1);
    expect(llm.journal.count('parseCriteria')).toBe(1);
  });

  it('n’appelle pas le LLM quand le découpage déterministe suffit', async () => {
    const llm = createFakeLlm();
    const drafts = await proposeFromDescription(CHECKBOX_DESCRIPTION, 'fr', llm);
    expect(drafts).toHaveLength(3);
    expect(llm.journal.count('parseCriteria')).toBe(0);
  });

  it('une panne du LLM ne bloque pas l’import', async () => {
    const llm = createFakeLlm({ criteria: [new Error('modèle indisponible')] });
    await expect(proposeFromDescription('Texte libre.', 'fr', llm)).resolves.toEqual([]);
  });
});

describe('réécriture de la description (SPEC §8.2)', () => {
  it('écrit la section des critères dans Jira après import', async () => {
    const jira = createFakeJira();
    const issue = anIssue({ description: CHECKBOX_DESCRIPTION });
    await importCriteria(
      { issue, actor: human, settings: settings({ language: 'fr' }) },
      { ...deps(), jira },
    );
    expect(jira.rewrites).toHaveLength(1);
    expect(jira.rewrites[0].issueId).toBe(ISSUE_ID);
    expect(jira.rewrites[0].section).toContain("## Critères d'acceptation");
    expect(jira.rewrites[0].section).toContain('**AC-3**');
  });

  it('hérite de la force exigée du type inféré', async () => {
    const result = await createCriteria(
      {
        issueId: ISSUE_ID,
        drafts: [{ text: 'Le refus est notifié sans exposer le mot de passe' }],
        author: human,
      },
      deps(),
    );
    expect(result.created[0].type).toBe('security');
    expect(result.created[0].requiredStrength).toBe('attested');
  });

  it('écrit la première version dans l’historique du critère', async () => {
    const result = await createCriteria(
      { issueId: ISSUE_ID, drafts: [{ text: 'Le refus est journalisé' }], author: human },
      deps(),
    );
    const revisions = await store.listCriterionRevisions(result.created[0].id);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].version).toBe(1);
  });
});
