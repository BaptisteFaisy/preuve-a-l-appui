/**
 * Cycle de vie des preuves : attachement, remplacement, fraîcheur, péremption
 * (SPEC §9, §8.4, §9.3, §20, FP-03, FP-04, FP-13).
 *
 * Invariants :
 * 1. Une preuve n'est jamais supprimée (SPEC §20, intégrité) : elle est
 *    *remplacée* — la nouvelle porte un id, l'ancienne `replacedBy` et passe
 *    `stale` ;
 * 2. Attacher est un seul geste (SPEC §20, légèreté) : `attachEvidence` ne
 *    demande rien d'obligatoire hors le critère visé et son type ;
 * 3. La force est *calculée* par l'app, jamais déclarée par l'appelant
 *    (SPEC §9.1) : `strength.ts` tranche, via le port `EvidenceChecker` ;
 * 4. Fraîcheur (SPEC §9.3) : un nouveau commit sur la branche passe la preuve
 *    de test en `to-reconfirm`, jusqu'au prochain passage vert ;
 * 5. Péremption (SPEC §8.4, FP-13) : une preuve antérieure à un changement de
 *    critère passe en `to-reconfirm` ; un clic la confirme, sinon elle tombe ;
 * 6. Seule une preuve `fresh` compte (SPEC §12.1 : « le validateur ne retient
 *    que les preuves fraîches »).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes. Domaine pur.
 */
import type { Clock, EvidenceChecker, IdGenerator, ProofStore } from '../ports.js';
import type { Criterion, Evidence, EvidenceType, Freshness, Strength } from '../types.js';
import { computeEvidenceStrength, type TestRunContext } from './strength.js';

/** L'entrée d'`attachEvidence` : seul `criterionId` + `type` sont requis. */
export interface AttachEvidenceInput {
  readonly criterionId: string;
  readonly type: EvidenceType;
  readonly reference?: string;
  readonly note?: string;
  /** Commit sur lequel un test a passé (SPEC §4, principe 4). */
  readonly commit?: string;
  readonly addedBy: string;
  readonly addedByAgent?: boolean;
  /** Remplace une preuve existante : l'ancienne passe `stale` (SPEC §20). */
  readonly replacesEvidenceId?: string;
  /** Une attestation valide accompagne la capture (SPEC §9.1). */
  readonly hasValidAttestation?: boolean;
  /** Résultats de CI déjà reçus pour la branche, si disponibles (SPEC §10). */
  readonly run?: TestRunContext;
  /** Ouverture du ticket : vérification des pages de documentation. */
  readonly since?: string;
}

export interface AttachEvidenceDeps {
  readonly store: ProofStore;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly checker?: EvidenceChecker;
}

/** Le résultat du geste : la preuve enregistrée et la force obtenue. */
export interface AttachEvidenceResult {
  readonly evidence: Evidence;
  readonly strength: Strength;
  /** La preuve remplacée, si remplacement (SPEC §20 : rien ne se supprime). */
  readonly previousEvidence: Evidence | null;
}

/**
 * Attache une preuve à un critère, en un seul geste (SPEC §20). La force est
 * calculée par l'app (SPEC §9.1) ; la version du critère vient du critère lu.
 */
export async function attachEvidence(
  input: AttachEvidenceInput,
  deps: AttachEvidenceDeps,
  criterion?: Criterion | null,
): Promise<AttachEvidenceResult> {
  const verification = await computeEvidenceStrength(
    {
      type: input.type,
      reference: input.reference ?? '',
      issueId: criterion?.issueId,
      criterionCode: criterion?.code,
      since: input.since,
      commit: input.commit,
      run: input.run,
      hasValidAttestation: input.hasValidAttestation,
    },
    deps.checker,
  );
  const evidence = buildEvidence(input, deps, criterion, verification.verified, verification.strength);
  const previousEvidence = await replacePrevious(input, deps, evidence.id);
  await deps.store.saveEvidence(evidence);
  return { evidence, strength: verification.strength, previousEvidence };
}

function buildEvidence(
  input: AttachEvidenceInput,
  deps: AttachEvidenceDeps,
  criterion: Criterion | null | undefined,
  verified: boolean,
  strength: Strength,
): Evidence {
  return {
    id: deps.ids.next('ev'),
    criterionId: input.criterionId,
    criterionVersion: criterion?.version ?? 1,
    type: input.type,
    reference: input.reference ?? '',
    note: input.note ?? '',
    strength,
    commit: input.commit ?? '',
    freshness: 'fresh',
    verified,
    addedBy: input.addedBy,
    addedByAgent: Boolean(input.addedByAgent),
    at: deps.clock.now(),
    replacedBy: '',
  };
}

async function replacePrevious(
  input: AttachEvidenceInput,
  deps: AttachEvidenceDeps,
  newId: string,
): Promise<Evidence | null> {
  if (!input.replacesEvidenceId) return null;
  const existing = await deps.store.getEvidence(input.replacesEvidenceId);
  if (!existing) return null;
  const replaced: Evidence = { ...existing, replacedBy: newId, freshness: 'stale' };
  await deps.store.saveEvidence(replaced);
  return replaced;
}

/**
 * Fraîcheur d'une preuve de test face au dernier commit de la branche
 * (SPEC §9.3) : un nouveau commit la passe en `to-reconfirm` ; le prochain
 * passage vert sur son commit la revalide. Une preuve `stale` (remplacée)
 * n'est jamais ressuscitée.
 */
export function refreshOnCommit(evidence: Evidence, latestCommit: string): Evidence {
  if (evidence.type !== 'test' || evidence.freshness === 'stale') return evidence;
  const freshness: Freshness =
    evidence.commit !== '' && evidence.commit === latestCommit ? 'fresh' : 'to-reconfirm';
  if (freshness === evidence.freshness) return evidence;
  return { ...evidence, freshness };
}

/**
 * Péremption après changement du critère (SPEC §8.4, FP-13) : les preuves
 * d'une version antérieure passent en `to-reconfirm` — un clic les confirme
 * (`reconfirmEvidence`), sinon elles tombent.
 */
export function expireOnCriterionChange(evidence: Evidence, newCriterionVersion: number): Evidence {
  if (evidence.criterionVersion >= newCriterionVersion) return evidence;
  if (evidence.freshness !== 'fresh') return evidence;
  return { ...evidence, freshness: 'to-reconfirm' };
}

/** Le clic qui confirme une preuve « à revoir » (SPEC §8.4) : elle redevient fraîche. */
export function reconfirmEvidence(evidence: Evidence): Evidence {
  if (evidence.freshness !== 'to-reconfirm') return evidence;
  return { ...evidence, freshness: 'fresh' };
}

/**
 * Seule une preuve fraîche compte (SPEC §12.1). Les preuves `to-reconfirm`
 * (nouveau commit, critère changé) et `stale` (remplacées) ne comptent pas.
 */
export function countsAsProof(evidence: Evidence): boolean {
  return evidence.freshness === 'fresh';
}
