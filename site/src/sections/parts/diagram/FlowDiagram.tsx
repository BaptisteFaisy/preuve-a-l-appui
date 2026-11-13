/**
 * Le schéma unique « comment ça marche » (lot `site-vitrine-confiance`).
 *
 * Un SVG inline : net à toute résolution, léger (aucune image à charger),
 * lisible par un lecteur d'écran (`role="img"`, `title`, `desc`) et suivi de
 * son équivalent textuel — le même contenu, en liste, sous le schéma. Les deux
 * sorties viennent du même modèle (`buildDiagram`) : aucune étape n'est écrite
 * deux fois, et un test vérifie que la liste dit bien tout le schéma.
 *
 * Le schéma est étroit pour rester lisible sur mobile ; sur grand écran, il se
 * place à côté de sa description (voir `diagram.css`).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { Language } from '../../../../../src/types.js';
import { VITRINE } from '../../../i18n/vitrine.js';
import { baselines, buildDiagram, LANE_BASELINE, BRANCH_LANE_X } from './diagram-data.js';
import type { DiagramBox, DiagramLink, DiagramModel } from './diagram-data.js';
import './diagram.css';

const TITLE_ID = 'vitrine-diagram-title';
const DESC_ID = 'vitrine-diagram-desc';
const ARROW_ID = 'vitrine-diagram-arrow';

/** Un trait du schéma, avec sa pointe de flèche. */
function Link({ link }: { link: DiagramLink }): ReactElement {
  const className = link.dashed ? 'diagram-link diagram-link--dashed' : 'diagram-link';
  return <path className={className} d={link.d} markerEnd={`url(#${ARROW_ID})`} />;
}

/** Le texte d'un bloc, placé sur les lignes de base calculées. */
function BoxText({ box }: { box: DiagramBox }): ReactElement {
  const centre = box.x + box.w / 2;
  const lines = baselines(box);
  return (
    <>
      {box.title.map((line, index) => (
        <text
          key={`t-${index}`}
          className="diagram-title"
          x={centre}
          y={lines.titles[index]}
          textAnchor="middle"
        >
          {line}
        </text>
      ))}
      {box.detail.map((line, index) => (
        <text
          key={`d-${index}`}
          className="diagram-detail"
          x={centre}
          y={lines.details[index]}
          textAnchor="middle"
        >
          {line}
        </text>
      ))}
    </>
  );
}

/** Un bloc du schéma : son cadre et son texte. */
function Box({ box }: { box: DiagramBox }): ReactElement {
  return (
    <g className={`diagram-box diagram-box--${box.tone}`}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={8} ry={8} />
      <BoxText box={box} />
    </g>
  );
}

/** La pointe de flèche, déclarée une fois dans le SVG. */
function ArrowHead(): ReactElement {
  return (
    <defs>
      <marker
        id={ARROW_ID}
        viewBox="0 0 8 8"
        refX="7"
        refY="4"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path className="diagram-arrowhead" d="M 0 1 L 7 4 L 0 7 z" />
      </marker>
    </defs>
  );
}

/** Le SVG lui-même : titre, description, voies, traits puis blocs. */
export function DiagramSvg({ model }: { model: DiagramModel }): ReactElement {
  return (
    <svg
      className="diagram-svg"
      viewBox={`0 0 ${model.width} ${model.height}`}
      role="img"
      aria-labelledby={`${TITLE_ID} ${DESC_ID}`}
      preserveAspectRatio="xMidYMid meet"
      focusable="false"
    >
      <title id={TITLE_ID}>{model.title}</title>
      <desc id={DESC_ID}>{model.desc}</desc>
      <ArrowHead />
      <text className="diagram-lane" x={8} y={LANE_BASELINE}>
        {model.laneMain}
      </text>
      <text className="diagram-lane" x={BRANCH_LANE_X} y={LANE_BASELINE}>
        {model.laneBranch}
      </text>
      {model.links.map((link) => (
        <Link key={link.id} link={link} />
      ))}
      {model.boxes.map((box) => (
        <Box key={box.id} box={box} />
      ))}
    </svg>
  );
}

/** Une liste d'étapes, numérotée : le texte dit ce que l'image montre. */
function Steps({ label, steps }: { label: string; steps: readonly string[] }): ReactElement {
  return (
    <div className="diagram-steps-block">
      <p className="diagram-steps-title">{label}</p>
      <ol className="diagram-steps">
        {steps.map((step) => (
          <li key={step} className="diagram-step">
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** La figure complète : le schéma, puis son équivalent textuel. */
export function FlowDiagram({ lang }: { lang: Language }): ReactElement {
  const model = buildDiagram(lang);
  const stepsTitle = VITRINE[lang].diagram.stepsTitle;
  return (
    <figure className="diagram-figure">
      <div className="diagram-canvas">
        <DiagramSvg model={model} />
      </div>
      <figcaption className="diagram-caption">
        <p className="diagram-desc">{model.desc}</p>
        <p className="diagram-steps-title diagram-steps-heading">{stepsTitle}</p>
        <Steps label={model.laneMain} steps={model.steps} />
        <Steps label={model.laneBranch} steps={model.branchSteps} />
      </figcaption>
    </figure>
  );
}
