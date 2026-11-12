/**
 * The 21 features in English (specification §14, FP-01…FP-21).
 *
 * Titles and descriptions restate the specification faithfully, readable out
 * of context. `where` is the relative anchor of the section where the feature
 * is visible: the demo (#demo) runs the real engine, the mockups (#screens)
 * render the real screens, #agents lists the MCP tools.
 *
 * Rule: files under 500 lines, functions under 50 lines.
 */
import type { FeatureEntry } from './features.js';

export const FEATURES_EN: readonly FeatureEntry[] = [
  {
    code: 'FP-01',
    priority: 'M',
    title: 'Structured criteria per ticket',
    description:
      'Every ticket carries acceptance criteria with a stable code (AC-1, AC-2…) and a version number: what was required, and when, is never lost.',
    where: '#demo',
  },
  {
    code: 'FP-02',
    priority: 'M',
    title: 'Import from the description',
    description:
      'The app recognises criteria already written in the description (checkboxes, an “Acceptance criteria” list) and proposes them; a human validates. Nothing is created on its own.',
    where: '#demo',
  },
  {
    code: 'FP-03',
    priority: 'M',
    title: 'Six evidence types',
    description:
      'Automated test, documentation, attestation, attachment, agent report, link: each type has a strength computed by the app, never declared by whoever attaches it.',
    where: '#demo',
  },
  {
    code: 'FP-04',
    priority: 'M',
    title: 'Evidence strength and coverage',
    description:
      'The strength of every piece of evidence is computed, then rolled up into one coverage row per ticket — the single row the validator, the field and the agent all read.',
    where: '#demo',
  },
  {
    code: 'FP-05',
    priority: 'M',
    title: 'Requirements per type and per project',
    description:
      'The required-strength grid is set per criterion type and per project, on top of a shared floor: the project picks its level, the app does not impose one.',
    where: '#screens',
  },
  {
    code: 'FP-06',
    priority: 'M',
    title: 'Verified CI summary',
    description:
      'One line at the end of a pipeline is enough: the app checks the named tests, the commit and the branch, then updates the test evidence.',
    where: '#demo',
  },
  {
    code: 'FP-07',
    priority: 'M',
    title: 'Blocking the “Done” transition',
    description:
      'The workflow validator refuses the transition and names each failing criterion, with the proof it expects for it.',
    where: '#demo',
  },
  {
    code: 'FP-08',
    priority: 'M',
    title: 'Independent attestation',
    description:
      'Neither the assignee nor an agent may attest: anything arriving over MCP is flagged “agent” and can only declare.',
    where: '#demo',
  },
  {
    code: 'FP-09',
    priority: 'M',
    title: 'Motivated waivers',
    description:
      'A waiver is requested criterion by criterion, with a mandatory reason, an allowed role, an expiry and a possible revocation.',
    where: '#demo',
  },
  {
    code: 'FP-10',
    priority: 'M',
    title: 'Criteria × evidence matrix',
    description:
      'The ticket panel shows the requirement, the evidence, the state — and only the gestures the person looking at it is actually allowed to make.',
    where: '#screens',
  },
  {
    code: 'FP-11',
    priority: 'M',
    title: 'MCP tools and Rovo agent',
    description:
      'Seven MCP tools and a Rovo agent: the agent asks what is missing, attaches what it has, and asks a human for the rest — it never attests.',
    where: '#agents',
  },
  {
    code: 'FP-12',
    priority: 'M',
    title: 'Strict, lenient and observe modes',
    description:
      'Strict (block), lenient (let criteria flagged minor through, and say so), observe (measure without blocking): you can roll out without breaking teams.',
    where: '#demo',
  },
  {
    code: 'FP-13',
    priority: 'S',
    title: 'Evidence goes stale',
    description:
      'A changed criterion or a new commit turns earlier evidence “to reconfirm”: goalposts do not move silently.',
    where: '#demo',
  },
  {
    code: 'FP-14',
    priority: 'S',
    title: 'Test ↔ criterion pairs',
    description:
      'The app proposes pairings between tests and criteria, with a confidence and a justification; a human confirms or rejects them.',
    where: '#demo',
  },
  {
    code: 'FP-15',
    priority: 'S',
    title: 'Notified attestation request',
    description:
      'When an attestation is missing, the app asks the competent role and notifies the person: proof keeps moving instead of waiting.',
    where: '#demo',
  },
  {
    code: 'FP-16',
    priority: 'S',
    title: '“Proofs n / m” field',
    description:
      'A coloured ticket field, readable on the board and usable in JQL, written from the same row the validator reads.',
    where: '#screens',
  },
  {
    code: 'FP-17',
    priority: 'S',
    title: 'Release proof dossier',
    description:
      'A frozen snapshot per release: every criterion, its proof, its attestor, its commit, its waivers — exported as Markdown, ready to paste into Confluence.',
    where: '#demo',
  },
  {
    code: 'FP-18',
    priority: 'S',
    title: 'Proof statistics',
    description:
      'Coverage by strength, waivers by granter, reopening rates by proof strength: the quality of “Done” becomes measurable.',
    where: '#screens',
  },
  {
    code: 'FP-19',
    priority: 'C',
    title: 'Living proof after closure',
    description:
      'The tests behind delivered criteria keep being watched on the main branch: a test that disappears or fails comes back as a regression.',
    where: '#screens',
  },
  {
    code: 'FP-20',
    priority: 'C',
    title: 'Proof before code',
    description:
      'The test intended for a criterion is recorded before the code exists: the intent is dated, therefore checkable, and its changes stay visible.',
    where: '#demo',
  },
  {
    code: 'FP-21',
    priority: 'C',
    title: 'Cross-evidence',
    description:
      'For critical criteria the grid can require several distinct evidence types: one piece of evidence, however strong, is not enough.',
    where: '#demo',
  },
];
