# Fait, preuve à l'appui

**Public site & live demo → <https://baptistefaisy.github.io/preuve-a-l-appui/>**
(the demo runs this repository’s real decision engine in your browser — no Jira,
no server, nothing installed)

**A ticket only reaches “Done” when every acceptance criterion carries evidence
of sufficient strength.** Otherwise the app names the missing criterion and
explains what proof it expects.

> Codegeist 2026 · category *Apps for Software Teams* · Atlassian **Forge** app
> for Jira Software · interface in English and French (SPEC §20).

## The problem

“Done” is a declaration: nothing in Jira links that declaration to what was
actually asked (SPEC §2). Three drifts follow:

1. **The forgotten criterion.** Four criteria, three implemented; the fourth
   reappears as a production bug two sprints later.
2. **The implicit proof.** “I tested it, it works.” No trace of what was
   tested, by whom, on which commit.
3. **The proof that evaporates.** A test that proved a criterion is disabled or
   removed six months later; nobody notices the guarantee is gone.

Coding agents make the problem urgent: an agent declares “done” with aplomb and
its summary is plausible by construction. Reviewers cannot verify everything
from scratch.

The app introduces one rule: **no proof, no “Done”.**

## How it works

1. Each acceptance criterion has a stable identifier (`AC-1`), a type, a
   **minimum strength of proof** and a version (SPEC §8.1).
2. Proofs come in six kinds and three strengths (SPEC §9.1):
   - **Machine-verified** — an automated test passing on the ticket branch, or a
     Confluence documentation page updated after the ticket opened;
   - **Attested** — a human third-party verification (tester, reviewer, admin;
     never the assignee, never an agent);
   - **Declared** — an agent report section, a screenshot, or a free link.
3. A **workflow validator** on the transition to “Done” reads the ticket
   coverage and blocks when a criterion falls short, naming each failing
   criterion and the expected proof (SPEC §12.1).
4. A one-line command at the end of a CI pipeline sends test names and states
   via web trigger; the app verifies test freshness and keeps watching the
   confirmed test ↔ criterion pairs after closure (**living proof**, SPEC §13).

Three project modes (SPEC §12.2): **strict** (nothing passes without full
coverage), **lenient** (minor criteria pass, flagged), and **observation**
(nothing is blocked; the app counts what it would have caught).

## Screens

| Screen | Module | Content |
|---|---|---|
| Ticket panel | `jira:issuePanel` | the criteria × proofs matrix, attach / attest / request attestation / waive |
| Coverage field | `jira:customField` | `3 / 4`, coloured, indexed for JQL queries |
| Project settings | `jira:projectSettingsPage` | strength grid, roles, gate mode, CI key and one-line command |
| Project page | `jira:projectPage` | tickets in progress, coverage, waivers, delivered criteria no longer proven |

## Agents first: MCP & Rovo

Seven MCP tools (`list-criteria`, `get-proof-status`, `attach-evidence`,
`propose-criteria`, `request-attestation`, `suggest-evidence`,
`get-release-proof`) and a Rovo agent that answers *“what is missing to close
PAY-123?”* (SPEC §15).

**No tool lets an agent attest, waive or validate a criterion**: those gestures
remain in the interface, reserved for humans (SPEC §15, §22 point 11).

## Architecture

```text
Jira ──▶ jira:workflowValidator ──▶ handler/validator ──▶ coverage row ──▶ { result, errorMessage }
CI   ──▶ webtrigger ci-results ──▶ queue proof-ci ──▶ consumer ──▶ proofs, freshness, living proof
agent──▶ rovo:mcp (7 tools)     ──▶ handler/dispatch  ──▶ pure domain ──▶ Forge SQL
```

The domain (`src/domain/`) never imports `@forge/*` (SPEC §17): everything that
touches Jira, Confluence, the LLM or SQL sits behind a port (`src/ports.ts`),
so the decision path is testable with in-memory fakes in milliseconds.

## Repository map

| Path | Content |
|---|---|
| `src/types.ts` | the frozen domain vocabulary (criteria, evidence, strength, coverage, waiver…) |
| `src/ports.ts` | interfaces between the pure domain and the Forge runtime |
| `src/domain/` | criteria, evidence, strength, requirements, coverage, gate, waivers, freshness |
| `src/db/` | Forge SQL adapters, one per table, plus the DDL (`schema.ts`) |
| `src/collect/` | the only adapters allowed to import `@forge/*` (Jira, Confluence, LLM, identity) |
| `src/handlers/` | the seven Forge entry points |
| `src/actions/` | the seven Rovo / MCP tools |
| `src/sample/` | canonical demo dataset PAY-123 (`pay-123.ts`, [README](src/sample/README.md)) |
| `tests/` | unit tests, shared harness (`tests/helpers/`), demo tests (`tests/sample/`) |
| `docs/` | specification, contract, architecture, judges' guide, video script, validation plan |

## Installation (demo site)

Full step-by-step for the judges: [docs/JUDGES.md](docs/JUDGES.md). In short:

1. Install the app on a Jira demo site (**Apps → Manage your apps → Install
   app**), or use the pre-installed demo site given in the submission form.
2. Open the demo project `PAY`: the sample ticket `PAY-123` and its dataset
   are preloaded — four acceptance criteria, coverage **2 / 4**
   ([docs/DEMO-DATA.md](docs/DEMO-DATA.md)).
