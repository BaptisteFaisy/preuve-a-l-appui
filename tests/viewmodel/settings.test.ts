/**
 * Tests du view-model des réglages projet (SPEC §16.3, §9.2, §10).
 *
 * Vérifie la commande CI générée, la grille des exigences par type, les
 * options de mode (strict / souple / observation) et le repli sur les
 * réglages par défaut. Logique pure.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { settings as buildSettings, PROJECT_ID } from '../../tests/helpers/builders.js';
import { CRITERION_TYPES } from '../../src/types.js';
import {
  buildGateModeOptions,
  buildSettingsViewModel,
  generateCiCommand,
} from '../../src/viewmodel/settings.js';

describe('generateCiCommand', () => {
  it('produit une commande d’une ligne qui poste au point d’entrée CI', () => {
    const cmd = generateCiCommand('PAY');
    expect(cmd).toContain('curl');
    expect(cmd).toContain('-X POST');
    expect(cmd).toContain('X-Project-Key: PAY');
    expect(cmd).not.toContain('\n');
  });

  it('signe le corps avec la clé CI (HMAC-SHA256)', () => {
    const cmd = generateCiCommand('PAY', '$PROOF_CI_KEY');
    expect(cmd).toContain('openssl dgst -sha256');
    expect(cmd).toContain('$PROOF_CI_KEY');
  });
});

describe('buildGateModeOptions', () => {
  it('liste les trois modes et marque celui sélectionné', () => {
    const opts = buildGateModeOptions('lenient', 'fr');
    expect(opts).toHaveLength(3);
    expect(opts.map((o) => o.value)).toEqual(['strict', 'lenient', 'observe']);
    const selected = opts.find((o) => o.isSelected);
    expect(selected?.value).toBe('lenient');
    expect(selected?.label).toBe('Souple');
  });
});

describe('buildSettingsViewModel', () => {
  it('construit une ligne d’exigence par type de critère', () => {
    const vm = buildSettingsViewModel(buildSettings({ projectId: PROJECT_ID }), PROJECT_ID, 'fr');
    expect(vm.requirements).toHaveLength(CRITERION_TYPES.length);
    const security = vm.requirements.find((r) => r.type === 'security');
    expect(security?.typeLabel).toBe('Sécurité');
    expect(security?.attesterRole).toBe('Security Reviewer');
  });

  it('traduit le mode sélectionné', () => {
    const vm = buildSettingsViewModel(buildSettings({ mode: 'observe' }), PROJECT_ID, 'fr');
    expect(vm.mode).toBe('observe');
    expect(vm.modeLabel).toContain('Observation');
  });

  it('expose la commande CI basée sur l’identifiant du projet', () => {
    const vm = buildSettingsViewModel(buildSettings({ projectId: '99' }), '99', 'en');
    expect(vm.ciCommand).toContain('X-Project-Key: 99');
  });

  it('signale les contraintes (pas l’auteur, lien de mesure)', () => {
    const vm = buildSettingsViewModel(buildSettings(), PROJECT_ID, 'fr');
    const data = vm.requirements.find((r) => r.type === 'data');
    expect(data?.constraintsLabel).toContain('Pas l’auteur');
    const perf = vm.requirements.find((r) => r.type === 'performance');
    expect(perf?.constraintsLabel).toContain('Lien de mesure');
  });

  it('retombe sur les réglages par défaut quand aucun n’existe', () => {
    const vm = buildSettingsViewModel(null, 'NEWPROJ', 'en');
    expect(vm.projectId).toBe('NEWPROJ');
    expect(vm.mode).toBe('strict');
    expect(vm.requirements).toHaveLength(CRITERION_TYPES.length);
  });
});
