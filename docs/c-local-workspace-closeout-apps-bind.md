# Local workspace closeout apps bind

This bind is the local product handoff for the desk that is already on this branch. It documents first run, stub mode, the loopback gate, and how to read a failure. It lists the commands a sender posts, the screens that do not post them, and the pending producers this repo does not consume. A screen is not protocol integration.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. SDK, manifest, and vector digests stay null. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA` (`52a9b5cbf7777df55d2d2062cb8d99d862b423bb`), and `protocolMergeSha` stay where the README protocol pin section put them. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical (`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). The branch base is `53f26a99780973c4f7d4cc149e1cea050027ccf9`. This delivery is the uncommitted diff on `agent/kixc-c-local-workspace-closeout`. The supervisor commits.

The machine-readable packet is `apps/web/src/handoff/packet.ts`. The page is `/handoff`. It does not post and it does not call `fetch`.

## What is not claimed

Protocol integration is not complete. Public service, real payment, and venue admission are not complete. Qualification stays `UNQUALIFIED`. Release stays `NOT_AUTHORIZED`. A local command receipt, a stub-shape receipt, and a synthetic fixture are not those claims. `KIX_REQUIRE_GATE=0` skips the live gate. That skip is not a live-gate pass. The reviewed gate still answers no CORS preflight, so a browser on this desk is not a live gate pass. There is no proxy and no stub fallback.

## First run

From this repository:

```bash
npm install
npm test
npm run dev
```

The desk listens on port 5173. Stub mode is the default (`VITE_KIX_PROTOCOL_MODE` unset or `stub`). Page-load state stays in the browser. A reload clears it and does not send again. A base URL in stub mode does not open HTTP.

The CI stub job is `npm ci`, `npm run typecheck`, `npm run build`, and `KIX_REQUIRE_GATE=0 npm test`. This document does not change that workflow.

## Stub mode and loopback

| Mode | What the desk does |
| --- | --- |
| Stub (default) | In-memory fixtures. Environment name `stub`. Desk methods stay not-bound. |
| `http` or `integration-http` with `http://127.0.0.1:<port>` | Environment name `integration-http`. One attempt. No retry, no `Idempotency-Key`, no redirect following, no stub fallback. |
| `production`, `public`, `live`, or another unknown name | Refused. The stub is not selected. |
| HTTP without `VITE_KIX_PROTOCOL_API_BASE` | Startup throws. The desk does not fall back to the stub. |
| `https`, `localhost`, a missing port, port 0, or any other host | Rejected before a request. |

This repo does not start the gate. From a kix-protocol checkout at merge `52a9b5cbf7777df55d2d2062cb8d99d862b423bb`:

```bash
python3 -m integration_gate --port 8765
```

The process binds `127.0.0.1` only. Then start this app with `VITE_KIX_PROTOCOL_MODE=http` and `VITE_KIX_PROTOCOL_API_BASE=http://127.0.0.1:8765`. A closed port is `GATE_UNAVAILABLE` after one attempt. The browser banner stays unavailable because the gate answers no CORS preflight.

## Diagnosis

`UNKNOWN`, `NOT_BOUND`, and `STALE` stay separate. None of them is a success.

| Class or code | Meaning | Next step |
| --- | --- | --- |
| `UNKNOWN` | The call may have applied. It is not a rejection. | Fence the next write. Do not retry and do not mint an operation id. |
| `NOT_BOUND` | The desk method is not sent. | Do not map it onto another body. |
| `STALE` | A stale response does not update the track. | Do not retry. |
| `REJECT` | The call was rejected. | Leave it rejected. |
| `STALE_RESPONSE` | Transport `unavailable`, fixture class `STALE`. | Not a success. A traced protocol error may still show as unknown. Those labels are not collapsed. |
| `GATE_UNAVAILABLE` and the other unavailable codes | The loopback gate is unavailable. | No retry and no stub fallback. |
| `NOT_READY`, `OVERLOADED`, `CORE_BUSY`, `JOURNAL_BUDGET` | The loopback gate is degraded. | Not production readiness. No retry. |
| A code that is not in the local list | Not classified here. | It is not a success. |

