/**
 * Le bloc « dossier de preuve » du site public : TOUT le projet de
 * démonstration, pas seulement le ticket vedette (lot `site-dossier`).
 *
 * Les tests partent de l'instantané RÉEL (`site/public/live-snapshot.json`) :
 * son dossier porte les tickets de la version 2.4. On prouve que le bloc se
 * construit sur un instantané qui porte un dossier (tickets, couvertures,
 * dérogations, états), qu'un instantané sans dossier ne produit AUCUN
 * tableau, que le rendu est accessible, et que rien de ce qui est affiché
 * n'est un identifiant de compte : les seuls noms viennent des acteurs.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DemoSnapshotData } from '../../src/demo-contract.js';
import type { DossierIssue, Waiver } from '../../src/types.js';
import { isSnapshot } from '../../site/src/demo/live-snapshot.js';
import { buildDossierView } from '../../site/src/sections/parts/dossier-viewmodel.js';
import { DossierBlock } from '../../site/src/sections/parts/DossierBlock.js';
import { Screens } from '../../site/src/sections/Screens.js';
import { DOSSIER_STRINGS } from '../../site/src/i18n/dossier.js';

const FIXTURE = fileURLToPath(new URL('../../site/public/live-snapshot.json', import.meta.url));

/** L'instantané réel, tel que l'app l'a servi. */
function realSnapshot(): DemoSnapshotData {
  const parsed: unknown = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  if (!isSnapshot(parsed)) throw new Error('fixture invalide');
  return parsed;
}

/** Un ticket du dossier réel, repéré par sa clé. */
function issueOf(snapshot: DemoSnapshotData, key: string): DossierIssue {
  const issue = snapshot.dossier?.issues.find((candidate) => candidate.issueKey === key);
  if (issue === undefined) throw new Error(`ticket absent du dossier : ${key}`);
  return issue;
}

/** Le même instantané, avec un autre dossier. */
function withDossier(
  snapshot: DemoSnapshotData,
  issues: readonly DossierIssue[],
): DemoSnapshotData {
  const dossier = snapshot.dossier;
  if (dossier === null) throw new Error('instantané sans dossier');
  return { ...snapshot, dossier: { ...dossier, issues } };
}

/** Une dérogation active, accordée par une référence d'acteur. */
function waiverOf(grantedBy: string): Waiver {
  return {
    id: 'wv-1',
    criterionId: 'crit-2',
    grantedBy,
    role: 'Administrators',
    reason: 'Refus du bac à sable',
    at: '2026-11-12T10:00:00.000Z',
    expiresAt: '',
    revokedAt: '',
  };
}

/** Le HTML du bloc, pour un instantané et une langue. */
function htmlOf(snapshot: DemoSnapshotData | null, lang: 'en' | 'fr'): string {
  return renderToStaticMarkup(createElement(DossierBlock, { lang, snapshot }));
}

describe('dossier du site — construit sur l’instantané réel', () => {
  it('liste tous les tickets du dossier, pas seulement le ticket vedette', () => {
    const view = buildDossierView(realSnapshot(), 'fr');
    expect(view).not.toBeNull();
    expect(view?.issues.map((issue) => issue.issueKey)).toEqual(['PRF-3', 'PRF-2', 'PRF-1']);
    expect(view?.issues.length).toBe(3);
    expect(view?.versionName).toBe('2.4');
    expect(view?.totals.criteria).toBe(8);
  });

  it('affiche la couverture « n / m » de chaque ticket', () => {
    const view = buildDossierView(realSnapshot(), 'fr');
    expect(view?.issues.map((issue) => issue.coverageLabel)).toEqual(['0 / 0', '1 / 4', '2 / 4']);
    const tones = view?.issues.map((issue) => issue.coverageTone) ?? [];
    expect(tones).toEqual(['red', 'orange', 'orange']);
  });

  it('état livré quand tout est prouvé, dérogé quand une dérogation existe', () => {
    const base = realSnapshot();
    const delivered = { ...issueOf(base, 'PRF-2'), proven: 4, waived: 0, waivers: [] };
    const waived = { ...issueOf(base, 'PRF-1'), waived: 1, waivers: [waiverOf('actor-1')] };
    const view = buildDossierView(withDossier(base, [delivered, waived]), 'fr');
    expect(view?.issues.map((issue) => issue.state)).toEqual(['delivered', 'waived']);
    expect(view?.issues[1]?.waiverCount).toBe(1);
  });

  it('un ticket encore incomplet reste « en cours »', () => {
    const view = buildDossierView(realSnapshot(), 'fr');
    expect(view?.issues.every((issue) => issue.state === 'in-progress')).toBe(true);
  });
});

