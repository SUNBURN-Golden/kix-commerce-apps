# Browser journeys for every synthetic desk (stub) apps bind

Scope: c-plan-c-synthetic-desk-browser-journeys-stub, contract_change=NO. All 35 registry routes with evidence=surface-row have a journey id and four cells (140 cells). Handoff and Help have no surface row. The objective also names docs/c-synthetic-desk-browser-journeys-stub-apps-bind.md; this document uses the authoritative Constraints path instead.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The adapter journey remains create_event → prepare_trade → accept_trade. No new command composition, desk binding, placeHold mapping, capture or settle_capture sequence was added. placeHold keeps consideredAction reserve_listing and stays not-bound. The locked commerce-bindings.ts, pins, protocolMergeSha, CI, .aiops/, docs/aiops/ and bundle-budget.json are unchanged.

## Standing limits

stub only; not HTTP mode; not qualification; not acceptance; not release. This is headless Chrome evidence over synthetic sources and local controls. No real payment, funds movement, bank rail, KYC, credit disbursement, venue scanning, live marketplace, public deployment, SLO or production runtime is involved. Production and truth claims remain false. Session retention remains UNDETERMINED.

The existing harness builds a clean stub bundle and serves only http://127.0.0.1. Every browser cell calls suite.pass, which checks zero fetch/XHR/beacon/WebSocket calls. Each file reports a ledger with zero non-loopback and zero non-GET requests. The external-blocked harness check deliberately tries a forbidden origin in its isolated guard test. It is not a desk request. Run-record redaction and the network harness are unchanged.

Only registry e2e metadata changed in apps/web/src. Tests add no production test id, seed, storage write, network call, fault hook, route interception or injected script. UNKNOWN browser drives use the shipped scenario selectors. Navigation uses in-app links, the marketing hub, catalogue rows and existing keyboard controls.

## Journey × outcome cells

BROWSER means the named check ran in Chrome. REFERENCE is an explicit pointer, with an owner, and does not claim the desk produced an UNKNOWN write. NOT_REACHABLE explains the missing response-loss path and names its owner. Local refusals and empty screens are identified in REJECT notes.

