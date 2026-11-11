/**
 * Textes anglais du site public.
 *
 * Le site est la vitrine : il reprend le vocabulaire de l'app sans le recopier
 * depuis `src/i18n/*`, qui reste la source des messages produits par l'app
 * elle-même (validateur, gestes, outils). Ici ne vivent que les textes de
 * présentation (SPEC §20 : interface en anglais et en français).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SiteStrings } from './types.js';

export const EN: SiteStrings = {
    skipToContent: 'Skip to content',
    nav: {
      problem: 'The problem',
      rule: 'The rule',
      demo: 'Live demo',
      screens: 'Screens',
      agents: 'Agents & MCP',
      architecture: 'Architecture',
      judges: 'For the judges',
    },
    hero: {
      kicker: 'Codegeist 2026 · Apps for Software Teams · Atlassian Forge',
      title: 'Done means ',
      titleEmphasis: 'proven.',
      lede:
        'A Jira ticket only reaches “Done” when every acceptance criterion carries evidence strong ' +
        'enough. Otherwise the app names the criterion that is missing and the proof it expects — ' +
        'and it keeps watching those proofs after delivery.',
      ctaDemo: 'Try the live demo',
      ctaRepo: 'Read the source',
      statCriteria: 'criteria, versioned',
      statProofTypes: 'proof types, 3 strengths',
      statTests: 'tests, real engine',
    },
    problem: {
      title: '“Done” is a declaration',
      lede:
        'Nothing in Jira ties that declaration to what was actually asked. Three drifts follow, ' +
        'and coding agents make them cheaper than ever to produce.',
      drifts: [
        {
          title: 'The forgotten criterion',
          body: 'Four acceptance criteria, three actually handled. The fourth comes back as a bug two sprints later.',
        },
        {
          title: 'The implicit proof',
          body: '“I tested it, it works.” No trace of what was tested, by whom, on which commit.',
        },
        {
          title: 'The proof that evaporates',
          body: 'The test that proved a criterion is disabled six months later. Nobody knows the criterion is no longer guaranteed.',
        },
      ],
      agents:
        'An agent declares “done” with aplomb, and its report is plausible by construction. The reviewer ' +
        'has no time to check everything. They need one rule: no proof, no “Done”.',
    },
    rule: {
      title: 'All proofs are not equal — and the app says so',
      lede:
        'Each criterion carries a type and a minimum strength. Each proof is verified by the app, ' +
        'then ranked. A screenshot proves a file exists, not what it shows.',
      strengthsTitle: 'Three strengths',
      strengths: [
        {
          name: 'Machine-verified',
          meaning: 'the pipeline says so',
          example: 'a named test, green on a commit of the ticket branch',
        },
        { name: 'Attested', meaning: 'a third party says so', example: 'a tester clicks “I checked it”' },
        { name: 'Declared', meaning: 'somebody says so', example: 'an agent report, a screenshot, a link' },
      ],
      typesTitle: 'Six kinds of proof',
      principles: [
        'Proof attaches to a criterion, never to the ticket.',
        'The one who does the work does not attest it. An agent can only declare.',
        'A proof has a date and a commit: the code moves, the proof expires.',
        'Blocking explains: the message names the criterion and the expected proof.',
        'Proving must cost less than explaining — one gesture, not a form.',
      ],
    },
    demo: {
      title: 'Live demo: PAY-123',
      lede:
        'This page runs the app’s real decision engine, compiled to the browser — the same criteria, ' +
        'strengths, coverage, independence rules and gate message as the Forge app. Nothing is mocked, ' +
        'nothing is sent anywhere.',
      engineNote: 'Engine: src/domain/* and src/handlers/* of this repository, in memory.',
      reset: 'Reset the ticket',
      coverage: 'Proofs',
      tryDone: 'Move to Done',
      gatePassed: 'The transition passes: every criterion is proven or waived.',
      runCi: 'Run the pipeline',
      attachTest: 'Attach a test',
      attest: 'I checked it',
      attestAs: 'Attest as',
      waive: 'Waive',
      waiverReason: 'Reason',
      waiverPlaceholder: 'Deferred to PAY-140',
      mode: 'Project mode',
      actor: 'You are',
      colCriterion: 'Criterion',
      colRequired: 'Required',
      colProofs: 'Proofs',
      colState: 'State',
      noProof: 'No proof',
      log: 'What the app did',
    },
    screens: {
      title: 'Four screens inside Jira',
      lede: 'Forge UI Kit 2, rendered natively in the ticket, the board and the project settings.',
      items: [
        {
          name: 'Ticket panel',
          module: 'jira:issuePanel',
          body: 'The criteria × proofs matrix: required strength, proofs, state, and the four gestures — attach, attest, request an attestation, waive.',
        },
        {
          name: 'Coverage field',
          module: 'jira:customField',
          body: '“3 / 4”, coloured, read-only, usable in JQL and on boards. Written by the app from the same row the validator reads.',
        },
        {
          name: 'Project settings',
          module: 'jira:projectSettingsPage',
          body: 'The strength grid per criterion type, the roles that attest and waive, the gate mode, the CI key and the one-line command to copy.',
        },
        {
          name: 'Project page',
          module: 'jira:projectPage',
          body: 'Tickets in flight and their coverage, waivers with their counters, delivered criteria no longer proven, statistics.',
        },
      ],
    },
    agents: {
      title: 'Built for coding agents',
      lede:
        'Seven MCP tools and a Rovo agent let an agent ask what is missing, attach what it has, and ' +
        'request a human for the rest.',
      forbidden:
        'No tool can attest, waive or validate a criterion. Those gestures exist only in the interface, ' +
        'for a human — and anything arriving through MCP is marked “agent”, so it can only declare.',
      toolsTitle: 'The seven tools',
      questionsTitle: 'The agent answers',
      questions: [
        'What is missing to close PAY-123?',
        'Which tickets of version 2.4 were closed by waiver?',
        'Which delivered criteria are no longer proven?',
        'Draft the acceptance criteria of this ticket. (proposals, for a human to validate)',
      ],
    },
    architecture: {
      title: 'How it holds up',
      lede:
        'A pure domain, ports, and adapters. The decision path never imports @forge/*, so it is tested ' +
        'in memory — and it can run in a browser, as this page proves.',
      flowTitle: 'The paths',
      fastTitle: 'Why the validator answers in under a second',
      fastBody:
        'It computes nothing. Every write — a proof attached, a CI summary, a waiver — recomputes the ' +
        'coverage and stores it. The validator reads one row, composes the message, answers.',
      limitsTitle: 'What the app says it does not cover',
      limits: [
        'Bulk transitions, some automations and some API calls bypass the validator: a nightly control lists tickets closed without coverage.',
        'Forge models only read text: an image proves a file exists, not what it shows.',
        'A test proof is tied to a commit: a new commit makes it “to reconfirm” until the next green run.',
      ],
    },
    judges: {
      title: 'Test it in ten minutes',
      lede: 'No repository and no CI tooling required: the demo project and its ticket come preloaded.',
      stepsTitle: 'The route',
      ciCommandTitle: 'One line at the end of a pipeline',
      linksTitle: 'Read further',
    },
    footer: {
      built: 'Built for Codegeist 2026 by Baptiste Faisy, with a fleet of coding agents under contract.',
      license: 'MIT licence',
      contest: 'Codegeist 2026 · Apps for Software Teams',
    },
    langLabel: 'Français',
  };
