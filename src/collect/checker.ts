/**
 * Adaptateur `EvidenceChecker` : vérifications hors Jira (SPEC §9.1).
 *
 * Quatre preuves vérifiées directement par l'application :
 *   1. page Confluence : la page existe et a été modifiée après `since` ;
 *   2. pièce jointe : le fichier figure parmi les pièces du ticket Jira ;
 *   3. compte rendu d'agent : le compte rendu existe et cite le critère ;
 *   4. lien joignable : `HEAD`/`GET` HTTP si l'app a le droit de vérifier ;
 *      un échec réseau ou un délai ne fait jamais planter l'app.
 *
 * Seul `src/collect/` importe `@forge/api` (docs/CONTRACTS.md §4bis).
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { route } from '@forge/api';
import type { Route } from '@forge/api';
import type { EvidenceChecker } from '../ports';
import {
  DEFAULT_TIMEOUT_MS,
  defaultConfluenceRequest,
  defaultExternalFetch,
  defaultJiraRequest,
  jsonInit,
  readJsonOrNull,
  readTextOrNull,
  withTimeout,
  type ExternalFetch,
  type HttpResponse,
  type ProductRequest,
} from './http';

export interface EvidenceCheckerOptions {
  /** Transport Confluence injecté (défaut : `api.asApp().requestConfluence`). */
  requestConfluence?: ProductRequest;
  /** Transport Jira injecté pour vérifier les pièces jointes (défaut : `asApp()`). */
  requestJira?: ProductRequest;
  /** Transport HTTP externe injecté pour les liens libres (défaut : `api.fetch`). */
  fetch?: ExternalFetch;
  /** Délai maximal d'une vérification en millisecondes. */
  timeoutMs?: number;
}

/* ------------------------------------------------------------- Confluence */

interface ConfluencePagePayload {
  id?: string;
  version?: { createdAt?: string; number?: number };
  history?: { lastUpdated?: string; createdDate?: string };
}

/** Extrait l'identifiant de page Confluence d'une URL (/pages/12345 ou ?pageId=12345). */
export function extractConfluencePageId(url: string): string | null {
  const match = /\/pages\/(\d+)/.exec(url) ?? /[?&]pageId=(\d+)/.exec(url);
  return match && match[1] ? match[1] : null;
}

/** Date de dernière modification d'une page Confluence (ISO). */
export function pageModifiedAt(payload: ConfluencePagePayload | null): string | null {
  if (!payload) return null;
  return (
    payload.version?.createdAt ??
    payload.history?.lastUpdated ??
    payload.history?.createdDate ??
    null
  );
}

/* ----------------------------------------------------------------- Jira */

interface JiraAttachment {
  id?: string;
  filename?: string;
  content?: string;
}

interface JiraAttachmentsPayload {
  fields?: {
    attachment?: JiraAttachment[];
    comment?: { comments?: { id?: string; body?: unknown }[] };
  };
}

function matchesAttachment(att: JiraAttachment, reference: string): boolean {
  if (!reference) return false;
  const target = reference.trim().toLowerCase();
  const idMatch = att.id ? att.id.toLowerCase() === target : false;
  const nameMatch = att.filename ? att.filename.toLowerCase() === target : false;
  const baseMatch = att.filename ? target.endsWith(att.filename.toLowerCase()) : false;
  return idMatch || nameMatch || baseMatch;
}

/* ---------------------------------------------------------------- helpers */

async function fetchJsonSafely<T>(
  request: ProductRequest,
  target: Route,
  timeoutMs: number,
): Promise<T | null> {
  try {
    const response = await withTimeout<HttpResponse | null>(
      (signal) => request(target, { ...jsonInit('GET'), signal }).catch(() => null),
      timeoutMs,
    );
    return readJsonOrNull<T>(response);
  } catch {
    return null;
  }
}

async function checkConfluencePage(
  request: ProductRequest,
  url: string,
  since: string,
  timeoutMs: number,
): Promise<boolean> {
  const id = extractConfluencePageId(url);
  if (!id) return false;
  const payload = await fetchJsonSafely<ConfluencePagePayload>(
    request,
    route`/wiki/api/v2/pages/${id}`,
    timeoutMs,
  );
  if (!payload) return false;
  if (!since) return true;
  const modified = pageModifiedAt(payload);
  if (!modified) return false;
  return modified >= since;
}

