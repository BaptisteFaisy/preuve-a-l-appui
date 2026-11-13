/**
 * La vitrine de confiance : le schéma unique, le badge « Runs on Atlassian » et
 * les chiffres clés du site public (lot `site-vitrine-confiance`).
 *
 * Ces tests rendent le VRAI JSX (`renderToStaticMarkup`), sur l'instantané RÉEL
 * embarqué (`site/public/live-snapshot.json` via `bundledSnapshot()`), et
 * vérifient trois choses que le jury peut contrôler lui-même :
 *  1. le schéma est rendu, il porte son alternative textuelle, et cette liste
 *     dit bien toutes les étapes de l'image — dans les deux langues ;
 *  2. les chiffres affichés sont ceux des données réelles, pas des constantes
 *     recopiées : on modifie l'instantané et le rendu doit suivre ;
 *  3. le badge est présent en FR et en EN, sans logo officiel.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ReactElement } from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DemoSnapshotData } from '../../src/demo-contract.js';
import { isSnapshot } from '../../site/src/demo/live-snapshot.js';
import { VITRINE } from '../../site/src/i18n/vitrine.js';
import { Architecture } from '../../site/src/sections/Architecture.js';
import { Hero } from '../../site/src/sections/Hero.js';
import { buildDiagram } from '../../site/src/sections/parts/diagram/diagram-data.js';
import { FlowDiagram } from '../../site/src/sections/parts/diagram/FlowDiagram.js';
import { keyFigures } from '../../site/src/sections/parts/diagram/key-figures.js';
import { KeyFigures } from '../../site/src/sections/parts/diagram/KeyFigures.js';
import { RunsOnAtlassian } from '../../site/src/sections/parts/diagram/RunsOnAtlassian.js';
import {
  GREEN_TESTS_FLOOR,
  RUNTIME_DEPENDENCIES,
} from '../../site/src/sections/parts/diagram/sources.js';

const SNAPSHOT = fileURLToPath(new URL('../../site/public/live-snapshot.json', import.meta.url));

/** L'instantané réel, tel que l'app installée l'a produit. */
function realSnapshot(): DemoSnapshotData {
  const parsed: unknown = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
  if (!isSnapshot(parsed)) throw new Error('instantané invalide');
  return parsed;
}

/** Le balisage d'un composant, sans navigateur. */
function render(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

/** Le texte d'un nœud, sans balises : ce qu'un lecteur d'écran lirait. */
function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
}

/** Les chiffres de la bande, repérés par leur identifiant. */
function figuresOf(lang: 'fr' | 'en', snapshot: DemoSnapshotData | null): Map<string, string> {
  return new Map(keyFigures(lang, snapshot).items.map((item) => [item.id, item.value]));
}

