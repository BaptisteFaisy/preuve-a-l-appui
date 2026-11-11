# Guide for the judges

Ten minutes, no repository and no CI tooling required (SPEC §24). The demo
project `PAY` and its ticket `PAY-123` come preloaded; the dataset is described
in [DEMO-DATA.md](DEMO-DATA.md) and lives in
[`src/sample/pay-123.ts`](../src/sample/pay-123.ts).

## 1. Install the app on the demo site

1. Open the demo Jira site provided with the submission.
2. The app **Fait, preuve à l'appui** (*Done, With Proof*) is either already
   installed, or installable from the Marketplace listing link given in the
   submission form: **Apps → Manage your apps → Install app**.
3. Open the demo project `PAY`. The sample project loads the PAY-123 dataset:
   four acceptance criteria, two machine-verified proofs, one criterion waiting
   for an attestation, one without evidence — coverage **2 / 4**.

## 2. Put the validator on the transition to “Done” (three clicks)

The validator is a `jira:workflowValidator` (SPEC §12.1); it needs the new
workflow editor and an administrator account:

1. **Project settings → Workflows**, open the workflow of `PAY`, edit the
   transition to *Terminé* / *Done*.
2. **Add validator → Apps**, pick *Fait, preuve à l'appui*.
3. **Publish** the workflow.

That is all: the validator computes nothing, it reads the coverage row of the
ticket, so it answers in well under a second. If the sample workflow shipped
with the demo project is already configured, skip this step.

## 3. Try to close the ticket

Open `PAY-123` and attempt the transition to *Done*. Jira refuses and shows
the blocking message (SPEC §7.2): it names the two failing criteria — `AC-3`
(an attestation is expected, a declaration was received) and `AC-4` (no
evidence attached) — with, for each, the proof the app expects. The ticket
panel shows the same matrix: criteria × proofs, required strength, state.

## 4. Attest, waive, close

- **Attest** (SPEC §7.3): log in as the tester **Nora QA** — not the assignee,
  who can never attest her own work. In the panel, on `AC-3`, click
  *I checked*, add the optional screenshot, confirm. One gesture, ten seconds.
- **Waive** (SPEC §7.4): log in as the product owner **Sam PO**. On `AC-4`,
  click *Waive*, keep the reason (*Postponed to PAY-140*), confirm. Waivers
  are granted before the transition, in the panel, because the validator never
  sees who is transitioning.
- **Close**: attempt the transition again — it passes. The waiver appears in
  the proof dossier of version `2.4` (*Project page → Proofs*).

## 5. Send a sample CI summary with the provided command

**Project settings → Proof requirements** shows the CI entry point: the URL of
the web trigger `ci-results` and the one-line command to copy, with the
project key already filled in. It posts a summary — repository, branch,
commit, test names and states only, never logs (SPEC §10). The sample command
sends the PAY-123 run: two tests, both green, on the branch
`feature/PAY-123-refusal-email`:

```bash
curl -fsS -X POST "$PROOF_CI_URL" \
  -H "x-proof-key: $PROOF_CI_KEY" -H "content-type: application/json" \
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

The JSON body is exactly the `CiSummary` of the frozen contract
([`src/types.ts`](../src/types.ts)); the demo dataset exports the matching
payload through `createDemoCiSummary()` (see
[`src/sample/README.md`](../src/sample/README.md)). Within a minute the
consumer has updated the proofs and the coverage field of the ticket
(SPEC §10, §20): the machine-verified proofs of `AC-1` and `AC-2` turn green
again after a new run, or fall to *to-reconfirm* after a new commit.

## 6. Ask the Rovo agent

The agent **Proof at hand** (SPEC §15) is declared with the app. In Rovo chat:

- *What is missing to close PAY-123?* — it calls `get-proof-status` and
  answers with the same failing criteria as the validator message
  (SPEC §22 point 10).
- *Which tickets of version 2.4 were closed by waiver?* — `get-release-proof`.
- *Draft the acceptance criteria of this ticket.* — `propose-criteria`; the
  proposals wait for a human validation.

Optional: connect any MCP client to the app's `rovo:mcp` server and call the
seven tools directly. **No tool lets an agent attest, waive or validate a
criterion** (SPEC §22 point 11): those gestures exist only in the interface,
for a human.

## 7. Check the CI verdict yourself

The repository behind the app runs one required check, verdict in under five
minutes: typecheck, all tests, file and function size guards, manifest guard,
documentation sanity. To reproduce it locally:

```bash
npm ci && npm run typecheck && npm test
```

The acceptance recipe of SPEC §22 is covered by `tests/acceptance/`, one test
per recipe point.

## Where to look next

- [DEMO-DATA.md](DEMO-DATA.md) — the PAY-123 dataset, criterion by criterion.
- [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md) — what the demo video shows, minute by minute.
- [ARCHITECTURE.md](ARCHITECTURE.md) — modules, data model, flows.
- [VALIDATION-PLAN.md](VALIDATION-PLAN.md) — the platform points we verified
  and their fallbacks.
