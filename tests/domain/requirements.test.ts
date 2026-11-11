/**
 * Tests de la résolution des exigences (SPEC §9.2, §8.1, FP-05, §12.1).
 *
 * Un test par comportement : grille par type, surcharge par critère,
 * surcharge par projet, lecture de la preuve croisée (lot C), phrase
 * « preuve attendue » traduite, conformité au port `RequirementResolver`.
 */
import { describe, expect, it } from 'vitest';
import {
  createRequirementResolver,
  requiresCrossEvidence,
  resolveExpectedProof,
  resolveRequirement,
  resolveRequirementForType,
} from '../../src/domain/requirements.js';
import { DEFAULT_REQUIREMENTS, defaultProjectSettings } from '../../src/defaults.js';
import { CRITERION_TYPES } from '../../src/types.js';
import { aCriterion, PROJECT_ID, settings } from '../helpers/builders.js';

const fr = settings({ language: 'fr' });
const en = settings({ language: 'en' });

describe('resolveRequirementForType — la grille du projet (SPEC §9.2)', () => {
  it('rend l’entrée de la grille pour chaque type de critère', () => {
    for (const type of CRITERION_TYPES) {
      expect(resolveRequirementForType(fr, type)).toBe(fr.requirements[type]);
    }
  });

  it('applique la grille par défaut du SPEC §9.2', () => {
    const defaults = defaultProjectSettings(PROJECT_ID);
    expect(resolveRequirementForType(defaults, 'regression').accepted).toEqual(['machine-verified']);
    expect(resolveRequirementForType(defaults, 'functional').accepted).toEqual([
      'machine-verified',
      'attested',
    ]);
    expect(resolveRequirementForType(defaults, 'security').attesterRole).toBe('Security Reviewer');
    expect(resolveRequirementForType(defaults, 'data').notAuthor).toBe(true);
    expect(resolveRequirementForType(defaults, 'performance').measurementLink).toBe(true);
    expect(resolveRequirementForType(defaults, 'documentation').accepted).toEqual([
      'machine-verified',
    ]);
    expect(DEFAULT_REQUIREMENTS.accessibility.accepted).toEqual(['attested']);
  });

  it('une grille de projet personnalisée prime sur les défauts', () => {
    const custom = settings({
      requirements: {
        ...DEFAULT_REQUIREMENTS,
        regression: { ...DEFAULT_REQUIREMENTS.regression, accepted: ['attested'] },
      },
    });
    expect(resolveRequirementForType(custom, 'regression').accepted).toEqual(['attested']);
  });
});

describe('resolveRequirement — surcharge par critère (SPEC §8.1)', () => {
  it('sans surcharge, rend la grille du type', () => {
    const criterion = aCriterion({ type: 'functional', requiredStrength: 'machine-verified' });
    expect(resolveRequirement(fr, criterion).accepted).toEqual(['machine-verified', 'attested']);
  });

  it('une surcharge « attestée » élargit la non-régression à l’attestation', () => {
    const criterion = aCriterion({ type: 'regression', requiredStrength: 'attested' });
    expect(resolveRequirement(fr, criterion).accepted).toEqual(['machine-verified', 'attested']);
  });

  it('une surcharge « vérifiée par machine » restreint une grille élargie', () => {
    const widened = settings({
      requirements: {
        ...DEFAULT_REQUIREMENTS,
        functional: { ...DEFAULT_REQUIREMENTS.functional, accepted: ['attested', 'declared'] },
      },
    });
    const criterion = aCriterion({ type: 'functional', requiredStrength: 'machine-verified' });
    expect(resolveRequirement(widened, criterion).accepted).toEqual(['machine-verified']);
  });

  it('tant que la force exigée égale la primaire de la grille, la liste du projet fait foi', () => {
    const criterion = aCriterion({ type: 'functional', requiredStrength: 'machine-verified' });
    expect(resolveRequirement(fr, criterion).accepted).toEqual(['machine-verified', 'attested']);
  });

  it('une surcharge « déclarée » accepte les trois forces', () => {
    const criterion = aCriterion({ type: 'regression', requiredStrength: 'declared' });
    expect(resolveRequirement(fr, criterion).accepted).toEqual([
      'machine-verified',
      'attested',
      'declared',
    ]);
  });

  it('la surcharge ne touche ni au rôle désigné ni au lien de mesure', () => {
    const sec = aCriterion({ type: 'security', requiredStrength: 'declared' });
    const resolvedSec = resolveRequirement(fr, sec);
    expect(resolvedSec.attesterRole).toBe('Security Reviewer');

    const perf = aCriterion({ type: 'performance', requiredStrength: 'machine-verified' });
    expect(resolveRequirement(fr, perf).measurementLink).toBe(true);
  });
});