| Journey | SUCCESS | REJECT | UNKNOWN | NOT_BOUND |
| --- | --- | --- | --- | --- |
| box-office | BROWSER `box-office.SUCCESS`  | BROWSER `box-office.REJECT`  | NOT_REACHABLE  The stub-shape desk never loses a response, so no UNKNOWN screen exists to drive. Owner: `c-fault-injection-stub`. | BROWSER `box-office.NOT_BOUND`  |
| booking | BROWSER `booking.SUCCESS`  | BROWSER `booking.REJECT`  | REFERENCE `journeys-table.RESPONSE_LOST.booking` The Journeys table row for this journey's Response lost branch is a reused reference row (not run on that page) with a FENCED or COMPENSATION_UNDEFINED word. Nothing is closed. Owner: `c-cross-surface-journeys-stub`. The desk itself never loses a response in stub mode, so the table row is the only UNKNOWN text for this journey. | BROWSER `booking.NOT_BOUND`  |
| admission | BROWSER `admission.SUCCESS`  | BROWSER `admission.REJECT`  | NOT_REACHABLE  The stub-shape desk never loses a response, so no UNKNOWN screen exists to drive. Owner: `c-fault-injection-stub`. | BROWSER `admission.NOT_BOUND`  |
| resale | BROWSER `resale.SUCCESS`  | BROWSER `resale.REJECT`  | REFERENCE `journeys-table.RESPONSE_LOST.resale` The Journeys table row for this journey's Response lost branch is a reused reference row (not run on that page) with a FENCED or COMPENSATION_UNDEFINED word. Nothing is closed. Owner: `c-cross-surface-journeys-stub`. The desk itself never loses a response in stub mode, so the table row is the only UNKNOWN text for this journey. | BROWSER `resale.NOT_BOUND`  |
| credit | BROWSER `credit.SUCCESS`  | BROWSER `credit.REJECT`  | NOT_REACHABLE  The stub-shape desk never loses a response, so no UNKNOWN screen exists to drive. Owner: `c-fault-injection-stub`. | BROWSER `credit.NOT_BOUND`  |
| gift | BROWSER `gift.SUCCESS`  | BROWSER `gift.REJECT`  Local input-format rejection: the form refuses an incomplete body before creating a controller attempt. It is not a gate rejection. | REFERENCE `journeys-table.RESPONSE_LOST.gift` The Journeys table row for this journey's Response lost branch is a reused reference row (not run on that page) with a FENCED or COMPENSATION_UNDEFINED word. Nothing is closed. Owner: `c-cross-surface-journeys-stub`. The desk itself never loses a response in stub mode, so the table row is the only UNKNOWN text for this journey. | BROWSER `gift.NOT_BOUND`  |
| organizer | BROWSER `organizer.SUCCESS`  | BROWSER `organizer.REJECT`  Local input-format rejection: the form refuses an incomplete body before creating a controller attempt. It is not a gate rejection. | REFERENCE `journeys-table.RESPONSE_LOST.organizer` The Journeys table row for this journey's Response lost branch is a reused reference row (not run on that page) with a FENCED or COMPENSATION_UNDEFINED word. Nothing is closed. Owner: `c-cross-surface-journeys-stub`. The desk itself never loses a response in stub mode, so the table row is the only UNKNOWN text for this journey. | BROWSER `organizer.NOT_BOUND`  |
| receipts | BROWSER `receipts.SUCCESS`  | BROWSER `receipts.REJECT`  The empty and nothing-kept-aside screens. The reader has no reject of its own. | REFERENCE `receipts.UNKNOWN.read-note` The read note says a read never turns an unknown outcome into a confirmed receipt. Owner: `c-receipt-explorer`. | BROWSER `receipts.NOT_BOUND`  |
| buyer | BROWSER `buyer.SUCCESS`  | BROWSER `buyer.REJECT`  Empty receipt and nothing-kept-aside screens, not a producer rejection. | REFERENCE  apps/e2e/tests/journeys/receipts.e2e.test.ts receipts.UNKNOWN.read-note: an observation cannot confirm an unknown write. Owner: `c-receipt-explorer`. | BROWSER `buyer.NOT_BOUND`  |
| discovery | BROWSER `discovery.SUCCESS`  | BROWSER `discovery.REJECT`  Synthetic conflicting filter refused by the discovery source. | REFERENCE  apps/e2e/tests/shared.e2e.test.ts journeys-table.RESPONSE_LOST.booking: reused booking lost-response row. Discovery search has no lost write. Owner: `c-cross-surface-journeys-stub`. | BROWSER `discovery.NOT_BOUND`  |
| inventory | BROWSER `inventory.SUCCESS`  | BROWSER `inventory.REJECT`  Queue-lapsed local selection refusal; nothing sent. | REFERENCE  packages/protocol-adapter/src/inventory-read.ts INVENTORY_SCENARIOS has no lost response scenario; selection is local. Owner: `c-inventory-venue-stub`. | BROWSER `inventory.NOT_BOUND`  |
| mobile | BROWSER `mobile.SUCCESS`  | BROWSER `mobile.REJECT`  | BROWSER `mobile.UNKNOWN`  | BROWSER `mobile.NOT_BOUND`  |
| assistant | BROWSER `assistant.SUCCESS`  | BROWSER `assistant.REJECT`  | BROWSER `assistant.UNKNOWN`  | BROWSER `assistant.NOT_BOUND`  |
| organizer-workspace | BROWSER `organizer-workspace.SUCCESS`  | BROWSER `organizer-workspace.REJECT`  Local input-format refusal before a controller attempt. | REFERENCE  apps/e2e/tests/shared.e2e.test.ts journeys-table.RESPONSE_LOST.organizer: reused organizer row; workspace stub never loses its answer. Owner: `c-cross-surface-journeys-stub`. | BROWSER `organizer-workspace.NOT_BOUND`  |
| merchant | BROWSER `merchant.SUCCESS`  | BROWSER `merchant.REJECT`  | REFERENCE `merchant.UNKNOWN` apps/web/src/merchant-operations.ts: read-lost renders unavailable, not an UNKNOWN write row. Owner: `c-merchant-operations-stub`. Lost read has no ledger; it confirms and resolves no write. | BROWSER `merchant.NOT_BOUND`  |
| finance | BROWSER `finance.SUCCESS`  | BROWSER `finance.REJECT`  | BROWSER `finance.UNKNOWN`  | BROWSER `finance.NOT_BOUND`  |
| provider | BROWSER `provider.SUCCESS`  | BROWSER `provider.REJECT`  | BROWSER `provider.UNKNOWN`  | BROWSER `provider.NOT_BOUND`  |
| credit-origination | BROWSER `credit-origination.SUCCESS`  | BROWSER `credit-origination.REJECT`  | BROWSER `credit-origination.UNKNOWN`  | BROWSER `credit-origination.NOT_BOUND`  |
| credit-servicing | BROWSER `credit-servicing.SUCCESS`  | BROWSER `credit-servicing.REJECT`  | BROWSER `credit-servicing.UNKNOWN`  | BROWSER `credit-servicing.NOT_BOUND`  |
| marketing | BROWSER `marketing.SUCCESS`  | BROWSER `marketing.REJECT`  Hub empty local membership state, not a gate rejection. | NOT_REACHABLE  No published command: the session stub records locally, so there is no command response to lose. Owner: `c-fault-injection-stub`. | BROWSER `marketing.NOT_BOUND`  |
| marketing-journey | BROWSER `marketing-journey.SUCCESS`  | BROWSER `marketing-journey.REJECT`  Source usage-limit-reached disables apply before sending; local eligibility refusal, not a producer rejection. | BROWSER `marketing-journey.UNKNOWN`  | BROWSER `marketing-journey.NOT_BOUND`  |
| platform | BROWSER `platform.SUCCESS`  | BROWSER `platform.REJECT`  | BROWSER `platform.UNKNOWN`  | BROWSER `platform.NOT_BOUND`  |
| marketplace-performance | BROWSER `marketplace-performance.SUCCESS`  | BROWSER `marketplace-performance.REJECT`  The source refuses claims-price; no price assertion. | REFERENCE `marketplace-performance.UNKNOWN` packages/protocol-adapter/src/marketplace-performance.ts: read-lost remains pending; no UNKNOWN row is rendered. Owner: `c-marketplace-performance-stub`. Browser check observes loading with no rows and the lost-answer note; it does not claim a settled unknown write. | BROWSER `marketplace-performance.NOT_BOUND`  |
| permissions | BROWSER `permissions.SUCCESS`  | BROWSER `permissions.REJECT`  | BROWSER `permissions.UNKNOWN`  | BROWSER `permissions.NOT_BOUND`  |
| notifications | BROWSER `notifications.SUCCESS`  | BROWSER `notifications.REJECT`  | BROWSER `notifications.UNKNOWN`  | BROWSER `notifications.NOT_BOUND`  |
| identity | BROWSER `identity.SUCCESS`  | BROWSER `identity.REJECT`  Foreign context rows are refused as this journey evidence; not a gate rejection. | BROWSER `identity.UNKNOWN`  | BROWSER `identity.NOT_BOUND`  |
| session | BROWSER `session.SUCCESS`  | BROWSER `session.REJECT`  After a lost attach, the existing control refuses a second attach with an UNKNOWN reason; not a source rejection. | BROWSER `session.UNKNOWN`  | BROWSER `session.NOT_BOUND`  |
| journeys | BROWSER `journeys.SUCCESS`  | BROWSER `journeys.REJECT`  The source refuses claims-pass; no journey is promoted. | BROWSER `journeys-page.UNKNOWN`  | BROWSER `journeys.NOT_BOUND`  |
| qualification | BROWSER `qualification.SUCCESS`  | BROWSER `qualification.REJECT`  Malformed claims-pass packet refused locally as UNTRUSTED_PACKET; run remains UNKNOWN, not a source rejection or qualification decision. | BROWSER `qualification.UNKNOWN`  | BROWSER `qualification.NOT_BOUND`  |
| release | BROWSER `release.SUCCESS`  | BROWSER `release.REJECT`  Malformed claims-pass packet refused locally as UNTRUSTED_PACKET; run remains UNKNOWN, not a source rejection or release decision. | BROWSER `release.UNKNOWN`  | BROWSER `release.NOT_BOUND`  |
| marketing-m01 | BROWSER `marketing-m01.SUCCESS`  | BROWSER `marketing-m01.REJECT`  Local input-format refusal; nothing recorded. | NOT_REACHABLE  No published command: the session stub records locally, so there is no command response to lose. Owner: `c-fault-injection-stub`. | BROWSER `marketing-m01.NOT_BOUND`  |
| marketing-m02 | BROWSER `marketing-m02.SUCCESS`  | BROWSER `marketing-m02.REJECT`  Guest presale control is disabled with its reason; nothing recorded. | NOT_REACHABLE  No published command: the session stub records locally, so there is no command response to lose. Owner: `c-fault-injection-stub`. | BROWSER `marketing-m02.NOT_BOUND`  |
| marketing-m03 | BROWSER `marketing-m03.SUCCESS`  | BROWSER `marketing-m03.REJECT`  Unknown local coupon is refused; no protocol command. | NOT_REACHABLE  No published command: the session stub records locally, so there is no command response to lose. Owner: `c-fault-injection-stub`. | BROWSER `marketing-m03.NOT_BOUND`  |
| marketing-m04 | BROWSER `marketing-m04.SUCCESS`  | BROWSER `marketing-m04.REJECT`  Unknown local referral is refused; no protocol command. | NOT_REACHABLE  No published command: the session stub records locally, so there is no command response to lose. Owner: `c-fault-injection-stub`. | BROWSER `marketing-m04.NOT_BOUND`  |
| marketing-m05 | BROWSER `marketing-m05.SUCCESS`  | BROWSER `marketing-m05.REJECT`  Local input-format refusal before any consent send. | REFERENCE  apps/web/src/consent-desk.ts: UNKNOWN fence wording; the default stub invoker cannot lose a response. Owner: `w7-m05-consent-bind`. | BROWSER `marketing-m05.NOT_BOUND`  |

