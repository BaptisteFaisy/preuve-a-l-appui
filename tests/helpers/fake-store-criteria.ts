/**
 * Faux `CriterionStore` : critères et historique (SPEC §8, §18).
 *
 * Un critère est une ligne unique qui porte sa version ; le texte qui change
 * incrémente `version` (SPEC §8.4). L'historique est une table d'append.
 * Les critères `superseded` restent en base : jamais de suppression physique.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { CriterionStore } from '../../src/ports.js';
import { append, bounded, criteriaOfIssue, type FakeStoreTables } from './fake-store-core.js';

/** Extrait le numéro d'un code `AC-12` ; `null` si le code n'en est pas un. */
export function codeNumber(code: string): number | null {
  const match = /^AC-(\d+)$/.exec(code);
  if (match === null) return null;
  const value = Number.parseInt(match[1] ?? '', 10);
  return Number.isNaN(value) ? null : value;
}

/**
 * Prochain code libre d'un ticket : `AC-1` si le ticket n'a aucun critère,
 * sinon le plus grand numéro déjà pris + 1 (les `superseded` comptent).
 */
export function nextCodeFor(tables: FakeStoreTables, issueId: string): string {
  let max = 0;
  for (const criterion of criteriaOfIssue(tables, issueId)) {
    const value = codeNumber(criterion.code);
    if (value !== null && value > max) max = value;
  }
  return `AC-${max + 1}`;
}

export function criterionStore(tables: FakeStoreTables): CriterionStore {
  return {
    async listCriteriaByIssue(issueId, statuses) {
      return bounded(criteriaOfIssue(tables, issueId, statuses));
    },

    async getCriterion(criterionId) {
      return tables.criteria.get(criterionId) ?? null;
    },

    async getCriterionByCode(issueId, code) {
      for (const criterion of tables.criteria.values()) {
        if (criterion.issueId === issueId && criterion.code === code) return criterion;
      }
      return null;
    },

    async saveCriterion(criterion) {
      tables.criteria.set(criterion.id, criterion);
    },

    async addCriterionRevision(revision) {
      append(tables.revisions, revision.criterionId, revision);
    },

    async listCriterionRevisions(criterionId) {
      const rows = tables.revisions.get(criterionId) ?? [];
      return bounded([...rows].sort((a, b) => a.version - b.version));
    },

    async nextCriterionCode(issueId) {
      return nextCodeFor(tables, issueId);
    },
  };
}
