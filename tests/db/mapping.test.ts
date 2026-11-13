/**
 * Aller-retour ligne SQL ↔ type du domaine, sur le scénario du SPEC §7 :
 * le ticket PAY-123, ses quatre critères d'acceptation, un test vert, une
 * attestation et une dérogation « reporté dans PAY-140 ».
 *
 * La règle testée est simple et stricte : un objet écrit puis relu est
 * identique, champ pour champ. Une chaîne vide reste vide (jamais `null`),
 * un tableau vide s'écrit `'[]'`, une date absente reste absente.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import type { TestLink } from '../../src/types.js';
import {
  attestationToRow,
  coverageToRow,
  criterionRevisionToRow,
  criterionToRow,
  evidenceToRow,
  insertPlaceholders,
  livingProofToRow,
  parseBlockingItems,
  parseCriterionStates,
  projectSettingsToRow,
  releaseDossierToRow,
  rowToAttestation,
  rowToCoverage,
  rowToCriterion,
  rowToCriterionRevision,
  rowToEvidence,
  rowToLivingProof,
  rowToProjectSettings,
  rowToReleaseDossier,
  rowToTestLink,
  rowToTestOutcome,
  rowToTestRun,
  rowToWaiver,
  selectColumns,
  testLinkToRow,
  testOutcomeToRow,
  testRunToRow,
  waiverToRow,
} from '../../src/db/mapping.js';
import {
  ac1,
  ac3,
  ac4,
  attestation,
  coverage,
  criterionState,
  dossier,
  livingProof,
  revision,
  settings,
  testEvidence,
  testLink,
  testOutcome,
  testRun,
  waiver,
} from './fixtures.js';

describe('mapping — critères', () => {
  it('fait l’aller-retour sans perte', () => {
    expect(rowToCriterion(criterionToRow(ac1()))).toEqual(ac1());
    expect(rowToCriterion(criterionToRow(ac3()))).toEqual(ac3());
    expect(rowToCriterion(criterionToRow(ac4()))).toEqual(ac4());
  });

  it('fait l’aller-retour d’une révision', () => {
    expect(rowToCriterionRevision(criterionRevisionToRow(revision()))).toEqual(revision());
  });

  it('écrit les dates au format Forge SQL', () => {
    expect(criterionToRow(ac1()).created_at).toBe('2026-11-11 09:00:00.000');
  });
});

describe('mapping — preuves, attestations, dérogations', () => {
  it('fait l’aller-retour d’une preuve', () => {
    expect(rowToEvidence(evidenceToRow(testEvidence()))).toEqual(testEvidence());
  });

  it('fait l’aller-retour d’une attestation', () => {
    expect(rowToAttestation(attestationToRow(attestation()))).toEqual(attestation());
  });

  it('fait l’aller-retour d’une dérogation, motif compris', () => {
    const original = waiver();
    expect(rowToWaiver(waiverToRow(original))).toEqual(original);
    expect(rowToWaiver(waiverToRow(original)).reason).toBe('reporté dans PAY-140');
  });

  it('écrit les booléens en 0/1', () => {
    const row = evidenceToRow(testEvidence());
    expect(row.verified).toBe(1);
    expect(row.added_by_agent).toBe(1);
  });

  it('garde une date vide vide, jamais nulle', () => {
    const row = waiverToRow(waiver());
    expect(row.expires_at).toBe('');
    expect(row.revoked_at).toBe('');
    expect(rowToWaiver(row).expiresAt).toBe('');
  });

  it('relit la « zéro date » MySQL comme une date absente (dérogation restée active)', () => {
    // Une colonne TIMESTAMP NOT NULL écrite avec '' ressort en
    // '0000-00-00 00:00:00' : elle veut dire « pas de date », sinon une
    // dérogation jamais révoquée compterait comme révoquée (SPEC §12.4).
    const zero = '0000-00-00 00:00:00.000';
    const row = { ...waiverToRow(waiver()), expires_at: zero, revoked_at: zero };
    const read = rowToWaiver(row);
    expect(read.expiresAt).toBe('');
    expect(read.revokedAt).toBe('');
  });
});

describe('mapping — couverture et réglages', () => {
  it('fait l’aller-retour de la couverture, matrice comprise', () => {
    expect(rowToCoverage(coverageToRow(coverage()))).toEqual(coverage());
  });

  it('fait l’aller-retour des réglages projet', () => {
    expect(rowToProjectSettings(projectSettingsToRow(settings()))).toEqual(settings());
  });

  it('écrit un tableau vide en []', () => {
    const row = coverageToRow(coverage({ blocking: [], criteria: [] }));
    expect(row.blocking_json).toBe('[]');
    expect(row.criteria_json).toBe('[]');
  });

  it('conserve null et « aucune preuve » distinctement', () => {
    const original = criterionState({ bestStrength: null, defect: null, evidences: [] });
    const decoded = rowToCoverage(coverageToRow(coverage({ criteria: [original] }))).criteria[0];
    expect(decoded?.bestStrength).toBeNull();
    expect(decoded?.defect).toBeNull();
    expect(decoded?.evidences).toEqual([]);
  });

  it('lit une charge utile corrompue sans lever', () => {
    const row = coverageToRow(coverage());
    expect(parseBlockingItems('{')).toEqual([]);
    expect(parseCriterionStates('pas du json')).toEqual([]);
    expect(rowToCoverage({ ...row, blocking_json: '{"criterionId":' }).blocking).toEqual([]);
  });
});

describe('mapping — CI et rapprochement', () => {
  it('fait l’aller-retour d’un run', () => {
    expect(rowToTestRun(testRunToRow(testRun()))).toEqual(testRun());
  });

  it('fait l’aller-retour d’un résultat de test', () => {
    const original = testOutcome();
    expect(rowToTestOutcome(testOutcomeToRow(original, 'run-1'))).toEqual(original);
  });

  it('range le résultat dans le run fourni', () => {
    expect(testOutcomeToRow(testOutcome(), 'run-9').run_id).toBe('run-9');
  });

  it('fait l’aller-retour d’une paire test ↔ critère', () => {
    expect(rowToTestLink(testLinkToRow(testLink()))).toEqual(testLink());
  });

  it('traite une paire illisible comme proposée, jamais comme une preuve', () => {
    const row = testLinkToRow(testLink({ status: 'peut-être' as TestLink['status'] }));
    expect(rowToTestLink(row).status).toBe('proposed');
  });
});

describe('mapping — preuve vivante et dossier', () => {
  it('fait l’aller-retour d’une preuve vivante', () => {
    const original = livingProof();
    expect(rowToLivingProof(livingProofToRow(original, '10001'))).toEqual(original);
  });

  it('garde le projet du contexte d’écriture', () => {
    expect(livingProofToRow(livingProof(), '10001').project_id).toBe('10001');
  });

  it('fait l’aller-retour du dossier de preuve', () => {
    expect(rowToReleaseDossier(releaseDossierToRow(dossier()))).toEqual(dossier());
  });
});

describe('mapping — colonnes', () => {
  it('requote les colonnes réservées dans les listes de colonnes', () => {
    expect(selectColumns('evidence')).toContain('`commit`');
    expect(selectColumns('evidence')).toContain('`reference`');
    expect(selectColumns('criterion')).not.toContain('`');
  });

  it('donne autant de ? que de colonnes', () => {
    const placeholders = insertPlaceholders('evidence').split(', ');
    expect(placeholders).toHaveLength(selectColumns('evidence').split(', ').length);
  });
});
