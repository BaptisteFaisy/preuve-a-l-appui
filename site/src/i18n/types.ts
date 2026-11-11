/**
 * Contrat des textes du site : une clé, ses deux langues.
 *
 * Le site est la vitrine : il reprend le vocabulaire de l'app sans le recopier
 * depuis `src/i18n/*`, qui reste la source des messages produits par l'app
 * elle-même (validateur, gestes, outils). Ici ne vivent que les textes de
 * présentation (SPEC §20 : interface en anglais et en français).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Lang } from './index.js';

export interface SiteStrings {
  readonly skipToContent: string;
  readonly nav: {
    readonly problem: string;
    readonly rule: string;
    readonly demo: string;
    readonly screens: string;
    readonly agents: string;
    readonly architecture: string;
    readonly judges: string;
  };
  readonly hero: {
    readonly kicker: string;
    readonly title: string;
    readonly titleEmphasis: string;
    readonly lede: string;
    readonly ctaDemo: string;
    readonly ctaRepo: string;
    readonly statCriteria: string;
    readonly statProofTypes: string;
    readonly statTests: string;
  };
  readonly problem: {
    readonly title: string;
    readonly lede: string;
    readonly drifts: readonly { title: string; body: string }[];
    readonly agents: string;
  };
  readonly rule: {
    readonly title: string;
    readonly lede: string;
    readonly strengthsTitle: string;
    readonly strengths: readonly { name: string; meaning: string; example: string }[];
    readonly typesTitle: string;
    readonly principles: readonly string[];
  };
  readonly demo: {
    readonly title: string;
    readonly lede: string;
    readonly engineNote: string;
    readonly reset: string;
    readonly coverage: string;
    readonly tryDone: string;
    readonly gatePassed: string;
    readonly runCi: string;
    readonly attachTest: string;
    readonly attest: string;
    readonly attestAs: string;
    readonly waive: string;
    readonly waiverReason: string;
    readonly waiverPlaceholder: string;
    readonly mode: string;
    readonly actor: string;
    readonly colCriterion: string;
    readonly colRequired: string;
    readonly colProofs: string;
    readonly colState: string;
    readonly noProof: string;
    readonly log: string;
  };
  readonly screens: {
    readonly title: string;
    readonly lede: string;
    readonly items: readonly { name: string; module: string; body: string }[];
  };
  readonly agents: {
    readonly title: string;
    readonly lede: string;
    readonly forbidden: string;
    readonly toolsTitle: string;
    readonly questionsTitle: string;
    readonly questions: readonly string[];
  };
  readonly architecture: {
    readonly title: string;
    readonly lede: string;
    readonly flowTitle: string;
    readonly fastTitle: string;
    readonly fastBody: string;
    readonly limitsTitle: string;
    readonly limits: readonly string[];
  };
  readonly judges: {
    readonly title: string;
    readonly lede: string;
    readonly stepsTitle: string;
    readonly ciCommandTitle: string;
    readonly linksTitle: string;
  };
  readonly footer: {
    readonly built: string;
    readonly license: string;
    readonly contest: string;
  };
  readonly langLabel: string;
}

export type { Lang };
