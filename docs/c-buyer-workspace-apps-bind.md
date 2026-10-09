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

## Hold

`UNDETERMINED` until a product owner sets them: refund and cancel policy values, hold-expiry copy beyond the adapter's `expired` and `expiresAt`, and price or fee display. Persisting an unconfirmed intent across reload is `c-async-session-fence`. Prefilling gift `ticketId` from a journey receipt needs a mapping register and a producer contract. This page does neither.

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. The five pins stay where the gate bind put them.

## Tests

`apps/web/test/buyer-workspace.test.tsx` covers the new builder and page. Journey, gift, registry, and desk-attempt suites stay as they are.

Browser exercise of the dev server is recorded with the delivery when a browser is available. A missing browser stays unverified. The live-gate job is not a local pass: `KIX_REQUIRE_GATE=0` skips it.
