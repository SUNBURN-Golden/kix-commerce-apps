# Organizer console apps bind

This bind is the adapter helper for the organizer event lifecycle: `create_event`, `close_sales`, `open_admission`, `complete_event`, `cancel_event`, and `issue_invitation`. Stub mode stays the default. HTTP mode stays the opt-in loopback. This document adds no command, no read, no retry, and no desk binding.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The Wave 6 gate record is [kix-protocol issue 56, comment 5868307343](https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343). Wave 7 stays shut until `w6a-evidence` merges (`docs/decisions/PROGRAM_ROADMAP_20260930.md` §2 R-7). The roadmap is [kix-protocol docs/decisions/PROGRAM_ROADMAP_20260930.md](https://github.com/BeautifulMind-JT/kix-protocol/blob/main/docs/decisions/PROGRAM_ROADMAP_20260930.md). No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the gate bind put them.

## Ruling

M2 is selected. The booking journey composes nothing past `accept_trade`: `create_event`, then `prepare_trade`, then `accept_trade`. `capture` and `settle_capture` are never composed and never sent. `commit_trade`, `open_admission`, and `admit` stay uncomposed on that journey. `JOURNEY_NOT_COMPOSED` is unchanged. `BookingJourney` still does not compose `open_admission`.

This console is a separate surface, as `GiftTransfer` is. `open_admission` and `issue_invitation` stay uncomposed by the journey and the gift helper. They are sent only by this console. The ruling's "stays uncomposed" line is about the journey helper, not a ban on this route.

H1 is selected. `placeHold.consideredAction` stays `reserve_listing`. `placeHold` stays not-bound. `prepare_trade` is only an `invokeLocalCall` body on the journey. `placeHold({ eventId, quantity })` is not mapped onto it. `packages/protocol-adapter/src/commerce-bindings.ts` is unchanged. The organizer console is not a `CommerceProtocol` desk method, so there is no new `COMMERCE_METHODS` entry.

## What is posted

`OrganizerConsole` calls an existing `invokeLocalCall`. `create_event` is optional. The other commands take a caller-typed `eventId`. The gate decides whether that order is legal. This client does not copy a lifecycle order. Each call uses a caller-chosen `operationId`.

The domain on every body is `kix:fixture:lifecycle:0.3`. The helper checks each body with the vendored command schema before the call. It does not add `admissionStatus`, `issuerId`, or `sessionId` on `create_event`. `reservationSeconds` is included only when the caller typed one, and a blank value stays omitted. The helper does not default it. It does not default `policy`, `invitationQuota`, `seats`, or a price. The desk reuses the existing synthetic show fixture as the only policy source and does not render it.

| Step | Actor | Body |
| --- | --- | --- |
| `create_event` | `operator` | `domain`, `eventId`, `organizer`, `policy`, `seats`, plus `invitationQuota` or `reservationSeconds` only when the caller typed one |
| `close_sales` | `operator` | `domain`, `eventId` |
| `open_admission` | `operator` | `domain`, `eventId` |
| `complete_event` | `operator` | `domain`, `eventId` |
| `cancel_event` | `operator` | `domain`, `eventId` |
| `issue_invitation` | the caller-supplied organizer id | `domain`, `inventoryId`, `expectedInventoryVersion`, `recipient` |

`issue_invitation` does not put `eventId` in the body. The actor is the organizer id the caller supplies. The gift live test sends that actor as `organizer`. The reference role rule for `operator` on `complete_event` and `cancel_event` is not readable in this repo. Those two commands are not part of the live-gate test here.

The live gate test creates the event, issues one invitation while sales are still open, then closes sales and opens admission. On the pinned gate, `issue_invitation` after `close_sales` is `REJECTED` with code `EVENT_NOT_OPEN`, and the next write is `FENCED`. The helper still sends the invitation the caller asked for. It does not refuse that order itself.

The actor string is that local-call argument. It is not an authentication result. This client defines no auth scheme.

## Receipt checks

The check is on top of the published receipt envelope (`domain`, `operationId`, `sequence`, `action`, `result`). A mismatch is `UNKNOWN` with code `INVALID_RECEIPT`, not a success.

| Step | Result |
| --- | --- |
| `create_event` | Closed keys `eventId`, `policyHash`, `inventoryIds`, `reservationSeconds`, same as the journey. `eventId` matches the body. `policyHash` is a non-empty string. `inventoryIds` is a non-empty string array the same length as `seats`. `reservationSeconds` is an integer |
| `close_sales` | `salesStatus` is `CLOSED`. Other result keys are allowed. The integration-gate test pins the status and does not pin the full key set |
| `open_admission` | The result equals exactly `{admissionStatus:"OPEN"}` |
| `issue_invitation` | `ticketId` is a non-empty string and `financialEntries` is `0`. Other keys are allowed |
| `complete_event`, `cancel_event` | The result is a record. No field names are invented |

`complete_event` and `cancel_event` result keys, and the full `issue_invitation` result, are not pinned in this repository. No local kix-protocol checkout was used to close them. The stub-shape invoker returns `{}` for complete and cancel, and `{ticketId:"ticket-1", financialEntries:0}` for an invitation. Those literals are not gate receipts.

## Outcomes and fences

| Outcome | When |
| --- | --- |
| `RECEIPT` | The step's result matches the table |
| `REJECTED` | `invokeLocalCall` throws `GateRejectedError` |
| `UNKNOWN` | Any other `ProtocolError` that carries trace ids, or a returned receipt that fails the result check |
| `NOT_SENT` | The helper threw before the call (schema or missing caller input). The method rejects. Later steps are fenced |
| `FENCED` | The console is halted, the step was already sent, the same `inventoryId` was already invited, or a call is in flight. Nothing is sent |

A rejection, an unknown outcome, or a not-sent outcome fences every later write. The next call returns `FENCED` with `halted` and does not mint a replacement `operationId`. There is no retry and no `Idempotency-Key`. A repaired attempt is a new `OrganizerConsole` after a reload, with a new attempt id. This helper adds no read.

Each non-invitation step is sent at most once (`already-sent`). `issue_invitation` is once per `inventoryId`. `in-flight` blocks a concurrent call. `out-of-order` is part of the fence type and is not produced: `create_event` is optional, and the gate decides legality.

## Not composed

| Action | Recorded reason |
| --- | --- |
| `capture` | Nothing past `accept_trade`. Never composed, never sent. `confirmBooking` stays not-bound. |
| `settle_capture` | Stays out. `settlementPreview` stays not-bound. |
| `commit_trade` | Stays uncomposed. This surface does not capture. `commitSettlement` is not `commit_trade`. |
| `admit` | Stays uncomposed. `checkAdmission` stays `admit`. |

`ORGANIZER_NOT_COMPOSED` holds those reasons. The helper has no method for these actions. It does not compose `prepare_trade` and it does not map `placeHold` onto any body.

## Desk methods quoted, not remapped

| Method | `consideredAction` | Stays not-bound because |
| --- | --- | --- |
| `cancelSettlement` | none | Not `cancel_event` and not a catalogue command |
| `cancelReservation` | none | Not `cancel_event` and not a catalogue command |
| `cancelCredit` | none | Not `cancel_event` |
| `registerReservationShow` | none | Not `create_event` and not a catalogue command |
| `checkAdmission` | `admit` | Not `open_admission`. `admit` stays uncomposed |

`ORGANIZER_DESK_NOT_BOUND` quotes `COMMERCE_COMMAND_BINDINGS`. It does not rewrite them.

## Desk

The `/organizer` page keeps one `OrganizerConsole` per event id for that page load. Operation ids are `org:<eventId>:<attempt>:<step>`. `issue_invitation` suffixes the inventory id. An id longer than 100 characters fails before the call and the row is not sent. The operator label is `operator`. The organizer id on the desk is `desk-organizer`. Seats are a comma-separated caller string. A blank invitation quota is omitted. A non-canonical integer is not sent. Stub-shape receipts are literals. They are not gate receipts. In the browser, integration HTTP shows unavailable because the reviewed gate answers no CORS preflight. The desk does not fall back to the stub and does not proxy the gate. The browser success path is the stub-shape invoker. The live success path is the Node gate test. The observed browser run is below.

## Browser run

Observed in headless Chrome 154.0.8037.57 on 2026-10-09. The stub desk was Vite at `http://127.0.0.1:5177`. The HTTP desk was a second Vite at `http://127.0.0.1:5180` with `VITE_KIX_PROTOCOL_MODE=http` and `VITE_KIX_PROTOCOL_API_BASE` set to the reviewed gate, which was listening on `http://127.0.0.1:40125`. No page error. The page text did not include a loopback URL, a policy number, or a payment claim. `capture`, `settle_capture`, `commit_trade`, and `admit` appeared only in the not-composed list.

| State | Observed |
| --- | --- |
| Empty event id, after clicking Organizer from Box office | Path `available-stub-shape`. All six Send buttons disabled. Each row said "Enter an event id. The desk does not mint one." The ruling, the stub-shape label, the not-authentication line, and "No funds." were on the page. |
| Stub success for event id `show-browser-ok`, seat `A1`, quota `1`, inventory `inv-0`, version `0`, recipient `guest-a` | All six rows Confirmed, each noting "Confirmed stub-shape receipt. Not from the gate." Last confirmed receipt: `issue_invitation · org:show-browser-ok:1:issue_invitation:inv-0`. Unconfirmed request: none. `create_event` showed `eventId` `show-browser-ok`, `inventoryIds` `["inv-0"]`, `policyHash` `policy-hash`, `reservationSeconds` `900`, actor `operator`. `close_sales` showed `salesStatus` `CLOSED`. `open_admission` showed `admissionStatus` `OPEN`. `issue_invitation` showed `financialEntries` `0` and `ticketId` `ticket-1`, actor `desk-organizer`. `complete_event` and `cancel_event` showed no result fields. After each send that button was disabled. |
| Reload after that success | Page-load rows cleared. Sends were disabled until an event id is typed again. |
| Non-canonical quota `1.5` on `show-browser-bad` | `create_event` was not-sent: "Not sent. Field body.invitationQuota must be an integer." The other five rows were Blocked. All six sends were disabled. |
| Integration HTTP against the reviewed loopback gate | Path `unavailable`. The alert said the organizer path is unavailable, the desk does not fall back to the stub, and the code is `GATE_UNAVAILABLE`. There was no stub-shape label. All six rows said "Unavailable. No write is sent." Typing an event id left the sends disabled. The browser health probe failed (`net::ERR_FAILED` on `/health`). The desk sent no command. |

The live invitation receipt, and the `EVENT_NOT_OPEN` rejection after `close_sales`, are the Node gate test. The browser does not reach that call.

## Hold

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. The five pins stay where the gate bind put them.
