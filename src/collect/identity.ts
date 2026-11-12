/**
 * Adaptateur `IdentityGateway` : contexte Forge → `Actor` (SPEC §15, §19).
 *
 * Règle capitale de sécurité (SPEC §19, R1 §2 point 5) :
 *   - Tout appel venu de `rovo:mcp`, d'un client externe MCP ou d'un module
 *     `action` est marqué avec `agent: true` ;
 *   - Un agent ne peut QUE déclarer des preuves, il ne peut jamais attester,
 *     déroger ni valider des critères (SPEC §15, §22 point 11) ;
 *   - Pour les humains, le nom affiché et les rôles projet sont résolus auprès
 *     de Jira avec délai borné et repli sûr.
 *
 * Seul `src/collect/` importe `@forge/api` (docs/CONTRACTS.md §4bis).
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { ActorContext, IdentityGateway, JiraGateway } from '../ports';
import type { Actor, Language } from '../types';
import { createJiraGateway } from './jira';
import { text as translateText } from '../i18n/index';
import { ADAPTATEURS_MESSAGES } from '../i18n/adaptateurs';

export interface IdentityGatewayOptions {
  /** Façade Jira injectée pour résoudre noms et rôles (défaut : `createJiraGateway()`). */
  jira?: JiraGateway;
  /** Détection stricte supplémentaire des modules agent. */
  isAgentModule?: (moduleId: string) => boolean;
  /** Résolveur direct de rôles pour tests ou injection spécifique. */
  rolesResolver?: (accountId: string, context: ActorContext) => Promise<string[]>;
  /** Langue préférée pour les libellés de repli (défaut : 'fr', SPEC §20). */
  language?: Language;
}

const AGENT_MODULE_PREFIXES = ['mcp', 'action', 'rovo', 'fn-'] as const;

/** Vrai si le contexte d'invocation provient d'un agent IA ou d'un outil MCP. */
export function isAgentContext(
  context: ActorContext,
  customCheck?: (moduleId: string) => boolean,
): boolean {
  if (context.fromMcp) return true;
  const raw = (context.moduleId || '').trim();
  // Le détecteur injecté voit le module tel que Forge le nomme (casse d'origine).
  if (customCheck && customCheck(raw)) return true;
  const mod = raw.toLowerCase();
  return AGENT_MODULE_PREFIXES.some((prefix) => mod.startsWith(prefix));
}

/** Nom affiché de secours quand Jira est indisponible (traduit, SPEC §20). */
export function fallbackDisplayName(
  accountId: string,
  agent: boolean,
  language: Language = 'fr',
): string {
  if (agent) {
    const key = accountId ? 'identity.agent.named' : 'identity.agent.anonymous';
    return translateText(ADAPTATEURS_MESSAGES, key, language, { accountId });
  }
  if (!accountId) {
    return translateText(ADAPTATEURS_MESSAGES, 'identity.human.fallback', language);
  }
  return accountId;
}

function buildAgentActor(accountId: string, displayName: string, language: Language): Actor {
  return {
    accountId,
    displayName: displayName || fallbackDisplayName(accountId, true, language),
    agent: true,
    roles: [],
  };
}

function buildHumanActor(
  accountId: string,
  displayName: string,
  roles: readonly string[],
  language: Language,
): Actor {
  return {
    accountId,
    displayName: displayName || fallbackDisplayName(accountId, false, language),
    agent: false,
    roles: [...roles],
  };
}

/**
 * Construit l'adaptateur `IdentityGateway`.
 * Tout appel MCP / action est garanti renvoyer `agent: true`.
 */
export function createIdentityGateway(options: IdentityGatewayOptions = {}): IdentityGateway {
  const jira = options.jira ?? createJiraGateway();
  const language: Language = options.language ?? 'fr';

  return {
    async actorOf(context: ActorContext): Promise<Actor> {
      const accountId = context.accountId || '';
      const agent = isAgentContext(context, options.isAgentModule);

      let name = '';
      if (accountId) {
        try {
          name = await jira.displayName(accountId);
        } catch {
          name = '';
        }
      }

      if (agent) {
        return buildAgentActor(accountId, name, language);
      }

      let roles: string[] = [];
      if (options.rolesResolver && accountId) {
        try {
          roles = await options.rolesResolver(accountId, context);
        } catch {
          roles = [];
        }
      }

      return buildHumanActor(accountId, name, roles, language);
    },
  };
}
