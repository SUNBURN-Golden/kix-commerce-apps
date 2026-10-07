# Product journey workspace candidate

This is one cumulative product PR, based on PR #25 at
`23eba2ac317f1890a7a1ffd96cbd174c70031f7f`. PR #23 at
`0a940df885b70edce0db577d9783921609f71dfe` remains its mapping reference.
Neither existing branch, PR nor protected completion record is changed.

## Acceptance scope

- Box office and booking show the approved synthetic catalogue journey, validated receipts,
  the last confirmed step and the unconfirmed request separately.
- Stub-default, explicitly labelled scripted scenarios cover acceptance, rejection,
  response loss, stale correlation and malformed receipt. They exercise the same
  composer used by the Node loopback gate. They are not the desk FSM and do not
  claim to implement protocol state, expiry, payment or issuance.
- Browser HTTP displays unavailable and sends no journey POST. There is no proxy,
  browser gate bypass or fallback to the demo.
- Switching scenarios clears old evidence; reload discards fixtures. A new fixture
  run is not retry/recovery of an unknown request. Booking event transitions reset
  the event's local state. Missing events have an error and return path.
- The existing stub desk links booking through resale to admission with the correct
  event id. This route continuity is distinct from catalogue admission qualification.
- Actual gate success followed by response loss is injected at each of create,
  prepare, accept, capture, commit, open admission and admit. No next write, retry or replacement id is observed.
- Fixture/gate parity covers sequence, operation identity and blocked steps, not
  identical generated IDs or protocol arithmetic.

## Reproduction

```
npm ci
npm run typecheck
npm run build
KIX_REQUIRE_GATE=0 npm test
npx playwright install chromium
npm run test:browser
KIX_PROTOCOL_ROOT=/path/to/reviewed-protocol KIX_REQUIRE_GATE=1 npm test
```

The protocol checkout must be clean and pinned to
`52a9b5cbf7777df55d2d2062cb8d99d862b423bb`. Browser tests start only loopback
servers (5173 stub, 5174 HTTP-unavailable). No database is used. CI runs both
browser modes alongside the existing stub and reviewed-gate jobs.

## Historical validation before the approved full-chain extension (2026-10-07)

Typecheck and build passed. With the clean reviewed gate checkout, adapter tests
passed 108/108 and web tests 47/47. Chromium browser tests passed 6/6, including
keyboard activation, mobile overflow, HTTP no-write behavior, missing events,
booking-to-resale-to-admission route continuity and event-state isolation.
The browser suite writes a mobile screenshot under ignored `test-results/`.

The existing development dependency audit initially reported four vulnerabilities.
Vitest is updated to the Node-20-compatible 4.1.11 and source-map-js is patched;
`npm audit` then reports zero vulnerabilities. Web test Node types are explicit.
The workflow checkout uses the current `SUNBURN-Golden/kix-protocol` name (same
repository ID 1365416872); the pinned gate commit and credentials are unchanged.

## Review and audit handoff

The author supplies implementation and test evidence only. An independent reviewer
must inspect the final PR HEAD, especially UNKNOWN rendering, isolation between
fixtures/events, HTTP no-write behavior, receipt-to-body links and the fixture's
lack of protocol arithmetic. The `w6a-journey-test` and `w6a-ui-skeleton` nodes
have A2 floors; the inherited adapter has A3. A cumulative candidate must retain
that inherited A3 boundary. No protected PASS or DONE is manufactured here, and
no source has been submitted to a new external audit provider.

The [2026-10-07 User decision](decisions/2026-10-07-commerce-journey-and-a3.md)
settles the map choice: synthetic capture, issuance and admission are now composed;
optional settlement and all desk remappings remain out. It also explicitly accepts
a fresh internal non-author Astra source A3 for PR26, without changing central
protected receipt consumers. Full closeout still needs required CI, that audit,
and predecessor/completion evidence. Session persistence/recovery, producer SDK/manifest upgrades and later
workspace nodes are not completed by this fixture. Wave 7 remains closed until
`w6a-evidence` merges. Central AIOPS state is unchanged.

Wave 6 gate: https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343

Wave 7 gate and roadmap: kix-protocol
`docs/decisions/PROGRAM_ROADMAP_20260930.md` §2 R-7.


## Continuation evidence

The composer snapshots the caller's event, buyer, operation IDs, seats and policy
before awaiting the first receipt. A regression test reproduced the previous
input-mutation failure and passes with the snapshot. An additional reviewed-gate
test advances the fixture clock after prepare and verifies that expired accept is
rejected without further composition. This adds no session schema, recovery API,
producer command or new journey step.

See [CI access diagnosis](ci-access-diagnosis.md) for the credential metadata and
minimum recovery boundary, and [remaining decision check](journey-decision-check.md)
for the original ruling analysis and the later User approval. The CI credential
recovery remains separate and awaits GitHub web login.

Continuation validation: adapter 110/110, web 47/47, Chromium 6/6; typecheck and build passed.


Independent review of `563c89bd8ac0e15b65e473caa1aa4aa5bdd33da5` identified a
nested payload guard error being classified as an explicit rejection when its
ProtocolError had no code. Both direct and HTTP reproductions failed before the
fix. The payload guard now assigns the existing `GATE_STATUS` code to those
validation failures so the journey reports `INVALID_RECEIPT` and keeps the effect
unconfirmed. It does not change a server's explicit business rejection or add a
new protocol code. Final-HEAD re-review is required after this correction.

Post-fix author validation: adapter 112/112, web 47/47, Chromium 6/6; typecheck and build passed.

## Approved full-chain extension

The User's explicit PR26 decision is recorded with its original question/answer
and message IDs in `docs/decisions/2026-10-07-commerce-journey-and-a3.md`.
The composer now confirms synthetic capture, issuance and admission in order;
optional settlement is omitted and hold/desk bindings remain unchanged.

Author validation of this extension: typecheck/build passed; clean pinned gate
adapter tests 128/128, web tests 51/51, Chromium 6/6. The suite covers lost responses
after every actual gate effect, invalid causal receipts, reservation expiry after
capture, transferred-right stale admission and prevention of a second admission.
The final exact-HEAD independent Astra A3 result and GitHub CI status are recorded
in the PR handoff rather than committing their own HEAD and causing a hash loop.

## Independent A3 finding and follow-up checkpoint

The fresh non-author source A3 reviewed exact HEAD
`a92dec19efbcfd000f763aaa04fcb41b21e1e982` and returned **FAIL**, one F1/P2:
positive but impossible first-issuance versions allowed downstream writes.
The complete unaltered report is preserved in
[pr26-a3-a92dec1.md](reviews/pr26-a3-a92dec1.md), including configured model/session,
missing provider telemetry, independently executed tests and authority boundaries.

The writer reproduced four failing unit/real-gate regressions before the fix.
The composer now requires the pinned fresh-primary `rightsVersion=1` and
`admissionEpoch=1` before opening admission. Six regression cases cover each wrong
positive value and both together in direct and actual-gate response injection.
Post-fix author verification: adapter 134/134, web 51/51, typecheck and build pass.
The failed A3 is not relabelled PASS; the changed HEAD requires independent re-audit.

User instruction `Sentinel_bda72b431f708191b09cbd82e79337f5` stops highspeed/Fast/
priority while retaining Astra/high. The current cloud/collaboration tools expose
no service-tier setter; the running audit was allowed to finish without duplicate
execution. No further model invocation is issued at this checkpoint. Independent
re-audit awaits a supported standard/default session. This does not change central
model settings, credentials or audit/merge gates.
