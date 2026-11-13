# Video script — under 5 minutes, English (SPEC §23)

Seven sequences, timed. *Says* is the spoken text; *Shows* is what is on
screen. The demo data is PAY-123 exactly as described in
[DEMO-DATA.md](DEMO-DATA.md): four criteria, two machine-verified proofs, one
criterion waiting for an attestation, one without evidence — coverage **2 / 4**.

## 1. 0:00 – 0:30 — The problem

**Shows.** A ticket marked *Done*, then a bug report: the fourth criterion was
never actually delivered. Cut to the four acceptance criteria of PAY-123.

**Says.** “This ticket is Done. Four criteria were asked; three were actually
delivered. The fourth one comes back as a bug two weeks later. Nothing in Jira
linked ‘Done’ to what was asked. Done was a declaration — and with coding
agents, declarations are cheap and plausible by construction.”

## 2. 0:30 – 1:10 — The rule and the matrix

**Shows.** The ticket panel: the criteria × proofs matrix of PAY-123, required
strength per criterion, coverage field `2 / 4`.

**Says.** “Our rule: no proof, no Done. Every acceptance criterion has a
stable code, a type, and a minimum strength of proof: machine-verified, a
named test green on the branch; attested, a third party checked it; or
declared, an agent says so. The matrix shows, at a glance, what is proven and
what the app still expects.”

## 3. 1:10 – 2:10 — The agent works, the CI feeds the app

**Shows.** An agent calls `attach-evidence` twice (one test per criterion) and
declares a report section for the third. The pipeline runs; the one-line CI
command posts the summary; `AC-1` and `AC-2` turn green.

**Says.** “The agent attaches two tests and a section of its report. When the
pipeline ends, one line in it sends the test names and states — never logs —
to the app. The two tests exist and pass on the pull-request commit: they
become machine-verified proofs. The agent report stays *declared*: an agent
can declare, it can never attest.”

## 4. 2:10 – 2:40 — The blocked transition

**Shows.** The developer attempts *Done*. Jira refuses; the message names
`AC-3` and `AC-4` with the expected proof for each.

**Says.** “Now she tries to close the ticket. Jira blocks, and says why:
`AC-3` needs a third-party attestation, only a declaration was received;
`AC-4` has no evidence at all. The validator reads one precomputed row — it
answers in well under a second.”

## 5. 2:40 – 3:20 — Attestation, waiver, closure

**Shows.** The tester clicks *I checked* on `AC-3` with a screenshot; the
product owner waives `AC-4` with the reason “Postponed to PAY-140”; the
transition passes.

**Says.** “The tester actually triggers a refusal, receives the email, and
attests in one click — she is not the assignee, the app forbids self-
attestation. `AC-4` is postponed to another ticket: the product owner grants a
motivated waiver. The transition passes — and the waiver stays on record.”

## 6. 3:20 – 4:00 — Six months later: the living proof

**Shows.** Another ticket disables the test that proved `AC-1`. Next run on
main: PAY-123 is flagged “`AC-1` is no longer proven since commit `e41f`”.

**Says.** “Six months later, an agent disables the test that proved `AC-1`.
The app keeps watching the confirmed test-to-criterion pairs after closure:
the test is gone from the run, so the delivered criterion is no longer proven.
The team is notified — the proof does not evaporate.”

## 7. 4:00 – 4:50 — The dossier, the architecture, close

**Shows.** The proof dossier of version `2.4`: per ticket, criteria, proofs,
attesters, waivers. Then the architecture slide: workflow validator, CI web
trigger, consumer, `rovo:mcp`, pure domain.

**Says.** “Every release keeps a proof dossier: what was asked, what proves
it, who attested, which waivers were granted. Under the hood: a Forge workflow
validator, a web trigger for CI results, a queue, seven MCP tools and a Rovo
agent — with a pure domain that never touches the runtime, so every decision
is tested in memory. Done is no longer a declaration. It is a fact, with proof
to back it up.”
