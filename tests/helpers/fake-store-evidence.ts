/**
 * Faux `EvidenceStore` : preuves et attestations (SPEC §9, §18).
 *
 * Une preuve appartient à une version de critère. Remplacer une preuve, c'est
 * écrire une nouvelle ligne et porter `replacedBy` sur l'ancienne : rien n'est
 * effacé (SPEC §20, intégrité). La fraîcheur suit la version du critère.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { EvidenceStore } from '../../src/ports.js';
import {
  append,
  bounded,
  criterionIdsOfIssue,
  type FakeStoreTables,
} from './fake-store-core.js';

export function evidenceStore(tables: FakeStoreTables): EvidenceStore {
  return {
    async listEvidencesByCriterion(criterionId) {
      return bounded([...tables.evidence.values()].filter((row) => row.criterionId === criterionId));
    },

    async listEvidencesByIssue(issueId) {
      const ids = criterionIdsOfIssue(tables, issueId);
      return bounded([...tables.evidence.values()].filter((row) => ids.has(row.criterionId)));
    },

    async listEvidencesByTestName(testName) {
      return bounded([...tables.evidence.values()].filter((row) => row.reference === testName));
    },

    async getEvidence(evidenceId) {
      return tables.evidence.get(evidenceId) ?? null;
    },

    async saveEvidence(evidence) {
      tables.evidence.set(evidence.id, evidence);
    },

    async addAttestation(attestation) {
      append(tables.attestations, attestation.criterionId, attestation);
    },

    async listAttestations(criterionId) {
      const rows = tables.attestations.get(criterionId) ?? [];
      return bounded([...rows].sort((a, b) => a.at.localeCompare(b.at)));
    },

    async markEvidencesToReconfirm(criterionId, fromVersion) {
      return markOlderThan(tables, criterionId, fromVersion);
    },
  };
}

/**
 * Passe en « à revoir » les preuves des versions strictement antérieures
 * à `fromVersion` (SPEC §8.4). Renvoie le nombre de preuves touchées.
 */
export function markOlderThan(
  tables: FakeStoreTables,
  criterionId: string,
  fromVersion: number,
): number {
  let touched = 0;
  for (const row of tables.evidence.values()) {
    if (row.criterionId !== criterionId) continue;
    if (row.criterionVersion >= fromVersion) continue;
    if (row.freshness === 'to-reconfirm') continue;
    row.freshness = 'to-reconfirm';
    touched += 1;
  }
  return touched;
}
