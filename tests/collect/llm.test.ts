import { describe, expect, it } from 'vitest';
import {
  createLlmGateway,
  extractText,
  fallbackClassify,
  fallbackParseCriteria,
  fallbackSuggestPairs,
  parseJsonBlock,
  type ForgeLlmClient,
} from '../../src/collect/llm.js';
import type { Criterion } from '../../src/types.js';

describe('extractText & parseJsonBlock', () => {
  it('extrait le texte depuis une chaîne ou un tableau de blocs', () => {
    expect(extractText('Simple texte')).toBe('Simple texte');
    expect(extractText([{ text: 'Bloc 1 ' }, { text: 'Bloc 2' }])).toBe('Bloc 1 Bloc 2');
    expect(extractText(null)).toBe('');
  });

  it('parse du JSON brut ou imbriqué dans des blocs Markdown', () => {
    expect(parseJsonBlock('{"type": "functional"}')).toEqual({ type: 'functional' });
    expect(parseJsonBlock('```json\n{"type": "security"}\n```')).toEqual({ type: 'security' });
    expect(parseJsonBlock('pas du json')).toBeNull();
  });
});

describe('replis déterministes du modèle (SPEC §19 : jamais d exception)', () => {
  it('classe par mots-clés les sept types de critère', () => {
    expect(fallbackClassify('Temps de réponse sous 200 ms')).toBe('performance');
    expect(fallbackClassify('Chiffrement du token et droits')).toBe('security');
    expect(fallbackClassify('Contraste conforme WCAG a11y')).toBe('accessibility');
    expect(fallbackClassify('Migration de la table clients en SQL')).toBe('data');
    expect(fallbackClassify('Mise à jour du guide Confluence')).toBe('documentation');
    expect(fallbackClassify('Non-régression du calcul existant')).toBe('regression');
    expect(fallbackClassify('Le bouton affiche le total')).toBe('functional');
  });

  it('découpe une description en critères cases à cocher, listes et scénarios', () => {
    const description = [
      '## Critères',
      '- [ ] Valider le panier',
      '* Confirmer la commande',
      'Étant donné un client, quand il paie, alors le reçu est envoyé',
      'ligne ignorée',
    ].join('\n');

    const parsed = fallbackParseCriteria(description);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ text: 'Valider le panier', origin: 'checkbox' });
    expect(parsed[1]).toMatchObject({ text: 'Confirmer la commande', origin: 'list' });
    expect(parsed[2]).toMatchObject({ origin: 'scenario' });
  });

  it('borne le repli d import à cinquante critères', () => {
    const description = Array.from({ length: 80 }, (_unused, index) => `- critère ${index}`).join('\n');
    expect(fallbackParseCriteria(description)).toHaveLength(50);
  });

  it('rapproche un test d un critère par inclusion de mots signifiants', () => {
    const criterion: Criterion = {
      id: 'crit-9',
      issueId: 'PAY-1',
      code: 'AC-9',
      text: 'Le refus de paiement est notifié par courriel',
      type: 'functional',
      requiredStrength: 'machine-verified',
      version: 1,
      status: 'active',
      createdBy: 'u1',
      createdAt: '2026-11-11T00:00:00Z',
      updatedAt: '2026-11-11T00:00:00Z',
    };

    const pairs = fallbackSuggestPairs([criterion], ['PayMailTests.testRefusNotifie', 'Other.unrelated']);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.testName).toBe('PayMailTests.testRefusNotifie');
    expect(pairs[0]!.confidence).toBeGreaterThan(0.4);
    expect(pairs[0]!.rationale.length).toBeGreaterThan(0);
  });

  it('ne propose aucune paire quand aucun mot ne correspond', () => {
    const criterion: Criterion = {
      id: 'crit-9',
      issueId: 'PAY-1',
      code: 'AC-9',
      text: 'zzz qqq',
      type: 'functional',
      requiredStrength: 'machine-verified',
      version: 1,
      status: 'active',
      createdBy: 'u1',
      createdAt: '2026-11-11T00:00:00Z',
      updatedAt: '2026-11-11T00:00:00Z',
    };
    expect(fallbackSuggestPairs([criterion], ['SomeTest.other'])).toEqual([]);
  });
});

