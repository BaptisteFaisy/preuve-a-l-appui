/**
 * Le contrat du scénario de démonstration (socle gelé, lot `env-complet`).
 *
 * Ce fichier est le SEUL endroit où la forme d'une histoire de ticket est
 * décidée. Les règles y sont strictes : un scénario mal formé est rejeté,
 * jamais appliqué à moitié.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { emptyScenario, parseScenario } from '../../src/sample/scenario.js';

/** Un scénario minimal mais complet. */
function scenario(): Record<string, unknown> {
  return {
    criteria: [
      {
        code: 'AC-1',
        text: 'Le paiement par carte expirée est refusé',
        type: 'functional',
        requiredStrength: 'machine-verified',
      },
      {
        code: 'AC-2',
        text: 'La limite est réglable par un administrateur',
        type: 'performance',
        requiredStrength: 'attested',
        status: 'proposed',
      },
    ],
    evidences: [
      { criterion: 'AC-1', type: 'test', reference: 'checkout refuses an expired card' },
      {
        criterion: 'AC-1',
        type: 'documentation',
        reference: 'docs/refus.md',
        note: 'Procédure de refus',
        addedBy: 'developer',
      },
    ],
    attest: [{ code: 'AC-1', accountId: 'user-tester', note: 'Vérifié à la main' }],
    waive: [
      {
        code: 'AC-2',
        accountId: 'user-po',
        role: 'Product Owner',
        reason: 'Reporté à la version 2.5',
      },
    ],
    links: [{ code: 'AC-1', testName: 'checkout refuses an expired card' }],
    revisions: [{ code: 'AC-1', text: 'Le paiement par carte expirée est refusé sans repasser' }],
  };
}

describe('parseScenario — un scénario valide', () => {
  it('lit les critères, les preuves et les gestes', () => {
    const parsed = parseScenario(scenario());
    expect(parsed).not.toBeNull();
    expect(parsed?.criteria).toHaveLength(2);
    expect(parsed?.evidences).toHaveLength(2);
    expect(parsed?.attest).toHaveLength(1);
    expect(parsed?.waive).toHaveLength(1);
    expect(parsed?.links).toHaveLength(1);
    expect(parsed?.revisions).toHaveLength(1);
  });

  it('complète les valeurs absentes : statut actif, agent auteur, paire confirmée', () => {
    const parsed = parseScenario(scenario());
    expect(parsed?.criteria[0]?.status).toBe('active');
    expect(parsed?.criteria[1]?.status).toBe('proposed');
    expect(parsed?.evidences[0]?.addedBy).toBe('agent');
    expect(parsed?.evidences[1]?.addedBy).toBe('developer');
    expect(parsed?.links[0]?.status).toBe('confirmed');
    expect(parsed?.evidences[0]?.note).toBe('');
  });

  it('accepte un scénario sans geste humain', () => {
    const parsed = parseScenario({ criteria: [], evidences: [] });
    expect(parsed).not.toBeNull();
    expect(parsed?.attest).toEqual([]);
    expect(parsed?.waive).toEqual([]);
  });
});

describe('parseScenario — un scénario mal formé est rejeté', () => {
  it('refuse un critère sans code ou sans texte', () => {
    const broken = scenario();
    broken['criteria'] = [{ code: '', text: 'texte', type: 'functional' }];
    expect(parseScenario(broken)).toBeNull();
  });

  it('refuse deux critères de même code', () => {
    const broken = scenario();
    broken['criteria'] = [
      { code: 'AC-1', text: 'a', type: 'functional', requiredStrength: 'attested' },
      { code: 'AC-1', text: 'b', type: 'functional', requiredStrength: 'attested' },
    ];
    expect(parseScenario(broken)).toBeNull();
  });

  it('refuse un type de critère inconnu', () => {
    const broken = scenario();
    broken['criteria'] = [
      { code: 'AC-1', text: 'a', type: 'magique', requiredStrength: 'attested' },
    ];
    expect(parseScenario(broken)).toBeNull();
  });

  it('refuse une force exigée inconnue', () => {
    const broken = scenario();
    broken['criteria'] = [
      { code: 'AC-1', text: 'a', type: 'functional', requiredStrength: 'incroyable' },
    ];
    expect(parseScenario(broken)).toBeNull();
  });

  it('refuse une preuve qui vise un critère inexistant', () => {
    const broken = scenario();
    broken['evidences'] = [{ criterion: 'AC-9', type: 'test', reference: 'x' }];
    expect(parseScenario(broken)).toBeNull();
  });

  it('refuse une attestation, une dérogation ou une paire sur un critère inexistant', () => {
    const broken = scenario();
    broken['attest'] = [{ code: 'AC-9', accountId: 'user-tester' }];
    expect(parseScenario(broken)).toBeNull();

    const brokenWaiver = scenario();
    brokenWaiver['waive'] = [
      { code: 'AC-9', accountId: 'user-po', role: 'Product Owner', reason: 'non' },
    ];
    expect(parseScenario(brokenWaiver)).toBeNull();

    const brokenLink = scenario();
    brokenLink['links'] = [{ code: 'AC-9', testName: 'x' }];
    expect(parseScenario(brokenLink)).toBeNull();
  });

  it('refuse une dérogation sans motif', () => {
    const broken = scenario();
    broken['waive'] = [{ code: 'AC-2', accountId: 'user-po', role: 'Product Owner', reason: '' }];
    expect(parseScenario(broken)).toBeNull();
  });

  it('refuse ce qui n’est pas un objet', () => {
    expect(parseScenario(null)).toBeNull();
    expect(parseScenario('texte')).toBeNull();
    expect(parseScenario(42)).toBeNull();
  });
});

describe('emptyScenario', () => {
  it('est un scénario sans rien', () => {
    const empty = emptyScenario();
    expect(empty.criteria).toEqual([]);
    expect(empty.evidences).toEqual([]);
    expect(empty.revisions).toEqual([]);
  });
});