Qualification and release reject malformed claims-pass packets as UNTRUSTED_PACKET and keep the run UNKNOWN. Their REJECT checks assert that local refusal, not a source reject or a promotion. Their UNKNOWN checks start read-lost, then switch the actor: the journal records UNKNOWN / CONTEXT_SWITCHED, with no packet and a fenced run control. A lost run is never retried.

The marketplace NOT_BOUND check reads the existing queue boundary: browse access is never a hold, payment, issued right or entry. The bench has no placeHold notice; the check asserts this boundary and the absence of any Send button. Identity/session similarly assert their existing no-protocol-receipt and never-sent notices; no attribute was added to those desks.

## One-attempt checks

Each row covers a real double click, Enter twice and reload. The original booking keeps its three existing check ids. Synthetic sends assert the existing sent/request counter stays at one; reload shows zero sends. Gift/organizer/workspace assert one confirmed operation/result and none after reload. Legacy mock case checks keep a single case phase and no second successful effect; admission keeps the same mock operation facts after repeated consume input. These observations do not claim protocol idempotency or exactly-once delivery.

| Journey with a send control | Required check ids |
| --- | --- |
| box-office | `box-office.one-attempt` |
| booking | `one-attempt.double-click`, `one-attempt.keyboard`, `one-attempt.reload` |
| admission | `admission.one-attempt` |
| resale | `resale.one-attempt` |
| credit | `credit.one-attempt` |
| gift | `gift.one-attempt` |
| organizer | `organizer.one-attempt` |
| organizer-workspace | `organizer-workspace.one-attempt` |
| platform | `platform.one-attempt` |
| finance | `finance.one-attempt` |
| credit-origination | `credit-origination.one-attempt` |
| credit-servicing | `credit-servicing.one-attempt` |
| marketing-journey | `marketing-journey.one-attempt` |
| assistant | `assistant.one-attempt` |
| permissions | `permissions.one-attempt` |
| notifications | `notifications.one-attempt` |
| provider | `provider.one-attempt` |
| identity | `identity.one-attempt` |
| session | `session.one-attempt` |
| mobile | `mobile.one-attempt` |
| qualification | `qualification.one-attempt` |
| release | `release.one-attempt` |
| marketing-m05 | `marketing-m05.one-attempt` |
| marketplace-performance | `marketplace-performance.one-attempt` |

