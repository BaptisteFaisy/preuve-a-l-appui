/**
 * Recette SPEC §22 — points 1 et 10 : le blocage et sa source unique.
 *
 * Point 1  : un ticket à quatre critères dont un sans preuve ne passe pas à
 *            « Terminé » ; le message nomme ce critère (SPEC §7.2).
 * Point 10 : `get-proof-status` renvoie les mêmes critères en défaut que le
 *            message du validateur — même ligne de couverture, jamais deux
 *            calculs (SPEC §22 point 10, docs/CONTRACTS.md §1bis).
 *
 * Tout traverse les vrais modules assemblés par `harness.ts` : le moteur de
 * couverture réel, `createValidator`, `runAction` (outil `get-proof-status`).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import type { GetProofStatusResult } from '../../src/actions/types.js';
import { createAcceptanceHarness, ISSUE_ID, ISSUE_KEY } from './harness.js';

describe('recette §22 — le blocage (points 1 et 10)', () => {
  it('recette-01 : quatre critères dont un sans preuve ne passent pas à « Terminé », le message nomme le critère', async () => {
    const h = await createAcceptanceHarness();
    await h.recompute(ISSUE_ID);

    const verdict = await h.validate();

    // Le validateur réel lit la couverture réelle et refuse la transition.
    expect(verdict.result).toBe(false);
    // AC-4 n'a aucune preuve : le message le nomme explicitement (SPEC §7.2).
    expect(verdict.errorMessage).toContain('AC-4');
    expect(verdict.errorMessage).toContain('no proof');
    // AC-1 et AC-2 sont vérifiés par machine : ils ne bloquent pas.
    expect(verdict.errorMessage).not.toContain('AC-1');
    expect(verdict.errorMessage).not.toContain('AC-2');
  });

  it('recette-10 : get-proof-status renvoie les mêmes critères en défaut que le message du validateur', async () => {
    const h = await createAcceptanceHarness();
    // Un seul recalcul : les deux lecteurs lisent ensuite la même ligne.
    const coverage = await h.recompute(ISSUE_ID);
    expect(coverage).not.toBeNull();

    const verdict = await h.validate();
    const status = (await h.tool('get-proof-status', { issueKey: ISSUE_KEY })) as GetProofStatusResult;

    // Même source : les critères en défaut de l'outil sont ceux de la couverture.
    const coverageCodes = (coverage?.blocking ?? []).map((item) => item.code);
    const toolCodes = status.blocking.map((item) => item.code);
    expect(toolCodes).toEqual(coverageCodes);
    expect(status.passes).toBe(false);

    // Chaque critère nommé par le validateur figure dans l'outil (et réciproquement
    // pour les deux premiers, le validateur nommant au plus deux critères — §19).
    for (const code of coverageCodes.slice(0, 2)) {
      expect(verdict.errorMessage).toContain(code);
      expect(toolCodes).toContain(code);
    }
  });
});
