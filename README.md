# Fait, preuve à l'appui

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

## Documentation

- [The brief](docs/CAHIER-DES-CHARGES.md) (French) — full specification (SPEC).
- [The contract](docs/CONTRACTS.md) — frozen interfaces and lot ownership.
- [The architecture](docs/ARCHITECTURE.md) — modules, data model, execution flows.
- [Conventions](docs/CONVENTIONS.md) — the rules enforced by the CI.
- [Judges' guide](docs/JUDGES.md) — test the app on a demo site in 5-10 minutes.
- [Video demo script](docs/VIDEO-SCRIPT.md) — narration and storyboard (< 5 min).
- [Demo dataset](docs/DEMO-DATA.md) — PAY-123 numbers, criteria, and outcomes.
- [Methodology](docs/METHODE.md) (French) — autonomous lots, contracts, CI 5 min, Mergify queue.
- [Validation plan](docs/VALIDATION-PLAN.md) (French) — the 6 prototype validation points of SPEC §19.

## Progress

- **Merged on `main`**: the frozen contract (`src/types.ts`, `src/ports.ts`,
  `src/defaults.ts`), the Forge manifest, the SQL schema and mapping, the seven
  entry-point stubs, the shared test harness (in-memory fakes, PAY-123
  scenario of SPEC §7), the CI guards, the demo dataset
  ([src/sample/](src/sample/README.md)) and this documentation set.
- **In progress, one pull request per lot**: criteria (L1), evidence (L2),
  coverage & gate (L3), CI ingestion (L4), MCP tools & Rovo agent (L5),
  screens (L6), matching & reports (L7), runtime adapters (L9). Ownership and
  file map: [docs/CONTRACTS.md](docs/CONTRACTS.md) §2.
- **Live status**: the required check `ci` on each pull request, and the
  Mergify queue that merges green PRs on its own. The six platform points of
  SPEC §19 are tracked in [docs/VALIDATION-PLAN.md](docs/VALIDATION-PLAN.md).

## License

MIT.