Merchant export, search/filter, inventory selection and buyer receipt/return strips are reads or local selection, not send controls. Marketing M01–M04 write local session records without a published command and assert no Send control. The marketplace queue join is covered while its existing held response is in flight; its counter stays at one through repeated input and zero after reload. M05 covers the locked authorize_marketing control after the explicit set_consent; editing consent is an independently supported new attempt, not a retry.

To avoid duplicating drives, session.UNKNOWN and journeys-page.UNKNOWN remain owned by the existing shared test file. Legacy one-attempt additions are grouped in existing-one-attempt.e2e.test.ts; all 27 new routes have their own journey file.

## Browser run

Local tools: Node v20.19.2, npm 11.21.1, Google Chrome 156.0.8078.47. CI specifies Node 22; the installed Node 20 satisfies the repository engine (>=20), so these are the closest local equivalents, not a Node 22 runner claim.

Base main SHA: `aa8943381bab7619296c93c2c6783dcd7b283e48`. Worktree HEAD: `aa8943381bab7619296c93c2c6783dcd7b283e48`. Changes are uncommitted as requested. Check ids expected in the journey record: 161.

| Field | Observed result |
| --- | --- |
| Browser | Chrome 156.0.8078.47; playwright-core 1.58.2 |
| Suite | 43 files / 174 tests passed; 329.21 s (5 min 29 s), below the 15-minute CI limit |
| Cells | 35 journeys / 140 cells: 120 BROWSER, 12 REFERENCE, 8 NOT_REACHABLE |
| Checks | 162 passed check ids; every expected id and every BROWSER check id present |
| One-attempt denominator | 24 journeys with send controls, all required checks present |
| Network ledger | nonLoopback 0; nonGet 0; appNetworkCalls 0 |
| Record redaction | Existing findSensitiveInRecord(record) returned [] |
| Claims | httpModePass false; productionQualification false; realPayment false; released false |

Complete redacted journey run record (fault suite keeps its existing separate record and denominator):