describe('le schéma « comment ça marche »', () => {
  it('est rendu en SVG accessible, avec titre et description', () => {
    for (const lang of ['fr', 'en'] as const) {
      const html = render(createElement(FlowDiagram, { lang }));
      expect(html, lang).toContain('<svg');
      expect(html, lang).toContain('role="img"');
      expect(html, lang).toContain('aria-labelledby="vitrine-diagram-title vitrine-diagram-desc"');
      expect(html, lang).toContain('<title id="vitrine-diagram-title">');
      expect(html, lang).toContain('<desc id="vitrine-diagram-desc">');
      const model = buildDiagram(lang);
      expect(plainText(html), lang).toContain(model.desc.slice(0, 60));
    }
  });

  it('porte les sept étapes du flux réel, du résumé CI au validateur', () => {
    const steps = buildDiagram('fr').steps.join(' | ').toLowerCase();
    for (const needle of [
      'résumé ci',
      'déclencheur web',
      'proof-ci',
      'consommateur',
      'preuves rafraîchies',
      'couverture recalculée',
      'validateur',
    ]) {
      expect(steps, needle).toContain(needle);
    }
    // Les deux issues sont distinctes : acceptée, ou refus motivé.
    expect(buildDiagram('fr').steps.some((step) => /accept/i.test(step))).toBe(true);
    expect(buildDiagram('fr').steps.some((step) => /refus/i.test(step))).toBe(true);
  });

  it('porte la branche « l’agent propose, un humain atteste »', () => {
    const model = buildDiagram('fr');
    expect(model.branchSteps).toHaveLength(2);
    expect(model.branchSteps[0]).toMatch(/agent/i);
    expect(model.branchSteps[1]).toMatch(/humain/i);
    const text = plainText(render(createElement(FlowDiagram, { lang: 'fr' })));
    for (const step of model.branchSteps) expect(text).toContain(step);
  });

  it('donne le même chemin en texte, dans les deux langues, sans trou', () => {
    for (const lang of ['fr', 'en'] as const) {
      const model = buildDiagram(lang);
      const text = plainText(render(createElement(FlowDiagram, { lang })));
      // Chaque étape de l'image est écrite dans la liste : rien n'est porté par
      // la seule couleur, ni par la seule position d'un bloc.
      for (const step of [...model.steps, ...model.branchSteps]) {
        expect(text, `${lang} ${step}`).toContain(step);
      }
      expect(model.steps.length).toBeGreaterThanOrEqual(9);
    }
  });

  it('place les blocs dans le cadre, sans chevauchement, dans les deux langues', () => {
    for (const lang of ['fr', 'en'] as const) {
      const model = buildDiagram(lang);
      for (const box of model.boxes) {
        expect(box.x, `${lang} ${box.id}`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.w, `${lang} ${box.id}`).toBeLessThanOrEqual(model.width);
        expect(box.y + box.h, `${lang} ${box.id}`).toBeLessThanOrEqual(model.height);
        // Le cadre contient le titre, le détail et les marges.
        expect(box.h, `${lang} ${box.id}`).toBeGreaterThanOrEqual(box.title.length * 14 + 20);
      }
      const sorted = [...model.boxes].sort((a, b) => a.y - b.y);
      for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1]!;
        const current = sorted[index]!;
        const shares = previous.x < current.x + current.w && current.x < previous.x + previous.w;
        if (shares) expect(previous.y + previous.h, `${lang} ${current.id}`).toBeLessThanOrEqual(current.y);
      }
    }
  });

  it('s’insère dans la section Architecture, sous son titre', () => {
    const html = render(createElement(Architecture, { lang: 'fr' }));
    expect(html).toContain('id="architecture"');
    expect(plainText(html)).toContain(VITRINE.fr.diagram.title);
    expect(html).toContain('<svg');
  });
});

