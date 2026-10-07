# Wave 6-A synthetic journey adapter apps bind

The [2026-10-07 User decision](decisions/2026-10-07-commerce-journey-and-a3.md)
selects M1 and H1 from [PR23](https://github.com/SUNBURN-Golden/kix-commerce-apps/pull/23).
It supersedes the earlier prefix-only interpretation in PR25: existing desk
not-bound reasons were not themselves a ruling against explicit catalogue
composition. Original PR23/25 source and historical task records remain intact.

`composePrimarySeatJourney` composes one primary seat through `invokeLocalCall`:
`create_event → prepare_trade → accept_trade → capture → commit_trade →
open_admission → admit`. Stub mode remains the default. The browser runs only an
isolated labelled script; real contract tests use Node and the reviewed loopback
gate. No new Protocol body, pin, desk API or browser transport is introduced.

## Receipt-to-body links

The caller supplies seven distinct operation IDs and a payment ID; missing or
reused operation IDs are rejected locally before the first write. This helper
snapshots the invocation and never mints a replacement ID. Each step gets one
attempt. No retry, Idempotency-Key, redirect following or fallback.

| Step | Actor | Validated causal inputs / success condition |
|---|---|---|
| create_event | operator | Caller event, organizer, policy, seats; event must match and inventory IDs must be nonempty strings |
| prepare_trade | buyer | First returned inventory ID; caller trade/buyer/primaryPrice, initial versions 0. Require matching trade, PREPARED, nonempty ticketId, externalOrderId and termsHash |
| accept_trade | buyer | Validated tradeId and copied termsHash; accepted must be true |
| capture | pg-adapter | prepare.externalOrderId → orderId; original paymentId/buyer/price, KRW, synthetic provenance and fixed fixture scope. Require captured=true AND cashAvailable=false |
| commit_trade | operator | Validated tradeId after capture; require the prepared ticketId, original buyer, positive safe-integer rightsVersion and admissionEpoch |
| open_admission | operator | Original validated eventId, after commit; admissionStatus must be OPEN |
| admit | venue | Commit ticketId/owner/rightsVersion/admissionEpoch copied into ticketId/holder/expectedVersion/admissionEpoch; require ADMITTED_ONCE and admissionId equal to the submitted operation ID |

Fixture scope is exactly provider=toss, environment=test, merchant=kix-fixture,
channel=card. This labels synthetic evidence; it does not call Toss or an account.
Optional settle_capture is omitted. The pinned reference's commit_trade does not
require settlement, and capture is not spendable cash. A duplicate-only capture
receipt does not establish this invocation's complete causal success and stops
with INVALID_RECEIPT; the helper does not add recovery or replay semantics.

Every generic envelope must also pass payload guards and action/operation/domain
receipt validation. Unconfirmed, malformed or stale responses fence later writes.
Response loss is UNKNOWN even if the server applied the command. Explicit server
rejection remains REJECTED. An earlier confirmed synthetic capture can coexist
with a failed commit; neither the UI nor helper asserts refund or issuance.

## Desk boundary

| Desk method | Retained binding | Separate composer behavior |
|---|---|---|
| placeHold | not-bound; consideredAction reserve_listing | Primary prepare_trade uses its explicit body, never eventId/quantity remapping |
| confirmBooking | not-bound | Separate synthetic capture does not bind confirmBooking(holdId) |
| settlementPreview | not-bound | No settle_capture call in this journey |
| commitSettlement / checkAdmission | not-bound | No remapping into commit_trade or admit |

The helper's uncomposed list contains optional settle_capture and reserve_listing.
Resale, credit and desk FSM behavior are unchanged.

## Evidence boundaries

Unit tests cover receipt identity/versions, synthetic scope, immutable intent and
one-attempt fences. Reviewed-gate tests cover all seven successful effects followed
by injected response loss, one-time admission, actual gift transfer invalidating
an old presentation, and expiry both before accept and after capture. Gift/clock
calls are test fault injection, not new product features. Fixture parity verifies
sequence and operation identity, not a second implementation of protocol math.

Browser tests cover success, prepare faults, capture/commit response loss, invalid
commit and stale presentation, state reset, mobile overflow and HTTP no-write.
No real payment, KYC, credit disbursement, venue scan, bank rail, live marketplace
or deployment. No database is required. Five pins remain at
`52a9b5cbf7777df55d2d2062cb8d99d862b423bb`.

Wave6 gate: https://github.com/SUNBURN-Golden/kix-protocol/issues/56#issuecomment-5868307343

Wave7 remains closed until w6a-evidence merges (Protocol roadmap §2 R-7).
Required exact-head CI and the explicitly designated fresh independent Astra
ARCHITECTURE/A3 audit are separate from the User's composition decision.
