/**
 * Tests d'indépendance de l'attestation (SPEC §9.4, §21, §22 point 4, FP-08).
 *
 * Un comportement par test : refus de l'agent, de l'assigné (même ancien),
 * de l'auteur pour les données, hors rôle désigné pour Sécurité et Données,
 * et autorisation d'un tiers indépendant. Raisons traduites (SPEC §20).
 */
import { describe, expect, it } from 'vitest';
import { canAttest, designatedRoles } from '../../src/domain/independence.js';
import { aCriterion, anActor, anIssue, DEVELOPER, settings, TESTER } from '../helpers/builders.js';
import { createPay123Scenario } from '../helpers/scenario.js';

const fr = settings({ language: 'fr' });
const en = settings({ language: 'en' });
const issue = anIssue({ assigneeAccountId: DEVELOPER });

describe('canAttest — refus (SPEC §9.4)', () => {
  it('refuse un agent : un agent ne peut jamais attester', () => {
    const agent = anActor({ accountId: 'agent-coder', agent: true, roles: ['Developers'] });
    const verdict = canAttest(agent, issue, aCriterion(), fr);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain('agent');
  });

  it('refuse l’assigné du ticket sur ses propres critères', () => {
    const assignee = anActor({ accountId: DEVELOPER, roles: ['Developers'] });
    const verdict = canAttest(assignee, issue, aCriterion(), fr);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain('assigné');
  });

  it('refuse un ancien assigné : le travail qu’il a fait reste non attestable (SPEC §21)', () => {
    const former = anActor({ accountId: 'user-former', roles: ['Developers'] });
    const verdict = canAttest(former, issue, aCriterion(), fr, {
      formerAssignees: ['user-former'],
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain('ancien assigné');
  });

  it('refuse l’auteur du travail quand l’exigence demande un tiers (données, SPEC §9.2)', () => {
    const author = anActor({ accountId: 'user-author', roles: ['Data Lead'] });
    const dataCriterion = aCriterion({ type: 'data' });
    const verdict = canAttest(author, issue, dataCriterion, fr, {
      authorAccountId: 'user-author',
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain('auteur');
  });

  it('refuse un attestant sans le rôle désigné pour la sécurité (SPEC §9.4)', () => {
    const dev = anActor({ accountId: 'user-dev2', roles: ['Developers'] });
    const verdict = canAttest(dev, issue, aCriterion({ type: 'security' }), fr);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain('Security Reviewer');
  });

  it('refuse un attestant hors rôle désigné pour les données (SPEC §9.4)', () => {
    const dev = anActor({ accountId: 'user-dev2', roles: ['Developers'] });
    const verdict = canAttest(dev, issue, aCriterion({ type: 'data' }), fr);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain('Data Lead');
  });

  it('refuse un acteur sans aucun rôle habilité à attester dans le projet (SPEC §16.3)', () => {
    const guest = anActor({ accountId: 'user-guest', roles: ['Viewers'] });
    const verdict = canAttest(guest, issue, aCriterion(), fr);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain('pas le droit');
  });

  it('traduit le refus en anglais quand le projet est en anglais (SPEC §20)', () => {
    const agent = anActor({ accountId: 'agent-coder', agent: true, roles: [] });
    const verdict = canAttest(agent, issue, aCriterion(), en);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe('An agent cannot attest (declaration only)');
  });
});

describe('canAttest — autorisations (SPEC §22 point 4)', () => {
  it('autorise un tiers indépendant membre du projet', () => {
    const tester = anActor({ accountId: TESTER, roles: ['Developers'] });
    const verdict = canAttest(tester, issue, aCriterion(), fr);
    expect(verdict.allowed).toBe(true);
  });

  it('autorise le rôle désigné pour la sécurité', () => {
    const sec = anActor({ accountId: 'user-sec', roles: ['Developers', 'Security Reviewer'] });
    const verdict = canAttest(sec, issue, aCriterion({ type: 'security' }), fr);
    expect(verdict.allowed).toBe(true);
  });

  it('autorise un tiers non auteur pour les données', () => {
    const lead = anActor({ accountId: 'user-data', roles: ['Data Lead'] });
    const verdict = canAttest(lead, issue, aCriterion({ type: 'data' }), fr, {
      authorAccountId: DEVELOPER,
    });
    expect(verdict.allowed).toBe(true);
  });

  it('rejoue le scénario PAY-123 : la testeuse atteste AC-3, l’assignée non (§7.3)', async () => {
    const scenario = await createPay123Scenario();
    const ac3 = scenario.criteria[2];
    const tester = canAttest(scenario.actors.tester, scenario.issue, ac3, scenario.project);
    const assignee = canAttest(scenario.actors.developer, scenario.issue, ac3, scenario.project);
    const agent = canAttest(scenario.actors.agent, scenario.issue, ac3, scenario.project);
    expect(tester.allowed).toBe(true);
    expect(assignee.allowed).toBe(false);
    expect(agent.allowed).toBe(false);
  });
});

describe('designatedRoles — lecture des rôles désignés (SPEC §9.4)', () => {
  it('sécurité : les rôles security du projet', () => {
    expect(designatedRoles(fr, aCriterion({ type: 'security' }))).toEqual([
      'Security Reviewer',
      'Administrators',
    ]);
  });

  it('données : les rôles data du projet', () => {
    expect(designatedRoles(fr, aCriterion({ type: 'data' }))).toEqual(['Data Lead', 'Administrators']);
  });

  it('autres types : aucun rôle désigné', () => {
    expect(designatedRoles(fr, aCriterion({ type: 'functional' }))).toEqual([]);
    expect(designatedRoles(fr, aCriterion({ type: 'regression' }))).toEqual([]);
  });
});
