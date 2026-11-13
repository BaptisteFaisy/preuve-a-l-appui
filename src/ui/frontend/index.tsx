/**
 * Point d'entrée de l'interface Forge (SPEC §16, lot L6).
 *
 * Route les quatre modules déclarés dans le manifest vers leur écran :
 * - `proof-matrix-panel`    (jira:issuePanel)         → MatrixPanel
 * - `proof-coverage-field`  (jira:customField)        → CoverageField
 * - `proof-project-settings`(jira:projectSettingsPage)→ ProjectSettingsPanel
 * - `proof-project-page`    (jira:projectPage)        → ProjectPagePanel
 *
 * La logique de transformation vit dans `src/viewmodel/` (pure, testée) ;
 * ce fichier ne fait que router, charger et rendre.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Box, Spinner, Text, useProductContext } from '@forge/react';
import { invoke } from '@forge/bridge';
import { text } from '../../i18n/index';
import { UI_MESSAGES } from '../../i18n/ui';
import type { Language } from '../../types';
import type { CoverageFieldViewModel } from '../../viewmodel/coverage';
import type { MatrixViewModel } from '../../viewmodel/matrix';
import type { ProjectPageViewModel } from '../../viewmodel/project';
import type { SettingsViewModel } from '../../viewmodel/settings';
import { CoverageField } from '../coverage-field';
import { MatrixPanel } from '../matrix';
import { ProjectPagePanel } from '../project-page';
import { ProjectSettingsPanel } from '../settings';

/** Détecte la langue depuis la locale du contexte (SPEC §20 : en + fr). */
export function resolveLanguage(locale: string | undefined): Language {
  return locale && locale.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

/** Identifie l'écran à partir de la clé du module Forge. */
export type ScreenKey = 'matrix' | 'coverage-field' | 'settings' | 'project-page';

export function resolveScreen(moduleKey: string | undefined): ScreenKey {
  const key = moduleKey ?? '';
  if (key.includes('proof-coverage-field')) return 'coverage-field';
  if (key.includes('proof-project-settings')) return 'settings';
  if (key.includes('proof-project-page')) return 'project-page';
  return 'matrix';
}

function Loading({ language }: { language: Language }): React.ReactElement {
  return (
    <Box>
      <Spinner size="medium" />
      <Text>{text(UI_MESSAGES, 'ui.common.loading', language)}</Text>
    </Box>
  );
}

export default function App(): React.ReactElement {
  const context = useProductContext();
  const locale = context?.locale;
  const moduleKey = context?.moduleKey;
  const language = resolveLanguage(locale);
  const screen = resolveScreen(moduleKey);
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (screen === 'matrix') {
        setData(await invoke('get-issue-matrix', { language }));
      } else if (screen === 'coverage-field') {
        setData(await invoke('get-coverage-field', { language }));
      } else if (screen === 'settings') {
        setData(await invoke('get-project-settings', { language }));
      } else {
        setData(await invoke('get-project-page', { language }));
      }
    } finally {
      setLoading(false);
    }
  }, [screen, language]);

  useEffect(() => {
    void load();
  }, [load]);

  if (context === undefined || loading) {
    return <Loading language={language} />;
  }

  if (screen === 'coverage-field') {
    return <CoverageField vm={data as CoverageFieldViewModel} />;
  }
  if (screen === 'settings') {
    return (
      <ProjectSettingsPanel vm={data as SettingsViewModel} language={language} onReload={load} />
    );
  }
  if (screen === 'project-page') {
    return <ProjectPagePanel vm={data as ProjectPageViewModel} language={language} onReload={load} />;
  }
  return <MatrixPanel vm={data as MatrixViewModel} language={language} onReload={load} />;
}
