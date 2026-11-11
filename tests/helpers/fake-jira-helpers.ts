/**
 * Méthodes de lecture et d'écriture pour le faux `JiraGateway`.
 *
 * Découpé depuis `fake-gateways.ts` pour respecter la règle des 50 lignes par fonction.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { IssueRef } from '../../src/types.js';
import type { CallJournal, JiraWrite } from './fake-gateways.js';

export interface FakeJiraState {
  journal: CallJournal;
  known: IssueRef[];
  roles: Map<string, readonly string[]>;
  names: Map<string, string>;
  writes: Record<JiraWrite, boolean>;
  rewrites: { issueId: string; section: string }[];
  coverageFields: { issueId: string; label: string; proven: number; total: number }[];
  notifications: { accountId: string; subjectKey: string; bodyKey: string; issueKey: string }[];
}

export function matchesProject(issue: IssueRef, projectId: string): boolean {
  return issue.projectId === projectId || issue.projectKey === projectId;
}

export function createJiraReader(state: FakeJiraState) {
  return {
    async getIssue(issueIdOrKey: string): Promise<IssueRef | null> {
      state.journal.calls.push({ method: 'getIssue', args: [issueIdOrKey] });
      return state.known.find((i) => i.id === issueIdOrKey || i.key === issueIdOrKey) ?? null;
    },
    async findIssueByBranch(projectId: string, branch: string): Promise<IssueRef | null> {
      state.journal.calls.push({ method: 'findIssueByBranch', args: [projectId, branch] });
      return state.known.find((i) => matchesProject(i, projectId) && branch.includes(i.key)) ?? null;
    },
    async listIssuesOfVersion(projectId: string, versionId: string): Promise<IssueRef[]> {
      state.journal.calls.push({ method: 'listIssuesOfVersion', args: [projectId, versionId] });
      return state.known.filter((i) => matchesProject(i, projectId) && i.fixVersions.includes(versionId));
    },
  };
}

export function createJiraWriter(state: FakeJiraState) {
  return {
    async rewriteDescriptionSection(issueId: string, section: string): Promise<boolean> {
      state.journal.calls.push({ method: 'rewriteDescriptionSection', args: [issueId, section] });
      state.rewrites.push({ issueId, section });
      return state.writes.rewrite;
    },
    async setCoverageField(issueId: string, label: string, proven: number, total: number): Promise<boolean> {
      state.journal.calls.push({ method: 'setCoverageField', args: [issueId, label, proven, total] });
      state.coverageFields.push({ issueId, label, proven, total });
      return state.writes.coverage;
    },
    async projectRoles(projectId: string, accountId: string): Promise<string[]> {
      state.journal.calls.push({ method: 'projectRoles', args: [projectId, accountId] });
      return [...(state.roles.get(accountId) ?? [])];
    },
    async notify(accountId: string, subjectKey: string, bodyKey: string, issueKey: string): Promise<boolean> {
      state.journal.calls.push({ method: 'notify', args: [accountId, subjectKey, bodyKey, issueKey] });
      state.notifications.push({ accountId, subjectKey, bodyKey, issueKey });
      return state.writes.notify;
    },
    async displayName(accountId: string): Promise<string> {
      state.journal.calls.push({ method: 'displayName', args: [accountId] });
      return state.names.get(accountId) ?? accountId;
    },
  };
}