`placeHold` stays not-bound. `consideredAction` stays `reserve_listing`. `prepare_trade` is only a `BookingJourney` body. `placeHold({ eventId, quantity })` is not mapped onto it. `confirmBooking` does not send `capture`. `settlementPreview` does not send `settle_capture`. M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

## Supported commands

These are the actions the existing senders post through `invokeLocalCall`. Each one is local only. Protocol integration is not complete.

| Sender | Commands | Surfaces |
| --- | --- | --- |
| `BookingJourney` | `create_event`, `prepare_trade`, `accept_trade` | `/booking/:eventId` |
| `OrganizerConsole` | `create_event`, `close_sales`, `open_admission`, `complete_event`, `cancel_event`, `issue_invitation` | `/organizer`, `/organizer/workspace` |
| `GiftTransfer` | `offer_gift`, `accept_gift`, `cancel_gift` | `/gift` |
| `ConsentBind` | `set_consent`, `authorize_marketing` | `/marketing/m05` |

`capture`, `settle_capture`, `commit_trade`, `admit`, and `refund_ticket` are not in that table. The booking journey still does not compose `open_admission`. The organizer console does post `open_admission` as its own request. That post is not venue admission.

## Feature status

`local-command` means a sender posts a published action on that surface. `synthetic` means a stub, a fixture, or a session card. `unsupported` means no command is posted. Every row has protocol integration not complete. A screen does not complete protocol integration.

| Status | Surfaces |
| --- | --- |
| `local-command` | `booking-journey`, `gift-transfer`, `organizer-console`, `organizer-workspace`, `marketing-m05` |
| `synthetic` | `box-office-catalog`, `box-office-journey-view`, `box-office-settlement`, `reservation-case`, `admission-credential`, `resale-desk`, `credit-desk`, `marketing-hub`, `marketing-m01`, `marketing-m02`, `marketing-m03`, `marketing-m04`, `discovery-prototype`, `discovery-live-read`, `inventory-venue-select`, `platform-journey-trade`, `merchant-operations`, `credit-origination`, `buyer-workspace`, `receipt-explorer` |
| `unsupported` | `operator-transport`, `operator-unshown-desk`, `accessibility-baseline` |

Unconnected screens are the synthetic and unsupported rows that have a page control. The admission page is one of them. Its credential label is not `admit`. The discovery page is one of them. Its rows are a fixture, and its projection read is a bounded synthetic stream. The seat and GA page is one of them. Its rows are a synthetic inventory, and a selection there sends nothing. The trading platform page is one of them. Its listings, trades, and facets are a synthetic source, and its writes land on that source and send nothing to a protocol. The merchant workroom is one of them. Its events, listings, trades, and money lines are a synthetic source, its sales figure is never settled funds or lendable, and its export is the producer's own file judged against the last read. The credit origination page is one of them. Its application, review, commitment, and drawdown lanes are a synthetic source, a submission is not a decision, an approval is not a commitment, and a recorded request is not a disbursement. The settlement panel is synthetic. Its mock phases are not funds.

## Pending producers

These ids live in the non-executable pending catalogue. `connected` is false. This node does not implement them.

