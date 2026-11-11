/**
 * Écran — Réglages du projet (SPEC §16.3, §9.2, §10).
 *
 * Grille des exigences par type, rôles qui attestent et dérogent, mode du
 * validateur (strict / souple / observation), politique « ticket sans critère »,
 * clé du point d'entrée de CI et la commande à copier. Toute la logique vit
 * dans `src/viewmodel/settings.ts` ; ce composant ne fait que rendre. Découpé
 * en sections pour rester sous la limite de 50 lignes par fonction.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import React, { useState } from 'react';
import {
  Box,
  Button,
  CodeBlock,
  DynamicTable,
  Heading,
  Inline,
  Lozenge,
  Spinner,
  Stack,
  Text,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { text } from '../i18n/index.js';
import { UI_MESSAGES } from '../i18n/ui.js';
import type { GateMode, Language } from '../types.js';
import type { SettingsViewModel } from '../viewmodel/settings.js';

export interface ProjectSettingsProps {
  readonly vm: SettingsViewModel;
  readonly language: Language;
  readonly onReload: () => Promise<void>;
}

/** Sélecteur du mode de sévérité du validateur (SPEC §12.2). */
function ModeSection(props: {
  vm: SettingsViewModel;
  language: Language;
  saving: boolean;
  onSave: (mode: GateMode) => Promise<void>;
}): React.ReactElement {
  const { vm, language, saving, onSave } = props;
  return (
    <Stack space="space.100">
      <Heading as="h3">{text(UI_MESSAGES, 'ui.settings.section.gateMode', language)}</Heading>
      <Inline space="space.100">
        {vm.modeOptions.map((opt) => (
          <Button
            key={opt.value}
            appearance={opt.isSelected ? 'primary' : 'default'}
            onClick={() => onSave(opt.value)}
            isDisabled={saving}
          >
            {opt.label}
          </Button>
        ))}
        {saving ? <Spinner size="small" /> : null}
      </Inline>
      <Text>{vm.modeLabel}</Text>
    </Stack>
  );
}

/** Clé du point d'entrée de CI et commande à copier (SPEC §10). */
function CiSection({ vm, language }: { vm: SettingsViewModel; language: Language }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  return (
    <Stack space="space.100">
      <Heading as="h3">{text(UI_MESSAGES, 'ui.settings.section.ci', language)}</Heading>
      <Text>{text(UI_MESSAGES, 'ui.settings.ci.keyHelp', language)}</Text>
      <CodeBlock language="shell" text={vm.ciCommand} />
      <Inline space="space.100">
        <Button appearance="primary" onClick={() => setCopied(true)}>
          {text(UI_MESSAGES, 'ui.settings.ci.copy', language)}
        </Button>
        {copied ? (
          <Lozenge appearance="success">{text(UI_MESSAGES, 'ui.settings.ci.copied', language)}</Lozenge>
        ) : null}
      </Inline>
    </Stack>
  );
}

/** Grille des exigences par type de critère (SPEC §9.2). */
function RequirementsTable({ vm, language }: { vm: SettingsViewModel; language: Language }): React.ReactElement {
  const head = {
    cells: [
      { key: 'type', content: text(UI_MESSAGES, 'ui.matrix.col.type', language), width: 24 },
      { key: 'accepted', content: text(UI_MESSAGES, 'ui.settings.col.accepted', language), width: 26 },
      { key: 'role', content: text(UI_MESSAGES, 'ui.settings.col.attesterRole', language), width: 24 },
      { key: 'constraints', content: text(UI_MESSAGES, 'ui.settings.col.constraints', language), width: 16 },
      { key: 'minor', content: text(UI_MESSAGES, 'ui.settings.col.minor', language), width: 10 },
    ],
  };
  const rows = vm.requirements.map((r) => ({
    key: r.type,
    cells: [
      { key: 'type', content: <Text>{r.typeLabel}</Text> },
      { key: 'accepted', content: <Lozenge appearance="default">{r.acceptedStrengths}</Lozenge> },
      { key: 'role', content: <Text>{r.attesterRole}</Text> },
      { key: 'constraints', content: <Text>{r.constraintsLabel}</Text> },
      {
        key: 'minor',
        content: (
          <Text>{text(UI_MESSAGES, r.minor ? 'ui.common.yes' : 'ui.common.no', language)}</Text>
        ),
      },
    ],
  }));
  return <DynamicTable head={head} rows={rows} />;
}

/** Rôles qui attestent, dérogent, reviennent à la sécurité et aux données. */
function RolesSection({ vm, language }: { vm: SettingsViewModel; language: Language }): React.ReactElement {
  const line = (labelKey: string, roles: readonly string[]) => (
    <Text>{`${text(UI_MESSAGES, labelKey, language)} : ${roles.join(', ')}`}</Text>
  );
  return (
    <Stack space="space.100">
      <Heading as="h3">{text(UI_MESSAGES, 'ui.settings.section.roles', language)}</Heading>
      {line('ui.settings.roles.attest', vm.roles.attest)}
      {line('ui.settings.roles.waive', vm.roles.waive)}
      {line('ui.settings.roles.security', vm.roles.security)}
      {line('ui.settings.roles.data', vm.roles.data)}
    </Stack>
  );
}

export function ProjectSettingsPanel({
  vm,
  language,
  onReload,
}: ProjectSettingsProps): React.ReactElement {
  const [saving, setSaving] = useState(false);
  const onSave = async (mode: GateMode) => {
    setSaving(true);
    try {
      await invoke('save-project-settings', { mode });
      await onReload();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Box>
      <Stack space="space.300">
        <Heading as="h2">{text(UI_MESSAGES, 'ui.settings.title', language)}</Heading>
        <Text>{text(UI_MESSAGES, 'ui.settings.description', language)}</Text>
        <ModeSection vm={vm} language={language} saving={saving} onSave={onSave} />
        <Stack space="space.100">
          <Heading as="h3">{text(UI_MESSAGES, 'ui.settings.section.missingCriteria', language)}</Heading>
          <Text>{vm.missingCriteriaLabel}</Text>
        </Stack>
        <CiSection vm={vm} language={language} />
        <Stack space="space.100">
          <Heading as="h3">{text(UI_MESSAGES, 'ui.settings.section.requirements', language)}</Heading>
          <RequirementsTable vm={vm} language={language} />
        </Stack>
        <RolesSection vm={vm} language={language} />
      </Stack>
    </Box>
  );
}
