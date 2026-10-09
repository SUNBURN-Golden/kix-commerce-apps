# Buyer workspace apps bind

This bind is the read-only buyer workspace at `/buyer`. It shows selection, reservation, order, and issuance from the desks already on this page load, links the receipts those desks produced, and gives blank, error, loading, and unsupported states a return action. It adds no command, no read, no retry, and no desk binding.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical.

## What the page shows

The page reads `listPerformances` once per load and once more when the person presses Read again. That call is the existing stub read. A message that starts `listPerformances is not-bound.` becomes the locked `COMMERCE_COMMAND_BINDINGS.listPerformances` reason. The page does not switch adapters.

Progress rows stay separate. A track is `confirmed` only when that row has a receipt. Journey and gift row statuses map as `confirmed` to `confirmed`, `rejected` to `rejected`, `unconfirmed` to `unknown`, `not-sent` to `not-sent`, `blocked` to `fenced`, `unavailable` to `unavailable`, `ready` or `not-started` to `empty`, and `in-flight` to `in-flight`. `placeHold` stays not-bound with `consideredAction` `reserve_listing` and `mappedOntoPrepareTrade` false. The payment row quotes the locked `confirmBooking` reason and does not post. The ticket-read row quotes the locked `getBooking` reason. There is no published read of a held ticket (`ReadObservationV1` is unpublished), so the page does not invent one and does not treat a mock phase as ownership.

A reservation view prints `phase`, `expiresAt`, `expired`, `issueStatus`, and `lastRejectCode` when the desk view has them. A mock resale right prints `eligibility`, `salePhase`, and `lastRejectCode`. Those strings are copied. They are not upgraded to a catalogue receipt.

Evidence is the operation ids and ref ids already on this page load. A journey row links to `/booking/<eventId>`. A gift row links to `/gift` with no query. A mock right links to `/resale`. The gift draft is not filled from a journey receipt.

`JOURNEY_NOT_COMPOSED` is listed as recorded and not sent. The page does not compose those actions.

## Return and reload

| Catalog state | Return |
| --- | --- |
| empty | Pick a show, linking to `/` |
| error | Read again, one list read, no timer and no write |
| loading | Back to box office, linking to `/` |
| not-bound | Open box office, linking to `/` |

A reload clears page-load state and re-sends nothing. The workspace has no post, so a refresh does not run one. There is no success animation. An in-flight row stays `in-flight` until a receipt exists.

Every buyer section carries `data-adapter-environment`. Each row prints its source: `stub-shape`, `integration-gate`, `mock-case`, or `none`. The shell banner still prints the environment on every route.

The section nav is `Buyer sections`, with anchors for Shows, Progress, and Evidence. At a viewport of 720px or narrower the nav is sticky at the bottom. Focus rings and 44px targets are scoped to `.buyer-*`.

## Browser run

Observed in headless Chrome 154.0.8037.57 on 2026-10-09. The stub desk was `vite preview` at `http://127.0.0.1:5291` from the default production build. The HTTP desk was a second preview at `http://127.0.0.1:5292`. Vite inlines `VITE_KIX_PROTOCOL_MODE` and `VITE_KIX_PROTOCOL_API_BASE` at build time, so that preview was a separate build with mode `http` and base `http://127.0.0.1:8765`. Nothing was listening on port 8765. No page exception.

| State | Observed |
| --- | --- |
| Initial load | `/buyer`. Shows, Progress, and Evidence each had `data-adapter-environment="stub"`. Shows was `data-catalog="ready"` and `data-source="stub-shape"`. Evidence said "No receipt on this page load." Selection was `empty`, source `stub-shape`. |
| Catalog read | Shows listed North Station Lanterns, Paper Orchestra, and Last Ferry Diagram, with "source stub-shape" and an Open booking link on each. No Read again button on this ready catalog. |
| Shows, Progress, Evidence | Those three sections, and the Buyer sections nav, carried `data-adapter-environment="stub"`. The recorded-and-not-sent section carried `data-adapter-environment="stub"` and `data-source="none"`. |
| `placeHold` | Hold row, state `not-bound`, source `none`: "placeHold stays not-bound. consideredAction reserve_listing. mappedOntoPrepareTrade false. placeHold({ eventId, quantity }) does not match reserve_listing, which requires domain, expiresAt, listingHash, listingId, and tradeId." |
| Payment | Payment row, state `not-bound`, source `none`: "confirmBooking(holdId) does not match capture. capture carries amount, currency, and paymentId. The desk keeps simulated-no-funds bookings on the stub and does not send capture." |
| Ticket read | Ticket read row, state `not-bound`, source `none`: "The contract-only catalogue has no read command for a booking id." |
| Journey link | On `/booking/evt_lanterns`, Send `create_event`, Send `prepare_trade`, and Send `accept_trade` each showed Confirmed and "Confirmed stub-shape receipt. Not from the gate." Last confirmed receipt: `accept_trade · jrn:evt_lanterns:1:accept_trade`. The Buyer link then showed three Evidence rows, each `evt_lanterns` linking to `/booking/evt_lanterns`, status `confirmed`, source `stub-shape`. |
| 720px nav | At a 720px-wide viewport the Buyer sections nav computed `position: sticky` and `bottom: 0px`, and it sat on the bottom edge. |
| Reload | A reload returned Evidence to "No receipt on this page load." The `accept_trade` receipt line was gone. The Hold, Payment, and Ticket read not-bound rows stayed. |
| HTTP mode | Banner: "Loopback gate is unavailable (GATE_UNAVAILABLE). The client does not retry and does not fall back to the stub. The desk stays on integration HTTP." Shows was `data-catalog="not-bound"`, `data-source="integration-gate"`, and `data-adapter-environment="integration-http"`. The section text was "source integration-gate" and the alert "The contract-only catalogue has no list or read command. listPerformances stays on the stub." No show titles. The return control was Open box office. |

The browser does not reach a live gate. The page did not post `placeHold`, `capture`, or `settle_capture`.

## Hold

`UNDETERMINED` until a product owner sets them: refund and cancel policy values, hold-expiry copy beyond the adapter's `expired` and `expiresAt`, and price or fee display. Persisting an unconfirmed intent across reload is `c-async-session-fence`. Prefilling gift `ticketId` from a journey receipt needs a mapping register and a producer contract. This page does neither.

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. The five pins stay where the gate bind put them.

## Tests

`apps/web/test/buyer-workspace.test.tsx` covers the new builder and page. Journey, gift, registry, and desk-attempt suites stay as they are.

Browser exercise is the `Browser run` section above. The live-gate job is not a local pass: `KIX_REQUIRE_GATE=0` skips it.
