# Demo Data — PAY-123

> Every number, label, test name, commit hash and reason on this page is derived
> from the single code source `src/sample/pay-123.ts` (loader:
> `loadDemoDataset(store)`, description: [src/sample/README.md](../src/sample/README.md)).
> Nothing here is hand-written twice: the test suite
> `tests/sample/pay-123.test.ts` checks this page against the code.

## The ticket

| Field | Value |
|---|---|
| Issue key | `PAY-123` |
| Summary | Refuser un paiement par carte expirée et notifier le client |
| Project | `PAY` |
| Status | `In Progress` |
| Assignee | Camille Dev (`user-dev`, role `Developers`) |
| Reporter | Sam PO (`user-po`, role `Product Owner`) |
| Component | `checkout-api` |
| Fix version | `2.4` |

## The four criteria

| Code | Type | Required strength | Label (FR) | Label (EN) |
|---|---|---|---|---|
| `AC-1` | functional | machine-verified | Le paiement par carte expirée est refusé | Expired card payment is refused |
| `AC-2` | regression | machine-verified | Un paiement déjà refusé ne repasse pas | A payment already refused cannot be processed again |
| `AC-3` | functional | attested | L'e-mail de refus est envoyé | Refusal email is sent to customer |
| `AC-4` | functional | machine-verified | La limite est réglable par l'administrateur | Refusal threshold is configurable by administrator |

## The evidence (initial state)

| Criterion | Evidence type | Reference | Strength obtained | Added by |
|---|---|---|---|---|
| `AC-1` | test | `checkout refuses an expired card` | machine-verified | Agent Code (`agent-coder`, agent) |
| `AC-2` | test | `checkout logs the refusal reason` | machine-verified | Agent Code (`agent-coder`, agent) |
| `AC-3` | agent-report | `report#ac-3` | declared | Agent Code (`agent-coder`, agent) |
| `AC-4` | — | — | — | — |

## The CI summary

Sent to the `ci-results` web trigger (SPEC §10), one-line `curl` in
[JUDGES.md](JUDGES.md) §5:

| Field | Value |
|---|---|
| Repo | `pay/paiements` |
| Branch | `feature/PAY-123-refusal-email` |
| Commit | `e41f0c9a1b2c3d4e5f60` |
| Main branch | no |

Test outcomes:

| Test name | State | Duration |
|---|---|---|
| `checkout refuses an expired card` | passed | 42 ms |
| `checkout logs the refusal reason` | passed | 57 ms |

The branch name contains the key `PAY-123`: the app attaches the run to the
ticket by that key (SPEC §10), and the two tests confirm `AC-1` and `AC-2` as
machine-verified on the exact commit.

## The expected coverage: 2 / 4

| Criterion | Required | Best obtained | Proven? | Defect |
|---|---|---|---|---|
| `AC-1` | machine-verified | machine-verified | yes | — |
| `AC-2` | machine-verified | machine-verified | yes | — |
| `AC-3` | attested | declared | no | weak-strength |
| `AC-4` | machine-verified | none | no | no-evidence |

Coverage line: **2 proven / 4 total**, mode `strict`, gate verdict: **blocked**
(`wouldBlock: true`). The blocking message names exactly two criteria, `AC-3`
and `AC-4` (SPEC §7.2, calibrated message — VALIDATION-PLAN point 3):

```text
2 critères sans preuve suffisante.
AC-3 « L'e-mail de refus est envoyé » : attestation d'un tiers attendue, déclaration reçue.
AC-4 « La limite est réglable par l'administrateur » : aucune preuve.
```

## The attestation (SPEC §7.3)

| Field | Value |
|---|---|
| Criterion | `AC-3` (`crit-3`) |
| Attester | Nora QA (`user-tester`, role `Developers`) — not the assignee, not an agent |
| Note | Refus déclenché manuellement, e-mail de confirmation reçu |
| Attachment | `att-screenshot-1` |

After the attestation, `AC-3` reaches `attested` strength: coverage becomes
**3 / 4**.

## The waiver (SPEC §7.4)

| Field | Value |
|---|---|
| Criterion | `AC-4` (`crit-4`) |
| Granted by | Sam PO (`user-po`, role `Product Owner`) |
| Reason | Reporté dans PAY-140 |
| Expiry | none (valid until the ticket closes) |

With 3 proven criteria and 1 waiver, the strict gate passes and the ticket can
transition to Done. The waiver stays in the release dossier of version `2.4`.

## The actors

| Role in the story | Account | Display name | Agent? | Project roles |
|---|---|---|---|---|
| Coding agent | `agent-coder` | Agent Code | yes | — |
| Developer (assignee) | `user-dev` | Camille Dev | no | Developers |
| Tester (attester) | `user-tester` | Nora QA | no | Developers |
| Product owner (waiver) | `user-po` | Sam PO | no | Product Owner |

Independence rules (SPEC §9.4) exercised by this cast: the assignee cannot
attest her own criteria, and the agent can only declare — its `agent-report`
evidence never satisfies `AC-3`, which demands an attestation.

## Living proof, six months later (SPEC §7.5)

An agent working on another ticket disables the test
`checkout refuses an expired card`. On the next main-branch run, the app notices
the test is no longer executed and flags the closed ticket:
`PAY-123 : AC-1 n'est plus prouvé depuis le commit e41f0c9a1b2c3d4e5f60`.
