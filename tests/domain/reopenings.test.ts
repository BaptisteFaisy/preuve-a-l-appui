/**
 * Les réouvertures réelles (SPEC §14 FP-18).
 *
 * La mesure « taux de réouverture selon la force des preuves » ne se lit pas
 * dans la base : elle se déduit de l'historique Jira (un ticket livré puis
 * rouvert) et de la couverture réelle (la force de sa preuve). Avant, elle
 * était toujours vide dans l'app installée.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { reopeningEvents, reopeningRates, wasReopened } from '../../src/domain/stats.js';
import { isClosedStatus } from '../../src/domain/status.js';
import type { Coverage, TicketStatusHistory } from '../../src/types.js';

/** Un historique de statuts. */
function history(
  issueKey: string,
  transitions: readonly { from: string; to: string }[],
  currentStatus = 'Done',
): TicketStatusHistory {
  return {
    issueId: `id-${issueKey}`,
    issueKey,
    currentStatus,
    transitions: [...transitions],
  };
}

/** Une couverture : un critère prouvé, de la force demandée. */
function coverage(
  issueKey: string,
  strength: 'machine-verified' | 'attested' | 'declared',
): Coverage {
  return {
    issueId: `id-${issueKey}`,
    issueKey,
    total: 1,
    proven: 1,
    waived: 0,
    mode: 'strict',
    passes: true,
    wouldBlock: false,
    blocking: [],
    criteria: [
      {
        criterionId: `id-${issueKey}-crit-1`,
        code: 'AC-1',
        text: 'texte',
        type: 'functional',
        version: 1,
        requiredStrength: 'machine-verified',
        bestEvidenceId: `id-${issueKey}-ev-1`,
        bestStrength: strength,
        proven: true,
        waived: false,
        minor: false,
        defect: null,
        expected: '',
        evidences: [],
        waiverId: '',
      },
    ],
    updatedAt: '2026-11-13T09:00:00.000Z',
  };
}

describe('isClosedStatus', () => {
  it('reconnaît les statuts livrés, dans les langues de Jira', () => {
    expect(isClosedStatus('Done')).toBe(true);
    expect(isClosedStatus('Terminé')).toBe(true);
    expect(isClosedStatus('Closed')).toBe(true);
    expect(isClosedStatus('In Progress')).toBe(false);
    expect(isClosedStatus('To Do')).toBe(false);
  });
});

describe('wasReopened', () => {
  it('dit vrai quand le ticket passe par un statut livré puis revient', () => {
    const ticket = history('PRF-2', [
      { from: 'To Do', to: 'Done' },
      { from: 'Done', to: 'To Do' },
    ]);
    expect(wasReopened(ticket)).toBe(true);
  });

  it('dit faux quand le ticket reste livré', () => {
    const ticket = history('PRF-3', [{ from: 'To Do', to: 'Done' }]);
    expect(wasReopened(ticket)).toBe(false);
  });
});

describe('reopeningEvents', () => {
  it('compte un événement par ticket livré, dit s’il a été rouvert', () => {
    const events = reopeningEvents(
      [
        history('PRF-2', [
          { from: 'To Do', to: 'Done' },
          { from: 'Done', to: 'To Do' },
        ]),
        history('PRF-3', [{ from: 'To Do', to: 'Done' }]),
        history('PRF-4', [{ from: 'To Do', to: 'In Progress' }], 'In Progress'),
      ],
      [coverage('PRF-2', 'machine-verified'), coverage('PRF-3', 'attested')],
    );

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ strength: 'machine-verified', reopened: true });
    expect(events[1]).toEqual({ strength: 'attested', reopened: false });
  });

  it('ignore un ticket jamais livré', () => {
    const events = reopeningEvents(
      [history('PRF-5', [{ from: 'To Do', to: 'In Progress' }], 'In Progress')],
      [],
    );
    expect(events).toHaveLength(0);
  });

  it('classe un ticket sans couverture prouvée en « déclaré »', () => {
    const events = reopeningEvents([history('PRF-6', [{ from: 'To Do', to: 'Done' }])], []);
    expect(events[0]?.strength).toBe('declared');
  });
});

describe('reopeningRates', () => {
  it('donne le taux par force : une réouverture sur deux livrés', () => {
    const rates = reopeningRates([
      { strength: 'machine-verified', reopened: true },
      { strength: 'machine-verified', reopened: false },
      { strength: 'attested', reopened: false },
    ]);
    const machine = rates.find((rate) => rate.strength === 'machine-verified');
    expect(machine?.closed).toBe(2);
    expect(machine?.reopened).toBe(1);
    const attested = rates.find((rate) => rate.strength === 'attested');
    expect(attested?.closed).toBe(1);
    expect(attested?.reopened).toBe(0);
  });
});
