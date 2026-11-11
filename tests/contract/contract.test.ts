import { describe, expect, it } from 'vitest';
import { CRITERION_TYPES, EVIDENCE_TYPES, reaches, STRENGTH_ORDER } from '../../src/types.js';
import { DEFAULT_REQUIREMENTS, DEFAULT_ROLES, defaultProjectSettings } from '../../src/defaults.js';
import { interpolate, mergeDictionaries, translate } from '../../src/i18n/index.js';
import { stubOf } from '../../src/db/stub.js';

describe('contrat du domaine', () => {
  it('classe les trois forces dans le bon ordre', () => {
    expect(STRENGTH_ORDER['machine-verified']).toBeGreaterThan(STRENGTH_ORDER.attested);
    expect(STRENGTH_ORDER.attested).toBeGreaterThan(STRENGTH_ORDER.declared);
  });

  it('une force déclarée n atteint jamais une exigence attestée', () => {
    expect(reaches('declared', 'attested')).toBe(false);
    expect(reaches('attested', 'machine-verified')).toBe(false);
    expect(reaches('machine-verified', 'machine-verified')).toBe(true);
    expect(reaches(null, 'declared')).toBe(false);
  });

  it('couvre les sept types de critère et les six types de preuve', () => {
    expect(CRITERION_TYPES).toHaveLength(7);
    expect(EVIDENCE_TYPES).toHaveLength(6);
    for (const type of CRITERION_TYPES) {
      expect(DEFAULT_REQUIREMENTS[type]).toBeDefined();
      expect(DEFAULT_REQUIREMENTS[type].accepted.length).toBeGreaterThan(0);
    }
  });

  it('donne des réglages par défaut complets', () => {
    const settings = defaultProjectSettings('10001');
    expect(settings.mode).toBe('strict');
    expect(settings.roles.attest.length).toBeGreaterThan(0);
    expect(settings.roles.waive.length).toBeGreaterThan(0);
    expect(DEFAULT_ROLES.security).toContain('Security Reviewer');
  });
});

describe('traduction', () => {
  const dictionary = mergeDictionaries({
    'gate.blocked': { en: '{count} criteria without proof', fr: '{count} critère(s) sans preuve' },
  });

  it('traduit et interpole', () => {
    expect(translate(dictionary, 'gate.blocked', 'fr', { count: 2 }).text).toBe('2 critère(s) sans preuve');
    expect(translate(dictionary, 'gate.blocked', 'en', { count: 2 }).text).toBe('2 criteria without proof');
  });

  it('retombe sur la clé brute quand la clé manque', () => {
    expect(translate(dictionary, 'gate.unknown', 'fr').text).toBe('gate.unknown');
  });

  it('interpole sans casser les accolades inconnues', () => {
    expect(interpolate('{a} et {b}', { a: 'x' })).toBe('x et {b}');
  });
});

describe('souches', () => {
  it('une souche lève une erreur nommée', () => {
    const stub = stubOf<{ ping(): void }>('createFake', 'L0');
    expect(() => stub.ping()).toThrowError(/implémentée/);
  });
});
