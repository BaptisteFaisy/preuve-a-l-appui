/**
 * Section « Architecture » du site public.
 *
 * Titre + accroche, le schéma unique « comment ça marche » (lot
 * `site-vitrine-confiance` : un seul SVG inline, du résumé CI signé à la
 * transition refusée, avec la branche « l'agent propose, un humain atteste »),
 * puis les trois chemins de décision en blocs, l'encadré « pourquoi le
 * validateur répond vite » et les limites annoncées (l'honnêteté fait partie
 * du produit, SPEC §20).
 *
 * Tout le texte vient de `t.architecture.*` (site/src/i18n) ou de
 * `VITRINE[lang].diagram` : rien d'en dur, aucun JS ajouté. La chaîne d'étapes
 * fournie est découpée sur la flèche « → » uniquement pour l'affichage en
 * blocs.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../src/types.js';
import { stringsFor } from '../i18n/index.js';
import { VITRINE } from '../i18n/vitrine.js';
import { FlowDiagram } from './parts/diagram/FlowDiagram.js';
import { RunsOnAtlassian } from './parts/diagram/RunsOnAtlassian.js';
import './Architecture.css';

/** Découpe la chaîne d'étapes sur la flèche « → » pour l'affichage en blocs. */
function splitSteps(path: string): string[] {
  return path
    .split('→')
    .map((step) => step.trim())
    .filter((step) => step.length > 0);
}

/** Un chemin : son nom et la chaîne d'étapes rendue en blocs reliés. */
function FlowDiagramBlocks(props: { name: string; path: string }): ReactElement {
  const steps = splitSteps(props.path);
  return (
    <li className="archi-flow">
      <p className="archi-flow-name">{props.name}</p>
      <ol className="archi-steps">
        {steps.map((step, index) => (
          <li key={step} className="archi-step">
            <span className="archi-step-box">{step}</span>
            {index < steps.length - 1 ? (
              <span className="archi-arrow" aria-hidden="true">→</span>
            ) : null}
          </li>
        ))}
      </ol>
    </li>
  );
}

export function Architecture({ lang }: { lang: Language }): ReactElement {
  const t = stringsFor(lang);
  const arch = t.architecture;
  const scheme = VITRINE[lang].diagram;
  return (
    <section id="architecture" aria-labelledby="architecture-title">
      <div className="wrap">
        <h2 id="architecture-title">{arch.title}</h2>
        <p className="lede">{arch.lede}</p>

        <h3 className="archi-subtitle archi-scheme-title">{scheme.title}</h3>
        <p className="archi-scheme-lede">{scheme.lede}</p>
        <FlowDiagram lang={lang} />

        <h3 className="archi-subtitle">{arch.flowTitle}</h3>
        <ul className="archi-flows">
          {arch.flows.map((flow) => (
            <FlowDiagramBlocks key={flow.name} name={flow.name} path={flow.path} />
          ))}
        </ul>

        <aside className="archi-fast" aria-labelledby="archi-fast-title">
          <h3 className="archi-fast-title" id="archi-fast-title">{arch.fastTitle}</h3>
          <p className="archi-fast-body">{arch.fastBody}</p>
        </aside>

        <h3 className="archi-subtitle">{arch.limitsTitle}</h3>
        <ul className="archi-limits">
          {arch.limits.map((limit) => (
            <li key={limit} className="archi-limit">{limit}</li>
          ))}
        </ul>

        <RunsOnAtlassian lang={lang} variant="compact" />
      </div>
    </section>
  );
}
