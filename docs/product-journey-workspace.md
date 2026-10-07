# Product journey workspace candidate

This is one cumulative product PR, based on PR #25 at
`23eba2ac317f1890a7a1ffd96cbd174c70031f7f`. PR #23 at
`0a940df885b70edce0db577d9783921609f71dfe` remains its mapping reference.
Neither existing branch, PR nor protected completion record is changed.

## Acceptance scope

- Box office and booking show the supported catalogue prefix, validated receipts,
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
  prepare and accept. No next write, retry or replacement id is observed.
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

## Local evidence (2026-10-07)

Typecheck and build passed. With the clean reviewed gate checkout, adapter tests
passed 108/108 and web tests 47/47. Chromium browser tests passed 6/6, including
keyboard activation, mobile overflow, HTTP no-write behavior, missing events,
booking-to-resale-to-admission route continuity and event-state isolation.
The browser suite writes a mobile screenshot under ignored `test-results/`.

## Review and audit handoff

The author supplies implementation and test evidence only. An independent reviewer
must inspect the final PR HEAD, especially UNKNOWN rendering, isolation between
fixtures/events, HTTP no-write behavior, receipt-to-body links and the fixture's
lack of protocol arithmetic. The `w6a-journey-test` and `w6a-ui-skeleton` nodes
have A2 floors; the inherited adapter has A3. A cumulative candidate must retain
that inherited A3 boundary. No protected PASS or DONE is manufactured here, and
no source has been submitted to a new external audit provider.

Full product closeout is still blocked by unmerged predecessors and the unresolved
capture/settlement ruling in PR #23. Only the supported prefix is implemented;
`capture`, `settle_capture`, `commit_trade`, `open_admission`, and `admit` remain
uncomposed. Session persistence/recovery, producer SDK/manifest upgrades and later
workspace nodes are not completed by this fixture. Wave 7 remains closed until
`w6a-evidence` merges. Central AIOPS state is unchanged.

Wave 6 gate: https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343

Wave 7 gate and roadmap: kix-protocol
`docs/decisions/PROGRAM_ROADMAP_20260930.md` §2 R-7.
