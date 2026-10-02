# Wave 6-A journey adapter apps bind

This helper composes one primary-seat mock booking through `invokeLocalCall`. The order is the prefix fixed by the journey map in [pull request 23](https://github.com/BeautifulMind-JT/kix-commerce-apps/pull/23): `create_event`, then `prepare_trade`, then `accept_trade`. Stub mode stays the default. HTTP mode stays the loopback in [http-integration-gate-apps-bind.md](http-integration-gate-apps-bind.md).

`packages/protocol-adapter/src/commerce-bindings.ts` already decides the two map rulings. This helper records those not-bound reasons and does not rewrite them.

| Desk method | Binding already on main | What this helper does |
| --- | --- | --- |
| `placeHold` | `not-bound`, nearest name `reserve_listing` | Does not send `reserve_listing` and does not change the mapping. `prepare_trade` is a separate `invokeLocalCall` body. |
| `confirmBooking` | `not-bound`. The desk does not send `capture`. | Does not send `capture`. |
| `settlementPreview` | `not-bound`. `settle_capture` is a monetary posting the desk does not send. | Does not send `settle_capture`. |

The helper does not compose a `capture` plus `settle_capture` sequence. `commit_trade` needs a capture receipt, so `commit_trade` and `admit` stay uncomposed. `open_admission` stays in its map position after that uncomposed capture step, and this helper does not send it ahead of that step.

## Receipt links that are composed

The caller supplies each `operationId`. The helper does not mint a replacement. One attempt per step. No `Idempotency-Key`, no retry, no stub fallback.

| Step | Actor | Copied from the previous success receipt | Kept from the caller's own request |
| --- | --- | --- | --- |
| `create_event` | `operator` | none | `eventId`, `organizer`, `policy`, `seats` |
| `prepare_trade` | the buyer | the first `inventoryIds` entry, in seat order, as `inventoryId` | `tradeId`, `buyer`, `amount` equal to the `primaryPrice` on the create policy, `expectedInventoryVersion` `0`, `expectedVersion` `0` |
| `accept_trade` | the buyer | `tradeId`, `termsHash` | none |

`prepare_trade` omits `ticketId`, `listingId`, and `expiresAt`. The helper copies `termsHash`. It does not recompute it.

A lost response (`REQUEST_TIMEOUT`, `GATE_UNAVAILABLE`, or `GATE_TRANSPORT`), a receipt that is not the published success for that call, `STALE_RESPONSE`, or a rejection fences the next write. The operation id on that step stays the one the caller supplied.

## Hold

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. Catalogue pins stay on the reviewed gate. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. Wave 7 stays shut until `w6a-evidence` merges (`docs/decisions/PROGRAM_ROADMAP_20260930.md` §2 R-7).

Wave 6 gate record: https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343
