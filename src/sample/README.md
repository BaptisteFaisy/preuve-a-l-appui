# Sample demo dataset — PAY-123

This folder contains the demo dataset for the app:
[`pay-123.ts`](pay-123.ts) is the single source of truth for the sample
scenario (SPEC §7, §22, §24).

The documentation never hard-codes numbers: it quotes values from this dataset,
and [`tests/sample/pay-123.test.ts`](../../tests/sample/pay-123.test.ts) locks
the cohesion between code and documentation.

## What is inside

| Symbol | Description |
|---|---|
| `DEMO_PROJECT_KEY`, `DEMO_ISSUE_KEY` | `PAY` and `PAY-123` |
| `DEMO_ACTORS` | `agent`, `developer` (assignee), `tester` (QA), `owner` (PO) |
| `createDemoCriteria()` | Four active criteria: `AC-1`, `AC-2`, `AC-3`, `AC-4` |
| `createDemoEvidences()` | Three pieces of evidence: two tests, one agent report |
| `createDemoCiSummary()` | Two green tests, repo `pay/paiements`, branch `feature/PAY-123-refusal-email` |
| `createInitialDemoCoverage()` | Initial coverage row: 2 / 4 proven, transition blocked |
| `createDemoAttestation()` | The QA attestation on `AC-3` (SPEC §7.3) |
| `createDemoWaiver()` | The PO waiver on `AC-4` (SPEC §7.4) |
| `loadDemoDataset(store)` | Seeds any `ProofStore` (fake or Forge SQL) with the initial state |
| `applyDemoResolutions(store)` | Writes the QA attestation and the PO waiver to the store |

## How to load it

### In tests (in-memory fake store)

```typescript
import { createFakeStore } from '../../tests/helpers/fake-store.js';
import { loadDemoDataset, applyDemoResolutions } from './pay-123.js';

const store = createFakeStore();
const { settings, issue, criteria, evidences, coverage } =
  await loadDemoDataset(store);

// Replay the two human gestures (attestation on AC-3, waiver on AC-4)
const { attestation, waiver } = await applyDemoResolutions(store);
```

### In a running Forge app (Forge SQL)

From the project settings or an admin script, pass the app's `ProofStore`
assembled by `createStore(sqlClient)` (`src/db/repo.ts`):

```typescript
import { loadDemoDataset } from './pay-123.js';

await loadDemoDataset(deps.store);
```

The issue `PAY-123` itself is created in Jira; the dataset populates the
app-managed tables (`criterion`, `evidence`, `test_run`, `test_result`,
`coverage`, `settings`).

## How to send the sample CI summary

The summary produced by `createDemoCiSummary()` matches the `CiSummary`
contract from [`src/types.ts`](../types.ts). The one-line command displayed in
the project settings sends it to the web trigger `ci-results`:

```bash
curl -fsS -X POST "$PROOF_CI_URL" \
  -H "x-proof-key: $PROOF_CI_KEY" \
  -H "content-type: application/json" \
  -d '{
    "repo": "pay/paiements",
    "branch": "feature/PAY-123-refusal-email",
    "commit": "e41f0c9a1b2c3d4e5f60",
    "mainBranch": false,
    "tests": [
      { "name": "checkout refuses an expired card", "state": "passed", "durationMs": 42 },
      { "name": "checkout logs the refusal reason", "state": "passed", "durationMs": 57 }
    ],
    "receivedAt": "2026-11-11T08:00:00.000Z"
  }'
```

Within a minute the consumer turns the two tests into machine-verified proofs
on `AC-1` and `AC-2` (SPEC §10).

## Cohesion test

[`tests/sample/pay-123.test.ts`](../../tests/sample/pay-123.test.ts) proves:

1. Four criteria, each with an identifier and a unique code (`AC-1` … `AC-4`).
2. Two machine-verified proofs, matching the two passed CI tests.
3. `AC-3` requires an attestation; the agent declaration alone fails the gate.
4. `AC-4` has no evidence.
5. Coverage is **2 / 4** and blocks the transition in strict mode.
6. Every visible string exists in English and French in [`src/i18n/docs.ts`](../i18n/docs.ts).
7. Internal Markdown links in the documentation point to existing files.
