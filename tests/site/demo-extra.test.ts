/**
 * Les gestes avancés de la démo sont testés comme le reste : ils assemblent les
 * VRAIS modules de l'app sur les doubles en mémoire, donc ces tests prouvent à
 * la fois que la démo fonctionne et qu'elle ne ment pas sur l'app.
 *
 * Chaque test rejoue un geste puis vérifie l'effet réellement rangé en base
 * (critères validés, preuves à reconfirmer, notification envoyée, dossier
 * figé, grille relevée) — jamais le texte affiché seul.
 *
 * Lot `site-toutes-features`. Règle : fichiers < 500 lignes, fonctions < 50.
 */
import { describe, expect, it } from 'vitest';
import { setLanguage } from '../../site/src/demo/actions.js';
import { ADVANCED_ACTIONS, runAdvanced } from '../../site/src/demo/advanced.js';
import { createDemoWorld, ISSUE_ID, PROJECT_ID, type DemoWorld } from '../../site/src/demo/world.js';

/** Monde prêt à jouer, dans la langue demandée, couverture à jour. */
async function world(lang: 'fr' | 'en' = 'fr'): Promise<DemoWorld> {
  const built = await createDemoWorld();
  await setLanguage(built, lang);
  await built.recompute();
  return built;
}

/** Les fonctionnalités du cahier des charges que la démo doit rendre visibles. */
const DEMONSTRATED = ['FP-02', 'FP-03', 'FP-13', 'FP-14', 'FP-15', 'FP-17', 'FP-20', 'FP-21'];

describe('panneau avancé de la démo — couverture des fonctionnalités', () => {
  it('donne un geste à chaque fonctionnalité annoncée', () => {
    const covered = ADVANCED_ACTIONS.flatMap((action) => action.feature.split(' · '));
    for (const code of DEMONSTRATED) expect(covered, code).toContain(code);
  });

  it('refuse un geste inconnu au lieu de le jouer', async () => {
    const built = await world();
    const result = await runAdvanced(built, 'inexistant', 'fr');
    expect(result.outcome).toBe('refused');
  });

  it('répond dans les deux langues', async () => {
    for (const lang of ['fr', 'en'] as const) {
      const built = await world(lang);
      const result = await runAdvanced(built, 'stale-on-change', lang);
      expect(result.detail.length).toBeGreaterThan(10);
    }
  });
});

describe('panneau avancé de la démo — effets réels sur l’app', () => {
  it('FP-02 : les critères proposés par l’agent ne comptent qu’après validation humaine', async () => {
    const built = await world();
    const result = await runAdvanced(built, 'import-criteria', 'fr');
    expect(result.outcome).toBe('ok');
    const criteria = await built.deps.store.listCriteriaByIssue(ISSUE_ID);
    expect(criteria).toHaveLength(6);
    expect(criteria.map((criterion) => criterion.status)).toEqual(criteria.map(() => 'active'));
    const coverage = await built.coverage();
    expect(coverage?.total).toBe(6);
  });

  it('FP-13 : modifier un critère met ses preuves à reconfirmer', async () => {
    const built = await world();
    const result = await runAdvanced(built, 'stale-on-change', 'fr');
    expect(result.outcome).toBe('info');
    const criterion = await built.deps.store.getCriterion('crit-1');
    expect(criterion?.version).toBe(2);
    const evidences = await built.deps.store.listEvidencesByCriterion('crit-1');
    expect(evidences.map((evidence) => evidence.freshness)).toEqual(['to-reconfirm']);
  });

  it('FP-14 et FP-20 : le rapprochement tests ↔ critères propose des paires', async () => {
    const built = await world();
    const result = await runAdvanced(built, 'suggest-pairs', 'fr');
    expect(result.outcome).toBe('info');
    expect(result.detail).toContain('AC-1');
  });

  it('FP-15 : la demande d’attestation notifie une personne qui peut attester', async () => {
    const built = await world();
    const result = await runAdvanced(built, 'request-attestation', 'fr');
    expect(result.outcome).toBe('info');
    const sent = built.scenario.jira.notifications;
    expect(sent).toHaveLength(1);
    expect(sent[0]?.issueKey).toBe('PAY-123');
    expect(sent[0]?.accountId).not.toBe(built.scenario.issue.assigneeAccountId);
  });

  it('FP-17 : le dossier de preuve de la version est figé puis lu par l’agent', async () => {
    const built = await world();
    const result = await runAdvanced(built, 'release-proof', 'fr');
    expect(result.outcome).toBe('info');
    expect(result.detail).toContain('2.4');
    const dossier = await built.deps.store.getDossier('2.4');
    expect(dossier?.versionName).toBe('2.4');
    expect(dossier?.totals.criteria).toBe(4);
  });

  it('FP-03 : une documentation attachée reste une déclaration, jamais une preuve machine', async () => {
    const built = await world();
    const result = await runAdvanced(built, 'other-evidence-types', 'fr');
    expect(result.outcome).toBe('info');
    const evidences = await built.deps.store.listEvidencesByCriterion('crit-4');
    const documentation = evidences.find((evidence) => evidence.type === 'documentation');
    expect(documentation?.strength).toBe('declared');
    expect(documentation?.verified).toBe(false);
  });

  it('FP-21 : la grille relevée exige deux types de preuve distincts', async () => {
    const built = await world();
    const result = await runAdvanced(built, 'cross-evidence', 'fr');
    expect(result.outcome).toBe('info');
    const settings = await built.deps.store.getSettings(PROJECT_ID);
    expect(settings?.requirements.functional.minDistinctTypes).toBe(2);
  });
});
