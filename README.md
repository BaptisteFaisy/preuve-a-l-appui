# Fait, preuve à l'appui

**A ticket only reaches “Done” when every acceptance criterion carries evidence
of sufficient strength.** Otherwise the app says which criterion is missing and
which proof it expects.

> Codegeist 2026 · category *Apps for Software Teams* · Atlassian **Forge** app
> for Jira · interface in English and French.

## The problem

“Done” is a declaration: nothing in Jira links that declaration to what was
actually asked. Three drifts follow — the forgotten criterion, the implicit
proof (“I tested it, it works”), and the proof that evaporates (the test that
proved a criterion is disabled six months later). Coding agents make it urgent:
an agent declares “done” with aplomb and its report is plausible by
construction.

The app answers with one rule: **no proof, no “Done”.**

## How it works

1. Each acceptance criterion has a stable code (`AC-1`), a type, a **minimum
   strength of proof** and a version.
2. Proofs come in six kinds and three strengths: *machine-verified* (a named
   test, green on the ticket branch), *attested* (a third party says so), or
   *declared* (an agent report, a screenshot, a link).
3. A **workflow validator** on the transition to “Done” reads the ticket
   coverage and blocks, naming each failing criterion and the proof it
   expects. It never receives the identity of the person transitioning, so
   waivers are granted *before*, in the panel.
4. A one-line command at the end of a CI pipeline sends the test names and
   states; the app turns them into machine-verified proofs, tracks their
   freshness, and keeps watching the confirmed test ↔ criterion pairs after
   the ticket is closed.

Three project modes: **strict** (nothing passes without full coverage),
**lenient** (minor criteria may pass, and stay flagged), **observation**
(nothing is blocked; the app counts what it would have blocked).

## Screens

| Screen | Content |
|---|---|
| Ticket panel | the criteria × proofs matrix, attach / attest / request an attestation / waive |
| Coverage field | `3 / 4`, coloured, usable in JQL |
| Project settings | the strength grid, the roles that attest and waive, the mode, the CI key and the command to copy |
| Project page | tickets in progress and their coverage, waivers, delivered criteria no longer proven, statistics |

## Agents first

Seven MCP tools (`list-criteria`, `get-proof-status`, `attach-evidence`,
`propose-criteria`, `request-attestation`, `suggest-evidence`,
`get-release-proof`) and a Rovo agent that answers “what is missing to close
PAY-123?”. **No tool lets an agent attest, waive or validate a criterion**:
those gestures stay in the interface, for a human.

## Architecture

```
Jira ─▶ jira:workflowValidator ─▶ handler/validator ─▶ coverage row ─▶ { result, errorMessage }
CI   ─▶ webtrigger ci-results ─▶ queue proof-ci ─▶ consumer ─▶ proofs, freshness, living proof
agent▶ rovo:mcp (7 tools)     ─▶ handler/dispatch  ─▶ pure domain ─▶ Forge SQL
```

The domain (`src/domain/`) never imports `@forge/*`: everything that touches
Jira, Confluence, the LLM or SQL sits behind a port (`src/ports.ts`), so the
whole decision path is tested with in-memory fakes.

## Repository map

| Path | Content |
|---|---|
| `src/types.ts` | the frozen vocabulary (criteria, evidence, strength, coverage, waiver…) |
| `src/ports.ts` | interfaces between the pure domain and the Forge runtime |
| `src/domain/` | criteria, evidence, strength, requirements, coverage, gate, waivers, freshness, matching |
| `src/db/` | Forge SQL adapters, one per table, plus the DDL (`schema.ts`) |
| `src/collect/` | the only adapters allowed to import `@forge/*` (Jira, Confluence, LLM, identity) |
| `src/handlers/` | the seven Forge entry points |
| `src/actions/` | the seven Rovo/MCP tools |
| `src/ui/` | the four screens (logic in `src/viewmodel/`, tested) |
| `tests/` | unit tests, shared fakes (`tests/helpers/`), acceptance recipe |
| `docs/` | the brief, the contract, the architecture, the judges’ guide, the video script |

## Development

```bash
npm install
npm run typecheck      # tsc --noEmit
npm test               # vitest
python3 tools/check-file-limits.py    # < 500 lines per file
node tools/check-function-limits.mjs  # < 50 lines per function
node tools/check-manifest.mjs         # the manifest matches the CLI schema
```

The CI verdict fits in **5 minutes** (project rule): one job, self-hosted
runners, no reinstall when the lock file did not change.

## Documentation

- [The brief](docs/CAHIER-DES-CHARGES.md) (French) — the full specification.
- [The contract](docs/CONTRACTS.md) — frozen interfaces and lot ownership.
- [The architecture](docs/ARCHITECTURE.md) — modules, data model, flows.
- [Conventions](docs/CONVENTIONS.md) — the rules the CI enforces.

## License

MIT.
