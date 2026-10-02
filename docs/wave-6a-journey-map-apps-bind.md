# Wave 6-A journey map apps bind

This bind maps one receipt-chained mock booking onto published catalogue commands. It is the Wave 6-A step in kix-protocol `docs/decisions/PROGRAM_DECISIONS_20260928.md` §3 (Wave 6 open; mock backend only) and §6 (Wave 6-A booking and box-office skeleton). Stub mode stays the default. HTTP mode stays the opt-in loopback in [http-integration-gate-apps-bind.md](http-integration-gate-apps-bind.md). This document adds no command, no read, no retry, and no desk binding.

The chain below is the candidate primary-seat journey. Two rulings are still open. `w6a-journey-adapter` must not compose either ruling until Astra records the choice. This file does not make that choice.

## Sources

Catalogue and gate pins are unchanged. Both OpenAPI files, `PINNED_ACTIONS`, `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay on the reviewed merge.

| Source | Pin |
| --- | --- |
| Integration-gate merge | `52a9b5cbf7777df55d2d2062cb8d99d862b423bb` (feature `c7238bc24a399a6cabbab87ac23dbfd7e9c252dd`, one tree) |
| Contract-only OpenAPI sha256 | `fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e` |
| Gate OpenAPI sha256 | `2a2af554cb1a8b128f2cf1b1d5b8cf6b1c8fa90adf30865dbc3e64932b3bd13f` |
| `protocol_contract.json` sha256 | `ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e` |
| Domain on every body | `kix:fixture:lifecycle:0.3` |

Receipt fields below are the reference result objects at that merge:

- `reference/v0.3-rc1/lifecycle.py`: `_create_event`, `_prepare_trade`, `_reserve_listing`, `_open_admission`, `_expire_trade`
- `reference/v0.3-rc1/core.py`: `execute`, `_accept_trade`, `_capture`, `_commit_trade`, `_abort_trade`, `_admit`
- `reference/v0.3-rc1/finance.py`: `_settle_capture`, `replay_receipt`
- `reference/v0.3-rc1/test_core.py`: `Harness.prepare`, `Harness.capture`, `Harness.purchase`, `LifecycleTests.test_purchase_resale_admission_and_exact_payouts`, `test_late_payment_after_abort_never_mints_ticket`, `test_event_completion_aborts_unfinished_checkout`, `test_capture_is_not_available_cash`, `test_original_qr_invalid_after_resale`

The apps live test `packages/protocol-adapter/test/http-integration-gate.test.ts` already posts `create_event`, `open_admission`, `capture`, `settle_capture`, `admit`, and `accept_trade` at this pin. `capture` and `settle_capture` use `provenance: "synthetic"` and the reference fixture scope. Those calls use a missing trade or ticket, so the gate rejects `TRADE_NOT_FOUND` or `TICKET_NOT_FOUND`. The test does not chain a success receipt into the next body. The causal links are the reference modules above.

`packages/protocol-adapter/src/commerce-bindings.ts` leaves every `COMMERCE_METHODS` entry `not-bound`. `consideredAction` is a nearest name, not a request.

## Candidate chain

One primary seat. The caller keeps each request body it sent. A success receipt does not echo every field the next body needs.

`create_event` → `prepare_trade` → `accept_trade` → `capture` → `settle_capture` (optional) → `commit_trade` → `open_admission` → `admit`

No step is a read. `presentAdmission` stays a `/health` probe and does not post `admit`.

| Step | Actor | Body fields taken from the previous success receipt | Body fields the caller keeps from its own request | Success `result` |
| --- | --- | --- | --- | --- |
| `create_event` | `operator` | none | `eventId`, `organizer`, `policy`, `seats` | `eventId`, `policyHash`, `inventoryIds`, `reservationSeconds` |
| `prepare_trade` | `buyer` | one `inventoryIds` entry → `inventoryId` | `tradeId`; `amount` equal to the `primaryPrice` sent on `create_event`; `buyer`; `expectedInventoryVersion` `0` and `expectedVersion` `0` for that fresh row | `tradeId`, `ticketId`, `externalOrderId`, `status` `PREPARED`, `termsHash` |
| `accept_trade` | `buyer` | `tradeId`, `termsHash` | none | `accepted` `true` |
| `capture` | `pg-adapter` | `externalOrderId` → `orderId`; `tradeId` | `amount`, `currency` `KRW`, `buyer`; caller-chosen `paymentId`; `provenance` `synthetic`; `scope` the reference fixture scope | `captured` `true`, `cashAvailable` `false` |
| `settle_capture` | `pg-adapter` | `tradeId` | the `capture` request's `paymentId`, `amount`, and `currency`; caller-chosen `movementId`; `provenance` `synthetic`; the same fixture `scope`; the fixture settlement statement fields the live test already sends | `settled`, `grossAccounted`, `feeBearer` `platform` |
| `commit_trade` | `operator` | `tradeId` | none | `ticketId`, `owner`, `rightsVersion`, `admissionEpoch` |
| `open_admission` | `operator` | `create_event` `eventId` | none | `admissionStatus` `OPEN` |
| `admit` | `venue` | `commit_trade` `ticketId`; `owner` → `holder`; `rightsVersion` → `expectedVersion`; `admissionEpoch` | none | `admissionId`, `decision` `ADMITTED_ONCE` |

`open_admission` does not depend on the trade. It uses the event id from `create_event`. `admit` waits until `commit_trade` returned, because that receipt is the presentation.

### How each link is fixed

`create_event` returns `inventoryIds` in seat order. `prepare_trade` for this journey sends one of those ids as `inventoryId` and omits `ticketId`. Sending both is `AMBIGUOUS_RIGHT_REFERENCE`. A fresh inventory row starts at version `0`, and the right created for it starts at `rightsVersion` `0`. Those zeros are the reference initial values in `_create_event` and `new_right`. They are not receipt fields. This journey does not interleave another inventory command. `STALE_INVENTORY_VERSION` or `STALE_RIGHTS_VERSION` fences the next write. The caller does not compute an inventory id and does not read one back.

`amount` on `prepare_trade` is the `primaryPrice` the caller put in the `create_event` policy. The receipt returns `policyHash`, not the price. A primary price other than that policy value is `PRIMARY_PRICE_MISMATCH`.

`prepare_trade` may omit `expiresAt`. The reference then uses the clock plus `reservationSeconds` from the create receipt. The default create path uses `900`. An explicit `expiresAt` has to fall inside that window.

On a primary seat, `_prepare_trade` sets `accepted` true before `accept_trade`. `accept_trade` still runs. It copies `tradeId` and `termsHash` from the prepare receipt and returns `{ accepted: true }`. It adds no field to `capture`. `TERMS_MISMATCH` or `TRADE_NOT_ACCEPTABLE` fences `capture`. The caller copies `termsHash`. It does not recompute it.

`capture.orderId` is `externalOrderId` from the prepare receipt. The trade id is not the order id. The reference rejects a mismatch as `CAPTURE_BINDING_MISMATCH`. `amount`, `currency`, and `buyer` must equal the prepare trade. The prepare receipt does not echo them, so the caller keeps the prepare request. `paymentId` is chosen by the caller. The capture receipt does not echo it. `provenance` is the string `synthetic`. `scope` is the fixture scope already used by the live test (`provider` `toss`, `environment` `test`, `merchant` `kix-fixture`, `channel` `card`). The actor is `pg-adapter`. Any other provenance or scope is `SOURCE_SCOPE_MISMATCH`. `cashAvailable: false` means the capture is not spendable cash. The same evidence binding returns `{ duplicate: true }` and does not post again.

`settle_capture` is optional for `commit_trade`. `_commit_trade` requires `captured`, `accepted`, status `PREPARED`, the lock, the expected rights version, an open event, open sales, and a clock inside the reservation. It does not require `settled`. `test_core.py` `Harness.purchase(..., settle=False)` commits without `settle_capture`. When the step is included, `paymentId` is the capture request's payment id, and the statement fields match the live test: `feeAmount`, `taxAmount`, `heldAmount`, and `adjustmentAmount` are `0`, `grossAmount` equals `amount`, `feeBearer` is `platform`, and `contractRef` is `fixture:settlement:v1`. This document does not compute a fee split.

`commit_trade` returns the presentation `admit` sends. `open_admission` uses the create receipt's `eventId`. The create default `admissionStatus` is already `OPEN`. The journey still sends `open_admission` before `admit`, which is the live test's order. `admit` requires the holder, rights version, and admission epoch from the commit receipt. An older triple is `STALE_OR_WRONG_PRESENTATION`. `test_original_qr_invalid_after_resale` is that fence after a later transfer. This journey does not transfer the seat. A commit receipt used after some other command has moved the right is stale, and the next write stays fenced.

## Operation identity and outcomes

Every call is `invokeLocalCall` with its own `operationId`. The reference fingerprint is the actor, the action, and the body. The same id and the same fingerprint return the stored receipt through `replay_receipt`. A different body for that id is `OPERATION_ID_CONFLICT`. The apps client sends one attempt. It does not send `Idempotency-Key`, does not follow redirects, and does not fall back to the stub.

A stored success receipt is `{ domain, operationId, sequence, action, result }` for that same id and action. `sequence` is not a request field.

A parsed rejection is a rejection. The reference raises `Rejected` before commit, so the effect is absent. On the gate, HTTP 422 and any body with `rejected: true` stay rejections. The next command is not sent. The same `operationId` is not reused with a repaired body.

A missing authoritative receipt is `UNKNOWN`. That includes `REQUEST_TIMEOUT`, a closed port after the request was written (`GATE_UNAVAILABLE`), and a body cut off mid-read. The reference can tell a pre-commit rollback (`fail_before_commit`) from a commit followed by `INJECTED_RESPONSE_LOSS_AFTER_COMMIT`. The HTTP client cannot. Both look like a lost response. The journey treats both as `UNKNOWN`. The caller does not start the next step, does not mint a replacement `operationId`, and does not retry. A non-authoritative read cannot prove payment, issuance, or admission. This node adds no read.

`STALE_RESPONSE` is a correlation-id mismatch. It is not a business receipt and it is not success.

`duplicate: true` on `capture` or `settle_capture` is the reference evidence binding seen again. It is not an apps retry and it is not the stub settlement journal.

## Stale receipts, expiry, and cancellation

The next write is fenced when the receipt it needs is missing, rejected, or stale. Fences named by the reference for this chain:

| Condition | Reference result | Next write |
| --- | --- | --- |
| Prepare response lost | `UNKNOWN` | no `accept_trade` and no `capture` |
| `termsHash` not the prepare receipt | `TERMS_MISMATCH` | no `capture` |
| Clock at or past `expiresAt`, or event not open | `TRADE_NOT_ACCEPTABLE` | no `accept_trade` |
| Capture `orderId` is not `externalOrderId` | `CAPTURE_BINDING_MISMATCH` | no `commit_trade` |
| Commit response lost | `UNKNOWN` | no `admit` |
| Admit presentation is not the commit receipt | `STALE_OR_WRONG_PRESENTATION` | stop |
| Inventory or rights version is not the fresh-row zero | `STALE_INVENTORY_VERSION` or `STALE_RIGHTS_VERSION` | stop |

`abort_trade` is the synthetic cancellation while the trade is `PREPARED`. The actor is `operator`, the buyer, or the seller. The receipt is `{ status: "VOID", refundDue }`. The ticket lock is cleared. `expire_trade`, after `advance_clock` has reached `expiresAt`, voids a prepared trade and returns `lateCommitFenced: true`. A later `commit_trade` is `TRADE_NOT_COMMITTABLE`. `test_late_payment_after_abort_never_mints_ticket` and `test_event_completion_aborts_unfinished_checkout` show a capture that arrives after the trade is void: the reference records the refund duty and does not mint the owner. Those tests are the compensation evidence. This journey does not map `refund_ticket`, `prepare_effect`, `send_effect`, or `observe_effect`, and it does not copy settlement arithmetic.

`close_sales` and `complete_event` also void a prepared trade. They are not steps of this chain.

## Desk methods

The chain serves no bound desk method. Every entry in `COMMERCE_METHODS` stays `not-bound`. The nearest names, and the methods that stay not-bound beside them:

| Catalogue command | Nearest desk method | Stays not-bound because |
| --- | --- | --- |
| `create_event` | none | No desk method takes the create body. `registerReservationShow` is a stub FSM command. |
| `prepare_trade` | `placeHold` | `placeHold({ eventId, quantity })` is not the prepare body. See the open ruling below. |
| `accept_trade` | none on this journey | `acceptResale(listingId)` is the resale neighbour and stays not-bound. |
| `capture` | `confirmBooking` | `confirmBooking(holdId)` is not the capture body. `captureSettlement` is a stub phase, not catalogue `capture`. |
| `settle_capture` | `settlementPreview` | The binding calls `settle_capture` a monetary posting the desk does not send. |
| `commit_trade` | `commitSettlement` | The binding states `commitSettlement` is not `commit_trade`. |
| `open_admission` | none | No desk method posts `open_admission`. |
| `admit` | `checkAdmission` | `checkAdmission({ rightsRef, gateId })` is not the admit body. `presentAdmission` reads `/health` only. |

Resale, credit, reservation FSM, and admission FSM methods stay not-bound. This journey does not call `reserve_listing`, `create_listing`, `offer_gift`, or `release_inventory`.

## Open rulings

These are options. This document selects none of them.

### Capture and settle_capture

`commerce-bindings.ts` describes `capture` and `settle_capture` as monetary postings the desk does not send. `confirmBooking` and `settlementPreview` stay not-bound for that reason. The live gate test already posts both actions with `provenance: "synthetic"` and the fixture scope, and the reference accepts that provenance only. [settlement-depth-apps-bind.md](settlement-depth-apps-bind.md) already says an explicit `invokeLocalCall` may post `settle_capture` while the desk method stays not-bound.

- Option M1. The adapter may later compose `capture`, and optional `settle_capture`, only as `invokeLocalCall` with the published bodies in the table above. Desk methods stay not-bound. Their arguments are not rewritten into those bodies. `commit_trade` and `admit` stay behind a successful `capture` receipt.
- Option M2. The adapter composes nothing past `accept_trade`. `capture` and `settle_capture` stay out of the journey. `commit_trade` requires a capture, so this option also leaves `commit_trade` and `admit` uncomposed.

Remapping `confirmBooking`, `captureSettlement`, `settlementPreview`, or `commitSettlement` onto a catalogue body is not an option. That would be a desk-method remap onto a different body.

### placeHold and prepare_trade

`placeHold` is `not-bound` with `consideredAction` `reserve_listing`. `_reserve_listing` prepares a trade from an existing listing. It requires `listingId`, `listingHash`, `expiresAt`, and `tradeId`. It does not take `eventId` or `quantity`. The primary journey's prepare step takes an `inventoryId` from `create_event`.

- Option H1. Leave `consideredAction` as `reserve_listing`. `placeHold` stays not-bound. The primary journey calls `prepare_trade` only through `invokeLocalCall` with the published body. `reserve_listing` remains the listing path and is not this journey.
- Option H2. Change the nearest-name note so `placeHold`'s `consideredAction` is `prepare_trade`, and leave `status` `not-bound`. `placeHold({ eventId, quantity })` is still not sent. No request is added.

Binding `placeHold` by turning `eventId` and `quantity` into a `prepare_trade` body is not an option.

## Hold

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. The five pins stay where the gate bind put them. Wave 7 stays shut until `w6a-evidence` merges (`docs/decisions/PROGRAM_ROADMAP_20260930.md` §2 R-7).
