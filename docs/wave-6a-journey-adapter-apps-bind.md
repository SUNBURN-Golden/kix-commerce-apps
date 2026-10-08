# Wave 6-A journey adapter apps bind

This bind is the adapter helper for the candidate chain in [wave-6a-journey-map-apps-bind.md](wave-6a-journey-map-apps-bind.md). Stub mode stays the default. HTTP mode stays the opt-in loopback. This document adds no command, no read, no retry, and no desk binding.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The Wave 6 gate record is [kix-protocol issue 56, comment 5868307343](https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343). Wave 7 stays shut until `w6a-evidence` merges (`docs/decisions/PROGRAM_ROADMAP_20260930.md` §2 R-7). No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the gate bind put them.

## Ruling

M2 is selected. The helper composes nothing past `accept_trade`. `capture` and `settle_capture` are never composed and never sent. `commit_trade`, `open_admission`, and `admit` stay uncomposed. The helper only records their not-composed reasons.

H1 is selected. `placeHold.consideredAction` stays `reserve_listing`. `placeHold` stays not-bound. `prepare_trade` is only an `invokeLocalCall` body. `placeHold({ eventId, quantity })` is not mapped onto it. `packages/protocol-adapter/src/commerce-bindings.ts` is unchanged.

## Composed chain and bodies

`BookingJourney` calls an existing `invokeLocalCall` three times, in this order, each with a caller-chosen `operationId`:

`create_event` → `prepare_trade` → `accept_trade`

The domain on every body is `kix:fixture:lifecycle:0.3`. The helper checks each body with the vendored command schema before the call. It does not add optional fields and it does not default a price, a fee, or a refund profile. Those values come from the caller.

| Step | Actor | Body |
| --- | --- | --- |
| `create_event` | `operator` | `domain`, `eventId`, `organizer`, `policy`, `seats` |
| `prepare_trade` | the caller-supplied `buyer` id | `domain`, `tradeId`, `inventoryId` from `inventoryIds[seatIndex ?? 0]`, `amount` equal to the `primaryPrice` on the create request, `buyer`, `expectedInventoryVersion` `0`, `expectedVersion` `0` |
| `accept_trade` | the same `buyer` id | `domain`, `tradeId`, `termsHash`, both copied from the prepare receipt |

The map names the prepare and accept actor as `buyer`. The reference role check requires that actor string to be the buyer id on the body (`Harness.prepare` passes the buyer as both). A literal actor `buyer` with a different body buyer is `UNAUTHORIZED_FIXTURE_ACTOR`. The helper therefore sends the caller-supplied buyer id as the actor. It does not invent one.

`prepare_trade` omits `ticketId`, `listingId`, `listingHash`, and `expiresAt`. The helper does not recompute `termsHash` and does not compute an inventory id.

## Receipt checks

The check is on top of the published receipt envelope (`domain`, `operationId`, `sequence`, `action`, `result`). These result objects are the reference returns at the reviewed tree (`52a9b5cbf7777df55d2d2062cb8d99d862b423bb`, feature `c7238bc24a399a6cabbab87ac23dbfd7e9c252dd`). A missing field, a mismatched value, or an extra result key is `UNKNOWN` with code `INVALID_RECEIPT`, not a success.

| Step | Result |
| --- | --- |
| `create_event` | `eventId` equals the id sent, `policyHash` is a non-empty string, `inventoryIds` is one non-empty string per seat, `reservationSeconds` is an integer |
| `prepare_trade` | `tradeId` equals the id sent, `ticketId` and `externalOrderId` are non-empty strings, `status` is `PREPARED`, `termsHash` is a non-empty string |
| `accept_trade` | `accepted` is `true` |

## Outcomes and fences

| Outcome | When |
| --- | --- |
| `RECEIPT` | The step's result matches the table |
| `REJECTED` | `invokeLocalCall` throws `GateRejectedError` (HTTP 422, or any body with `rejected: true`) |
| `UNKNOWN` | Any other `ProtocolError` that carries trace ids, or a returned receipt that fails the result check |
| `NOT_SENT` | The helper threw before the call (schema or missing caller input). The method rejects. Later steps are fenced |
| `FENCED` | The journey is halted, the step is out of order, the step already ran, or a call is in flight. Nothing is sent |

A rejection or an unknown outcome stores the failing `operationId`, actor, action, body, and, when the transport supplied them, `requestId`, `correlationId`, and `code`. The next call returns `FENCED` and does not mint a replacement `operationId`. There is no retry and no `Idempotency-Key`. A repaired attempt is a new `BookingJourney` and new caller-chosen ids. This helper adds no read.

A non-422 response whose body is not marked `rejected: true` stays `UNKNOWN`. The reviewed gate marks parsed rejections with `rejected: true`, including its HTTP 422 body. A gate-supplied `error` string such as `REQUEST_TIMEOUT` does not by itself classify the outcome; the typed rejection does.

A response that is cut off after the server has applied the effect is `UNKNOWN`. The helper does not replay that `operationId`. A test-only oracle may replay the same id and body to show the stored receipt. That replay is not helper behaviour.

## Not composed (M2)

| Action | Recorded reason |
| --- | --- |
| `capture` | Nothing past `accept_trade`. Never composed, never sent. `confirmBooking` stays not-bound. |
| `settle_capture` | Stays out of the journey. `settlementPreview` stays not-bound. |
| `commit_trade` | Stays uncomposed. This journey does not capture. `commitSettlement` is not `commit_trade`. |
| `open_admission` | Stays uncomposed. No desk method posts it. |
| `admit` | Stays uncomposed. `checkAdmission` is not the admit body. |

`JOURNEY_NOT_COMPOSED` holds those reasons. The helper has no method for these actions.

## Desk methods (H1)

| Method | `consideredAction` | Stays not-bound because |
| --- | --- | --- |
| `placeHold` | `reserve_listing` | `placeHold({ eventId, quantity })` is not `reserve_listing`, and it is not `prepare_trade` |
| `confirmBooking` | `capture` | `confirmBooking(holdId)` is not the capture body, and this journey does not send `capture` |
| `settlementPreview` | `settle_capture` | The binding calls `settle_capture` a monetary posting the desk does not send |
| `checkAdmission` | `admit` | `checkAdmission({ rightsRef, gateId })` is not the admit body |

`JOURNEY_DESK_NOT_BOUND` quotes `COMMERCE_COMMAND_BINDINGS`. It does not rewrite them.

## Guard review result

`enforceRemotePayloadGuards` was run, through `invokeLocalCall`, on the three composed success results and on the not-composed shapes as read-only fixtures: `captured` / `cashAvailable`, `settled` / `grossAccounted` / `feeBearer`, `ticketId` / `owner` / `rightsVersion` / `admissionEpoch`, `admissionStatus`, and `admissionId` / `decision`. Those receipts are accepted. No guard change was required.

The same walk still rejects a nested `payment` other than `simulated-no-funds`, a settlement `mode` that is not mock, and a `listingId` paired with an amount. Production, truth, money, and credit flag checks are unchanged.

## Hold

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. The five pins stay where the gate bind put them.
