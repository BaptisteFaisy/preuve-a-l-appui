/**
 * Recette SPEC §22 — point 11 : aucun outil MCP ne permet d'attester ni de déroger.
 *
 * Les sept outils Rovo/MCP (SPEC §15) lisent, proposent ou déclarent — jamais
 * ils n'attestent, ne dérogent, ne valident un critère ni ne modifient la grille
 * d'exigences. Tout geste réservé à l'humain est refusé explicitement par le
 * vrai dispatch (`runAction`, lot L5) :
 * - les noms d'action interdits (attester, déroger, valider, régler la grille)
 *   tombent sur une `ActionError` de code `forbidden-action` ;
 * - `propose-criteria` ne crée que des critères « proposés », jamais « actifs » ;
 * - `request-attestation` notifie, mais n'écrit aucune attestation.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import type { ProposeCriteriaResult, RequestAttestationResult } from '../../src/actions/types.js';
import { createAcceptanceHarness, ISSUE_ID, ISSUE_KEY } from './harness.js';

/** Les quatre gestes interdits, déclinés en noms d'action plausibles. */
const FORBIDDEN_ACTIONS = [
  'attest-criterion', // attester
  'attest',
  'grant-waiver', // déroger
  'waive-criterion',
  'validate-criterion', // valider un critère
  'set-requirements', // modifier la grille
  'update-requirements',
  'save-project-settings',
];

describe('recette §22 — aucun outil MCP n’atteste ni ne déroge (point 11)', () => {
  it('recette-11 : chaque geste interdit est refusé explicitement par le dispatch', async () => {
    const h = await createAcceptanceHarness();
    for (const name of FORBIDDEN_ACTIONS) {
      await expect(
        h.tool(name, { issueKey: ISSUE_KEY }, h.mcpContext),
      ).rejects.toMatchObject({ code: 'forbidden-action' });
    }
  });

  it('recette-11 (variante) : propose-criteria ne crée que des critères « proposés », jamais actifs', async () => {
    const h = await createAcceptanceHarness();
    const result = (await h.tool(
      'propose-criteria',
      { issueKey: ISSUE_KEY, criteria: 'Le refus est journalisé, un e-mail est envoyé' },
      h.mcpContext,
    )) as ProposeCriteriaResult;

    // L'entrée CSV est découpée (SPEC §19) : deux propositions, toutes « proposées ».
    expect(result.proposedCount).toBe(result.criteria.length);
    expect(result.proposedCount).toBeGreaterThanOrEqual(1);
    expect(result.criteria.every((c) => c.status === 'proposed')).toBe(true);
    // Aucun outil ne peut valider un critère : il n'entre pas dans la grille active.
    const active = await h.scenario.store.listCriteriaByIssue(ISSUE_ID, ['active']);
    expect(active.some((c) => result.criteria.some((p) => p.id === c.id))).toBe(false);
  });

  it('recette-11 (variante) : request-attestation notifie sans écrire aucune attestation', async () => {
    const h = await createAcceptanceHarness();
    const before = await h.scenario.store.listAttestations('crit-3');

    const result = (await h.tool(
      'request-attestation',
      { issueKey: ISSUE_KEY, criterionId: 'crit-3', what: 'Vérifier l’envoi de l’e-mail' },
      h.mcpContext,
    )) as RequestAttestationResult;

    // L'outil demande, il n'atteste pas : aucune ligne d'attestation n'est écrite.
    expect(result.issueKey).toBe(ISSUE_KEY);
    const after = await h.scenario.store.listAttestations('crit-3');
    expect(after).toHaveLength(before.length);
  });
});
