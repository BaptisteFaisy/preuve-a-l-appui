/**
 * Écran — Matrice critères × preuves sur le ticket (SPEC §16.1, FP-10).
 *
 * Une ligne par critère : code, texte, type, force exigée, preuves, état.
 * Boutons Attacher, J'ai vérifié (attestation en un geste §7.3),
 * Demander une attestation, Déroger, et historique des versions.
 * Toute la logique de transformation vit dans `src/viewmodel/matrix.ts` ;
 * ce composant ne fait que rendre. Découpé en sous-composants pour rester
 * sous la limite de 50 lignes par fonction.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  DynamicTable,
  Heading,
  Inline,
  Lozenge,
  SectionMessage,
  Stack,
  Tag,
  Text,
  TextArea,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { text } from '../i18n/index.js';
import { UI_MESSAGES } from '../i18n/ui.js';
import type { Language } from '../types.js';
import {
  dialogLabelKey,
  dialogTitleKey,
  type HistoryItemViewModel,
  type MatrixDialogMode,
  type MatrixRowViewModel,
  type MatrixViewModel,
} from '../viewmodel/matrix.js';

export interface MatrixPanelProps {
  readonly vm: MatrixViewModel;
  readonly language: Language;
  readonly onReload: () => Promise<void>;
}

interface ActiveDialog {
  readonly mode: MatrixDialogMode;
  readonly criterionId: string;
  readonly code: string;
}

const NO_DIALOG: ActiveDialog = { mode: 'none', criterionId: '', code: '' };
const isActionMode = (m: MatrixDialogMode) => m === 'attach' || m === 'attest' || m === 'waive' || m === 'request';

/** Cellule « preuves » : force colorée + référence + fraîcheur. */
function evidenceCell(row: MatrixRowViewModel, language: Language): React.ReactElement {
  if (row.evidences.length === 0) {
    return <Text>{text(UI_MESSAGES, 'ui.common.none', language)}</Text>;
  }
  return (
    <Stack space="space.050">
      {row.evidences.map((e) => (
        <Inline key={e.id} space="space.050">
          <Tag text={e.strengthLabel} color={e.strengthColor} />
          <Text>{e.reference}</Text>
          {e.freshness === 'fresh' ? null : (
            <Lozenge appearance="inprogress">{e.freshnessLabel}</Lozenge>
          )}
        </Inline>
      ))}
    </Stack>
  );
}

/** Cellule « actions » : les gestes humains sur un critère (SPEC §16.1). */
function actionsCell(
  row: MatrixRowViewModel,
  language: Language,
  open: (mode: MatrixDialogMode, r: MatrixRowViewModel) => void,
): React.ReactElement {
  const btn = (mode: MatrixDialogMode, key: string, appearance: 'primary' | 'subtle') => (
    <Button appearance={appearance} spacing="none" onClick={() => open(mode, row)}>
      {text(UI_MESSAGES, key, language)}
    </Button>
  );
  return (
    <ButtonGroup>
      {btn('attach', 'ui.matrix.action.attach', 'subtle')}
      {row.canAttest ? btn('attest', 'ui.matrix.action.attest', 'primary') : null}
      {btn('request', 'ui.matrix.action.requestAttestation', 'subtle')}
      {row.canWaive ? btn('waive', 'ui.matrix.action.waive', 'subtle') : null}
      {btn('history', 'ui.matrix.action.history', 'subtle')}
    </ButtonGroup>
  );
}

/** Historique des versions d'un critère (SPEC §8.4), chargé à l'ouverture. */
function HistoryDialog(props: {
  criterionId: string;
  code: string;
  language: Language;
  onClose: () => void;
}): React.ReactElement {
  const { criterionId, code, language, onClose } = props;
  const [revisions, setRevisions] = useState<readonly HistoryItemViewModel[]>([]);
  useEffect(() => {
    invoke('list-criterion-history', { criterionId, code, language })
      .then((r) => setRevisions((r as HistoryItemViewModel[]) ?? []))
      .catch(() => setRevisions([]));
  }, [criterionId, code, language]);
  return (
    <SectionMessage
      title={text(UI_MESSAGES, 'ui.matrix.form.historyTitle', language, { code })}
      appearance="information"
    >
      <Stack space="space.100">
        {revisions.length === 0 ? (
          <Text>{text(UI_MESSAGES, 'ui.common.none', language)}</Text>
        ) : (
          revisions.map((rev) => <Text key={rev.version}>{`${rev.label} — ${rev.text}`}</Text>)
        )}
        <Button appearance="subtle" onClick={onClose}>
          {text(UI_MESSAGES, 'ui.common.cancel', language)}
        </Button>
      </Stack>
    </SectionMessage>
  );
}

