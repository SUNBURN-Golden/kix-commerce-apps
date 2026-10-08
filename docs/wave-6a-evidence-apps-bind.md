# Wave 6-A evidence apps bind

This document records the alignment evidence for one mock surface. The surface is the booking screen (`/booking/:eventId`) and the read-only box office view on `/`. The journey it shows is the M2-bounded mock journey. It ends at `accept_trade`. It is not a purchase-to-admission journey.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The map, the helper, the tests, and the screen are in [wave-6a-journey-map-apps-bind.md](wave-6a-journey-map-apps-bind.md), [wave-6a-journey-adapter-apps-bind.md](wave-6a-journey-adapter-apps-bind.md), [wave-6a-journey-test-apps-bind.md](wave-6a-journey-test-apps-bind.md), and [wave-6a-ui-skeleton-apps-bind.md](wave-6a-ui-skeleton-apps-bind.md). HTTP mode stays the opt-in loopback in [http-integration-gate-apps-bind.md](http-integration-gate-apps-bind.md). This document adds no command, no read, no retry, and no desk binding.

## Status and gate

M2 is selected. The adapter composes `create_event`, then `prepare_trade`, then `accept_trade`, through `invokeLocalCall` with the published bodies, and nothing past `accept_trade`. `capture` and `settle_capture` stay out of the journey. `capture` is never composed and never sent. `settle_capture` is never composed and never sent. `commit_trade`, `open_admission`, and `admit` stay uncomposed. The adapter records those not-composed reasons in `JOURNEY_NOT_COMPOSED`.

H1 is selected. `placeHold.consideredAction` stays `reserve_listing`. `placeHold` stays not-bound. `prepare_trade` is only an `invokeLocalCall` body. `placeHold({ eventId, quantity })` is not mapped onto it. `packages/protocol-adapter/src/commerce-bindings.ts` is unchanged.

The Wave 6 gate record is [kix-protocol issue 56, comment 5868307343](https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343).

