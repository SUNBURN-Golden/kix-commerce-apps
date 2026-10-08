# M05 consent apps bind

This bind is the adapter helper for `set_consent` and `authorize_marketing`. Stub mode stays the default. HTTP mode stays the opt-in loopback. This document adds no command, no read, no retry, and no desk binding on `CommerceProtocol`. CRM campaign editing stays out.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The Wave 6 gate record is [kix-protocol issue 56, comment 5868307343](https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343). Wave 7 opening is kix-protocol `docs/decisions/PROGRAM_ROADMAP_20260930.md` §2 R-7. The roadmap is [kix-protocol docs/decisions/PROGRAM_ROADMAP_20260930.md](https://github.com/BeautifulMind-JT/kix-protocol/blob/main/docs/decisions/PROGRAM_ROADMAP_20260930.md). No catalogue, gate, or SDK change is consumed. No compatibility manifest is consumed, so the evolution consumption rule has nothing to move. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the gate bind put them (`52a9b5cbf7777df55d2d2062cb8d99d862b423bb`, feature `c7238bc24a399a6cabbab87ac23dbfd7e9c252dd`, one tree).

## Ruling

M2 is selected. The booking journey composes nothing past `accept_trade`. `capture` and `settle_capture` are never composed and never sent. This consent helper does not attach itself to that journey and does not send those commands either.

H1 is selected. `placeHold.consideredAction` stays `reserve_listing`. `placeHold` stays not-bound. `prepare_trade` is only an `invokeLocalCall` body. `placeHold({ eventId, quantity })` is not mapped onto it. `packages/protocol-adapter/src/commerce-bindings.ts` is unchanged. Consent is not a `CommerceProtocol` desk method, so there is no new `COMMERCE_METHODS` entry.

## What is posted

`ConsentBind` calls an existing local-call invoker. The first call on a fresh helper is `set_consent`. After a receipt whose `allowed` is true, the caller may send `authorize_marketing`. A later `set_consent` with `allowed: false` is how a caller records a withdrawal. Each call uses a caller-chosen `operationId`.

The domain on every body is `kix:fixture:lifecycle:0.3`. The helper checks each body with the vendored command schema before the call. It does not add optional fields. It does not default `business`, `channel`, `purpose`, `subject`, or `expectedConsentVersion`. Choosing a legal purpose list would be a product policy value, and this helper does not choose one.

| Step | Actor | Body |
| --- | --- | --- |
| `set_consent` | the caller-supplied subject | `domain`, `allowed`, `business`, `channel`, `eventId`, `expectedConsentVersion`, `purpose` |
| `authorize_marketing` | `marketing-adapter` | `domain`, `business`, `channel`, `eventId`, `expectedConsentVersion`, `purpose`, `subject` |

`subject` is not a `set_consent` body field. The reviewed gate keys the consent by the local-call actor (`consent_key(self.actor, body)` at `52a9b5cb…`). The actor string is that local-call argument. It is not an authentication result. This client defines no auth scheme.

`authorize_marketing` is different. The reviewed handler calls `role("marketing-adapter")`. Any other actor is `UNAUTHORIZED_FIXTURE_ACTOR`. The helper therefore sends that fixture role as the actor. The caller-supplied subject stays in the body. This is the same kind of fixed local-call role as the organizer console's `operator`. It is not a default for `business`, `channel`, or `purpose`.

The helper does not send `create_event`. The reviewed gate returns `EVENT_NOT_FOUND` when `eventId` is not already an event. A live test may create the event before it calls this helper. That setup call is not part of `ConsentBind`.

Sending `set_consent` before `authorize_marketing` is desk behavior for this page. It is not protocol law. The helper fences `authorize_marketing` until this helper has a `set_consent` receipt with `allowed: true`. The gate, if called without that consent, rejects `CONSENT_NOT_CURRENT`.

## Receipt checks

The check is on top of the published receipt envelope (`domain`, `operationId`, `sequence`, `action`, `result`). These result objects were read by running the reviewed gate at `52a9b5cbf7777df55d2d2062cb8d99d862b423bb` (feature `c7238bc24a399a6cabbab87ac23dbfd7e9c252dd`, one tree) on 2026-10-09. A missing field, a mismatched value, or an extra result key is `UNKNOWN` with code `INVALID_RECEIPT`, not a success.

| Step | Result |
| --- | --- |
| `set_consent` | keys `allowed` and `consentVersion` only. `allowed` equals the boolean sent. `consentVersion` is an integer |
| `authorize_marketing` | keys `authorizedAt`, `consentVersion`, `dispatchDecision`, and `networkSendPerformed` only. `dispatchDecision` is `AUTHORIZED_FIXTURE_INTENT`. `networkSendPerformed` is false. `authorizedAt` is an integer. `consentVersion` equals the `expectedConsentVersion` on that call |

`consentVersion` is not compared with `expectedConsentVersion + 1`. That comparison would be reference arithmetic, and this client does not copy it. The stub-shape `set_consent` result uses the fixed literal `consentVersion: 1` even when the caller sent another integer. The stub copies `expectedConsentVersion` onto the authorize result. It does not add one.

Observed gate rejections, recorded here and not pre-checked as a policy list: `STALE_CONSENT_VERSION`, `CONSENT_NOT_CURRENT`, `INVALID_CONSENT`, `EVENT_NOT_FOUND`, `UNAUTHORIZED_FIXTURE_ACTOR`. `INVALID_CONSENT` is what the reviewed handler returns unless `purpose` is `next_event_marketing`, `business` is `KIX`, and `channel` is `email` or `sms`. This client does not fill those strings in. A caller that wants the gate to accept the command supplies them. The desk inputs start empty.

`networkSendPerformed: false` is the observed success value. A true value is `INVALID_RECEIPT`. This surface has no sender.

## Outcomes and fences

| Outcome | When |
| --- | --- |
| `RECEIPT` | The step's result matches the table |
| `REJECTED` | `invokeLocalCall` throws `GateRejectedError` |
| `UNKNOWN` | Any other `ProtocolError` that carries trace ids, or a returned receipt that fails the result check |
| `NOT_SENT` | The helper threw before the call (schema or missing caller input). The method rejects. Later steps are fenced |
| `FENCED` | The bind is halted, `authorize_marketing` runs before an `allowed: true` receipt, that authorize already ran since the latest `set_consent`, or a call is in flight. Nothing is sent |

A rejection, an unknown outcome, or a not-sent outcome fences every later write. The next call returns `FENCED` and does not mint a replacement `operationId`. There is no retry and no `Idempotency-Key`. A repaired attempt is a new `ConsentBind` and new caller-chosen ids. This helper adds no read.

A second `authorize_marketing` after a receipt, with no newer `set_consent`, is `already-sent`. Another `set_consent` is allowed. That is the withdrawal path. It clears the authorize latch. `authorize_marketing` after `allowed: false` is `out-of-order`.

## Not composed

| Action | Recorded reason |
| --- | --- |
| `capture` | Nothing past `accept_trade`. Never composed, never sent. `confirmBooking` stays not-bound. |
| `settle_capture` | Stays out. `settlementPreview` stays not-bound. |

`CONSENT_NOT_COMPOSED` holds those reasons. The helper has no method for these actions.

## Desk methods quoted, not remapped

| Method | `consideredAction` | Stays not-bound because |
| --- | --- | --- |
| `placeHold` | `reserve_listing` | H1. `placeHold({ eventId, quantity })` is not `set_consent` and is not `prepare_trade` |

`CONSENT_DESK_NOT_BOUND` quotes `COMMERCE_COMMAND_BINDINGS`. It does not rewrite them.

## Desk

The `/marketing/m05` page keeps the session-flag form. Those flags stay `channelSend: "none"` and are not the `set_consent` body. Below that form, one `ConsentBind` is kept per event id for that page load. Operation ids are `cns:<eventId>:<attempt>:<step>`. A further `set_consent` on the same page load uses the next attempt, so the id stays in that shape. The actor shown for `set_consent` is the caller-typed subject. The actor shown for `authorize_marketing` is `marketing-adapter`. Stub-shape receipts are literals. They are not gate receipts. In the browser, integration HTTP shows unavailable because the reviewed gate answers no CORS preflight. The desk does not fall back to the stub and does not proxy the gate. The browser success path is the stub-shape invoker. The live success path is the Node gate test. M05 stays 미착수.

## Browser run

Observed in headless Chrome 154.0.8037.57 on 2026-10-09. The stub desk was `vite preview` at `http://127.0.0.1:4173` from the default production build. The HTTP desk was a second preview at `http://127.0.0.1:4174`. Vite inlines `VITE_KIX_PROTOCOL_MODE` and `VITE_KIX_PROTOCOL_API_BASE` at build time, so that preview was a separate build with mode `http` and base `http://127.0.0.1:8765`. Nothing was listening on port 8765. No page exception. The visible page text did not include a loopback URL. `capture` and `settle_capture` appeared only in the not-composed list. `placeHold` appeared only as the quoted not-bound desk method, with `consideredAction` `reserve_listing`.

| State | Observed |
| --- | --- |
| Stub, empty event id | Path `available-stub-shape`. Both Send buttons disabled. Each row said "Enter an event id. The desk does not mint one." The page showed "The actor is not an authentication result.", "Stub-shape receipts are not gate receipts.", and "not protocol law." M05 stayed 미착수. |
| Save consent flags | Stamp `SAVED`. Outbound send `none`. The flags copy still said these flags are not the `set_consent` body, and `channelSend: none`. |
| Stub, event id `show-browser-blank`, other fields empty, Send `set_consent` | Status Not sent. Note: "Not sent. actor must be a non-empty string of at most 100 characters with no leading or trailing whitespace." Operation `cns:show-browser-blank:1:set_consent`. `authorize_marketing` was Blocked. Both sends disabled. |
| Stub, event id `show-browser-order`, subject `subject-browser`, business `desk-business`, channel `desk-channel`, purpose `desk-purpose`, version `0`, allowed `true`, Send `authorize_marketing` first | `set_consent` stayed Ready. `authorize_marketing` stayed sendable and said "Fenced (out-of-order). Nothing was sent." Actor shown: `marketing-adapter`. |
| Stub success on that same event, then Send `set_consent` and Send `authorize_marketing` | Both rows Confirmed, each noting "Confirmed stub-shape receipt. Not from the gate." Last confirmed receipt: `authorize_marketing · cns:show-browser-order:1:authorize_marketing`. Unconfirmed request: none. `set_consent` actor `subject-browser`, result `allowed` true and `consentVersion` 1. `authorize_marketing` actor `marketing-adapter`, result `authorizedAt` 0, `consentVersion` 0, `dispatchDecision` `AUTHORIZED_FIXTURE_INTENT`, `networkSendPerformed` false. |
| Integration HTTP, closed port 8765, event id `show-browser-http` | Path `unavailable` before and after the event id. Alert code `GATE_UNAVAILABLE`. The desk did not fall back to the stub. There was no stub-shape receipt line. Both rows Unavailable and both sends disabled. Saving flags still stamped `SAVED` with outbound send `none`. |

The live `set_consent` / `authorize_marketing` receipts, and the `CONSENT_NOT_CURRENT` rejection, are the Node gate test. The browser does not reach that call.

## Hold

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. The five pins stay where the gate bind put them.