/** Dialogue de saisie pour attacher / attester / déroger / demander. */
function ActionDialog(props: {
  mode: MatrixDialogMode;
  criterionId: string;
  code: string;
  language: Language;
  onClose: () => void;
  onReload: () => Promise<void>;
}): React.ReactElement {
  const { mode, criterionId, code, language, onClose, onReload } = props;
  const [inputVal, setInputVal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    setSubmitting(true);
    try {
      const action =
        mode === 'attest' ? 'attest-criterion' : mode === 'waive' ? 'waive-criterion' : 'attach-evidence';
      await invoke(action, { criterionId, value: inputVal });
      onClose();
      await onReload();
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <SectionMessage
      title={`${code} — ${text(UI_MESSAGES, dialogTitleKey(mode), language)}`}
      appearance="discovery"
    >
      <Stack space="space.100">
        <Text>{text(UI_MESSAGES, dialogLabelKey(mode), language)}</Text>
        <TextArea name="dialogInput" value={inputVal} onChange={(e) => setInputVal(String(e.target.value ?? ''))} />
        <Inline space="space.100">
          <Button appearance="primary" onClick={submit} isDisabled={submitting}>
            {text(UI_MESSAGES, 'ui.common.save', language)}
          </Button>
          <Button appearance="subtle" onClick={onClose}>
            {text(UI_MESSAGES, 'ui.common.cancel', language)}
          </Button>
        </Inline>
      </Stack>
    </SectionMessage>
  );
}

/** En-tête + résumé de couverture de la matrice. */
function MatrixHeader({ vm, language }: { vm: MatrixViewModel; language: Language }): React.ReactElement {
  return (
    <Inline spread="space-between">
      <Heading as="h2">{text(UI_MESSAGES, 'ui.matrix.title', language)}</Heading>
      <Inline space="space.100">
        <Lozenge appearance={vm.passes ? 'success' : 'inprogress'} isBold>
          {vm.summaryText}
        </Lozenge>
        {vm.waived > 0 ? <Text>{vm.waivedText}</Text> : null}
      </Inline>
    </Inline>
  );
}

/** Colonnes de la matrice (SPEC §16.1). */
function buildHead(language: Language) {
  return {
    cells: [
      { key: 'code', content: text(UI_MESSAGES, 'ui.matrix.col.code', language), width: 8 },
      { key: 'text', content: text(UI_MESSAGES, 'ui.matrix.col.criterion', language), width: 34 },
      { key: 'req', content: text(UI_MESSAGES, 'ui.matrix.col.required', language), width: 16 },
      { key: 'ev', content: text(UI_MESSAGES, 'ui.matrix.col.evidences', language), width: 22 },
      { key: 'status', content: text(UI_MESSAGES, 'ui.matrix.col.status', language), width: 10 },
      { key: 'actions', content: text(UI_MESSAGES, 'ui.matrix.col.actions', language), width: 10 },
    ],
  };
}

/** Une ligne de la matrice : critère, force exigée, preuves, état, actions. */
function buildRow(
  row: MatrixRowViewModel,
  language: Language,
  open: (mode: MatrixDialogMode, r: MatrixRowViewModel) => void,
) {
  return {
    key: row.criterionId,
    cells: [
      { key: 'code', content: <Text>{row.code}</Text> },
      {
        key: 'text',
        content: (
          <Stack space="space.050">
            <Text>{row.text}</Text>
            {row.hasDefect ? <Text>{`${row.defectLabel} — ${row.expectedProof}`}</Text> : null}
          </Stack>
        ),
      },
      {
        key: 'req',
        content: (
          <Stack space="space.050">
            <Text>{row.typeLabel}</Text>
            <Lozenge appearance="default">{row.requiredStrengthLabel}</Lozenge>
          </Stack>
        ),
      },
      { key: 'ev', content: evidenceCell(row, language) },
      { key: 'status', content: <Lozenge appearance={row.statusAppearance}>{row.statusLabel}</Lozenge> },
      { key: 'actions', content: actionsCell(row, language, open) },
    ],
  };
}

/** Le tableau critères × preuves. */
function MatrixTable(props: {
  vm: MatrixViewModel;
  language: Language;
  open: (mode: MatrixDialogMode, r: MatrixRowViewModel) => void;
}): React.ReactElement {
  const { vm, language, open } = props;
  return (
    <DynamicTable
      head={buildHead(language)}
      rows={vm.rows.map((row) => buildRow(row, language, open))}
      emptyView={<Text>{text(UI_MESSAGES, 'ui.matrix.empty', language)}</Text>}
    />
  );
}

export function MatrixPanel({ vm, language, onReload }: MatrixPanelProps): React.ReactElement {
  const [dialog, setDialog] = useState<ActiveDialog>(NO_DIALOG);
  const open = (mode: MatrixDialogMode, row: MatrixRowViewModel) =>
    setDialog({ mode, criterionId: row.criterionId, code: row.code });
  const close = () => setDialog(NO_DIALOG);

  return (
    <Box>
      <Stack space="space.200">
        <MatrixHeader vm={vm} language={language} />
        {dialog.mode === 'history' ? (
          <HistoryDialog
            criterionId={dialog.criterionId}
            code={dialog.code}
            language={language}
            onClose={close}
          />
        ) : null}
        {isActionMode(dialog.mode) ? (
          <ActionDialog
            mode={dialog.mode}
            criterionId={dialog.criterionId}
            code={dialog.code}
            language={language}
            onClose={close}
            onReload={onReload}
          />
        ) : null}
        <MatrixTable vm={vm} language={language} open={open} />
      </Stack>
    </Box>
  );
}
