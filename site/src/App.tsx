/**
 * Coquille du site : navigation, sections de présentation, démo, pied de page.
 *
 * Les sections vivent dans `site/src/sections/`, la démo interactive dans
 * `site/src/demo/`. Le choix de langue (anglais / français, SPEC §20) est porté
 * ici et descend dans les deux.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { useCallback, useState } from 'react';
import type { ReactElement } from 'react';
import type { Language } from '../../src/types.js';
import { Demo } from './demo/index.js';
import { initialLang, otherLang, rememberLang } from './i18n/index.js';
import { Agents } from './sections/Agents.js';
import { Architecture } from './sections/Architecture.js';
import { Features } from './sections/Features.js';
import { Footer } from './sections/Footer.js';
import { Hero } from './sections/Hero.js';
import { Judges } from './sections/Judges.js';
import { Nav } from './sections/Nav.js';
import { Problem } from './sections/Problem.js';
import { Recipe } from './sections/Recipe.js';
import { Rule } from './sections/Rule.js';
import { Screens } from './sections/Screens.js';
import { Simulator } from './sections/Simulator.js';

export function App(): ReactElement {
  const [lang, setLang] = useState<Language>(initialLang());

  const toggleLang = useCallback(() => {
    setLang((current) => {
      const next = otherLang(current);
      rememberLang(next);
      document.documentElement.lang = next;
      return next;
    });
  }, []);

  return (
    <>
      <Nav lang={lang} onToggleLang={toggleLang} />
      <main id="content">
        <Hero lang={lang} />
        <Problem lang={lang} />
        <Rule lang={lang} />
        <Features lang={lang} />
        <section id="demo" aria-labelledby="demo-title">
          <div className="wrap">
            <Demo lang={lang} />
          </div>
        </section>
        <Simulator lang={lang} />
        <Screens lang={lang} />
        <Agents lang={lang} />
        <Architecture lang={lang} />
        <Recipe lang={lang} />
        <Judges lang={lang} />
      </main>
      <Footer lang={lang} />
    </>
  );
}
