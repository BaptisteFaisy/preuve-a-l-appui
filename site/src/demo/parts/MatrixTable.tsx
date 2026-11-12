/**
 * La matrice critères × preuves de la démo.
 *
 * Les lignes viennent du view-model réel du panneau Forge
 * (`src/viewmodel/matrix.ts`) : libellés traduits, force exigée, état, preuves,
 * et surtout `canAttest` / `canWaive`, calculés par le domaine pour l'acteur
 * courant (SPEC §9.4, §12.4). La démo n'affiche donc un bouton que si l'app
 * l'autoriserait vraiment.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { MatrixRowViewModel } from '../../../../src/viewmodel/matrix.js';
import { stringsFor } from '../../i18n/index.js';
import type { DemoSnapshot } from '../state.js';

export interface MatrixTableProps {
  readonly lang: 'en' | 'fr';
  readonly snapshot: DemoSnapshot;
  /** Les deux tests du jeu de démonstration, proposés au geste « attacher ». */
  readonly tests: readonly string[];
  readonly onAttach: (criterionId: string, index: number) => void;
  readonly onAttest: (criterionId: string) => void;
  readonly onWaive: (criterionId: string, reason: string) => void;
  readonly onAgentAttest: (criterionId: string) => void;
}

function ProofList({ row, noProof }: { row: MatrixRowViewModel; noProof: string }): ReactElement {
  if (row.evidences.length === 0) return <span className="demo-none">{noProof}</span>;
  return (
    <ul className="demo-proofs">
      {row.evidences.map((proof) => (
        <li key={proof.id}>
          <span className={`tag ${proof.strength === 'machine-verified' ? 'ok' : proof.strength === 'attested' ? 'warn' : ''}`}>
            {proof.strengthLabel}
          </span>{' '}
          <code>{proof.reference}</code>{' '}
          <span className="demo-freshness">
            {proof.freshnessLabel}
            {proof.addedByAgent ? ' · agent' : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface RowActionsProps {
  readonly row: MatrixRowViewModel;
  readonly index: number;
  readonly disabled: boolean;
  readonly table: MatrixTableProps;
}

function RowActions(props: RowActionsProps): ReactElement {
  const t = stringsFor(props.table.lang).demo;
  const [reason, setReason] = useState('');
  const { row } = props;
  return (
    <div className="demo-row-actions">
      <button
        type="button"
        className="button secondary"
        disabled={props.disabled || !row.canAttach}
        onClick={() => props.table.onAttach(row.criterionId, props.index)}
      >
        {t.attachTest}
      </button>
      <button
        type="button"
        className="button secondary"
        disabled={props.disabled || !row.canAttest}
        title={row.canAttest ? undefined : t.attestAs}
        onClick={() => props.table.onAttest(row.criterionId)}
      >
        {t.attest}
      </button>
      <button
        type="button"
        className="button secondary"
        disabled={props.disabled}
        onClick={() => props.table.onAgentAttest(row.criterionId)}
      >
        MCP
      </button>
      <span className="demo-waive">
        <input
          type="text"
          value={reason}
          placeholder={t.waiverPlaceholder}
          aria-label={t.waiverReason}
          disabled={props.disabled || !row.canWaive}
          onChange={(event) => setReason(event.target.value)}
        />
        <button
          type="button"
          className="button secondary"
          disabled={props.disabled || !row.canWaive}
          onClick={() => props.table.onWaive(row.criterionId, reason)}
        >
          {t.waive}
        </button>
      </span>
    </div>
  );
}

export function MatrixTable(props: MatrixTableProps): ReactElement {
  const t = stringsFor(props.lang).demo;
  const rows = props.snapshot.matrix.rows;
  return (
    <table className="demo-matrix">
      <caption className="visually-hidden">{props.snapshot.matrix.issueKey}</caption>
      <thead>
        <tr>
          <th scope="col">{t.colCriterion}</th>
          <th scope="col">{t.colRequired}</th>
          <th scope="col">{t.colProofs}</th>
          <th scope="col">{t.colState}</th>
          <th scope="col">{t.attest}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row: MatrixRowViewModel, index: number) => (
          <tr key={row.criterionId} data-status={row.status}>
            <th scope="row">
              <code>{row.code}</code> {row.text}
              <span className="demo-type">
                {row.typeLabel} · v{row.version}
              </span>
            </th>
            <td>{row.requiredStrengthLabel}</td>
            <td>
              <ProofList row={row} noProof={t.noProof} />
            </td>
            <td>
              <span className={`tag ${row.isProven ? 'ok' : row.isWaived ? 'warn' : 'bad'}`}>
                {row.statusLabel}
              </span>
              {row.hasDefect ? <span className="demo-defect">{row.defectLabel}</span> : null}
              {row.expectedProof ? <span className="demo-expected">{row.expectedProof}</span> : null}
            </td>
            <td>
              <RowActions row={row} index={index} disabled={props.snapshot.busy} table={props} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

