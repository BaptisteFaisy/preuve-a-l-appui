/**
 * Tests du point d'entrée dispatch.ts et de la table registry.ts (SPEC §15).
 *
 * Vérifie :
 * - refus explicite de toute tentative d'attester, de déroger, de valider ou de modifier la grille ;
 * - validation des entrées déclarées au manifest.yml (entrées manquantes) ;
 * - rejet des clés d'action inconnues avec suggestion des 7 outils légitimes ;
 * - découpage des listes au format csv (SPEC §19) ;
 * - cohérence du registre avec les 7 clés du SPEC §15.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { ACTION_KEYS, isActionKey } from '../../src/actions/registry.js';
import { splitCsv } from '../../src/actions/common.js';
import { ActionError, runAction } from '../../src/handlers/dispatch.js';
import { createMcpHarness, ISSUE_KEY } from './mcp-fixture.js';

describe('dispatch : conformité du registre et interdits majeurs', () => {
  it('contient exactement les sept clés du SPEC §15 dans l ordre', () => {
    expect(ACTION_KEYS).toEqual([
      'list-criteria',
      'get-proof-status',
      'attach-evidence',
      'propose-criteria',
      'request-attestation',
      'suggest-evidence',
      'get-release-proof',
    ]);
    for (const key of ACTION_KEYS) {
      expect(isActionKey(key)).toBe(true);
    }
  });

  it('interdit explicitement toute action qui tente d attester', async () => {
    const { deps, mcpContext } = await createMcpHarness();
    await expect(
      runAction('attest-criterion', { issueKey: ISSUE_KEY }, deps, mcpContext),
    ).rejects.toThrow(ActionError);
    await expect(
      runAction('attest', { issueKey: ISSUE_KEY }, deps, mcpContext),
    ).rejects.toThrow(/SPEC §15, §22 point 11/);
  });

  it('interdit explicitement toute action qui tente de déroger', async () => {
    const { deps, mcpContext } = await createMcpHarness();
    await expect(
      runAction('grant-waiver', { issueKey: ISSUE_KEY }, deps, mcpContext),
    ).rejects.toThrow(ActionError);
    await expect(
      runAction('waive', { issueKey: ISSUE_KEY }, deps, mcpContext),
    ).rejects.toThrow(/SPEC §15, §22 point 11/);
  });

  it('interdit explicitement toute action qui tente de valider un critère', async () => {
    const { deps, mcpContext } = await createMcpHarness();
    await expect(
      runAction('validate-criterion', { issueKey: ISSUE_KEY }, deps, mcpContext),
    ).rejects.toThrow(ActionError);
  });

  it('interdit de modifier la grille d exigences', async () => {
    const { deps, mcpContext } = await createMcpHarness();
    await expect(
      runAction('update-requirements', { issueKey: ISSUE_KEY }, deps, mcpContext),
    ).rejects.toThrow(ActionError);
  });

  it('rejette une clé d action inconnue avec message informatif', async () => {
    const { deps, mcpContext } = await createMcpHarness();
    await expect(
      runAction('non-existent-action', {}, deps, mcpContext),
    ).rejects.toThrow(/Unknown action/);
  });

  it('rejette une action sans entrée obligatoire', async () => {
    const { deps, mcpContext } = await createMcpHarness();
    await expect(
      runAction('list-criteria', {}, deps, mcpContext),
    ).rejects.toThrow(/Missing required input: issueKey/);
  });

  it('découpe les listes passées en chaîne csv en ignorant les entrées vides', () => {
    expect(splitCsv('foo, bar, , baz ')).toEqual(['foo', 'bar', 'baz']);
    expect(splitCsv('')).toEqual([]);
    expect(splitCsv(null)).toEqual([]);
  });
});
