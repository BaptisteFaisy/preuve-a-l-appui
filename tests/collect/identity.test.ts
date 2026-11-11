import { describe, expect, it } from 'vitest';
import {
  createIdentityGateway,
  fallbackDisplayName,
  isAgentContext,
} from '../../src/collect/identity.js';
import type { ActorContext } from '../../src/ports.js';
import { createFakeJira } from '../helpers/fake-gateways.js';

function context(overrides: Partial<ActorContext> = {}): ActorContext {
  return {
    accountId: 'user-1',
    moduleId: 'jira:issuePanel',
    fromMcp: false,
    cloudId: 'cloud-1',
    ...overrides,
  };
}

/** Jira factice dont `displayName` plante : simule un runtime Jira indisponible. */
function brokenNameJira() {
  const fake = createFakeJira();
  return { ...fake, displayName: async () => { throw new Error('jira indisponible'); } };
}

describe('isAgentContext', () => {
  it('marque comme agent tout appel venu de rovo:mcp', () => {
    expect(isAgentContext(context({ fromMcp: true }))).toBe(true);
    expect(isAgentContext(context({ moduleId: 'mcp:proof-mcp' }))).toBe(true);
    expect(isAgentContext(context({ moduleId: 'rovo:agent:proof-agent' }))).toBe(true);
  });

  it('marque comme agent tout appel venu d une action', () => {
    expect(isAgentContext(context({ moduleId: 'action:attach-evidence' }))).toBe(true);
    expect(isAgentContext(context({ moduleId: 'fn-attach-evidence' }))).toBe(true);
  });

  it('laisse un écran humain non marqué', () => {
    expect(isAgentContext(context({ moduleId: 'jira:workflowValidator' }))).toBe(false);
    expect(isAgentContext(context({ moduleId: 'jira:issuePanel' }))).toBe(false);
    expect(isAgentContext(context({ moduleId: '' }))).toBe(false);
  });

  it('respecte un détecteur plus strict injecté', () => {
    const strict = (moduleId: string) => moduleId === 'jira:issuePanel';
    expect(isAgentContext(context({ moduleId: 'jira:issuePanel' }), strict)).toBe(true);
    expect(isAgentContext(context({ moduleId: 'jira:projectPage' }), strict)).toBe(false);
  });
});

describe('fallbackDisplayName', () => {
  it('nomme un agent et un humain de façon distincte', () => {
    expect(fallbackDisplayName('user-1', true)).toBe('Agent (user-1)');
    expect(fallbackDisplayName('', true)).toBe('Agent Rovo');
    expect(fallbackDisplayName('user-1', false)).toBe('user-1');
    expect(fallbackDisplayName('', false)).toBe('Utilisateur inconnu');
  });
});

describe('IdentityGateway - acteur humain', () => {
  it('résout le nom affiché auprès de Jira', async () => {
    const jira = createFakeJira([], { displayNames: { 'user-1': 'Alice Dupont' } });
    const identity = createIdentityGateway({ jira });

    const actor = await identity.actorOf(context());
    expect(actor.accountId).toBe('user-1');
    expect(actor.displayName).toBe('Alice Dupont');
    expect(actor.agent).toBe(false);
  });

  it('prend les rôles du projet via le résolveur injecté', async () => {
    const jira = createFakeJira([], {
      displayNames: { 'user-1': 'Alice Dupont' },
      roles: { 'user-1': ['Developers', 'Product Owner'] },
    });
    const identity = createIdentityGateway({
      jira,
      rolesResolver: (accountId) => jira.projectRoles('10000', accountId),
    });

    const actor = await identity.actorOf(context());
    expect(actor.roles).toEqual(['Developers', 'Product Owner']);
  });

  it('retombe sur le nom du compte quand Jira est indisponible', async () => {
    const identity = createIdentityGateway({ jira: brokenNameJira() });

    const actor = await identity.actorOf(context());
    expect(actor.displayName).toBe('user-1');
    expect(actor.agent).toBe(false);
  });

  it('retombe sur des rôles vides quand le résolveur plante', async () => {
    const identity = createIdentityGateway({
      jira: createFakeJira(),
      rolesResolver: async () => {
        throw new Error('rôles indisponibles');
      },
    });

    const actor = await identity.actorOf(context());
    expect(actor.roles).toEqual([]);
    expect(actor.agent).toBe(false);
  });

  it('donne un acteur neutre quand le contexte ne porte aucun compte', async () => {
    const identity = createIdentityGateway({ jira: createFakeJira() });

    const actor = await identity.actorOf(context({ accountId: '' }));
    expect(actor.accountId).toBe('');
    expect(actor.displayName).toBe('Utilisateur inconnu');
    expect(actor.roles).toEqual([]);
  });
});

describe('IdentityGateway - acteur agent', () => {
  it('marque agent tout appel venu de rovo:mcp', async () => {
    const jira = createFakeJira([], { displayNames: { 'user-1': 'Alice Dupont' } });
    const identity = createIdentityGateway({ jira });

    const actor = await identity.actorOf(context({ fromMcp: true, moduleId: 'mcp:proof-mcp' }));
    expect(actor.agent).toBe(true);
    expect(actor.displayName).toBe('Alice Dupont');
  });

  it('marque agent tout appel venu d une action', async () => {
    const jira = createFakeJira([], { displayNames: { 'user-1': 'Alice Dupont' } });
    const identity = createIdentityGateway({ jira });

    const actor = await identity.actorOf(context({ moduleId: 'action:attach-evidence' }));
    expect(actor.agent).toBe(true);
  });

  it('retire tout rôle à un agent : il ne peut pas attester', async () => {
    const jira = createFakeJira([], { roles: { 'user-1': ['Administrators'] } });
    const identity = createIdentityGateway({
      jira,
      rolesResolver: async () => ['Administrators'],
    });

    const actor = await identity.actorOf(context({ fromMcp: true }));
    expect(actor.agent).toBe(true);
    expect(actor.roles).toEqual([]);
  });

  it('nomme l agent même quand Jira est indisponible', async () => {
    const identity = createIdentityGateway({ jira: brokenNameJira() });

    const actor = await identity.actorOf(context({ fromMcp: true }));
    expect(actor.agent).toBe(true);
    expect(actor.displayName).toBe('Agent (user-1)');
  });
});