```json
{
  "mode": "stub",
  "bind": "127.0.0.1",
  "date": "2026-10-23",
  "chrome": "156.0.8078.47",
  "playwrightCore": "1.58.2",
  "baseMainSha": "aa8943381bab7619296c93c2c6783dcd7b283e48",
  "ledger": {
    "nonLoopback": 0,
    "nonGet": 0,
    "appNetworkCalls": 0
  },
  "claims": {
    "httpModePass": false,
    "productionQualification": false,
    "realPayment": false,
    "released": false
  },
  "checks": [
    {
      "checkId": "admission.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "admission.REJECT",
      "pass": true
    },
    {
      "checkId": "admission.SUCCESS",
      "pass": true
    },
    {
      "checkId": "admission.one-attempt",
      "pass": true
    },
    {
      "checkId": "assistant.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "assistant.REJECT",
      "pass": true
    },
    {
      "checkId": "assistant.SUCCESS",
      "pass": true
    },
    {
      "checkId": "assistant.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "assistant.one-attempt",
      "pass": true
    },
    {
      "checkId": "booking.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "booking.REJECT",
      "pass": true
    },
    {
      "checkId": "booking.SUCCESS",
      "pass": true
    },
    {
      "checkId": "box-office.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "box-office.REJECT",
      "pass": true
    },
    {
      "checkId": "box-office.SUCCESS",
      "pass": true
    },
    {
      "checkId": "box-office.one-attempt",
      "pass": true
    },
    {
      "checkId": "buyer.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "buyer.REJECT",
      "pass": true
    },
    {
      "checkId": "buyer.SUCCESS",
      "pass": true
    },
    {
      "checkId": "connectivity.all-screens",
      "pass": true
    },
    {
      "checkId": "connectivity.form-and-refresh",
      "pass": true
    },
    {
      "checkId": "connectivity.no-replay",
      "pass": true
    },
    {
      "checkId": "connectivity.no-service-worker",
      "pass": true
    },
    {
      "checkId": "credit-origination.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "credit-origination.REJECT",
      "pass": true
    },
    {
      "checkId": "credit-origination.SUCCESS",
      "pass": true
    },
    {
      "checkId": "credit-origination.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "credit-origination.one-attempt",
      "pass": true
    },
    {
      "checkId": "credit-servicing.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "credit-servicing.REJECT",
      "pass": true
    },
    {
      "checkId": "credit-servicing.SUCCESS",
      "pass": true
    },
    {
      "checkId": "credit-servicing.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "credit-servicing.one-attempt",
      "pass": true
    },
    {
      "checkId": "credit.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "credit.REJECT",
      "pass": true
    },
    {
      "checkId": "credit.SUCCESS",
      "pass": true
    },
    {
      "checkId": "credit.one-attempt",
      "pass": true
    },
    {
      "checkId": "discovery.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "discovery.REJECT",
      "pass": true
    },
    {
      "checkId": "discovery.SUCCESS",
      "pass": true
    },
    {
      "checkId": "finance.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "finance.REJECT",
      "pass": true
    },
    {
      "checkId": "finance.SUCCESS",
      "pass": true
    },
    {
      "checkId": "finance.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "finance.one-attempt",
      "pass": true
    },
    {
      "checkId": "gift.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "gift.REJECT",
      "pass": true
    },
    {
      "checkId": "gift.SUCCESS",
      "pass": true
    },
    {
      "checkId": "gift.one-attempt",
      "pass": true
    },
    {
      "checkId": "harness.external-blocked",
      "pass": true
    },
    {
      "checkId": "harness.paths",
      "pass": true
    },
    {
      "checkId": "harness.redaction",
      "pass": true
    },
    {
      "checkId": "harness.server",
      "pass": true
    },
    {
      "checkId": "identity.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "identity.REJECT",
      "pass": true
    },
    {
      "checkId": "identity.SUCCESS",
      "pass": true
    },
    {
      "checkId": "identity.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "identity.one-attempt",
      "pass": true
    },
    {
      "checkId": "inventory.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "inventory.REJECT",
      "pass": true
    },
    {
      "checkId": "inventory.SUCCESS",
      "pass": true
    },
    {
      "checkId": "journeys-page.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "journeys-table.RESPONSE_LOST.booking",
      "pass": true
    },
    {
      "checkId": "journeys-table.RESPONSE_LOST.gift",
      "pass": true
    },
    {
      "checkId": "journeys-table.RESPONSE_LOST.organizer",
      "pass": true
    },
    {
      "checkId": "journeys-table.RESPONSE_LOST.resale",
      "pass": true
    },
    {
      "checkId": "journeys.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "journeys.REJECT",
      "pass": true
    },
    {
      "checkId": "journeys.SUCCESS",
      "pass": true
    },
    {
      "checkId": "marketing-journey.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "marketing-journey.REJECT",
      "pass": true
    },
    {
      "checkId": "marketing-journey.SUCCESS",
      "pass": true
    },
    {
      "checkId": "marketing-journey.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "marketing-journey.one-attempt",
      "pass": true
    },
    {
      "checkId": "marketing-m01.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "marketing-m01.REJECT",
      "pass": true
    },
    {
      "checkId": "marketing-m01.SUCCESS",
      "pass": true
    },
    {
      "checkId": "marketing-m02.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "marketing-m02.REJECT",
      "pass": true
    },
    {
      "checkId": "marketing-m02.SUCCESS",
      "pass": true
    },
    {
      "checkId": "marketing-m03.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "marketing-m03.REJECT",
      "pass": true
    },
    {
      "checkId": "marketing-m03.SUCCESS",
      "pass": true
    },
    {
      "checkId": "marketing-m04.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "marketing-m04.REJECT",
      "pass": true
    },
    {
      "checkId": "marketing-m04.SUCCESS",
      "pass": true
    },
    {
      "checkId": "marketing-m05.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "marketing-m05.REJECT",
      "pass": true
    },
    {
      "checkId": "marketing-m05.SUCCESS",
      "pass": true
    },
    {
      "checkId": "marketing-m05.one-attempt",
      "pass": true
    },
    {
      "checkId": "marketing.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "marketing.REJECT",
      "pass": true
    },
    {
      "checkId": "marketing.SUCCESS",
      "pass": true
    },
    {
      "checkId": "marketplace-performance.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "marketplace-performance.REJECT",
      "pass": true
    },
    {
      "checkId": "marketplace-performance.SUCCESS",
      "pass": true
    },
    {
      "checkId": "marketplace-performance.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "marketplace-performance.one-attempt",
      "pass": true
    },
    {
      "checkId": "merchant.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "merchant.REJECT",
      "pass": true
    },
    {
      "checkId": "merchant.SUCCESS",
      "pass": true
    },
    {
      "checkId": "merchant.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "mobile.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "mobile.REJECT",
      "pass": true
    },
    {
      "checkId": "mobile.SUCCESS",
      "pass": true
    },
    {
      "checkId": "mobile.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "mobile.one-attempt",
      "pass": true
    },
    {
      "checkId": "notifications.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "notifications.REJECT",
      "pass": true
    },
    {
      "checkId": "notifications.SUCCESS",
      "pass": true
    },
    {
      "checkId": "notifications.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "notifications.one-attempt",
      "pass": true
    },
    {
      "checkId": "one-attempt.double-click",
      "pass": true
    },
    {
      "checkId": "one-attempt.keyboard",
      "pass": true
    },
    {
      "checkId": "one-attempt.reload",
      "pass": true
    },
    {
      "checkId": "organizer-workspace.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "organizer-workspace.REJECT",
      "pass": true
    },
    {
      "checkId": "organizer-workspace.SUCCESS",
      "pass": true
    },
    {
      "checkId": "organizer-workspace.one-attempt",
      "pass": true
    },
    {
      "checkId": "organizer.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "organizer.REJECT",
      "pass": true
    },
    {
      "checkId": "organizer.SUCCESS",
      "pass": true
    },
    {
      "checkId": "organizer.one-attempt",
      "pass": true
    },
    {
      "checkId": "permissions.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "permissions.REJECT",
      "pass": true
    },
    {
      "checkId": "permissions.SUCCESS",
      "pass": true
    },
    {
      "checkId": "permissions.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "permissions.one-attempt",
      "pass": true
    },
    {
      "checkId": "platform.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "platform.REJECT",
      "pass": true
    },
    {
      "checkId": "platform.SUCCESS",
      "pass": true
    },
    {
      "checkId": "platform.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "platform.one-attempt",
      "pass": true
    },
    {
      "checkId": "provider.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "provider.REJECT",
      "pass": true
    },
    {
      "checkId": "provider.SUCCESS",
      "pass": true
    },
    {
      "checkId": "provider.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "provider.one-attempt",
      "pass": true
    },
    {
      "checkId": "qualification.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "qualification.REJECT",
      "pass": true
    },
    {
      "checkId": "qualification.SUCCESS",
      "pass": true
    },
    {
      "checkId": "qualification.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "qualification.one-attempt",
      "pass": true
    },
    {
      "checkId": "receipts.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "receipts.REJECT",
      "pass": true
    },
    {
      "checkId": "receipts.SUCCESS",
      "pass": true
    },
    {
      "checkId": "receipts.UNKNOWN.read-note",
      "pass": true
    },
    {
      "checkId": "release.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "release.REJECT",
      "pass": true
    },
    {
      "checkId": "release.SUCCESS",
      "pass": true
    },
    {
      "checkId": "release.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "release.one-attempt",
      "pass": true
    },
    {
      "checkId": "resale.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "resale.REJECT",
      "pass": true
    },
    {
      "checkId": "resale.SUCCESS",
      "pass": true
    },
    {
      "checkId": "resale.one-attempt",
      "pass": true
    },
    {
      "checkId": "session.NOT_BOUND",
      "pass": true
    },
    {
      "checkId": "session.REJECT",
      "pass": true
    },
    {
      "checkId": "session.SUCCESS",
      "pass": true
    },
    {
      "checkId": "session.UNKNOWN",
      "pass": true
    },
    {
      "checkId": "session.one-attempt",
      "pass": true
    },
    {
      "checkId": "untrusted-render.csp",
      "pass": true
    }
  ],
  "notRun": [
    "HTTP mode in a browser (needs a kix-protocol gate change)",
    "latency injection and SLO figures (fault cells are in the separate fault record)",
    "in-flight screen (the stub resolves at once)",
    "real device",
    "screen reader",
    "axe or other automated a11y acceptance (c-a11y-acceptance-stub)"
  ]
}
```

