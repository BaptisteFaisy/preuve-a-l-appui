/**
 * Textes anglais du site public.
 *
 * Le site est la vitrine : il reprend le vocabulaire de l'app sans le recopier
 * depuis `src/i18n/*`, qui reste la source des messages produits par l'app
 * elle-même (validateur, gestes, outils). Ici ne vivent que les textes de
 * présentation (SPEC §20 : interface en anglais et en français).
 *
 * Fichier GÉNÉRÉ par /tmp/i18ngen/gen.py — modifier le générateur, pas ce fichier.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { SiteStrings } from './types.js';

export const EN: SiteStrings = {
  skipToContent: "Skip to content",
  nav: {
    problem: "The problem",
    rule: "The rule",
    demo: "Live demo",
    screens: "Screens",
    agents: "Agents & MCP",
    architecture: "Architecture",
    recipe: "The recipe",
    judges: "For the judges",
  },
  hero: {
    kicker: "Codegeist 2026 · Apps for Software Teams · Atlassian Forge",
    title: "Done means ",
    titleEmphasis: "proven.",
    lede: "A Jira ticket only reaches “Done” when every acceptance criterion carries evidence strong enough. Otherwise the app names the criterion that is missing and the proof it expects — and it keeps watching those proofs after delivery.",
    ctaDemo: "Try the live demo",
    ctaRepo: "Read the source",
    statCriteria: "criteria, versioned",
    statProofTypes: "proof types, 3 strengths",
    statTests: "acceptance points, replayed on every commit",
  },
  problem: {
    title: "“Done” is a declaration",
    lede: "Nothing in Jira ties that declaration to what was actually asked. Three drifts follow, and coding agents make them cheaper than ever to produce.",
    drifts: [
      {
        title: "The forgotten criterion",
        body: "Four acceptance criteria, three actually handled. The fourth comes back as a bug two sprints later.",
      },
      {
        title: "The implicit proof",
        body: "“I tested it, it works.” No trace of what was tested, by whom, on which commit.",
      },
      {
        title: "The proof that evaporates",
        body: "The test that proved a criterion is disabled six months later. Nobody knows the criterion is no longer guaranteed.",
      },
    ],
    agents: "An agent declares “done” with aplomb, and its report is plausible by construction. The reviewer has no time to check everything. They need one rule: no proof, no “Done”.",
  },
  rule: {
    title: "All proofs are not equal — and the app says so",
    lede: "Each criterion carries a type and a minimum strength. Each proof is verified by the app, then ranked. A screenshot proves a file exists, not what it shows.",
    strengthsTitle: "Three strengths",
    strengths: [
      {
        name: "Machine-verified",
        meaning: "the pipeline says so",
        example: "a named test, green on a commit of the ticket branch",
      },
      {
        name: "Attested",
        meaning: "a third party says so",
        example: "a tester clicks “I checked it”",
      },
      {
        name: "Declared",
        meaning: "somebody says so",
        example: "an agent report, a screenshot, a link",
      },
    ],
    typesTitle: "Six kinds of proof",
    principlesTitle: "The five principles",
    principles: [
      "Proof attaches to a criterion, never to the ticket.",
      "The one who does the work does not attest it. An agent can only declare.",
      "A proof has a date and a commit: the code moves, the proof expires.",
      "Blocking explains: the message names the criterion and the expected proof.",
      "Proving must cost less than explaining — one gesture, not a form.",
    ],
  },
  ruleTypes: {
    title: "Six kinds of proof, checked by the app",
    lede: "A proof is not what its author says it is: the app verifies what it can and ranks the rest. A screenshot accompanied by an attestation takes the strength of the attestation.",
    head: ["Type", "What you provide", "Strength", "What the app verifies"],
    rows: [
      {
        name: "Automated test",
        provides: "The full name of the test",
        strength: "Machine-verified",
        check: "The test is in the CI results, it passes, on a commit of the ticket branch",
      },
      {
        name: "Documentation page",
        provides: "A link to a Confluence page",
        strength: "Machine-verified",
        check: "The page exists and was modified after the ticket started",
      },
      {
        name: "Attestation",
        provides: "One click “I checked it”, optional note and attachment",
        strength: "Attested",
        check: "The attester is neither the assignee nor an agent",
      },
      {
        name: "Screenshot or video",
        provides: "A ticket attachment or a link",
        strength: "Declared",
        check: "The attachment exists",
      },
      {
        name: "Agent report",
        provides: "A section of the report",
        strength: "Declared",
        check: "The section exists and quotes the criterion",
      },
      {
        name: "Free link",
        provides: "A dashboard, a commit, a pull request",
        strength: "Declared",
        check: "The link is reachable when the app can check it",
      },
    ],
    note: "The app never “reads” a screenshot: the models available in Forge only handle text. An image proves a file exists, not what it shows — which is why its strength stays “declared” until a third party attests it.",
  },
  demo: {
    title: "Live demo: PAY-123",
    lede: "This page runs the app’s real decision engine, compiled to the browser — the same criteria, strengths, coverage, independence rules and gate message as the Forge app. Nothing is faked, nothing is sent anywhere.",
    engineNote: "Engine: src/domain/* and src/handlers/* of this repository, running in memory.",
    reset: "Reset the ticket",
    coverage: "Proofs",
    tryDone: "Move to Done",
    gatePassed: "The transition passes: every criterion is proven or waived.",
    runCi: "Run the pipeline",
    attachTest: "Attach a test",
    attest: "I checked it",
    attestAs: "Acting as",
    waive: "Waive",
    waiverReason: "Reason",
    waiverPlaceholder: "Deferred to PAY-140",
    mode: "Project mode",
    actor: "You are",
    colCriterion: "Criterion",
    colRequired: "Required",
    colProofs: "Proofs",
    colState: "State",
    noProof: "No proof",
    log: "What the app did",
    editCriterion: "Edit the text",
    criterionPrompt: "New text for this criterion:",
    modes: {
      strict: "Strict",
      lenient: "Lenient",
      observe: "Observation",
    },
  },
  screens: {
    title: "Four screens inside Jira",
    lede: "Forge UI Kit 2, rendered natively in the ticket, the board and the project settings.",
    items: [
      {
        name: "Ticket panel",
        module: "jira:issuePanel",
        body: "The criteria × proofs matrix: required strength, proofs, state, and the four gestures — attach, attest, request an attestation, waive.",
      },
      {
        name: "Coverage field",
        module: "jira:customField",
        body: "“3 / 4”, coloured, read-only, usable in JQL and on boards. Written by the app from the same row the validator reads.",
      },
      {
        name: "Project settings",
        module: "jira:projectSettingsPage",
        body: "The strength grid per criterion type, the roles that attest and waive, the gate mode, the CI key and the one-line command to copy.",
      },
      {
        name: "Project page",
        module: "jira:projectPage",
        body: "Tickets in flight and their coverage, waivers with their counters, delivered criteria no longer proven, statistics.",
      },
    ],
  },
  agents: {
    title: "Built for coding agents",
    lede: "Seven MCP tools and a Rovo agent let an agent ask what is missing, attach what it has, and request a human for the rest.",
    forbidden: "No tool can attest, waive or validate a criterion. Those gestures exist only in the interface, for a human — and anything arriving through MCP is marked “agent”, so it can only declare.",
    toolsTitle: "The seven tools",
    toolsHead: ["Tool", "Verb", "Returns"],
    tools: [
      {
        key: "list-criteria",
        verb: "GET",
        returns: "Criteria, type, required strength, state",
      },
      {
        key: "get-proof-status",
        verb: "GET",
        returns: "Coverage, failing criteria, the proof expected for each",
      },
      {
        key: "attach-evidence",
        verb: "CREATE",
        returns: "The recorded proof and the strength it obtained",
      },
      {
        key: "propose-criteria",
        verb: "CREATE",
        returns: "Proposals waiting for a human to validate",
      },
      {
        key: "request-attestation",
        verb: "CREATE",
        returns: "A request sent to the competent role",
      },
      {
        key: "suggest-evidence",
        verb: "GET",
        returns: "Suggested pairs with a confidence and a reason",
      },
      {
        key: "get-release-proof",
        verb: "GET",
        returns: "Coverage of a version, and its waivers",
      },
    ],
    questionsTitle: "The agent answers",
    questions: [
      "What is missing to close PAY-123?",
      "Which tickets of version 2.4 were closed by waiver?",
      "Which delivered criteria are no longer proven?",
      "Draft the acceptance criteria of this ticket. (proposals, for a human to validate)",
    ],
  },
  architecture: {
    title: "How it holds up",
    lede: "A pure domain, ports, and adapters. The decision path never imports @forge/*, so it is tested in memory — and it can run in a browser, as this page proves.",
    flowTitle: "The three paths",
    flows: [
      {
        name: "Transition to “Done”",
        path: "jira:workflowValidator → handlers/validator → the coverage row → { result, errorMessage }",
      },
      {
        name: "End of pipeline",
        path: "webtrigger ci-results → queue proof-ci → consumer → proofs, freshness, coverage, living proof",
      },
      {
        name: "Agent or human",
        path: "rovo:mcp (7 tools) → handlers/dispatch → pure domain → Forge SQL",
      },
    ],
    fastTitle: "Why the validator answers in under a second",
    fastBody: "It computes nothing. Every write — a proof attached, a CI summary, a waiver — recomputes the coverage and stores it. The validator reads one row, composes the message, answers.",
    limitsTitle: "What the app says it does not cover",
    limits: [
      "Bulk transitions, some automations and some API calls bypass the validator: a nightly control lists tickets closed without coverage.",
      "Forge models only read text: an image proves a file exists, not what it shows.",
      "A test proof is tied to a commit: a new commit makes it “to reconfirm” until the next green run.",
    ],
  },
  recipe: {
    title: "The acceptance recipe, replayed on every commit",
    lede: "Eleven points from the specification, each replayed end to end with the real modules wired together — not with mocks of themselves. The demo above runs the same engine.",
    head: ["Point", "Test that proves it"],
    items: [
      {
        point: "A ticket with four criteria, one without proof, cannot move to Done; the message names that criterion.",
        test: "tests/acceptance/recette-01",
      },
      {
        point: "A test attached, present and green in the branch CI results, gives a machine-verified proof.",
        test: "tests/acceptance/recette-02",
      },
      {
        point: "The same test, absent or failing, gives no valid proof.",
        test: "tests/acceptance/recette-02",
      },
      {
        point: "The assignee cannot attest; another project member can.",
        test: "tests/acceptance/recette-03",
      },
      {
        point: "A proof declared by an agent does not satisfy a criterion that requires an attestation.",
        test: "tests/acceptance/recette-03",
      },
      {
        point: "A motivated waiver on the missing criterion unlocks the transition and appears in the dossier.",
        test: "tests/acceptance/recette-04",
      },
      {
        point: "Changing the text of a criterion puts its proofs “to review”.",
        test: "tests/acceptance/recette-05",
      },
      {
        point: "A new commit after a test proof makes it “to reconfirm” until the next green run.",
        test: "tests/acceptance/recette-05",
      },
      {
        point: "In observation mode the transition passes and the avoided block is counted.",
        test: "tests/acceptance/recette-04",
      },
      {
        point: "get-proof-status returns exactly the same failing criteria as the validator message.",
        test: "tests/acceptance/recette-01",
      },
      {
        point: "No MCP tool can attest or waive.",
        test: "tests/acceptance/recette-06",
      },
    ],
    howTo: "Replay them: npx vitest run tests/acceptance",
  },
  judges: {
    title: "Test it in ten minutes",
    lede: "No repository and no CI tooling required: the demo project and its ticket come preloaded.",
    stepsTitle: "The route",
    steps: [
      {
        title: "Install the app on the demo site",
        body: "Apps → Manage your apps → Install app. Open the demo project PAY: dataset PAY-123 preloaded, coverage 2 / 4.",
      },
      {
        title: "Put the validator on the transition to Done",
        body: "Project settings → Workflows → edit the transition → Add validator → Apps → “Fait, preuve à l’appui” → Publish.",
      },
      {
        title: "Try to close the ticket",
        body: "Jira refuses and names the two failing criteria: AC-3 (an attestation is expected, a declaration was received) and AC-4 (no proof).",
      },
      {
        title: "Attest, waive, close",
        body: "The tester clicks “I checked it” on AC-3; the product owner waives AC-4 with the reason “deferred to PAY-140”. The transition passes.",
      },
      {
        title: "Send a CI summary, ask the agent",
        body: "One curl at the end of a pipeline turns the two tests into machine-verified proofs. Then ask the Rovo agent what is still missing.",
      },
    ],
    ciCommandTitle: "One line at the end of a pipeline",
    ciCommand: "curl -fsS -X POST \"$PROOF_CI_URL\" -H \"x-ci-key: $PROOF_CI_KEY\" \\\n  -H \"x-ci-timestamp: $(date +%s)\" -H \"x-ci-signature: $SIGNATURE\" \\\n  --data '{\"repo\":\"pay/paiements\",\"branch\":\"feature/PAY-123-refusal-email\",\n           \"commit\":\"e41f0c9a\",\"tests\":[{\"name\":\"checkout refuses an expired card\",\"state\":\"passed\"}]}'",
    ciCommandBody: "Names and states only — no code, no log. Beyond 5 MB the summary is split into batches.",
    linksTitle: "Read further",
    links: [
      {
        label: "Judges’ guide (docs/JUDGES.md)",
        href: "https://github.com/BaptisteFaisy/preuve-a-l-appui/blob/main/docs/JUDGES.md",
      },
      {
        label: "The acceptance recipe (docs/RECETTE.md)",
        href: "https://github.com/BaptisteFaisy/preuve-a-l-appui/blob/main/docs/RECETTE.md",
      },
      {
        label: "Architecture (docs/ARCHITECTURE.md)",
        href: "https://github.com/BaptisteFaisy/preuve-a-l-appui/blob/main/docs/ARCHITECTURE.md",
      },
      {
        label: "The full brief, in French",
        href: "https://github.com/BaptisteFaisy/preuve-a-l-appui/blob/main/docs/CAHIER-DES-CHARGES.md",
      },
      {
        label: "Video script (docs/VIDEO-SCRIPT.md)",
        href: "https://github.com/BaptisteFaisy/preuve-a-l-appui/blob/main/docs/VIDEO-SCRIPT.md",
      },
      {
        label: "Source code",
        href: "https://github.com/BaptisteFaisy/preuve-a-l-appui",
      },
    ],
  },
  footer: {
    built: "Built for Codegeist 2026 by Baptiste Faisy, with a fleet of coding agents under contract.",
    license: "MIT licence",
    contest: "Codegeist 2026 · Apps for Software Teams",
    source: "Source and documentation",
  },
  langLabel: "Français",
};