async function checkAttachmentExists(
  request: ProductRequest,
  issueId: string,
  reference: string,
  timeoutMs: number,
): Promise<boolean> {
  if (!issueId || !reference) return false;
  const payload = await fetchJsonSafely<JiraAttachmentsPayload>(
    request,
    route`/rest/api/3/issue/${issueId}?fields=attachment`,
    timeoutMs,
  );
  const attachments = payload?.fields?.attachment;
  if (!Array.isArray(attachments)) return false;
  return attachments.some((att) => matchesAttachment(att, reference));
}

function textQuotesCriterion(body: unknown, criterionCode: string): boolean {
  if (!body || !criterionCode) return false;
  const hay = typeof body === 'string' ? body : JSON.stringify(body);
  const pattern = new RegExp(`\\b${criterionCode.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
  return pattern.test(hay);
}

async function checkReportSection(
  request: ProductRequest,
  issueId: string,
  reference: string,
  criterionCode: string,
  timeoutMs: number,
): Promise<boolean> {
  if (!issueId || !criterionCode) return false;
  const payload = await fetchJsonSafely<JiraAttachmentsPayload>(
    request,
    route`/rest/api/3/issue/${issueId}?fields=attachment,comment`,
    timeoutMs,
  );
  if (!payload?.fields) return false;
  const attachments = payload.fields.attachment ?? [];
  const foundAtt = attachments.find((att) => matchesAttachment(att, reference));
  if (foundAtt?.content) {
    try {
      const response = await withTimeout<HttpResponse | null>(
        (signal) =>
          request(
            route`/rest/api/3/attachment/content/${foundAtt.id ?? ''}`,
            { ...jsonInit('GET'), signal },
          ).catch(() => null),
        timeoutMs,
      );
      const text = await readTextOrNull(response);
      if (text && textQuotesCriterion(text, criterionCode)) return true;
    } catch {
      // Échec de lecture du contenu : repli sur le nom de fichier ou commentaire.
    }
    if (textQuotesCriterion(foundAtt.filename, criterionCode)) return true;
  }
  const comments = payload.fields.comment?.comments ?? [];
  return comments.some((comment) => {
    const bodyText = typeof comment.body === 'string' ? comment.body : JSON.stringify(comment.body ?? '');
    const mentionsRef = !reference || bodyText.toLowerCase().includes(reference.toLowerCase());
    return mentionsRef && textQuotesCriterion(bodyText, criterionCode);
  });
}

const SAFE_HTTP_URL = /^https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+$/;

async function checkLinkReachable(
  fetchFn: ExternalFetch,
  url: string,
  timeoutMs: number,
): Promise<boolean> {
  if (!url || !SAFE_HTTP_URL.test(url.trim())) return false;
  try {
    const headResponse = await withTimeout<HttpResponse | null>(
      (signal) => fetchFn(url, { method: 'HEAD', signal }).catch(() => null),
      timeoutMs,
    );
    if (headResponse && (headResponse.ok || (headResponse.status >= 200 && headResponse.status < 400))) {
      return true;
    }
    const getResponse = await withTimeout<HttpResponse | null>(
      (signal) => fetchFn(url, { method: 'GET', signal }).catch(() => null),
      timeoutMs,
    );
    return Boolean(getResponse && (getResponse.ok || (getResponse.status >= 200 && getResponse.status < 400)));
  } catch {
    // Un échec réseau n'est pas une preuve fausse : non joignable = false sans crash.
    return false;
  }
}

/* ----------------------------------------------------------- fabrique */

/**
 * Construit l'adaptateur `EvidenceChecker`.
 * Sans option : utilise les transports par défaut Forge (`asApp()`).
 */
export function createEvidenceChecker(options: EvidenceCheckerOptions = {}): EvidenceChecker {
  const reqConf = options.requestConfluence ?? defaultConfluenceRequest();
  const reqJira = options.requestJira ?? defaultJiraRequest();
  const fetchFn = options.fetch ?? defaultExternalFetch();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async documentationPage(url: string, since: string): Promise<boolean> {
      return checkConfluencePage(reqConf, url, since, timeoutMs);
    },

    async attachmentExists(issueId: string, reference: string): Promise<boolean> {
      return checkAttachmentExists(reqJira, issueId, reference, timeoutMs);
    },

    async reportSection(
      issueId: string,
      reference: string,
      criterionCode: string,
    ): Promise<boolean> {
      return checkReportSection(reqJira, issueId, reference, criterionCode, timeoutMs);
    },

    async linkReachable(url: string): Promise<boolean> {
      return checkLinkReachable(fetchFn, url, timeoutMs);
    },
  };
}