## Validation commands and results

Commands below were actually run. Failed iterations are retained so they cannot be mistaken for a pass. Final records are reported separately from skipped live-gate tests.

| Command | Observed result |
| --- | --- |
| `npm ci` | Exit 0; 534 packages installed. npm reported 5 vulnerabilities; no dependency or lock change. |
| `npm test -w @kix/web -- route-e2e-coverage route-registry local-evidence-matrix` | Exit 0; 3 files / 41 tests passed, including the mutated missing-e2e case. |
| `npm exec -w @kix/e2e -- vitest run --config ../../.kix-matrix.config.mjs` | Exit 0; 5 pure matrix tests passed. Temporary matrix-only config removed. |
| `npm run typecheck` | Exit 0. |
| `npm run build` | Exit 0; clean production build, with existing chunk-size warning. |
| `KIX_REQUIRE_GATE=0 npm test` | First run: two existing adapter tests timed out. Second run: exit 0; adapter 65 files / 1,335 tests passed, 5 files / 23 tests skipped; web 81 files / 1,068 tests passed. No timeout or CI settings were changed. |
| `npm run typecheck:e2e` | Early iterations caught unused/missing imports; corrected. Final code typecheck passed. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:e2e -- journeys/inspect` | Temporary read-only UI inspection: 1, then 16 checks passed; teardown correctly failed for missing full-suite ids. One intermediate inspection timed out. Inspection file removed. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kix-e2e-first.json npm run test:e2e` | First full iteration: 45 failed / 122 passed; 506.44 s. Corrected expected words, phases, selectors and real unreachable/read states. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kix-e2e-second.json npm run test:e2e` | Second full iteration: 13 failed / 161 passed; 451.12 s. Remaining assertions corrected; one page-load timeout occurred during coverage contention. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kix-e2e-third.json npm run test:e2e` | Exit 0; all 43 files / 174 tests passed in 329.21 s; all 161 required ids among 162 passed check ids, ledger zeros. |
| `npm run budget` | Exit 0; initial JS gzip 288,623 bytes <= 290,000; total gzip 783,078; route budgets strict and all passed. Budget file unchanged. |
| `npm run lint` | Exit 0. |
| `npm run deps:check` | Exit 0; 4 manifests and 630 lockfile entries checked. |
| `npm run cycle-check` | Exit 0; no circular imports in adapter, web or e2e. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | First run: existing form-validation interaction timed out at 5 s during parallel local verification. Second unchanged run: exit 0; all adapter and web coverage floors met (adapter statements/lines 91.22, functions 97.44, branches 84.59; web statements/lines 91.36, functions 76.86, branches 88.07). |
| `git diff --check` | Exit 0. |
| `git diff --exit-code packages/protocol-adapter/src/commerce-bindings.ts apps/web/bundle-budget.json .github .aiops docs/aiops` | Exit 0; locked paths unchanged. |
| `git diff --exit-code apps/e2e/src/browser.ts apps/e2e/src/static-server.ts apps/e2e/src/build.ts apps/e2e/src/redact.ts apps/e2e/src/run-record.ts apps/web/test/storage-allow-list.test.ts apps/web/test/untrusted-render-static.test.ts` | Exit 0; harness, record redaction and static guards unchanged. |

