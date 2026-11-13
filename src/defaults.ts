/**
 * Default values and frozen schemas (SPEC §9.2, §18).
 *
 * Rule: files < 500 lines, functions < 50 lines.
 */
import type { CriterionType, ProjectSettings, RequirementGrid, RolePolicy } from './types';

export const DEFAULT_REQUIREMENTS: RequirementGrid = {
  functional: {
    accepted: ['machine-verified', 'attested'],
    attesterRole: '',
    notAuthor: false,
    measurementLink: false,
    minDistinctTypes: 1,
    minor: false,
  },
  regression: {
    accepted: ['machine-verified'],
    attesterRole: '',
    notAuthor: false,
    measurementLink: false,
    minDistinctTypes: 1,
    minor: false,
  },
  performance: {
    accepted: ['attested'],
    attesterRole: '',
    notAuthor: false,
    measurementLink: true,
    minDistinctTypes: 1,
    minor: false,
  },
  security: {
    accepted: ['attested'],
    attesterRole: 'Security Reviewer',
    notAuthor: false,
    measurementLink: false,
    minDistinctTypes: 1,
    minor: false,
  },
  accessibility: {
    accepted: ['attested'],
    attesterRole: '',
    notAuthor: false,
    measurementLink: false,
    minDistinctTypes: 1,
    minor: false,
  },
  data: {
    accepted: ['attested'],
    attesterRole: '',
    notAuthor: true,
    measurementLink: false,
    minDistinctTypes: 1,
    minor: false,
  },
  documentation: {
    accepted: ['machine-verified'],
    attesterRole: '',
    notAuthor: false,
    measurementLink: false,
    minDistinctTypes: 1,
    minor: true,
  },
};

export const DEFAULT_ROLES: RolePolicy = {
  attest: ['Administrators', 'Developers'],
  waive: ['Administrators', 'Product Owner'],
  security: ['Security Reviewer', 'Administrators'],
  data: ['Data Lead', 'Administrators'],
};

export function defaultProjectSettings(projectId: string): ProjectSettings {
  return {
    projectId,
    requirements: DEFAULT_REQUIREMENTS,
    mode: 'strict',
    roles: DEFAULT_ROLES,
    missingCriteria: 'block',
    ciKeyHash: '',
    requireChildren: false,
    language: 'en',
    updatedAt: new Date().toISOString(),
  };
}

export function defaultStrengthForType(type: CriterionType): 'machine-verified' | 'attested' {
  const req = DEFAULT_REQUIREMENTS[type];
  const first = req.accepted[0];
  if (first === 'machine-verified' || first === 'attested') return first;
  return 'attested';
}