describe('minDistinctTypes — lecture seule de la preuve croisée (SPEC §9.2, lot C)', () => {
  it('lit l’exigence sans l’appliquer : une seule preuve suffit par défaut', () => {
    expect(requiresCrossEvidence(resolveRequirementForType(fr, 'functional'))).toBe(false);
  });

  it('détecte une exigence de preuve croisée posée par le projet', () => {
    const custom = settings({
      requirements: {
        ...DEFAULT_REQUIREMENTS,
        security: { ...DEFAULT_REQUIREMENTS.security, minDistinctTypes: 2 },
      },
    });
    expect(requiresCrossEvidence(resolveRequirementForType(custom, 'security'))).toBe(true);
  });

  it('la surcharge par critère conserve le minDistinctTypes du projet', () => {
    const custom = settings({
      requirements: {
        ...DEFAULT_REQUIREMENTS,
        data: { ...DEFAULT_REQUIREMENTS.data, minDistinctTypes: 3 },
      },
    });
    const criterion = aCriterion({ type: 'data', requiredStrength: 'attested' });
    expect(resolveRequirement(custom, criterion).minDistinctTypes).toBe(3);
  });
});

describe('resolveExpectedProof — la phrase « preuve attendue » (SPEC §7.2, §12.1)', () => {
  it('nomme le test vert pour un critère vérifié par machine, en français', () => {
    const phrase = resolveExpectedProof(fr, aCriterion({ type: 'regression' }));
    expect(phrase).toBe(
      'Test automatisé vert sur le commit de la branche, ou page de documentation mise à jour',
    );
  });

  it('nomme l’attestation tierce pour un critère attesté, en anglais', () => {
    const phrase = resolveExpectedProof(en, aCriterion({ type: 'accessibility' }));
    expect(phrase).toBe('Third-party attestation from an independent reviewer');
  });

  it('nomme le rôle de sécurité désigné', () => {
    expect(resolveExpectedProof(fr, aCriterion({ type: 'security' }))).toBe(
      'Attestation par le rôle Sécurité désigné',
    );
  });

  it('nomme l’exigence « autre que l’auteur » pour les données', () => {
    expect(resolveExpectedProof(fr, aCriterion({ type: 'data' }))).toBe(
      "Attestation par quelqu’un d’autre que l’auteur",
    );
  });

  it('nomme le lien de mesure pour la performance', () => {
    expect(resolveExpectedProof(fr, aCriterion({ type: 'performance' }))).toBe(
      'Attestation accompagnée d’un lien de mesure',
    );
  });

  it('accepte une preuve déclarée quand le critère l’exige seulement', () => {
    const criterion = aCriterion({ type: 'regression', requiredStrength: 'declared' });
    expect(resolveExpectedProof(fr, criterion)).toBe(
      'Preuve déclarée (capture, compte rendu d’agent, lien)',
    );
  });
});

describe('createRequirementResolver — conformité au port (src/ports.ts)', () => {
  it('expose forType, forCriterion et expectedProof cohérents', () => {
    const resolver = createRequirementResolver();
    const criterion = aCriterion({ type: 'security' });
    expect(resolver.forType(fr, 'security')).toEqual(resolveRequirementForType(fr, 'security'));
    expect(resolver.forCriterion(fr, criterion)).toEqual(resolveRequirement(fr, criterion));
    expect(resolver.expectedProof(fr, criterion)).toBe(resolveExpectedProof(fr, criterion));
    expect(resolver.expectedProof(fr, criterion, 'attestation')).toBe(resolveExpectedProof(fr, criterion));
  });
});