Wave 7 opens when `w6a-evidence` merges. The gate record for that opening is kix-protocol [`docs/decisions/PROGRAM_ROADMAP_20260930.md`](https://github.com/BeautifulMind-JT/kix-protocol/blob/main/docs/decisions/PROGRAM_ROADMAP_20260930.md) §2 R-7, read from that repository at blob `74caeeeb286a65842778a4a8554c517c636c0ef1`. R-7 says: when the kix-commerce-apps node `w6a-evidence` merges, Wave 7 opens; that is the program-decision §3 entry condition (a mock end-to-end journey of at least one surface); **that section is the gate record for Wave 7**. This file is not the gate record. The roadmap's "mock end-to-end" words are the gate's. What this repository built, under the recorded ruling, is the M2-bounded mock journey, and it ends at `accept_trade`. Whether that satisfies the roadmap entry is the milestone gate's call. This file does not make that call, and it does not say Wave 7 is already open.

Evolution boundary: this remains the existing minimal one-surface mock gate. It does not claim all commerce surfaces, external qualifications, release, or the later commerce-integration-closeout. No protected receipt is manufactured here. A manifest is not User approval.

## Pins (unchanged)

No catalogue, gate, or SDK change is consumed. No compatibility manifest is consumed, so the evolution consumption rule has nothing to move. Both OpenAPI files, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the gate bind put them. The narrative pin tables stay in the README Protocol pin section. This is the one copy in this document.

| Pin | Value |
| --- | --- |
| Integration-gate merge | `52a9b5cbf7777df55d2d2062cb8d99d862b423bb` (feature `c7238bc24a399a6cabbab87ac23dbfd7e9c252dd`, one tree) |
| Contract-only OpenAPI sha256 | `fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e` |
| Gate OpenAPI sha256 | `2a2af554cb1a8b128f2cf1b1d5b8cf6b1c8fa90adf30865dbc3e64932b3bd13f` |
| `protocol_contract.json` sha256 | `ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e` |
| Domain on every body | `kix:fixture:lifecycle:0.3` |

Every action named below is in `PINNED_ACTIONS`: `create_event`, `prepare_trade`, `accept_trade`, `reserve_listing`, `capture`, `settle_capture`, `commit_trade`, `open_admission`, `admit`. Naming `capture` or `settle_capture` here records that each is never composed and never sent.

## Binding table

The composed bodies and receipt checks are the helper in `packages/protocol-adapter/src/booking-journey.ts`. The same tables are in [wave-6a-journey-adapter-apps-bind.md](wave-6a-journey-adapter-apps-bind.md). The domain on every body is `kix:fixture:lifecycle:0.3`.

### Journey steps

| Step | Actor | Published body fields | Receipt checks | Test that proves it |
| --- | --- | --- | --- | --- |
| `create_event` | `operator` | `domain`, `eventId`, `organizer`, `policy`, `seats` | `eventId` equals the id sent, `policyHash` is a non-empty string, `inventoryIds` is one non-empty string per seat, `reservationSeconds` is an integer | `packages/protocol-adapter/test/booking-journey.test.ts` › composes only the published bodies, in order, and copies the receipt links |
| `prepare_trade` | the caller-supplied buyer id | `domain`, `tradeId`, `inventoryId` from `inventoryIds[seatIndex ?? 0]`, `amount` equal to the `primaryPrice` on the create request, `buyer`, `expectedInventoryVersion` `0`, `expectedVersion` `0` | `tradeId` equals the id sent, `ticketId` and `externalOrderId` are non-empty strings, `status` is `PREPARED`, `termsHash` is a non-empty string | same test |
| `accept_trade` | the same buyer id | `domain`, `tradeId`, `termsHash`, both copied from the prepare receipt | `accepted` is `true` | same test |

The live-gate file proves the same three-step report on the reviewed process: `packages/protocol-adapter/test/booking-journey-gate.test.ts` › matches the stub step report on the live gate. That file runs only in the live-gate job. A desk-job skip of it is not a pass.

### Desk methods

Quoted from `COMMERCE_COMMAND_BINDINGS` through `JOURNEY_DESK_NOT_BOUND`. Every row is `not-bound`. None is remapped. `placeHold({ eventId, quantity })` is not mapped onto `prepare_trade`. `capture` is never composed and never sent. `settle_capture` is never composed and never sent.

| Method | `consideredAction` | Quoted reason |
| --- | --- | --- |
| `placeHold` | `reserve_listing` | `placeHold({ eventId, quantity }) does not match reserve_listing, which requires domain, expiresAt, listingHash, listingId, and tradeId.` |
| `confirmBooking` | `capture` | `confirmBooking(holdId) does not match capture. capture carries amount, currency, and paymentId. The desk keeps simulated-no-funds bookings on the stub and does not send capture.` `capture` is never composed and never sent. |
| `settlementPreview` | `settle_capture` | `settlementPreview stays a mock F01–F03 pointer. settle_capture is a monetary posting, so the desk does not send it.` `settle_capture` is never composed and never sent. |
| `checkAdmission` | `admit` | `checkAdmission({ rightsRef, gateId }) does not match admit, which requires admissionEpoch, domain, expectedVersion, holder, and ticketId.` |

`JOURNEY_DESK_NOT_BOUND` quotes those reasons. It does not rewrite them. Every `COMMERCE_METHODS` entry stays `not-bound`.

### Not composed

`JOURNEY_NOT_COMPOSED` records these reasons. The helper has no method for these actions.

| Action | Recorded reason |
| --- | --- |
| `capture` | Nothing past `accept_trade`. Never composed, never sent. `confirmBooking` stays not-bound. |
| `settle_capture` | Stays out of the journey. Never composed, never sent. `settlementPreview` stays not-bound. |
| `commit_trade` | Stays uncomposed. This journey does not capture. `capture` is never composed and never sent. `commitSettlement` is not `commit_trade`. |
| `open_admission` | Stays uncomposed. No desk method posts it. |
| `admit` | Stays uncomposed. `checkAdmission` is not the admit body. |

Outcomes on a composed step are `RECEIPT`, `REJECTED`, `UNKNOWN`, `NOT_SENT`, and `FENCED`, as the adapter bind records them. There is no retry, no `Idempotency-Key`, and no minted `operationId`.

## Evidence matrix

These rows cite tests that already exist. They are not new evidence and they are not a new count. The evolution cases stay in [wave-6a-journey-test-apps-bind.md](wave-6a-journey-test-apps-bind.md) under "Evolution coverage". That table's live-gate rows ran in the live-gate job named below. That table's stub-run rows ran in the desk job. The desk job's skip of `booking-journey-gate.test.ts` and `booking-journey-live.test.ts` is not a pass of those rows.

| Claim | Mode | File › test | Where it ran |
| --- | --- | --- | --- |
| The helper sends only `create_event`, `prepare_trade`, `accept_trade`, with the published bodies and the receipt copies | stub-run | `packages/protocol-adapter/test/booking-journey.test.ts` › composes only the published bodies, in order, and copies the receipt links | Desk job on `05e4f436dc6d893d6dc6c023ee3e0d21ba8f21e8`. The same file also passed in the live-gate job on that SHA. |
| M2 + H1 is recorded: the five actions stay uncomposed, and `placeHold` stays `reserve_listing` and `not-bound` | stub-run | `packages/protocol-adapter/test/booking-journey.test.ts` › records the M2 + H1 ruling and the commands it does not send | Desk job on `05e4f436dc6d893d6dc6c023ee3e0d21ba8f21e8` |
| Evolution coverage (request-before-effect, response loss, stale and malformed receipts, refresh, expiry, no retry, no next write while `UNKNOWN`) | stub-run and live-gate, per that table | [wave-6a-journey-test-apps-bind.md](wave-6a-journey-test-apps-bind.md) › Evolution coverage | Live-gate rows: live-gate job on `05e4f436dc6d893d6dc6c023ee3e0d21ba8f21e8`. Stub-run rows: desk job on that SHA. |
| The shape-only invoker reports the same step sequence | stub-run | `packages/protocol-adapter/test/booking-journey-parity.test.ts` › reports the composed step sequence from a shape-only invoker | Desk job on `05e4f436dc6d893d6dc6c023ee3e0d21ba8f21e8` |
| The reviewed gate returns the same step report | live-gate | `packages/protocol-adapter/test/booking-journey-gate.test.ts` › matches the stub step report on the live gate | Live-gate job on `05e4f436dc6d893d6dc6c023ee3e0d21ba8f21e8`, against checkout `52a9b5cbf7777df55d2d2062cb8d99d862b423bb`. The desk job skipped this file. |
| The booking route and the box office render the journey; the box office has no send control | web | `apps/web/test/journey-panel.test.tsx` › renders the stub journey on the booking route and the box office | Desk job on `05e4f436dc6d893d6dc6c023ee3e0d21ba8f21e8` |
| Three confirmed receipts, no displayed price, and the uncomposed actions listed | web | `apps/web/test/journey-panel.test.tsx` › shows confirmed receipts without a price and lists the steps that stay uncomposed | Desk job on `05e4f436dc6d893d6dc6c023ee3e0d21ba8f21e8` |
| A lost response stays unconfirmed, apart from the last confirmed receipt, and the next send stays off | web | `apps/web/test/journey-panel.test.tsx` › shows an unconfirmed request apart from the last confirmed receipt | Desk job on `05e4f436dc6d893d6dc6c023ee3e0d21ba8f21e8` |
| A gate rejection is the only rejection wording, and later sends stay off | web | `apps/web/test/journey-panel.test.tsx` › shows a gate rejection and blocks the later sends | Desk job on `05e4f436dc6d893d6dc6c023ee3e0d21ba8f21e8` |
| Browser HTTP is unavailable: sends disabled, no stub-shape label, no gate URL, no proxy | web | `apps/web/test/journey-panel.test.tsx` › shows browser HTTP as unavailable, with sends disabled and no stub-shape label; › keeps the journey UI off the gate client and off a dev-server proxy | Desk job on `05e4f436dc6d893d6dc6c023ee3e0d21ba8f21e8` |
| The desk sends the three steps on the stub-shape invoker and stops | web | `apps/web/test/journey-desk.test.ts` › confirms create_event, prepare_trade, and accept_trade on the stub-shape invoker | Desk job on `05e4f436dc6d893d6dc6c023ee3e0d21ba8f21e8` |
| Page-load state clears on reset | web | `apps/web/test/journey-desk.test.ts` › reset clears page-load journeys | Desk job on `05e4f436dc6d893d6dc6c023ee3e0d21ba8f21e8` |

`apps/web/test/journey-panel.test.tsx` has 6 tests. `apps/web/test/journey-desk.test.ts` has 13 tests. Both files passed in that desk job (web suite: 14 files, 76 tests). The adapter file counts from that same SHA are in the live-gate section.

## Run links

Each link is a merged pull request or a Commerce apps CI run on `main`. The SHA is the commit that run executed. The exact-head run of the change that adds this file is not written here. That run does not exist until the supervisor opens the pull request. The pull request body carries it, and it names the job `Typecheck, build, and test (stub)`.

| Record | SHA the run executed | Link |
| --- | --- | --- |
| `w6a-journey-map`, pull request #23, merged | `83f1f17bbfea81a8371e4c598d41f2915102a6e8` | [PR #23](https://github.com/SUNBURN-Golden/kix-commerce-apps/pull/23), [CI run 37728548044](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/37728548044) |
| `w6a-journey-adapter`, pull request #27, merged | `7004cb22154e36b32fe94fb4e6c470c77c44cf42` | [PR #27](https://github.com/SUNBURN-Golden/kix-commerce-apps/pull/27), [CI run 37785728824](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/37785728824) |
| `w6a-journey-test`, pull request #28, merged | `1228072244982eb58724bef6f528c1f448a92e3e` | [PR #28](https://github.com/SUNBURN-Golden/kix-commerce-apps/pull/28), [CI run 37788481383](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/37788481383) |
| `w6a-ui-skeleton`, pull request #29, merged | `8a0d9e98a14eeb06077f3edd7d2d759835d1d827` | [PR #29](https://github.com/SUNBURN-Golden/kix-commerce-apps/pull/29), [CI run 37793141353](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/37793141353) |
| `main` after those four merges (also contains gift-surface #30) | `05e4f436dc6d893d6dc6c023ee3e0d21ba8f21e8` | [CI run 37797755427](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/37797755427) |

On each of those five runs, the jobs `Typecheck, build, and test (stub)` and `Adapter tests against the reviewed gate` both concluded success. The per-file counts below were read from the log of run 37797755427 only.

## Live-gate status

The live suite ran in CI. It did not run in this worktree.

Commerce apps CI run [37797755427](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/37797755427) on apps SHA `05e4f436dc6d893d6dc6c023ee3e0d21ba8f21e8` ran the job `Adapter tests against the reviewed gate`. That job checked out kix-protocol at `52a9b5cbf7777df55d2d2062cb8d99d862b423bb` (`KIX_PROTOCOL_GATE_SHA`) and ran `npm test -w @kix/protocol-adapter` with `KIX_REQUIRE_GATE=1`. The log shows 22 files passed and 162 tests passed, including `booking-journey-gate.test.ts` (5), `booking-journey-live.test.ts` (3), `booking-journey.test.ts` (27), and `booking-journey-parity.test.ts` (4).

The desk job on that same SHA sets `KIX_REQUIRE_GATE=0`. Its log shows `booking-journey-gate.test.ts` (5 skipped) and `booking-journey-live.test.ts` (3 skipped). That skip is not a pass of the live suite. The pass is the live-gate job above.

This node did not run the live suite locally. No reviewed checkout at `52a9b5cbf7777df55d2d2062cb8d99d862b423bb` was available in this worktree. The local command is `KIX_REQUIRE_GATE=0 npm test`. Files that skip under that flag are not a local pass of the live suite.

## Browser run

Browser run not performed in this node. This session has no browser. This node changes no UI. The states below are the assertions in `apps/web/test/journey-panel.test.tsx` and `apps/web/test/journey-desk.test.ts`, which render the panel without a browser. They are not a browser observation.

Those tests, as written, cover the stub success path and the main error paths:

- Stub booking route shows `Send create_event` enabled and `Send prepare_trade` disabled. The box office shows `Catalogue journey`, `Writes happen on the booking screen.`, and `No journey opened on this page load.`, and it does not show `Send create_event`.
- After the three stub-shape sends, the panel shows the receipt fields `eventId`, `policyHash`, `inventoryIds`, `reservationSeconds`, `termsHash`, and `accepted`, with `Last confirmed receipt: accept_trade`. It does not show the fixture price. It lists each `JOURNEY_NOT_COMPOSED` action as not composed, and it shows `reserve_listing`.
- A `REQUEST_TIMEOUT` on `prepare_trade` shows `Last confirmed receipt: create_event` and `Unconfirmed request: prepare_trade`, with the words `Unconfirmed` and `Not a rejection`. Later sends stay disabled.
- A gate rejection shows `Rejected by the gate (EVENT_EXISTS).` Later sends stay disabled.
- An unavailable integration-HTTP model shows `integration-http · unavailable`, `does not fall back to the stub`, and `Code GATE_UNAVAILABLE.` All three sends stay disabled. The markup has no stub-shape label and no `127.0.0.1`.
- `journey-desk.ts`, `journey-source.ts`, and `JourneyPanel.tsx` contain no `fetch(`, no `invokeLocalCall`, and no `fallback`. `vite.config.ts` contains no `proxy`.
- `reset clears page-load journeys` clears the desk's page-load record. That is the unit-test stand-in for a reload. It is not a browser reload.

The screen steps in [wave-6a-ui-skeleton-apps-bind.md](wave-6a-ui-skeleton-apps-bind.md) (send three steps, reload, unknown event id) were not exercised in a browser in this node.

## Opens Wave 7

Merging `w6a-evidence` is the condition that opens Wave 7, as R-7 states. The roadmap row is the gate record. This file does not open Wave 7 by itself. Wave 7 does not start from this text alone.

What stays closed until that merge, and what this file still does not grant: marketing must not call booking, resale, admission, settlement, or credit writes. `organizer-admin-console` and `w7-marketing-align` are waiting on this merge. They are not implemented here. `docs/aiops/PENDING_NODES.json` and `KIX_COMMERCE_PROGRAM_DRAFT.json` stay non-executable.

## Hold

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. `packages/protocol-adapter/src/commerce-bindings.ts` is unchanged. The five pins stay where the gate bind put them.
