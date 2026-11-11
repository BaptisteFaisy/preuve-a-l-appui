/**
 * Tests du domaine des dérogations (SPEC §12.4, FP-09).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { aWaiver } from '../helpers/builders.js';
import {
  countWaiversByGranter,
  findActiveWaiver,
  isRoleAllowedToWaive,
  isWaiverApplicable,
  isWaiverValid,
  validateWaiverCandidate,
} from '../../src/domain/waivers.js';
import type { RolePolicy } from '../../src/types.js';

describe('domain/waivers — validité d’une dérogation', () => {
  const now = '2026-11-11T12:00:00.000Z';

  it('une dérogation active avec motif est valide', () => {
    const waiver = aWaiver({ reason: 'Reporté dans PAY-140' });
    expect(isWaiverValid(waiver, now)).toBe(true);
  });

  it('une dérogation révoquée n’est plus valide', () => {
    const waiver = aWaiver({
      reason: 'Reporté',
      revokedAt: '2026-11-11T11:00:00.000Z',
    });
    expect(isWaiverValid(waiver, now)).toBe(false);
  });

  it('une dérogation expirée n’est plus valide', () => {
    const waiver = aWaiver({
      reason: 'Reporté temporairement',
      expiresAt: '2026-11-11T10:00:00.000Z',
    });
    expect(isWaiverValid(waiver, now)).toBe(false);
  });

  it('une dérogation dont l’expiration est future reste valide', () => {
    const waiver = aWaiver({
      reason: 'Reporté temporairement',
      expiresAt: '2026-11-11T18:00:00.000Z',
    });
    expect(isWaiverValid(waiver, now)).toBe(true);
  });

  it('une dérogation sans motif est rejetée', () => {
    const waiver = aWaiver({ reason: '   ' });
    expect(isWaiverValid(waiver, now)).toBe(false);
  });
});

describe('domain/waivers — non-héritage (SPEC §12.4)', () => {
  const now = '2026-11-11T12:00:00.000Z';

  it('une dérogation sur AC-4 ne couvre JAMAIS AC-5', () => {
    const waiverAc4 = aWaiver({ criterionId: 'crit-ac4', reason: 'Reporté dans PAY-140' });
    expect(isWaiverApplicable(waiverAc4, 'crit-ac4', now)).toBe(true);
    expect(isWaiverApplicable(waiverAc4, 'crit-ac5', now)).toBe(false);

    const active = findActiveWaiver('crit-ac5', [waiverAc4], now);
    expect(active).toBeNull();
  });

  it('trouve la dérogation active parmi plusieurs critères', () => {
    const w1 = aWaiver({ id: 'w1', criterionId: 'crit-1', reason: 'Motif 1' });
    const w2 = aWaiver({ id: 'w2', criterionId: 'crit-2', reason: 'Motif 2' });
    const found = findActiveWaiver('crit-2', [w1, w2], now);
    expect(found?.id).toBe('w2');
  });
});

describe('domain/waivers — contrôle des rôles et compteurs (SPEC §12.4)', () => {
  const rolesPolicy: RolePolicy = {
    attest: ['Developers'],
    waive: ['Administrators', 'Product Owner'],
    security: ['Security Reviewer'],
    data: ['Data Lead'],
  };

  it('autorise un Product Owner ou Administrateur à déroger', () => {
    expect(isRoleAllowedToWaive(['Product Owner'], rolesPolicy)).toBe(true);
    expect(isRoleAllowedToWaive(['Administrators'], rolesPolicy)).toBe(true);
  });

  it('interdit à un simple Developer de déroger', () => {
    expect(isRoleAllowedToWaive(['Developers'], rolesPolicy)).toBe(false);
    expect(isRoleAllowedToWaive([], rolesPolicy)).toBe(false);
  });

  it('valide une candidature de dérogation conforme', () => {
    const res = validateWaiverCandidate({
      criterionId: 'crit-1',
      grantedBy: 'user-po',
      role: 'Product Owner',
      reason: 'Attente du retour juridique',
      actorRoles: ['Product Owner'],
      rolesPolicy,
    });
    expect(res.valid).toBe(true);
  });

  it('rejette une candidature sans motif ou sans rôle habilité', () => {
    const res1 = validateWaiverCandidate({
      criterionId: 'crit-1',
      grantedBy: 'user-dev',
      role: 'Developers',
      reason: '',
      actorRoles: ['Developers'],
      rolesPolicy,
    });
    expect(res1.valid).toBe(false);

    const res2 = validateWaiverCandidate({
      criterionId: 'crit-1',
      grantedBy: 'user-dev',
      role: 'Developers',
      reason: 'Validé à l’oral',
      actorRoles: ['Developers'],
      rolesPolicy,
    });
    expect(res2.valid).toBe(false);
  });

  it('calcule le compteur de dérogations par personne', () => {
    const w1 = aWaiver({ id: 'w1', grantedBy: 'user-po' });
    const w2 = aWaiver({ id: 'w2', grantedBy: 'user-po' });
    const w3 = aWaiver({ id: 'w3', grantedBy: 'user-admin' });
    const wRevoked = aWaiver({ id: 'w4', grantedBy: 'user-po', revokedAt: '2026-11-11T00:00:00.000Z' });

    const counts = countWaiversByGranter([w1, w2, w3, wRevoked]);
    expect(counts).toHaveLength(2);
    expect(counts[0]).toEqual({ accountId: 'user-po', displayName: 'user-po', count: 2 });
    expect(counts[1]).toEqual({ accountId: 'user-admin', displayName: 'user-admin', count: 1 });
  });
});
