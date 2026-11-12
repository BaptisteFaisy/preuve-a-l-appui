/**
 * Écran — Page projet « Preuves » (SPEC §16.4, §13, §14, FP-10/FP-16).
 *
 * Tickets en cours et leur couverture, dérogations avec leur compteur,
 * critères livrés qui ne sont plus prouvés (living proof), statistiques.
 * Toute la logique vit dans `src/viewmodel/project.ts` ; ce composant rend.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import React, { useState } from 'react';
import {
  Box,
  Button,
  DynamicTable,
  Heading,
  Inline,
  Lozenge,
  SectionMessage,
  Stack,
  Text,
} from '@forge/react';
import { text } from '../i18n/index';
import { UI_MESSAGES } from '../i18n/ui';
import type { Language } from '../types';
import type { ProjectPageViewModel } from '../viewmodel/project';
import { CoverageField } from './coverage-field';

export interface ProjectPageProps {
  readonly vm: ProjectPageViewModel;
  readonly language: Language;
  readonly onReload: () => Promise<void>;
}

type TabKey = 'issues' | 'waivers' | 'living' | 'stats';

export function ProjectPagePanel({
  vm,
  language,
  onReload,
}: ProjectPageProps): React.ReactElement {
  const [tab, setTab] = useState<TabKey>('issues');
  const t = (key: string) => text(UI_MESSAGES, key, language);

  const issuesRows = vm.issues.map((issue) => ({
    key: issue.issueId,
    cells: [
      { key: 'key', content: <Text>{issue.issueKey}</Text> },
      { key: 'cov', content: <CoverageField vm={issue.coverage} /> },
      {
        key: 'gate',
        content: (
          <Lozenge appearance={issue.passes ? 'success' : 'removed'}>
            {issue.passes ? t('ui.coverage.passes') : t('ui.coverage.blocks')}
          </Lozenge>
        ),
      },
    ],
  }));

  const waiversRows = vm.waivers.map((w) => ({
    key: w.id,
    cells: [
      { key: 'crit', content: <Text>{w.criterionId}</Text> },
      { key: 'by', content: <Text>{`${w.grantedBy} (${w.role})`}</Text> },
      { key: 'reason', content: <Text>{w.reason}</Text> },
      { key: 'date', content: <Text>{w.atFormatted}</Text> },
    ],
  }));

  const livingRows = vm.unprovenLiving.map((l) => ({
    key: l.id,
    cells: [
      { key: 'issue', content: <Text>{l.issueKey}</Text> },
      { key: 'test', content: <Text>{l.testName}</Text> },
      { key: 'comp', content: <Text>{l.component}</Text> },
      { key: 'since', content: <Text>{l.sinceFormatted}</Text> },
    ],
  }));

  const tabs: readonly { key: TabKey; label: string; count?: number }[] = [
    { key: 'issues', label: t('ui.project.tabs.issues'), count: vm.issues.length },
    { key: 'waivers', label: t('ui.project.tabs.waivers'), count: vm.activeWaiversCount },
    { key: 'living', label: t('ui.project.tabs.living'), count: vm.unprovenLivingCount },
    { key: 'stats', label: t('ui.project.tabs.stats') },
  ];

  return (
    <Box>
      <Stack space="space.200">
        <Inline spread="space-between">
          <Heading as="h2">{t('ui.project.title')}</Heading>
          <Button appearance="subtle" onClick={onReload}>
            {t('ui.common.refresh')}
          </Button>
        </Inline>

        <Inline space="space.100">
          {tabs.map((item) => (
            <Button
              key={item.key}
              appearance={tab === item.key ? 'primary' : 'default'}
              onClick={() => setTab(item.key)}
            >
              {item.count === undefined ? item.label : `${item.label} (${item.count})`}
            </Button>
          ))}
        </Inline>

        {tab === 'issues' ? (
          <DynamicTable
            head={{
              cells: [
                { key: 'key', content: t('ui.project.col.issue'), width: 25 },
                { key: 'cov', content: t('ui.project.col.coverage'), width: 45 },
                { key: 'gate', content: t('ui.project.col.gate'), width: 30 },
              ],
            }}
            rows={issuesRows}
            emptyView={<Text>{t('ui.project.issues.empty')}</Text>}
          />
        ) : null}

        {tab === 'waivers' ? (
          <DynamicTable
            head={{
              cells: [
                { key: 'crit', content: t('ui.project.col.criterion'), width: 20 },
                { key: 'by', content: t('ui.project.col.grantedBy'), width: 25 },
                { key: 'reason', content: t('ui.project.col.reason'), width: 35 },
                { key: 'date', content: t('ui.project.col.date'), width: 20 },
              ],
            }}
            rows={waiversRows}
            emptyView={<Text>{t('ui.project.waivers.empty')}</Text>}
          />
        ) : null}

        {tab === 'living' ? (
          <Stack space="space.100">
            {vm.unprovenLivingCount > 0 ? (
              <SectionMessage title={t('ui.project.living.alertTitle')} appearance="warning">
                <Text>{t('ui.project.living.warning')}</Text>
              </SectionMessage>
            ) : null}
            <DynamicTable
              head={{
                cells: [
                  { key: 'issue', content: t('ui.project.col.issue'), width: 20 },
                  { key: 'test', content: t('ui.project.col.testName'), width: 40 },
                  { key: 'comp', content: t('ui.project.col.component'), width: 20 },
                  { key: 'since', content: t('ui.project.col.since'), width: 20 },
                ],
              }}
              rows={livingRows}
              emptyView={<Text>{t('ui.project.living.empty')}</Text>}
            />
          </Stack>
        ) : null}

        {tab === 'stats' && vm.stats ? (
          <Stack space="space.150">
            <Heading as="h3">{t('ui.project.stats.byStrength')}</Heading>
            <Inline space="space.100">
              {vm.stats.proofsByStrength.map((s) => (
                <Lozenge key={s.strength} appearance="default">
                  {`${s.strengthLabel}: ${s.count}`}
                </Lozenge>
              ))}
            </Inline>
            <Heading as="h3">{t('ui.project.stats.waiversByGranter')}</Heading>
            {vm.stats.waiversByGranter.length === 0 ? (
              <Text>{t('ui.common.none')}</Text>
            ) : (
              <Stack space="space.050">
                {vm.stats.waiversByGranter.map((g) => (
                  <Text key={g.accountId}>{`${g.displayName} : ${g.count}`}</Text>
                ))}
              </Stack>
            )}
            <Heading as="h3">{t('ui.project.stats.closedWithoutValidator')}</Heading>
            <Lozenge appearance="removed">{String(vm.stats.closedWithoutValidator)}</Lozenge>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
