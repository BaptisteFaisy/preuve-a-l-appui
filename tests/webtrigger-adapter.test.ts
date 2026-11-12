/**
 * Le contrat des web triggers Forge, verrouillé : c'est lui qui a fait répondre
 * `424 Failed Dependency` aux deux web triggers avant correction, sans aucun log
 * côté app. En-têtes et paramètres multi-valués à l'entrée, en-têtes en tableaux
 * à la sortie (developer.atlassian.com/platform/forge/runtime-reference/web-trigger).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import {
  firstValue,
  flatten,
  toForgeResponse,
  toWebRequest,
} from '../src/webtrigger-adapter.js';

describe('adaptation de la requête Forge', () => {
  it('aplatit les en-têtes multi-valués en chaînes simples', () => {
    expect(firstValue(['application/json', 'autre'])).toBe('application/json');
    expect(firstValue([])).toBe('');
    expect(firstValue('texte')).toBe('texte');
    expect(firstValue(undefined)).toBe('');
    expect(flatten({ 'X-Ci-Key': ['abc'], Accept: '*/*' })).toEqual({
      'X-Ci-Key': 'abc',
      Accept: '*/*',
    });
    expect(flatten(undefined)).toEqual({});
  });

  it('lit queryParameters, et retombe sur query', () => {
    const request = toWebRequest({
      method: 'GET',
      path: '/public/x',
      queryParameters: { issueKey: ['PAY-123'], site: ['one-atlas-cndz.atlassian.net'] },
    });
    expect(request.query).toEqual({ issueKey: 'PAY-123', site: 'one-atlas-cndz.atlassian.net' });
    expect(toWebRequest({ query: { issueKey: 'PAY-9' } }).query.issueKey).toBe('PAY-9');
  });

  it('tolère les champs absents sans lever', () => {
    const request = toWebRequest({});
    expect(request).toEqual({ method: 'GET', path: '', headers: {}, body: '', query: {} });
  });

  it('conserve le corps brut, dont dépend la signature HMAC', () => {
    const body = '{"repo":"pay/paiements","tests":[]}';
    expect(toWebRequest({ method: 'POST', body }).body).toBe(body);
  });
});

describe('adaptation de la réponse Forge', () => {
  it('renvoie les en-têtes en tableaux, comme la plateforme l’exige', () => {
    const response = toForgeResponse({
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: '{}',
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers).toEqual({
      'content-type': ['application/json'],
      'access-control-allow-origin': ['*'],
    });
    expect(response.body).toBe('{}');
  });
});
