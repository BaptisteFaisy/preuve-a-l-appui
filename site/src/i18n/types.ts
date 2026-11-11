/**
 * Contrat des textes du site : une clé, ses deux langues.
 *
 * Le site est la vitrine : il reprend le vocabulaire de l'app sans le recopier
 * depuis `src/i18n/*`, qui reste la source des messages produits par l'app
 * elle-même (validateur, gestes, outils). Ici ne vivent que les textes de
 * présentation (SPEC §20 : interface en anglais et en français).
 *
 * Fichier GÉNÉRÉ : le contrat suit le contenu de /tmp/i18ngen/gen.py.
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
    readonly recipe: string;
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
    readonly drifts: readonly { readonly title: string; readonly body: string }[];
    readonly agents: string;
  };
  readonly rule: {
    readonly title: string;
    readonly lede: string;
    readonly strengthsTitle: string;
    readonly strengths: readonly { readonly name: string; readonly meaning: string; readonly example: string }[];
    readonly typesTitle: string;
    readonly principles: readonly string[];
  };
  readonly ruleTypes: {
    readonly title: string;
    readonly lede: string;
    readonly head: readonly [string, string, string, string];
    readonly rows: readonly {
      readonly name: string;
      readonly provides: string;
      readonly strength: string;
      readonly check: string;
    }[];
    readonly note: string;
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
    readonly editCriterion: string;
    readonly criterionPrompt: string;
    readonly modes: Readonly<Record<'strict' | 'lenient' | 'observe', string>>;
  };
  readonly screens: {
    readonly title: string;
    readonly lede: string;
    readonly items: readonly { readonly name: string; readonly module: string; readonly body: string }[];
  };
  readonly agents: {
    readonly title: string;
    readonly lede: string;
    readonly forbidden: string;
    readonly toolsTitle: string;
    readonly toolsHead: readonly [string, string, string];
    readonly tools: readonly { readonly key: string; readonly verb: string; readonly returns: string }[];
    readonly questionsTitle: string;
    readonly questions: readonly string[];
  };
  readonly architecture: {
    readonly title: string;
    readonly lede: string;
    readonly flowTitle: string;
    readonly flows: readonly { readonly name: string; readonly path: string }[];
    readonly fastTitle: string;
    readonly fastBody: string;
    readonly limitsTitle: string;
    readonly limits: readonly string[];
  };
  readonly recipe: {
    readonly title: string;
    readonly lede: string;
    readonly head: readonly [string, string];
    readonly items: readonly { readonly point: string; readonly test: string }[];
    readonly howTo: string;
  };
  readonly judges: {
    readonly title: string;
    readonly lede: string;
    readonly stepsTitle: string;
    readonly steps: readonly { readonly title: string; readonly body: string }[];
    readonly ciCommandTitle: string;
    readonly ciCommand: string;
    readonly ciCommandBody: string;
    readonly linksTitle: string;
    readonly links: readonly { readonly label: string; readonly href: string }[];
  };
  readonly footer: {
    readonly built: string;
    readonly license: string;
    readonly contest: string;
    readonly source: string;
  };
  readonly langLabel: string;
}

export type { Lang };