describe('les chiffres clés viennent des données réelles', () => {
  it('compte tickets, critères prouvés, dérogations et réouvertures du dossier', () => {
    const snapshot = realSnapshot();
    const totals = snapshot.dossier!.totals;
    const figures = figuresOf('fr', snapshot);
    expect(figures.get('tickets')).toBe(String(totals.issues));
    expect(figures.get('proven')).toBe(`${totals.proven} / ${totals.criteria}`);
    // Le dossier compte 2 critères dérogés ; les statistiques de l'app comptent
    // 3 dérogations accordées par 2 personnes (John Doe ×2, Alison Swift ×1).
    const granted = snapshot.stats!.waiversByGranter.reduce((sum, entry) => sum + entry.count, 0);
    expect(granted).toBe(3);
    expect(figures.get('waivers')).toBe(String(granted));
    expect(figures.get('living')).toBe(String(snapshot.living.length));
    // Les réouvertures sont lues dans l'historique Jira, pas inventées.
    const reopening = snapshot.stats?.reopenings.find((rate) => rate.reopened > 0);
    expect(figures.get('reopenings')).toBe(String(reopening?.reopened));
  });

  it('suit l’instantané : un autre dossier donne d’autres chiffres', () => {
    const snapshot = realSnapshot();
    const dossier = snapshot.dossier!;
    const altered: DemoSnapshotData = {
      ...snapshot,
      dossier: {
        ...dossier,
        versionName: '9.9',
        totals: { ...dossier.totals, issues: 2, criteria: 7, proven: 5, waived: 1 },
      },
      stats: snapshot.stats === null
        ? null
        : {
            ...snapshot.stats,
            waiversByGranter: [{ accountId: 'actor-9', displayName: 'Test', count: 1 }],
          },
    };
    const figures = figuresOf('fr', altered);
    // Aucune constante recopiée : le rendu suit l'instantané fourni.
    expect(figures.get('tickets')).toBe('2');
    expect(figures.get('proven')).toBe('5 / 7');
    expect(figures.get('waivers')).toBe('1');
    expect(keyFigures('fr', altered).measuredOn).toBeTruthy();
  });

  it('affiche la bande dans le Hero, avec la date de mesure', () => {
    const text = plainText(render(createElement(Hero, { lang: 'fr' })));
    const totals = realSnapshot().dossier!.totals;
    expect(text).toContain(VITRINE.fr.figures.title);
    expect(text).toContain(`${totals.proven} / ${totals.criteria}`);
    expect(text).toContain('Données réelles mesurées le');
    expect(text).toContain('tests verts du dépôt');
  });

  it('garde les chiffres du dépôt en dur, avec leur source cliquable', () => {
    const band = keyFigures('en', realSnapshot());
    const tests = band.items.find((item) => item.id === 'tests');
    const deps = band.items.find((item) => item.id === 'runtime-deps');
    expect(tests?.value).toBe(`${GREEN_TESTS_FLOOR}+`);
    expect(tests?.href).toMatch(/^https:\/\/github\.com\/.*preuve-a-l-appui$/);
    expect(deps?.value).toBe(String(RUNTIME_DEPENDENCIES));
    expect(deps?.href).toContain('package.json');
    // La source est écrite en clair, pas seulement derrière un lien.
    expect(deps?.source).toContain('package.json');
  });

  it('se rabat sur les seuls chiffres du dépôt sans instantané, et le dit', () => {
    const band = keyFigures('fr', null);
    expect(band.items.map((item) => item.id)).toEqual(['tests', 'runtime-deps']);
    expect(band.measuredOn).toBeNull();
    expect(band.notice).toBe(VITRINE.fr.figures.missingLive);
    const text = plainText(render(createElement(KeyFigures, { lang: 'fr', snapshot: null })));
    expect(text).toContain(VITRINE.fr.figures.missingLive);
  });

  it('donne la même bande, chiffre pour chiffre, en FR et en EN', () => {
    const fr = figuresOf('fr', realSnapshot());
    const en = figuresOf('en', realSnapshot());
    expect([...fr.entries()]).toEqual([...en.entries()]);
    for (const item of keyFigures('en', realSnapshot()).items) {
      expect(item.label, item.id).not.toBe('');
    }
  });
});

describe('le badge « Runs on Atlassian »', () => {
  it('est présent en français et en anglais, et dit ce qu’il signifie', () => {
    for (const lang of ['fr', 'en'] as const) {
      const text = plainText(render(createElement(RunsOnAtlassian, { lang })));
      expect(text, lang).toContain(VITRINE[lang].badge.label);
      expect(text, lang).toContain(VITRINE[lang].badge.meaning);
      const html = render(createElement(RunsOnAtlassian, { lang }));
      expect(html, lang).toContain('docs/LIVE-DEMO.md');
    }
  });

  it('reste sobre : aucun logo officiel, aucune image chargée', () => {
    const html = render(createElement(RunsOnAtlassian, { lang: 'fr' }));
    expect(html).not.toContain('<img');
    expect(html).toContain('aria-hidden="true"');
    expect(plainText(html)).toContain('Runs on Atlassian');
  });

  it('apparaît dans le Hero et au pied de la section Architecture', () => {
    for (const lang of ['fr', 'en'] as const) {
      expect(plainText(render(createElement(Hero, { lang }))), lang).toContain(
        VITRINE[lang].badge.label,
      );
      expect(plainText(render(createElement(Architecture, { lang }))), lang).toContain(
        VITRINE[lang].badge.compact,
      );
    }
  });
});