describe('dossier du site — repli propre sans dossier', () => {
  it('un instantané sans dossier ne produit aucun tableau', () => {
    const without = { ...realSnapshot(), dossier: null };
    expect(buildDossierView(without, 'fr')).toBeNull();
    const html = htmlOf(without, 'fr');
    expect(html).toBe('');
    expect(html).not.toContain('<table');
  });

  it('un dossier vide ne produit aucun tableau non plus', () => {
    const base = realSnapshot();
    const empty = withDossier(base, []);
    expect(buildDossierView(empty, 'fr')).toBeNull();
    expect(htmlOf(empty, 'fr')).toBe('');
  });

  it('un instantané absent ne casse rien', () => {
    expect(buildDossierView(null, 'fr')).toBeNull();
    expect(htmlOf(null, 'fr')).toBe('');
  });
});

describe('dossier du site — rendu accessible et bilingue', () => {
  it('rend un tableau titré : caption, en-têtes de colonnes et de lignes', () => {
    const html = htmlOf(realSnapshot(), 'fr');
    expect(html).toContain('<caption');
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain('PRF-1');
    expect(html).toContain('2 / 4');
  });

  it('se rend dans les deux langues', () => {
    const base = realSnapshot();
    const fr = htmlOf(base, 'fr');
    const en = htmlOf(base, 'en');
    expect(fr).toContain('Résumé');
    expect(fr).toContain('En cours');
    expect(en).toContain('Summary');
    expect(en).toContain('In progress');
    expect(fr).not.toBe(en);
  });

  it('les textes FR et EN ont le même jeu de clés, aucun vide', () => {
    expect(Object.keys(DOSSIER_STRINGS.fr).sort()).toEqual(Object.keys(DOSSIER_STRINGS.en).sort());
    for (const key of Object.keys(DOSSIER_STRINGS.fr)) {
      expect(DOSSIER_STRINGS.fr[key as keyof typeof DOSSIER_STRINGS.fr].length).toBeGreaterThan(0);
      expect(DOSSIER_STRINGS.en[key as keyof typeof DOSSIER_STRINGS.en].length).toBeGreaterThan(0);
    }
  });
});

describe('dossier du site — ancre dans la page', () => {
  it('apparaît dans la section « Écrans », sous l’ancre #dossier', () => {
    const html = renderToStaticMarkup(createElement(Screens, { lang: 'fr' }));
    expect(html).toContain('id="dossier"');
    expect(html).toContain('PRF-1');
    expect(html).toContain('PRF-2');
    expect(html).toContain('PRF-3');
    expect(html).toContain('2 / 4');
  });
});

describe('dossier du site — aucun identifiant de compte en clair', () => {
  it('nomme l’accordeur par son nom d’affichage, jamais par sa référence', () => {
    const base = realSnapshot();
    const waived = { ...issueOf(base, 'PRF-1'), waived: 1, waivers: [waiverOf('actor-1')] };
    const html = htmlOf(withDossier(base, [waived]), 'fr');
    expect(html).toContain('Baptiste Faisy');
    expect(html).not.toContain('actor-1');
    expect(html).not.toContain('qm:');
    expect(html).not.toContain('712020:');
  });

  it('une référence d’acteur inconnue n’est jamais affichée', () => {
    const base = realSnapshot();
    const waived = { ...issueOf(base, 'PRF-1'), waived: 1, waivers: [waiverOf('actor-99')] };
    const html = htmlOf(withDossier(base, [waived]), 'fr');
    expect(html).not.toContain('actor-99');
    expect(html).not.toContain('Baptiste Faisy');
    expect(html).toContain('Refus du bac à sable');
  });

  it('l’instantané réel lui-même ne porte aucun identifiant de compte', () => {
    const raw = readFileSync(FIXTURE, 'utf8');
    expect(raw).not.toContain('qm:');
    expect(raw).not.toContain('712020:');
    expect(htmlOf(realSnapshot(), 'fr')).not.toContain('actor-');
  });
});
