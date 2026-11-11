/**
 * Recette SPEC §22 — points 6 et 9 : dérogation et mode observation.
 *
 * Point 6 : une dérogation motivée sur le critère manquant débloque la
 *           transition et figure dans le dossier de preuve (SPEC §7.4, §12.4).
 * Point 9 : en mode observation, la transition passe et le blocage évité est
 *           compté (SPEC §12.2, `wouldBlock`).
 *
 * Trajet réel : geste humain `attest-criterion` du résolveur (lot L6) pour
 * AC-3, validation de dérogation `validateWaiverCandidate` (domaine lot L3)
 * pour AC-4, moteur de couverture réel, `createValidator`, `buildVersionDossier`
 * (domaine lot L7). Aucun module réécrit.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { createAcceptanceHarness, ISSUE_ID, PROJECT_ID, PROJECT_KEY } from './harness.js';

describe('recette §22 — la dérogation motivée débloque (point 6)', () => {
  it('recette-06 : attestation + dérogation motivée débloquent la transition et la dérogation figure au dossier', async () => {
    const h = await createAcceptanceHarness();
    const { store, jira, clock, actors, project, possibleWaiver } = h.scenario;

    // Le blocage initial : AC-3 (attestation) et AC-4 (aucune preuve).
    await h.recompute(ISSUE_ID);
    expect((await h.validate()).result).toBe(false);

    // AC-3 : la testeuse (indépendante) atteste via le geste humain réel (§7.3).
    await h.gesture(
      'attest-criterion',
      { issueId: ISSUE_ID, criterionId: 'crit-3', note: 'Refus déclenché, e-mail reçu.', accountId: actors.tester.accountId },
      { accountId: actors.tester.accountId },
    );

    // AC-4 : le PO accorde une dérogation motivée — validée par le domaine (§12.4).
    const verdict = h.validateWaiverCandidate({
      criterionId: possibleWaiver.criterionId,
      grantedBy: possibleWaiver.grantedBy,
      role: possibleWaiver.role,
      reason: possibleWaiver.reason,
      actorIsAgent: false,
      actorRoles: actors.owner.roles,
      rolesPolicy: project.roles,
    });
    expect(verdict.valid).toBe(true);
    await store.saveWaiver(possibleWaiver);

    // Transition débloquée.
    await h.recompute(ISSUE_ID);
    expect((await h.validate()).result).toBe(true);

    // La dérogation figure dans le dossier de preuve de la version 2.4 (§7.4).
    const dossier = await h.buildVersionDossier(
      { store, jira, clock, coverage: h.coverage },
      { projectId: PROJECT_ID, projectKey: PROJECT_KEY, versionId: '2.4', versionName: '2.4' },
    );
    const pay123 = dossier.issues.find((issue) => issue.issueKey === 'PAY-123');
    expect(pay123?.waivers.some((w) => w.reason === 'Reporté dans PAY-140')).toBe(true);
    expect(pay123?.criteria.find((c) => c.criterionId === 'crit-4')?.waived).toBe(true);
    expect(h.renderDossierMarkdown(dossier, 'fr')).toContain('Reporté dans PAY-140');
  });
});

describe('recette §22 — le mode observation laisse passer et compte (point 9)', () => {
  it('recette-09 : en mode observation la transition passe et le blocage évité est compté', async () => {
    const h = await createAcceptanceHarness();
    // Le projet passe en mode observation (SPEC §12.2, §16.3).
    await h.scenario.store.saveSettings({ ...h.scenario.project, mode: 'observe' });

    const coverage = await h.recompute(ISSUE_ID);
    const verdict = await h.validate();

    expect(verdict.result).toBe(true); // la transition passe
    expect(verdict.errorMessage).toBe('');
    expect(coverage?.mode).toBe('observe');
    expect(coverage?.passes).toBe(true);
    // … mais ce qui aurait bloqué en mode strict est compté.
    expect(coverage?.wouldBlock).toBe(true);
    expect((coverage?.blocking ?? []).length).toBeGreaterThan(0);
  });
});
