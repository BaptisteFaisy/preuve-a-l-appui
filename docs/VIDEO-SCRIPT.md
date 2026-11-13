# Video script — 3 minutes, English (Codegeist 2026)

> The video shows the **real** environment: the demo Jira site with the
> `PRF` project (nine delivered tickets, version 2.4), the real proofs, and
> the public site running the real engine on that data.
>
> Frames captured from the public site live in `docs/video/frames/`; each shot
> below says which frame to use. The two shots marked **[session]** need a
> logged-in Jira browser — they are the only ones that cannot be captured
> automatically.

Three acts: **the problem**, **the rule**, **the proof that survives**. The
spoken text is short on purpose: the screen carries the argument.

## 0:00 – 0:25 — Act 1: "Done" was a declaration

**Shows.** A delivered ticket, then the bug it produced. Frame `01-probleme.png`
(the public site, the problem section) cuts to the *real* project view:
nine tickets, a coverage field per ticket, three of them closed on a waiver.

**Says.** “This team shipped nine tickets last quarter. Three of them were
closed on a waiver — a motivated one, on record. One of them was reopened
weeks later, because the test that justified it had quietly disappeared from
the main branch. Nothing in Jira linked *Done* to what was actually asked.
Done was a declaration. And with coding agents, declarations are cheap and
plausible by construction.”

## 0:25 – 0:55 — Act 2: the rule, and where the data comes from

**Shows.** The one diagram that explains everything, then the site itself.
Frames `02-schema.png` (the flow diagram) and `03-vitrine.png` (the hero,
with the eligibility badge and the measured key numbers).

**Says.** “Our rule is one line: no proof, no Done. Every acceptance
criterion has a stable code, a type, and a minimum strength of proof —
machine-verified, a named test green on the branch; attested, a named human
checked it; or declared, an agent says so. The summary of a CI run carries
the test names and their states, never the logs. The app computes one
coverage row, and the validator reads that row.”

## 0:55 – 1:35 — Act 3: the gate, for real

**Shows.** **[session]** The real Jira panel of `PRF-1`: the criteria × proofs
matrix, the coverage field `2 / 4`, and the developer attempting *Done* —
Jira refuses and names `AC-3` and `AC-4`, saying which proof each one is
waiting for. Frame `04-matrice.png` is the same matrix rendered by the real
view-model on the real data.

**Says.** “She tries to close it. Jira blocks, and says why: *AC-3* needs a
third-party attestation and only a declaration was received; *AC-4* has no
evidence at all. The validator reads one precomputed row, so it answers in
well under a second.”

## 1:35 – 2:05 — the two ways out, and the one that is refused

**Shows.** The simulator on the public site: pick a criterion, pick a proof,
and the verdict changes. Frames `05-simulateur.png` and
`06-simulateur-refus.png` — the second one is the refusal: the assignee
tries to attest her own criterion, and the app says no.

**Says.** “Two ways out. The tester actually triggers the case and attests in
one click — she is not the assignee, and the app forbids self-attestation.
Or the product owner grants a motivated waiver, criterion by criterion, and
it stays on record. You can try it right here: pick a criterion, attach a
proof, and watch the verdict move — and try to attest your own work, and
watch it refuse.”

## 2:05 – 2:40 — the proof that outlives the ticket

**Shows.** The project page on the public site: the delivered criteria that
are **no longer proven**, because their test vanished from the main branch.
Frames `07-preuve-vivante.png` (the living-proof table) and
`08-dossier.png` (the whole project, ticket by ticket, with the release
dossier of version 2.4).

**Says.** “And the part that no ticket tracker does. The ticket was delivered
in March. In June, a test disappeared from the main branch. The app noticed,
reopened the ticket, and told us which criterion lost its proof — with the
commit that changed it. The waiver and the attestation are in the release
dossier of the version. Every number on this page was computed by the app
that is installed on a real Jira site, not by this page.”

## 2:40 – 3:00 — the landing, and the invitation

**Shows.** The public site, full page: the 21 features, the site URL, the
call to try it. Frame `09-final.png`.

**Says.** “The site you are looking at is static, and it replays the real
engine on the real data of the demo tenant: the same modules, the same
rules, the same verdict. Try it — the URL is on screen. And if you want to
put this on your own Jira, the app is installable in two minutes; the link
is in the description.”

## Shooting notes

| | |
|---|---|
| Length | 2:55 — under the 3-minute cap |
| Language | English (the jury is international); subtitles burned in |
| Cursor | Highlight the criterion being talked about; no frantic mouse |
| Cuts | Hard cuts only, on the beat of the sentence |
| Sound | No music under the voice; a single low bed at −24 LUFS |
| **[session]** shots | 2 (the real Jira panel and the blocked transition). They need a logged-in Jira browser: log in, open `PRF-1`, show the matrix panel and the coverage field, then attempt *Done* and let the app refuse. Everything else is a frame of the public site. |

## Frames

| Frame | What it shows | Source |
|---|---|---|
| `01-probleme.png` | The problem: a delivered ticket that comes back as a bug | `/#problem` |
| `02-schema.png` | The one diagram: summary → queue → consumer → coverage → validator | `/#architecture` |
| `03-vitrine.png` | The hero: eligibility badge and measured key numbers | `/` |
| `04-matrice.png` | The criteria × proofs matrix on the real ticket | `/#demo` |
| `05-simulateur.png` | The simulator, with a proof attached | `/#simulator` |
| `06-simulateur-refus.png` | The simulator refusing a self-attestation | `/#simulator` |
| `07-preuve-vivante.png` | The delivered criteria that are no longer proven | `/#screens` |
| `08-dossier.png` | The whole project, ticket by ticket | `/#screens` |
| `09-final.png` | The whole page | `/` |

Captured with: `google-chrome --headless --screenshot=… --window-size=1440,900`.
The public site is fully static: every frame is the real rendering, with the
real data of the demo tenant.