| Id | Waiting surface | Why it stays pending |
| --- | --- | --- |
| `bind-list-read` | `box-office-catalog` | No list or read command. `listPerformances` stays on the stub. |
| `browser-gate-path` | `operator-transport` | The browser path to the loopback gate is not open. |
| `bind-settlement-fsm` | `box-office-settlement` | Settlement desk methods stay not-bound. |
| `bind-reservation-fsm` | `reservation-case` | Reservation desk methods stay not-bound. |
| `bind-admission-fsm` | `admission-credential` | `admit` stays uncomposed. A health probe is not entry. |
| `bind-resale-fsm` | `resale-desk` | Resale desk methods stay not-bound. Not a live marketplace. |
| `bind-credit-fsm` | `credit-desk` | The catalogue has no credit command. No disbursement. |
| `bind-wave4-pointers` | `booking-journey` | H1 keeps `placeHold` not-bound. This packet does not remap it. |
| `primary-price-fee-ui` | `booking-journey` | Price and fee display stays `UNDETERMINED`. |
| `refund-surface` | `operator-unshown-desk` | `refund_ticket` is not sent. `COMPENSATION_UNDEFINED` stays visible. |
| `c-discovery-live` | `discovery-prototype` | Synthetic rows are not a live query projection. |
| `c-inventory-venue` | `inventory-venue-select` | Seat and GA selection is a synthetic page. A real inventory and queue read stays on that pending node. |
| `c-platform-journey` | `platform-journey-trade` | The multi-channel trade page is synthetic. A real listing, trade, payment, transfer, and refund connection stays on that pending node. |
| `c-async-session-fence` | `platform-journey-trade` | The write fence and the unknown handling on the trade page live in this page load only. Durable session recovery stays on that pending node. |
| `c-merchant-operations` | `merchant-operations` | The merchant workroom is synthetic. A real event, listing, trade, and settlement-obligation read model and a real producer export stay on that pending node. |
| `c-credit-origination` | `credit-origination` | The origination desk is synthetic. A real claim basis, policy revision, consent, document, review, commitment, and drawdown permission read model and a real producer connection stay on that pending node. |
| `consume-p-sdk-0` | none | No SDK is consumed. Digests stay null. |
| `delegation-surface` | none | No delegation screen. Nothing here transfers, refunds, or signs. |

## Role journeys

Buyer: discovery, selection, reservation, payment, issuance, admission, refund, then marketing. Reservation, payment, issuance, and admission stay separate. `placeHold` is not a reservation receipt. Payment does not send `capture`. Refund stays `COMPENSATION_UNDEFINED`. Marketing M01–M04 are session stubs. M05 posts `set_consent` then `authorize_marketing`, and the label stays 미착수.

Organizer: `/organizer` posts the six lifecycle commands one at a time. `/organizer/workspace` previews, then sends one. The list is not one atomic transaction. `/merchant` is a synthetic workroom whose sales figure stays an observation and whose export is judged against the last read. `/credit/origination` is a synthetic seller advance whose submission is not a decision, whose approval is not a commitment, and whose recorded request is not a disbursement. The settlement case on `/` is synthetic.

Operator: the transport banner is a probe, not payment or admission. `/receipts` explains receipts already on the page and does not post. `/credit` is a mock case. The accessibility baseline adds no route. `/handoff` is this packet.

## Preserved original ten

The packet cites these documents and does not replace them.

| Node | Document |
| --- | --- |
| `w6a-journey-map` | `docs/wave-6a-journey-map-apps-bind.md` |
| `w6a-journey-adapter` | `docs/wave-6a-journey-adapter-apps-bind.md` |
| `w6a-journey-test` | `docs/wave-6a-journey-test-apps-bind.md` |
| `w6a-ui-skeleton` | `docs/wave-6a-ui-skeleton-apps-bind.md` |
| `w6a-evidence` | `docs/wave-6a-evidence-apps-bind.md` |
| `organizer-admin-console` | `docs/organizer-admin-console-apps-bind.md` |
| `gift-surface` | `docs/gift-surface-apps-bind.md` |
| `doc-m05-label` | `docs/wave7-marketing-m01-m05.md` |
| `w7-marketing-align` | `docs/wave7-marketing-align-apps-bind.md` |
| `w7-m05-consent-bind` | `docs/m05-consent-bind-apps-bind.md` |

Later local surfaces stay in their own binds: `docs/workspace-design-apps-bind.md`, `docs/c-buyer-workspace-apps-bind.md`, `docs/c-organizer-workspace-apps-bind.md`, `docs/c-receipt-explorer-apps-bind.md`, `docs/c-discovery-prototype-apps-bind.md`, `docs/c-discovery-live-stub-apps-bind.md`, `docs/c-inventory-venue-stub-apps-bind.md`, `docs/c-platform-journey-stub-apps-bind.md`, `docs/c-merchant-operations-stub-apps-bind.md`, `docs/c-credit-origination-stub-apps-bind.md`, `docs/c-accessibility-baseline-apps-bind.md`, and `docs/c-contract-fixture-library-apps-bind.md`.

