# Gift transfer apps bind

This bind is the adapter helper for `offer_gift`, `accept_gift`, and `cancel_gift` (P02 transfer). Stub mode stays the default. HTTP mode stays the opt-in loopback. This document adds no command, no read, no retry, and no desk binding.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The Wave 6 gate record is [kix-protocol issue 56, comment 5868307343](https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343). Wave 7 stays shut until `w6a-evidence` merges (`docs/decisions/PROGRAM_ROADMAP_20260930.md` §2 R-7). The roadmap is [kix-protocol docs/decisions/PROGRAM_ROADMAP_20260930.md](https://github.com/BeautifulMind-JT/kix-protocol/blob/main/docs/decisions/PROGRAM_ROADMAP_20260930.md). No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the gate bind put them.

## Ruling

M2 is selected. The booking journey composes nothing past `accept_trade`. `capture` and `settle_capture` are never composed and never sent. This gift helper does not attach itself to that journey and does not send those commands either.

H1 is selected. `placeHold.consideredAction` stays `reserve_listing`. `placeHold` stays not-bound. `prepare_trade` is only an `invokeLocalCall` body. `placeHold({ eventId, quantity })` is not mapped onto it. `packages/protocol-adapter/src/commerce-bindings.ts` is unchanged. Gift is not a `CommerceProtocol` desk method, so there is no new `COMMERCE_METHODS` entry.

## What is posted

`GiftTransfer` calls an existing `invokeLocalCall`. The first call is `offer_gift`. After that receipt, the caller sends either `accept_gift` or `cancel_gift`. Each call uses a caller-chosen `operationId`.

The domain on every body is `kix:fixture:lifecycle:0.3`. The helper checks each body with the vendored command schema before the call. It does not add optional fields. It does not default `expiresAt`, `expectedVersion`, `recipient`, or `ticketId`. A default expiry window would be a product policy value, and this helper does not choose one.

| Step | Actor | Body |
| --- | --- | --- |
| `offer_gift` | the caller-supplied donor id | `domain`, `giftId`, `ticketId`, `expectedVersion`, `recipient`, `expiresAt` |
| `accept_gift` | the recipient on the offer | `domain`, `giftId`, `termsHash` copied from the offer receipt |
| `cancel_gift` | the donor on the offer | `domain`, `giftId` |

The actor string is that local-call argument. It is not an authentication result. This client defines no auth scheme.

The booking journey stops at `accept_trade`. The `ticketId` from `prepare_trade` is not a held active right, so this helper does not read it from a journey. The caller supplies `ticketId` and `expectedVersion`. `issue_invitation` is not composed here.

`offer_gift` is not a credit draw. `offerCredit` stays not-bound and sends no request.

## Receipt checks

The check is on top of the published receipt envelope (`domain`, `operationId`, `sequence`, `action`, `result`). These result objects are the reference returns at the reviewed tree (`52a9b5cbf7777df55d2d2062cb8d99d862b423bb`, feature `c7238bc24a399a6cabbab87ac23dbfd7e9c252dd`). A missing field, a mismatched value, or an extra result key is `UNKNOWN` with code `INVALID_RECEIPT`, not a success.

| Step | Result |
| --- | --- |
| `offer_gift` | `giftId` equals the id sent, `termsHash` is a non-empty string |
| `accept_gift` | `ticketId` equals the offered ticket, `owner` equals the recipient, `rightsVersion` is an integer, `financialEntries` is `0` |
| `cancel_gift` | `giftState` is `CANCELLED` |

`rightsVersion` is not compared with `expectedVersion + 1`. That comparison would be reference arithmetic, and this client does not copy it.

## Outcomes and fences

| Outcome | When |
| --- | --- |
| `RECEIPT` | The step's result matches the table |
| `REJECTED` | `invokeLocalCall` throws `GateRejectedError` |
| `UNKNOWN` | Any other `ProtocolError` that carries trace ids, or a returned receipt that fails the result check |
| `NOT_SENT` | The helper threw before the call (schema or missing caller input). The method rejects. Later steps are fenced |
| `FENCED` | The transfer is halted, accept or cancel runs before an offer receipt, the step already ran, or a call is in flight. Nothing is sent |

A rejection, an unknown outcome, or a not-sent outcome fences every later write, including `cancel_gift`. A cancel after an unknown offer would be an arbitrary reversing command. The next call returns `FENCED` and does not mint a replacement `operationId`. There is no retry and no `Idempotency-Key`. A repaired attempt is a new `GiftTransfer` and new caller-chosen ids. This helper adds no read.

After `accept_gift` or `cancel_gift` has a receipt, a later write is `already-sent`. A second offer is `already-sent`.

## Not composed

| Action | Recorded reason |
| --- | --- |
| `capture` | Nothing past `accept_trade`. Never composed, never sent. `confirmBooking` stays not-bound. |
| `settle_capture` | Stays out. `settlementPreview` stays not-bound. |
| `commit_trade` | Stays uncomposed. This surface does not capture. `commitSettlement` is not `commit_trade`. |
| `issue_invitation` | Stays uncomposed on this helper. A giftable right is produced elsewhere. |

`GIFT_NOT_COMPOSED` holds those reasons. The helper has no method for these actions.

## Desk methods quoted, not remapped

| Method | `consideredAction` | Stays not-bound because |
| --- | --- | --- |
| `offerCredit` | none | `offerCredit` is not `offer_gift` and is not a catalogue command |
| `acceptResale` | `accept_trade` | `acceptResale(listingId)` is not `accept_gift` |
| `cancelResaleListing` | none | `cancelResaleListing` is not `cancel_gift` and is not a catalogue command |

`GIFT_DESK_NOT_BOUND` quotes `COMMERCE_COMMAND_BINDINGS`. It does not rewrite them.

## Desk

The `/gift` page keeps one `GiftTransfer` per gift id for that page load. Operation ids are `gft:<giftId>:<attempt>:<step>`. The donor shown on the desk is `desk-donor`. The recipient field starts as `desk-recipient` and can be edited before the offer is sent. After a resolution, the other row is blocked. Stub-shape receipts are literals. They are not gate receipts. In the browser, integration HTTP shows unavailable because the reviewed gate answers no CORS preflight. The desk does not fall back to the stub and does not proxy the gate.

## Hold

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. The five pins stay where the gate bind put them.
