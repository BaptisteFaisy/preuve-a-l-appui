/**
 * État de la démo : un instantané immuable + un journal, recalculés après
 * chaque geste en relisant ce que l'app a vraiment rangé en base.
 *
 * La démo ne tient aucun compte de la couverture : elle lit la ligne que le
 * moteur de couverture a écrite, exactement comme le validateur et le champ
 * « Preuves n / m » (SPEC §12.3, §22 point 10).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Actor, GateMode, GateVerdict, Language } from '../../../src/types.js';
import type { CoverageFieldViewModel } from '../../../src/viewmodel/coverage.js';
import type { MatrixViewModel } from '../../../src/viewmodel/matrix.js';
import { buildCoverageFieldViewModel } from '../../../src/viewmodel/coverage.js';
import { buildMatrixViewModel, type MatrixRights } from '../../../src/viewmodel/matrix.js';
import { canAttest } from '../../../src/domain/independence.js';
import { isRoleAllowedToWaive } from '../../../src/domain/waivers.js';
import type { DemoLogEntry } from './actions.js';
import type { DemoWorld } from './world.js';
import { ISSUE_ID, ISSUE_KEY, PROJECT_ID } from './world.js';

/** Instantané rendu par la démo. */
export interface DemoSnapshot {
  readonly matrix: MatrixViewModel;
  readonly field: CoverageFieldViewModel;
  readonly verdict: GateVerdict | null;
  readonly log: readonly DemoLogEntry[];
  readonly actor: Actor;
  readonly actors: readonly Actor[];
  readonly mode: GateMode;
  readonly language: Language;
  readonly busy: boolean;
}

/** Droits de geste de l'acteur courant, calculés par le domaine (§9.4, §12.4). */
async function rightsOf(world: DemoWorld, actor: Actor): Promise<MatrixRights> {
  const issue = world.scenario.issue;
  const settings = (await world.deps.store.getSettings(PROJECT_ID)) ?? world.scenario.project;
  const criteria = await world.deps.store.listCriteriaByIssue(ISSUE_ID);
  const attestable = new Set<string>();
  for (const criterion of criteria) {
    if (canAttest(actor, issue, criterion, settings).allowed) attestable.add(criterion.id);
  }
  return { attestable, waivable: !actor.agent && isRoleAllowedToWaive(actor.roles, settings.roles) };
}

/** Relit la couverture et reconstruit les deux view-models de l'app. */
export async function snapshotOf(
  world: DemoWorld,
  actor: Actor,
  mode: GateMode,
  language: Language,
  verdict: GateVerdict | null,
  log: readonly DemoLogEntry[],
  busy: boolean,
): Promise<DemoSnapshot> {
  const coverage = await world.coverage();
  const rights = await rightsOf(world, actor);
  return {
    matrix: buildMatrixViewModel(coverage, language, ISSUE_KEY, rights),
    field: buildCoverageFieldViewModel(coverage, language),
    verdict,
    log,
    actor,
    actors: Object.values(world.scenario.actors),
    mode,
    language,
    busy,
  };
}

/** Ajoute une ligne au journal, en gardant les vingt dernières. */
export function withLog(
  log: readonly DemoLogEntry[],
  entry: Omit<DemoLogEntry, 'id'>,
): DemoLogEntry[] {
  const id = log.length === 0 ? 1 : (log[0]?.id ?? 0) + 1;
  return [{ ...entry, id }, ...log].slice(0, 20);
}