## Hold

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. The five pins stay where the gate bind put them. Price and fee display stays `UNDETERMINED`.

## Tests

`apps/web/test/handoff-packet.test.tsx` checks the three statuses, the sender command list, the diagnosis split, the pending catalogue ids, the original ten anchors, and the loading, ready, empty, and error markup. `packages/protocol-adapter/src/commerce-bindings.ts` is hashed and must stay the recorded digest.

## Browser run

Observed in headless Chrome `Chrome/154.0.8037.97` on 2026-10-13. The desk was `vite preview` of the production build at `http://127.0.0.1:4187` (assets `index-D-ybOomj.js` and `index-CeCC_KIZ.css`). The stub adapter was selected. The banner read `Adapter stub`. A live gate was not opened. HTTP mode was not a browser pass. The page did not POST. Recorded requests were GET to `127.0.0.1:4187` plus one `data:` SVG. The visible page text did not contain `settle_capture` or `invokeLocalCall`. The loopback host on the page is the adapter pin `INTEGRATION_GATE_LOOPBACK_HOST`. The web source does not spell that address.

Desktop viewport 1280×800, URL `http://127.0.0.1:4187/handoff`:

| Step | Observed |
| --- | --- |
| Loading then ready | The handoff section was created with `data-handoff=packet`, then `data-state=loading`, then `data-state=ready`. The ready heading was `Local product handoff`. The ruling, `Protocol integration is not complete.`, `reserve_listing`, `npm run dev`, `UNQUALIFIED`, and the loopback host were on the page. The ready text did not contain `payment complete` or `admission complete`. |
| Empty filter | Query `zzzz-not-a-row` set `data-state=empty`. The page said `No handoff row matches this query.` The `booking-journey` row was absent. Focus stayed on `#handoff-query`. |
| Refused claim | Query `payment complete` set `data-state=error`. `#handoff-query` was `aria-invalid=true` and held focus. The alert mark was `data-status-mark=blocked`. The visible status word was `BLOCKED` because `.status-word` is uppercase. The alert included `This handoff refuses that completion claim.` The feature row was absent. |
| Unknown code | Code `NO_SUCH_CODE` set `data-state=error`. `#handoff-code` was `aria-invalid=true` and held focus. The page said the code is not in the local diagnosis list and is not a success. |
| `NOT_BOUND` | The diagnosis panel was `data-diagnosis=outcome` and `data-confirmed=false`. Its text was `NOT_BOUND. The desk method is not sent. Do not map it onto another body.` The section returned to `data-state=ready`. |
| Role keyboard | ArrowRight from Buyer selected `#handoff-tab-organizer`, moved focus there, and showed `organizer-workspace`. End selected `#handoff-tab-operator`, moved focus there, and showed `local-handoff`. Home selected `#handoff-tab-buyer` and moved focus there. |
| Skip link | Focus started on `Skip to content`. Activating it moved focus to `#desk-main`. |

The same build, still with no page error, rendered these routes with a `Local handoff` nav link: `/` (`Tonight’s window`), `/buyer` (`Buyer workspace`), `/discovery` (`SYNTHETIC`), `/booking/evt_lanterns` (`North Station Lanterns`), `/admission` (`Mock admission credential`), `/resale` (`Listings`), `/gift` (`Gift transfer`), `/organizer` (`Organizer console`), `/organizer/workspace` (`Organizer workspace`), `/receipts` (`Receipt explorer`), `/credit` (`Mock credit case`), `/marketing` (`Marketing desk`), and `/handoff`.

Mobile viewport 390×844 on `/handoff` in the ready state: `documentElement.scrollWidth` was 390 and `clientWidth` was 390. Nav links, handoff inputs, handoff buttons, and handoff links were at least 44px tall.