describe('LlmGateway - parseCriteria', () => {
  it('extrait des critères d acceptation au format JSON validé', async () => {
    const fakeClient: ForgeLlmClient = {
      async chat() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { text: 'Le paiement par carte est accepté', type: 'functional', origin: 'list' },
                  { text: 'Chiffrement TLS 1.3 requis', type: 'security', origin: 'list' },
                ]),
              },
            },
          ],
        };
      },
    };

    const llm = createLlmGateway({ client: fakeClient });
    const parsed = await llm.parseCriteria('Description...', 'fr');
    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.type).toBe('functional');
    expect(parsed[1]!.type).toBe('security');
  });

  it('retombe sur le repli déterministe si le modèle renvoie du texte non JSON', async () => {
    const fakeClient: ForgeLlmClient = {
      async chat() {
        return { choices: [{ message: { content: 'Voici les critères : pas du tout du json' } }] };
      },
    };

    const llm = createLlmGateway({ client: fakeClient });
    const desc = '## Critères\n- [ ] Valider le panier\n- [ ] Confirmer la commande';
    const parsed = await llm.parseCriteria(desc, 'fr');
    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.text).toBe('Valider le panier');
    expect(parsed[0]!.origin).toBe('checkbox');
  });

  it('gère une panne ou une exception du client sans lever d exception', async () => {
    const fakeClient: ForgeLlmClient = {
      async chat() {
        throw new Error('LLM Service Unavailable');
      },
    };

    const llm = createLlmGateway({ client: fakeClient });
    const parsed = await llm.parseCriteria('- [ ] Télécharger la facture', 'fr');
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.text).toBe('Télécharger la facture');
  });

  it('renvoie un tableau vide pour une description vide', async () => {
    const llm = createLlmGateway();
    expect(await llm.parseCriteria('', 'fr')).toEqual([]);
    expect(await llm.parseCriteria('   ', 'en')).toEqual([]);
  });
});

describe('LlmGateway - classifyCriterion', () => {
  it('classifie un critère via la réponse du modèle', async () => {
    const fakeClient: ForgeLlmClient = {
      async chat() {
        return { choices: [{ message: { content: '{"type": "performance"}' } }] };
      },
    };

    const llm = createLlmGateway({ client: fakeClient });
    const type = await llm.classifyCriterion('Temps de réponse sous 200 ms');
    expect(type).toBe('performance');
  });

  it('retombe sur les mots-clés déterministes si la réponse est invalide', async () => {
    const fakeClient: ForgeLlmClient = {
      async chat() {
        return { choices: [{ message: { content: 'type inconnu' } }] };
      },
    };

    const llm = createLlmGateway({ client: fakeClient });
    expect(await llm.classifyCriterion('Vérifier l authentification et le token JWT')).toBe('security');
    expect(await llm.classifyCriterion('Contraste des couleurs conforme a11y')).toBe('accessibility');
    expect(await llm.classifyCriterion('Migration du schéma et table clients')).toBe('data');
    expect(await llm.classifyCriterion('Mise à jour du wiki et de la documentation')).toBe('documentation');
    expect(await llm.classifyCriterion('Non-régression sur le calcul')).toBe('regression');
  });

  it('renvoie functional par défaut en cas de texte vide ou neutre', async () => {
    const llm = createLlmGateway();
    expect(await llm.classifyCriterion('')).toBe('functional');
  });
});

describe('LlmGateway - suggestPairs', () => {
  const criteria: Criterion[] = [
    {
      id: 'crit-1',
      issueId: 'PAY-1',
      code: 'AC-1',
      text: 'Le débit de carte est confirmé',
      type: 'functional',
      requiredStrength: 'machine-verified',
      version: 1,
      status: 'active',
      createdBy: 'u1',
      createdAt: '2026-11-11T00:00:00Z',
      updatedAt: '2026-11-11T00:00:00Z',
    },
  ];

  it('retourne les paires validées proposées par le LLM', async () => {
    const fakeClient: ForgeLlmClient = {
      async chat() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    criterionId: 'crit-1',
                    testName: 'PaymentTest.testCardDebit',
                    confidence: 0.85,
                    rationale: 'Teste le débit de carte',
                  },
                ]),
              },
            },
          ],
        };
      },
    };

    const llm = createLlmGateway({ client: fakeClient });
    const pairs = await llm.suggestPairs(criteria, ['PaymentTest.testCardDebit']);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.criterionId).toBe('crit-1');
    expect(pairs[0]!.confidence).toBe(0.85);
  });

  it('retombe sur le rapprochement déterministe si le modèle échoue', async () => {
    const fakeClient: ForgeLlmClient = {
      async chat() {
        throw new Error('LLM error');
      },
    };

    const llm = createLlmGateway({ client: fakeClient });
    const pairs = await llm.suggestPairs(criteria, ['PaymentTest.testCarteDebit']);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.criterionId).toBe('crit-1');
    expect(pairs[0]!.confidence).toBeGreaterThan(0.3);
  });

  it('gère des listes vides immédiatement', async () => {
    const llm = createLlmGateway();
    expect(await llm.suggestPairs([], ['Test'])).toEqual([]);
    expect(await llm.suggestPairs(criteria, [])).toEqual([]);
  });

  it('gère un délai dépassé sans exception', async () => {
    const llm = createLlmGateway({
      timeoutMs: 10,
      client: {
        chat: () => new Promise((resolve) => setTimeout(() => resolve({ choices: [] }), 100)),
      },
    });
    const type = await llm.classifyCriterion('Vérifier les données SQL');
    expect(type).toBe('data');
  });
});
