/**
 * Démo interactive PAY-123 : le vrai moteur de l'app, dans le navigateur.
 *
 * Ce composant ne contient aucune règle métier. Il appelle les gestes du
 * panneau (`src/handlers/resolver.ts`), le validateur
 * (`src/handlers/validator.ts`), le consommateur de CI
 * (`src/handlers/consumer.ts`) et les outils MCP (`src/handlers/dispatch.ts`),
 * puis affiche les view-models que l'app produit elle-même
 * (`src/viewmodel/*`). Tout est en mémoire : rien n'est envoyé nulle part.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ReactElement } from 'react';
import type { GateMode, Language } from '../../../src/types.js';
import { stringsFor } from '../i18n/index.js';
import { AdvancedPanel } from './parts/AdvancedPanel.js';
import { Controls } from './parts/Controls.js';
import { DemoHeader } from './parts/DemoHeader.js';
import { LogPanel } from './parts/LogPanel.js';
import { MatrixTable } from './parts/MatrixTable.js';
import { VerdictPanel } from './parts/Verdict.js';
import { useDemo } from './useDemo.js';
import './demo.css';

/** Le test que la démo attache à un critère : celui du jeu PAY-123. */
const DEMO_TESTS = ['checkout refuses an expired card', 'checkout logs the refusal reason'];

const MODES: readonly GateMode[] = ['strict', 'lenient', 'observe'];

export function Demo({ lang }: { lang: Language }): ReactElement {
  const demo = useDemo(lang);
  const { snapshot } = demo;

  if (!snapshot) {
    return <p className="demo-loading">…</p>;
  }

  return (
    <div className="demo">
      <DemoHeader lang={lang} snapshot={snapshot} />

      <Controls
        lang={lang}
        snapshot={snapshot}
        onActor={demo.setActor}
        modes={MODES}
        onMode={(next) => void demo.chooseMode(next)}
        onCi={(mainBranch) => void demo.runCi(mainBranch)}
        onDone={() => void demo.close()}
        onAgent={() => void demo.ask()}
        onReset={() => void demo.reset()}
      />

      <MatrixTable
        lang={lang}
        snapshot={snapshot}
        tests={DEMO_TESTS}
        onAttach={(criterionId, index) =>
          void demo.attach(criterionId, DEMO_TESTS[index % DEMO_TESTS.length] ?? '')
        }
        onAttest={(criterionId) => void demo.attestCriterion(criterionId)}
        onWaive={(criterionId, reason) => void demo.waiveCriterion(criterionId, reason)}
        onAgentAttest={(criterionId) => void demo.agentAttempt(criterionId)}
      />

      <AdvancedPanel
        lang={lang}
        results={demo.advanced}
        busy={snapshot.busy}
        onRun={(id) => void demo.advancedRun(id)}
      />

      <VerdictPanel lang={lang} verdict={snapshot.verdict} passedText={stringsFor(lang).demo.gatePassed} />
      <LogPanel lang={lang} entries={snapshot.log} />
    </div>
  );
}
