/**
 * Tests du verdict du validateur et du message d'erreur (SPEC §7.2, §12.1, §12.2, §19).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { aCoverage, aCriterionState } from '../helpers/builders.js';
import type { BlockingItem, Coverage, CriterionState } from '../../src/types.js';
import {
  buildGateErrorMessage,
  evaluateGate,
  lenientBlocking,
  MAX_NAMED_CRITERIA,
} from '../../src/domain/gate.js';

/** Trois défauts types du scénario PAY-123 (SPEC §7.2). */
function item(code: string, defect: BlockingItem['defect'], minor = false): BlockingItem {
  return {
    criterionId: `crit-${code}`,
    code,
    text: `Condition ${code}`,
    defect,
    expected: 'Attestation d’un tiers',
    minor,
  };
}

function coverageWith(
  blocking: readonly BlockingItem[],
  mode: Coverage['mode'] = 'strict',
  states: readonly CriterionState[] = [],
): Coverage {
  return aCoverage({
    mode,
    blocking,
    criteria: states,
    passes: blocking.length === 0,
    wouldBlock: blocking.length > 0,
  });
}

describe('domain/gate — message d’erreur au format du SPEC §7.2', () => {
  it('nomme chaque critère en défaut avec sa preuve attendue', () => {
    const message = buildGateErrorMessage(
      [item('AC-3', 'weak-strength'), item('AC-4', 'no-evidence')],
      [],
      'fr',
    );
    const lines = message.split('\n');
    expect(lines[0]).toBe('2 critères sans preuve suffisante.');
    expect(lines[1]).toContain('AC-3');
    expect(lines[1]).toContain('Condition AC-3');
    expect(lines[1]).toContain('Attestation d’un tiers attendue, aucune preuve reçue');
    expect(lines[2]).toContain('AC-4');
    expect(lines[2]).toContain('aucune preuve');
  });

  it('nomme au plus deux critères et renvoie au panneau pour le reste (SPEC §19)', () => {
    const blocking = [
      item('AC-1', 'no-evidence'),
      item('AC-2', 'not-fresh'),
      item('AC-3', 'weak-strength'),
      item('AC-4', 'unverified'),
    ];
    const message = buildGateErrorMessage(blocking, [], 'fr');
    const lines = message.split('\n');
    expect(lines).toHaveLength(1 + MAX_NAMED_CRITERIA + 1);
    expect(lines[1]).toContain('AC-1');
    expect(lines[2]).toContain('AC-2');
    expect(message).not.toContain('AC-3 «');
    expect(lines[3]).toContain('2 de plus');
    expect(lines[3]).toContain('panneau du ticket');
  });

  it('utilise le singulier pour un seul critère en défaut', () => {
    const message = buildGateErrorMessage([item('AC-1', 'no-evidence')], [], 'fr');
    expect(message.split('\n')[0]).toBe('1 critère sans preuve suffisante.');
  });

  it('traduit le message en anglais (SPEC §20)', () => {
    const message = buildGateErrorMessage([item('AC-1', 'no-evidence')], [], 'en');
    expect(message).toContain('1 criterion without sufficient proof.');
    expect(message).toContain('no proof');
  });

  it('affiche la force reçue pour un défaut de force, depuis l’état du critère', () => {
    const state = aCriterionState({
      criterionId: 'crit-AC-3',
      bestStrength: 'declared',
      proven: false,
    });
    const message = buildGateErrorMessage([item('AC-3', 'weak-strength')], [state], 'fr');
    expect(message).toContain('Attestation d’un tiers attendue, déclaration reçue');
  });

  it('un ticket sans critère produit le message dédié (SPEC §8.3)', () => {
    const message = buildGateErrorMessage([item('CRIT-0', 'no-criteria')], [], 'fr');
    expect(message).toContain('Aucun critère d’acceptation défini');
  });
});

describe('domain/gate — verdict selon les trois modes (SPEC §12.2)', () => {
  const blocking = [item('AC-1', 'no-evidence'), item('AC-2', 'weak-strength', true)];

  it('strict : bloque dès qu’un défaut existe', () => {
    const verdict = evaluateGate(coverageWith(blocking, 'strict'), { language: 'fr' });
    expect(verdict.result).toBe(false);
    expect(verdict.errorMessage).toContain('AC-1');
    expect(verdict.errorMessage).toContain('AC-2');
  });

  it('lenient : laisse passer si seuls des critères mineurs sont en défaut', () => {
    const minorsOnly = [item('AC-2', 'weak-strength', true)];
    const verdict = evaluateGate(coverageWith(minorsOnly, 'lenient'), { language: 'fr' });
    expect(verdict.result).toBe(true);
    expect(verdict.errorMessage).toBe('');
  });

  it('lenient : bloque dès qu’un critère majeur est en défaut', () => {
    const verdict = evaluateGate(coverageWith(blocking, 'lenient'), { language: 'fr' });
    expect(verdict.result).toBe(false);
    // Le message ne nomme que le critère majeur
    expect(verdict.errorMessage).toContain('AC-1');
    expect(verdict.errorMessage).not.toContain('AC-2 «');
    expect(lenientBlocking(blocking)).toHaveLength(1);
  });

  it('observe : ne bloque jamais, même avec des défauts (SPEC §22 pt 9)', () => {
    const verdict = evaluateGate(coverageWith(blocking, 'observe'), { language: 'fr' });
    expect(verdict.result).toBe(true);
    expect(verdict.errorMessage).toBe('');
  });

  it('une configuration de validateur peut surcharger le mode (SPEC §16.5)', () => {
    const verdict = evaluateGate(coverageWith(blocking, 'strict'), {
      language: 'fr',
      modeOverride: 'observe',
    });
    expect(verdict.result).toBe(true);
  });
});

describe('domain/gate — cas limites du verdict (SPEC §12.1, §20)', () => {
  it('couverture absente : le doute bloque, avec un message lisible', () => {
    const verdict = evaluateGate(null, { language: 'fr' });
    expect(verdict.result).toBe(false);
    expect(verdict.errorMessage).toContain('Couverture indisponible');
  });

  it('couverture complète : passe sans message', () => {
    const verdict = evaluateGate(coverageWith([], 'strict'), { language: 'fr' });
    expect(verdict.result).toBe(true);
    expect(verdict.errorMessage).toBe('');
  });

  it('la langue par défaut est l’anglais (soumission, SPEC §20)', () => {
    const verdict = evaluateGate(coverageWith([item('AC-1', 'no-evidence')], 'strict'));
    expect(verdict.errorMessage).toContain('without sufficient proof');
  });
});