3. Add the validator on the transition to *Done*: **Project settings →
   Workflows → edit the transition → Add validator → Apps → publish** (three
   clicks, new workflow editor).
4. Copy the one-line CI command from **Project settings → Proof requirements**.

## The one-line CI command

At the end of any pipeline, post the test names and states — never logs
(SPEC §10). The ready-to-copy command, with the project URL and key filled in,
is displayed in the project settings; it posts the `CiSummary` of the frozen
contract:

```bash
curl -fsS -X POST "$PROOF_CI_URL" -H "x-proof-key: $PROOF_CI_KEY" \
  -H "content-type: application/json" --data @ci-summary.json
```

## Development & CI

```bash
npm run typecheck                     # npx tsc --noEmit
npm test                              # npx vitest run
python3 tools/check-file-limits.py    # < 500 lines per file
node tools/check-function-limits.mjs  # < 50 lines per function
node tools/check-manifest.mjs         # manifest matches Forge CLI schema
```

The CI verdict fits in **5 minutes maximum** (project rule): persistent
self-hosted runners, no reinstallation when `package-lock.json` is unchanged.

## Public site

The site lives in this repository, under [`site/`](site/), and is published on
GitHub Pages by [`.github/workflows/site.yml`](.github/workflows/site.yml) on
every push to `main` that touches `site/`, `src/` or `tests/helpers/`:

- **URL**: <https://baptistefaisy.github.io/preuve-a-l-appui/>
- **Build**: Vite (no server, no tracking, no external runtime asset), output in
  `site/dist/` — never committed.
- **Local preview**: `npm run site:dev` (development) or
  `npm run site:build && npm run site:preview`.
- **Live demo**: the `#demo` section drives the real modules — `src/domain/*`,
  `src/handlers/*`, `src/viewmodel/*` — over the PAY-123 dataset
  (`src/sample/pay-123.ts`) with the in-memory fakes of `tests/helpers/`. Attach
  a test, run the pipeline, try to attest as the assignee (refused), attest as
  the tester, waive as the product owner, then attempt the transition and read
  the validator’s own message. English and French, like the app.
- **Feature map**: the `#features` section lists the 21 requirements of the
  specification (§14, FP-01…FP-21) with their priority and a link to where each
  one is visible on the page. `tests/site/features.test.ts` re-reads the
  specification table: a feature present in the SPEC and missing from the site
  fails the CI.
- **The four screens**: `#screens` renders the real view-models
  (`src/viewmodel/*`) — ticket panel, coverage field, project settings, project
  page — over the PAY-123 dataset, with no hard-coded text.
- **Advanced gestures**: below the demo, seven more buttons run the rest of the
  engine — criteria import, evidence going stale when a criterion changes,
  test ↔ criterion pairing, attestation request with its notification, release
  proof dossier, another evidence type, cross-evidence (FP-02, FP-03, FP-13,
  FP-14, FP-15, FP-17, FP-20, FP-21).

## Documentation

- [The brief](docs/CAHIER-DES-CHARGES.md) (French) — full specification (SPEC).
- [The contract](docs/CONTRACTS.md) — frozen interfaces and lot ownership.
- [The architecture](docs/ARCHITECTURE.md) — modules, data model, execution flows.
- [Conventions](docs/CONVENTIONS.md) — the rules enforced by the CI.
- [Judges' guide](docs/JUDGES.md) — test the app on a demo site in 5-10 minutes.
- [Video demo script](docs/VIDEO-SCRIPT.md) — narration and storyboard (< 5 min).
- [Demo dataset](docs/DEMO-DATA.md) — PAY-123 numbers, criteria, and outcomes.
- [Live demo](docs/LIVE-DEMO.md) — how the public site reads the real app state (contract, privacy, bootstrap).
- [Methodology](docs/METHODE.md) (French) — autonomous lots, contracts, CI 5 min, Mergify queue.
- [Validation plan](docs/VALIDATION-PLAN.md) (French) — the 6 prototype validation points of SPEC §19.

## Progress

Everything below is merged on `main` and covered by the test suite:

- the frozen contract (`src/types.ts`, `src/ports.ts`, `src/defaults.ts`) and the
  Forge manifest, checked against the published `@forge/manifest` JSON schema;
- the SQL schema (12 tables) and its row ↔ domain mapping;
- the nine feature lots: criteria, evidence and strengths, coverage and gate,
  CI intake and living proof, MCP tools and Rovo agent, the four screens,
  test ↔ criterion matching and reports, the documentation and demo dataset,
  and the Forge runtime adapters;
- the end-to-end acceptance recipe: the eleven points of SPEC §22 replayed with
  the real modules wired together (`tests/acceptance/`, see
  [docs/RECETTE.md](docs/RECETTE.md));
- the CI guards: < 500 lines per file, < 50 lines per function, manifest
  conformance, 5-minute budget.

What still needs a human, on the Atlassian side: `forge create` to register the
app and replace the placeholder `app.id`, `forge deploy` on a demo site, the
video recording (script ready in
[docs/VIDEO-SCRIPT.md](docs/VIDEO-SCRIPT.md)) and the Devpost submission.

## License

MIT.