| Command | Observed result |
| --- | --- |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kix-a11y.json npm run test:a11y` | First run: 268 passed / 1 existing booking axe scan timed out. No accessibility finding failed. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kix-a11y2.json npm run test:a11y` | Unchanged rerun: exit 0; 15 files / 269 tests passed in 352.72 s. Ledger zeros; acceptance/conformance/release claims remain false. Existing MaxListenersExceededWarning messages were printed. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_BUDGET_RECORD_OUT=/tmp/kix-browser-budget.json npm run test:budget` | Exit 0; 3 files / 9 tests passed in 25.71 s; ledger zeros. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-visual.json KIX_VISUAL_OUT=/tmp/kix-visual-out npm run test:visual` | Exit 0; 3 files / 42 tests passed in 38.35 s against committed baselines; ledger zeros. No baseline was edited. |
| `npm run audit:warn` | Exit 0; production audit found 0 vulnerabilities. |
| `node_modules/.bin/vite-node .kix-record-check.ts` | Exit 0; pure cross-check: matrixProblems [], 120 BROWSER ids and every one-attempt id present, all 161 required ids among 162 passed ids, redaction [], ledger zeros. Temporary verifier removed. |
| `node --version`, `npm --version`, `/usr/bin/google-chrome --version` | Node v20.19.2; npm 11.21.1; Chrome 156.0.8078.47. |
| `git diff --exit-code package-lock.json packages/protocol-adapter/src/commerce-bindings.ts apps/web/bundle-budget.json .github .aiops docs/aiops` | Exit 0 after all validation; locked files and dependency lock unchanged. |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` | 83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249 (unchanged). |

The final narrow web rerun again passed 3 files / 41 tests. Final e2e typecheck and lint both exited 0 after the final test edits. The complete run above stayed under the browser CI job limit without grouping the 27 route files or changing CI.

## Deviations and unverified scope

- Included all 35 surface-row routes, including the marketing hub/sections, marketplace bench and organizer workspace, as required by the registry drift checks.
- Matched actual rendering: merchant read-lost is unavailable; marketplace read-lost stays pending. Their UNKNOWN cells are REFERENCE with concrete pointers and owners. Marketing usage-limit is a local eligibility refusal. Packet claim refusals remain UNKNOWN; no production behavior was changed.
- Merchant export is a repeatable explicit read, not a send. The marketplace queue join does get its own one-attempt check. Legacy send checks share one test file.
- The two existing evidence docs were re-rendered in place for registry/surface browser mappings. Historical base, pin and node facts were preserved. No stale replacement lines were appended.
- Local Node 20.19.2 was used; CI specifies Node 22. No workflow or runtime dependency was changed.
- No HTTP-mode browser pass, reviewed live-gate pass, service qualification, user acceptance, real-device result, release or production claim is made. Live-gate tests skipped under KIX_REQUIRE_GATE=0 stay skipped.

## Files changed

- `apps/e2e/src/journey-matrix.ts`
- `apps/e2e/src/synthetic-desk.ts`
- `apps/e2e/tests/journeys/assistant.e2e.test.ts`
- `apps/e2e/tests/journeys/buyer.e2e.test.ts`
- `apps/e2e/tests/journeys/credit-origination.e2e.test.ts`
- `apps/e2e/tests/journeys/credit-servicing.e2e.test.ts`
- `apps/e2e/tests/journeys/discovery.e2e.test.ts`
- `apps/e2e/tests/journeys/existing-one-attempt.e2e.test.ts`
- `apps/e2e/tests/journeys/finance.e2e.test.ts`
- `apps/e2e/tests/journeys/identity.e2e.test.ts`
- `apps/e2e/tests/journeys/inventory.e2e.test.ts`
- `apps/e2e/tests/journeys/journeys.e2e.test.ts`
- `apps/e2e/tests/journeys/marketing-journey.e2e.test.ts`
- `apps/e2e/tests/journeys/marketing-m01.e2e.test.ts`
- `apps/e2e/tests/journeys/marketing-m02.e2e.test.ts`
- `apps/e2e/tests/journeys/marketing-m03.e2e.test.ts`
- `apps/e2e/tests/journeys/marketing-m04.e2e.test.ts`
- `apps/e2e/tests/journeys/marketing-m05.e2e.test.ts`
- `apps/e2e/tests/journeys/marketing.e2e.test.ts`
- `apps/e2e/tests/journeys/marketplace-performance.e2e.test.ts`
- `apps/e2e/tests/journeys/merchant.e2e.test.ts`
- `apps/e2e/tests/journeys/mobile.e2e.test.ts`
- `apps/e2e/tests/journeys/notifications.e2e.test.ts`
- `apps/e2e/tests/journeys/organizer-workspace.e2e.test.ts`
- `apps/e2e/tests/journeys/permissions.e2e.test.ts`
- `apps/e2e/tests/journeys/platform.e2e.test.ts`
- `apps/e2e/tests/journeys/provider.e2e.test.ts`
- `apps/e2e/tests/journeys/qualification.e2e.test.ts`
- `apps/e2e/tests/journeys/release.e2e.test.ts`
- `apps/e2e/tests/journeys/session.e2e.test.ts`
- `apps/e2e/tests/matrix.e2e.test.ts`
- `apps/web/src/shell/route-registry.ts`
- `apps/web/test/route-e2e-coverage.test.ts`
- `apps/web/test/support/local-evidence-matrix.ts`
- `apps/web/test/support/route-registry-checks.ts`
- `docs/c-local-evidence-matrix-stub-apps-bind.md`
- `docs/c-plan-c-synthetic-desk-browser-journeys-stub-apps-bind.md`
- `docs/c-route-registry-navigation-stub-apps-bind.md`
