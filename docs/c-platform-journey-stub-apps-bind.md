# Platform journey stub apps bind

This bind is the stub-scoped multi-channel trade page at `/platform`. It is the synthetic reduction of pending node `c-platform-journey`: the real connection stays pending on `kix-protocol:ps-03-resale-contract`, `ps-04-execution-partitions`, and `ps-05-query-projections`, and on the unpromoted `bind-resale-fsm`, `refund-surface`, and `c-async-session-fence`. This node wires the trade-tracking seam — many listings on many channels, a price change, a booking, a payment observation, a right transfer, and a refund explanation, with a write fence that holds through an unknown or late result — onto a deterministic synthetic source. It is not a producer connection and does not claim one.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical (`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). The branch base is `5a43b61d6ac7a605ac2758acfae56fb9fc9fc7d4`. This delivery is the uncommitted diff on `agent/kixc-c-platform-journey-stub`. The supervisor commits.

## What this page sends

Nothing goes to a protocol. The page sends no local call, no `create_event`, `prepare_trade`, or `accept_trade`, and no money posting. Its writes land on an in-process synthetic source, which is a stand-in for the producer. `capture` and `settle_capture` are never composed or sent, `commit_trade`, `open_admission`, and `admit` stay uncomposed, and `refund_ticket` is recorded and not sent (`PLATFORM_NOT_COMPOSED`, which reuses `JOURNEY_NOT_COMPOSED` and adds `refund_ticket`). `placeHold` stays not-bound with `consideredAction` `reserve_listing` (`PLATFORM_HOLD_NOT_BOUND` quotes the locked binding and the page prints its reason). `prepare_trade` is not mapped onto it, and none of the three synthetic steps (`book`, `transfer`, `reprice`) is a desk method or a catalogue command.

On `integration-http` the read and every write are `not-bound`: "The contract-only catalogue has no read command for a listing, trade, payment, transfer, or refund projection, and the resale contract, execution partitions, and query projections are not merged in kix-protocol." There is no stub fallback, no third adapter, and no request.

## Scope and acceptance

| Spec item | Where it lives | Test |
| --- | --- | --- |
| Multi-listing, price change, right transfer, payment observation, and transfer identities are linked | `PLATFORM_IDENTITY_REGISTER`, `platformRef`, the controller copying target fields from a read or a receipt | `packages/protocol-adapter/test/platform-journey.test.ts`, `platform-controller.test.ts` |
| An unknown or late result blocks new writes | `PlatformJourneyController.gateFor` | `platform-controller.test.ts` (client retry, late results, stale session) |
| Partial failure, refund, and the original right are explained together | `projectPlatform`, `describeTrade` | `apps/web/test/platform-journey.test.tsx` (payment lost, partial failure) |
| Two channels on one right never produce two successes | the controller serialises per right, the source decides, `integrityFault` flags any second observed transfer | `platform-controller.test.ts` (two channels race), `platform-journey.test.tsx` |
| A client resend makes no new payment effect | the fence, and a source that does not de-duplicate | `platform-controller.test.ts` (client retry) |
| Booking, payment, issuance, and refund are observed independently | four facets, no aggregate | both suites |
| Concurrent settlement, payment loss, and stale session end to end | the three groups above | the same suites, plus the browser run below |

The spec asks for a "producer SDK based trade adapter". No producer SDK exists in this repository (`consume-p-sdk-0` is pending), so the adapter is the synthetic port. That is the one deviation from the spec text, and it is the stub scope this node was reduced to.

## Identity

Every reference has its own kind and prefix: `lst-` listing, `rgt-` right, `trd-` trade, `pay-` payment, `xfr-` transfer, `rfd-` refund, `trm-` terms. `isPlatformRef(ref, kind)` is true for one kind only, so a trade reference is never read as a payment reference. The controller refuses a write whose target is the wrong kind before it sends anything (`NOT_SENT`, `identity`).

`PLATFORM_IDENTITY_REGISTER` says which identity has a named field in the pinned catalogue. A test reads the vendored contract-only OpenAPI file and checks every listed field.

| Identity | Field here | Status | Pinned fields |
| --- | --- | --- | --- |
| listing | `listingRef` | field named | `create_listing.listingId`, `prepare_trade.listingId`, `reserve_listing.listingId` |
| right | `rightRef` | field named | `create_listing.ticketId`, `prepare_trade.ticketId`, `offer_gift.ticketId`, `refund_ticket.ticketId` |
| trade | `tradeRef` | field named | `prepare_trade.tradeId`, `accept_trade.tradeId`, `reserve_listing.tradeId` |
| terms | `termsRef` | field named | `accept_trade.termsHash`, `accept_gift.termsHash` |
| version | `expectedVersion` | field named | `create_listing`, `prepare_trade`, `refund_ticket`, `offer_gift` |
| payment | `paymentRef` | not-bound | none. A payment id is named only by `capture`, `settle_capture`, `adjust_pg_cancel`, `finalize_effect`, `observe_effect`, and `observe_return`; each also carries an amount and a currency, and this journey composes none of them. There is no payment observation read |
| transfer | `transferRef` | not-bound | none. No pinned body or receipt names a transfer id |
| refund | `refundRef` | not-bound | none. `refund_ticket` is pinned (`domain`, `expectedVersion`, `ticketId`) and never sent. No refund id and no compensation policy are published |
| tier | `tier` | not-bound | none. The page shows opaque tier labels and copies no amount. No update-listing command is pinned, and a price change is not composed from `cancel_listing` plus `create_listing` |

Naming a field is not binding it. The values on the page are synthetic references, the pinned catalogue publishes no receipt path that would carry them, and no body is built from the register.

## The synthetic source

`packages/protocol-adapter/src/platform-journey.ts`. State lives in the object, so a new port is a new session. It holds two rights (`rgt-0001` at version 7, `rgt-0002` at version 3) and three listings: two channels (`web-board`, `partner-board`) list `rgt-0001`, and `web-board` lists `rgt-0002`.

The source has three writes. A booking records a trade and a payment observation; it does not lock the right. A transfer moves the right to the trade's buyer and raises its version. A tier change supersedes a listing with a new one that carries new terms. The source refuses a booking on a superseded listing, on other terms, or on a right version that moved. It refuses a transfer for an unknown or foreign trade, without a payment observation, on superseded or other terms, or on a right version that moved. Those refusals are stub policy for tests and the demo. They are not protocol law. A price is an opaque tier label; no amount, fee, share, or hash is computed.

The source is deliberately naive. It does not de-duplicate an intent and has no idempotency key, so a repeated write is applied again. The only thing that stops a second effect is the client fence below, and a test counts payment observations at the source to prove it.

| Scenario | What the source does |
| --- | --- |
| `clean` | Answers every write. |
| `empty` | Has no listings. The read is `empty`. |
| `stale` | Serves a watermark older than the floor. The read is `stale`. |
| `rival-channel` | Another channel's transfer lands first, so yours is refused as `VERSION_STALE`. |
| `payment-lost` | A booking is recorded and its payment observation never arrives. |
| `book-lost` | A booking and its payment observation are applied, and the answer is lost. |
| `transfer-lost` | A transfer is applied, and the answer is lost. |
| `transfer-late` | A transfer is applied, the answer is lost, and a late result can be delivered later. A test option makes the late result a rejection that matches a source that never applied it. |
| `held-response` | Effects apply at once and answers are held until `deliverHeld`. |

The facets on a trade are read from the source: booking (a trade record), payment (a `pay-` reference, or unknown), issuance (an `xfr-` reference, or none), and refund (`COMPENSATION_UNDEFINED` when a payment observation exists, or is unknown, and the right did not move for that trade). A refund is never executed and never queued.

## The controller

`packages/protocol-adapter/src/platform-controller.ts`. The context key is the mode, the domain, the actor string, and a session incarnation. The actor string is a context label and not an authentication result.

| Event | What the controller does |
| --- | --- |
| A write while another write on the same right is in flight | `FENCED` (`in-flight`). It never reaches the port. |
| A write on a right with an unknown result | `FENCED` (`unknown-outcome`), in any context and after any read. |
| A late result for an unknown write | Recorded as evidence. The write stays `UNKNOWN` and the fence stays. |
| A late result for another context, or for a write that is not unknown | Quarantined. Nothing changes. |
| A thrown, cut-off, or mis-correlated answer | `UNKNOWN`. It is not sent again. |
| A result after the session context changed | The write became `UNKNOWN` at the switch. The result is quarantined and applied nowhere. |
| A read that arrives for an older context, or after a newer read | Dropped. |
| A rejection from the source | `REJECTED`, which is a no-effect answer. A stale-class code (`VERSION_STALE`, `TERMS_CHANGED`, `LISTING_SUPERSEDED`) also asks for a fresh read before the next write. |
| An own write that landed after the last read | The next write waits for a fresh read. |
| A repeated intent | `FENCED` (`duplicate-intent`). |
| A caller that gives no intent, a wrong kind of reference, an unknown reference, or an unknown tier | `NOT_SENT`. Nothing is fenced, since nothing could have applied. |
| `integration-http` | `FENCED` (`not-bound`) before any send. |

A read, including the read that follows each settled write, is evidence and never resolves an unknown write. The caller supplies each intent reference, and the controller never mints one. Target fields (right, terms, expected version) are copied from the last read and are never typed or raised by the client. There is no retry, no `Idempotency-Key`, and no compensating write.

A started synthetic session is the page-load equivalent of a reload. Intents live in this page load only, and nothing is stored, so after a reload an unknown write is not recovered. This is stated on the screen. Durable session recovery is `c-async-session-fence`.

## Trade shapes

A trade shows one of these. There is no completed or done shape.

| Shape | Meaning |
| --- | --- |
| `booking-only` | Only the booking is observed. |
| `booking-payment-right` | A booking, a payment observation, and a right transfer are each observed. They stay three lines. |
| `payment-without-right` | A payment observation exists and the right did not move for this trade. The refund line reads `COMPENSATION_UNDEFINED`. |
| `right-without-payment` | The right moved and no payment observation is recorded. |
| `payment-unknown` | No payment observation arrived. Whether funds moved is not known here. |
| `unknown-effect` | The transfer result is unknown. The right may or may not have moved for this trade. |

For a trade the page prints the original right (holder and version when it was booked) next to the right in the last read. A trade seen in a read is linked to this page only when a confirmed booking receipt of this page named it. A trade observed after a lost answer is shown as observed only; this page does not claim it.

## Screen

`apps/web/src/platform-journey.ts` holds the hook and the pure view builders. `apps/web/src/pages/PlatformPanels.tsx` renders them, and `apps/web/src/pages/Platform.tsx` composes the page. Controls that are off use `aria-disabled` rather than a native `disabled`, so they stay in the keyboard order and name their reason through `aria-describedby`. A blocked, rejected, unknown, or quarantined result moves focus to the status region. Every state has a word, not only a style, and wide tables scroll inside their own labelled region instead of widening the page. Every row prints `data-source="synthetic-platform"` and `SYNTHETIC`. The page posts nothing and calls no `fetch`.

The hook starts a read when the page opens and one more read after a write that was answered (confirmed, rejected, or unknown). A fenced write, an unsent write, and a quarantined result trigger no read. Nothing polls and nothing sets a timer. The synthetic controls (scenario, deliver held response, deliver late result, switch session context, start a new synthetic session) stand in for events a real producer would cause, and a real producer offers none of them.

## Hold

The real connection is `c-platform-journey`. This node consumes no SDK, manifest, or vector and serves no producer. No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. Price, fee, refund policy, and the retention of an unknown write stay `UNDETERMINED`.

## Browser run

Observed in headless Chrome 154.0.8037.97 on 2026-10-13, driven by a Playwright script kept outside the repo. The stub desk was the default production build, and the HTTP desk was a second build with mode `http` and base `http://127.0.0.1:8765`; the script served both from `127.0.0.1`. Nothing was listening on port 8765. There was no page exception on either desk. The stub desk logged no console error, and the HTTP desk logged only the shell's failed probe to port 8765.

| State | Observed |
| --- | --- |
| Normal | "Platform read." Three listings: `lst-0001` and `lst-0002` on `rgt-0001`, `lst-0003` on `rgt-0002`. Tab reached the first Book button on the 28th press (the shell links come first). Enter booked: "Booking confirmed by the synthetic source. This is not a protocol receipt." and trade `trd-0001` showed `booking-only`. Booking the partner board added `trd-0002` |
| Two channels, one right | Two Enter presses on the two Transfer buttons: the first was confirmed and the second was rejected `VERSION_STALE` by the source. The stub answers within a microtask, so the second press arrived after the first had settled and the page had read again; the same-tick in-flight fence is covered by the adapter tests. Final: `trd-0001` `booking-payment-right`, `trd-0002` `payment-without-right`, `rgt-0001` integrity `ok`, "One trade moved this right in the last read." A second press on the loser after a read was rejected again, still one confirmed transfer. The loser showed "Right rgt-0001 when this trade was booked: holder holder-seed-1 at version 7", "in the last read: holder platform-desk at version 8", and "Refund: COMPENSATION_UNDEFINED", while the winner showed "Refund: nothing to compensate on this trade." Focus moved to the status region after the refusal |
| Empty | "No listings in this synthetic session. Nothing can be booked, changed, or transferred." with one Read again action |
| Stale | "Stale platform read. Watermark 2026-10-10T00:00:00.000Z is older than the floor 2026-10-12T00:00:00.000Z." |
| In progress | In `held-response` the booking sat as `IN_FLIGHT`. Both Book buttons of `rgt-0001` were `aria-disabled="true"` with "Another write on this right is in flight (intent-1). Wait for its answer." and `lst-0003` stayed enabled. The disabled button took keyboard focus and Enter sent nothing: the counters stayed at "Sent 1" |
| Stale session | Switch session context while that write was in flight: state `unread`, and `intent-1` became `UNKNOWN` `CONTEXT_SWITCHED`. Deliver held response: "Result confirmed for intent-1 was quarantined (context-changed). It changed nothing." and the page stayed `unread` with no trade shown. Read again: `trd-0001` appeared as `booking-only` with `linked=false`, `lst-0001` Book read "It was sent in an earlier session context. Writes on this right stay blocked. A read does not resolve it.", and `lst-0003` stayed enabled |
| Payment lost | Booking confirmed and observed, payment `unknown` ("Whether funds moved is not known here."), right transfer not observed, refund `unavailable` (`COMPENSATION_UNDEFINED`). Transfer was `aria-disabled` with "No payment observation is recorded for trd-0001, so the transfer waits." Holder stayed `holder-seed-1` at version 7 |
| Booking answer lost | "Booking result unknown (RESPONSE_LOST). It may or may not have applied." Further presses on both listings of the right sent nothing (counters stayed at "Sent 1"). After Read again `trd-0001` was shown as observed with `linked=false` and the page said "No trade is linked to it, and a trade seen in a read is not claimed for it." |
| Late result | Transfer unknown. Deliver late result: "Late result confirmed recorded for intent-2. The write stays unknown." The right transfer line read "Unknown (RESPONSE_LOST). A late result is recorded." beside "Observed in the last read", and Transfer stayed blocked |
| Rival channel | Transfer rejected `VERSION_STALE`. "Holder holder-rival at version 8". `trd-0002` was the rival's trade, `booking-payment-right`, `linked=false`, and ours was `payment-without-right`. This page showed no success of its own |
| New session | Intents cleared and three listings read again, as after a reload |
| Narrow | At 360 px the page had no horizontal scroll (`scrollWidth` 360). The first run showed 773 from the identity table; the tables now scroll inside labelled regions |
| HTTP desk | `data-platform-state="not-bound"` with the not-bound reason, 0 listings, 0 Book buttons, and `data-adapter-environment="integration-http"`. The only request outside the page assets was the shell's `GET /health` probe to port 8765 |
| Requests | On the stub desk every request was a page `GET`. No `POST`, and no request to port 8765 |

Not observed in the browser: the loading frame, because the stub port answers within a microtask (the server-rendered test covers the loading markup), and a screen reader pass. A real browser pass against a producer stays unverified by design, since no live environment exists for this stub scope.

## Tests

`packages/protocol-adapter/test/platform-journey.test.ts` covers the identity register against the pin, the not-composed record and the byte-identical bindings hash, reference kinds, the port choice, every read outcome, the writes and each refusal, the invalid-request set, the naive source, each fault scenario, and a source scan. `packages/protocol-adapter/test/platform-controller.test.ts` covers the context key, dropped reads, the write fence, the two-channel race on one page and across two pages, the rival channel, an integrity fault, payment loss, client resend with a payment count at the source, late results, a stale session, a changed price, the not-bound port, and a changed tuple. `apps/web/test/platform-journey.test.tsx` covers the screen for each state, every fence sentence, the journeys above as rendered pages, the mounted route, the registry, handoff, and fixture rows, and a source scan of the three new web modules. The workspace registry, contract fixture library, and handoff tests check the `platform-journey-trade` surface and its eight fixture rows.
