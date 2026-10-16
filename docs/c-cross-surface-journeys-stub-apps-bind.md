# Cross-surface journeys stub apps bind

This bind is the stub-scoped cross-surface journeys screen at `/journeys`, the synthetic reduction of pending node `c-cross-surface-journeys`. That pending node stays in `docs/aiops/PENDING_NODES.json` and waits on its producer prerequisites. This node reads one table, a row for each journey and branch, over the synthetic sources that already exist, and states for each row the last confirmed step, the unconfirmed request, the blocked next action, and the compensation path. It sends no command. It is not a real integration, and a partly landed journey keeps COMPENSATION_UNDEFINED visible instead of being closed or compensated by the page.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

M2: the adapter composes nothing past `accept_trade`, `capture` and `settle_capture` stay out of every journey, and `commit_trade`, `open_admission`, and `admit` stay uncomposed with their not-bound reasons recorded. H1: `placeHold` stays not-bound with `consideredAction` `reserve_listing`, and `prepare_trade` is only a local-call body that `placeHold` is never mapped onto. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `contract_change=NO`. The table, row, and status formats are app-internal and are not a public schema, operation, capability, or identifier. Built on main `f6d4b07`.

## What this page sends

Nothing goes to a protocol. The table is built by `composeCrossSurfaceRows` in the adapter, in this process. Each row is one of three kinds:

| Basis | What it is |
| --- | --- |
| `executed` | A sibling controller driven over its own synthetic stub with the steps its own tests use. A next step is shown through the controller's `gateFor`, which answers without sending, so a step the journey has not reached is never sent |
| `reused` | Legs copied from the operational-qualification packet, or, for a pointer row, a declaration that cites the test that already pins the branch. A pointer row is `reference` and its legs are not re-run here |
| `no-source-branch` | No source reproduces the branch. The row stays visible with its reason and is never counted as a success |

On `integration-http` the port is `not-bound`: no request is made, there is no stub fallback, and the scenario controls are `aria-disabled` with a printed reason. A sibling's in-process stub is not wrapped around `HttpProtocolAdapter`.

Booking, gift, and organizer rows are pointer rows. Driving those three classes needs fixture prices, expiries, and policy values that the desks refuse to default, so the table cites the existing tests instead and runs nothing for them.

## The row

| Column | Meaning |
| --- | --- |
| Status | `closed`, `rejected`, `unknown`, `partial`, `blocked`, or `reference`. It is computed from the whole leg sequence. A per-call receipt never gives `closed`: the terminal leg must be confirmed and no earlier leg may be anything but confirmed or observed |
| Last confirmed step | The last leg a source confirmed, or `none` |
| Unconfirmed request | Every leg whose answer is `UNKNOWN`. It is not shown as done and not shown as lost, and the table does not resolve it |
| Blocked next action | A next step that is `FENCED` or not sent, with the controller's own reason |
| Compensation path | One of three words, below |

The compensation cell follows the status and nothing else.

| Word | When | Meaning |
| --- | --- | --- |
| `NONE_NEEDED` | `closed`, `rejected`, `blocked` | Nothing was applied, or the run stopped at its own last leg |
| `FENCED` | `unknown` | The request may have applied. Later writes stay held, and no opposite command is composed |
| `COMPENSATION_UNDEFINED` | `partial`, a missing branch | A leg landed and a later one did not, and no compensation path is approved. It is never filled in with a command |

No cell names a refund, a cancel, a reverse, or an automatic command.

## The table

Every journey and branch pair has exactly one row. The branches are normal, explicit rejection, response lost, and partly landed.

| Journey | Normal | Explicit rejection | Response lost | Partly landed |
| --- | --- | --- | --- | --- |
| `purchase-booking` | pointer, `booking-journey.test.ts` | pointer | pointer | pointer |
| `purchase-provider` | reused `journey.provider-checkout` | reused `journey.provider-declined` | executed, provider `observe-lost` | executed, provider `issue-lost` |
| `resale-platform` | reused `journey.platform-trade-clean` | reused `journey.platform-trade-rival` | reused `journey.platform-transfer-late` | executed, platform `payment-lost` |
| `gift` | pointer, `gift-transfer.test.ts` | no source branch | pointer | pointer |
| `refund` | executed, refund `clean` | executed, refund `held-only` | executed, refund `refund-lost` | executed, refund `held-only` |
| `marketing-benefit` | executed, marketing `clean` | executed, marketing `budget-race` | executed, marketing `apply-lost` | executed, marketing `clean` plus a refund-order source event |
| `delegation` | executed, delegation `clean` | executed, delegation `expired` | executed, delegation `draft-lost` | no source branch |
| `credit-servicing` | executed, servicing `clean` | executed, servicing `self-approval` | executed, servicing `act-lost` | executed, servicing `draw-unknown` |
| `organizer` | pointer, `organizer-console.test.ts` | pointer | pointer | pointer |
| `session-recovery` | pointer, `session-recovery-controller.test.ts` | pointer | pointer | pointer |

The delegation partial branch has no row because its only source, `cancel-lost`, needs the draft cancel. That is an opposite command, no compensation is approved, and this table sends none. The gift rejection branch has no row because no existing gift test pins an explicit rejection answer.

### Overlap with the operational-qualification stub

Five rows reuse the 14 journeys of `createStubQualificationRunner`. Their legs are copied from the packet, and the exact test that runs the packet is `packages/protocol-adapter/test/operational-qualification.test.ts`, "runs the whole matrix and records every exercise class". A test resolves each pointer: the file exists, it contains the cited title, and the qualification journey id is in the packet. The executed rows use no qualification journey id, so only the new branches are added here.

### Recorded and never composed

The table carries `CROSS_SURFACE_NOT_COMPOSED`: the journey list spread from `JOURNEY_NOT_COMPOSED`, the refund record, and the opposite commands of the journeys it reads (`cancel_gift`, `cancel_event`, `cancel-draft`, and a benefit reclaim). `CROSS_SURFACE_HOLD_NOT_BOUND` quotes the locked hold binding. Web code reaches the hold text only through that export.

## Refusal

A table is refused whole when its non-claims are not the literal false (`journeyCompleteClaimed`, `compensationExecuted`, `unknownResolved`, `realPayment`, `fundsMoved`, `productionEnvironment`, `realIntegrationComplete`), when its state is not `STUB_TABLE_RECORDED`, when a row states a status its legs do not read, when a row with an unconfirmed request says `NONE_NEEDED`, or when a compensation cell uses a fourth word. No row of a refused table stays on screen.

## Screen

Ready, empty (the source answered no rows, or a filter matches nothing), unavailable (a lost read), in progress (the held scenario), refused (the `claims-pass` scenario), and `integration-http` not-bound. The filter works on rows already held and never reads again. The scenario is a select plus an apply button, not a select that acts on change. An off control stays focusable, uses `aria-disabled`, and prints its reason. The table sits in a scroll region so it does not overflow at 360px. There is no send control, no timer, and no browser storage.

## UNDETERMINED and out of scope

- Whether a marketing reclaim restores a usage count or a budget is UNDETERMINED. The table shows a reclaim as due and not sent.
- Refund and cancel policy values, and how long a fence is kept, are UNDETERMINED.
- Resolving an UNKNOWN, sending a step again, or choosing a compensation path is out of scope. Those need an approved path and a producer contract that is not merged.
- Real payment, real KYC, credit disbursement, venue scanning, a bank rail, a live marketplace, and any public deployment are separate authority.
- `c-browser-e2e-stub` and `c-fault-injection-stub` are separate nodes.

## Acceptance mapping

| Item | Where |
| --- | --- |
| One read-only table, no new command | `cross-surface-journeys.test.ts` counts commands at zero; the registry row has `sender: null`; `cross-surface-journeys.test.tsx` checks the markup has no write control |
| Four branches per journey on existing sources, no unapproved compensation | `cross-surface-journeys.test.ts`: four rows per journey; the compensation cell is one of three words; no leg label is an opposite command |
| Overlap linked to exact test paths | The pointer-resolves test |
| UNKNOWN is not done and not lost | The SSR test: no unknown row is marked closed, and its text lacks completed, failed, and success |
| `COMPENSATION_UNDEFINED` is not hidden | The partial rows and the missing branches render it |
| No new contract meaning | Refusal tests, source scans, and no change under `.aiops/`, `docs/aiops/`, `commerce-bindings.ts`, the pins, or CI |

## Browser pass

Run against `vite build` output (stub build, and a second build with `VITE_KIX_PROTOCOL_MODE=http` and `VITE_KIX_PROTOCOL_API_BASE=http://127.0.0.1:8765`) served by a local static server, with headless Chrome driven by `playwright-core`. 32 of 32 checks passed:

- Ready (40 rows), empty source, empty filter, unavailable (`read-lost`), in progress (`held`), refused (`claims-pass`), and `integration-http` not-bound each rendered the state they name, and the unavailable and refused states left no row.
- Keyboard: arrowing the scenario select changed only the draft, Tab reached the apply button, and Enter and Space both applied. An off control (`Read the table` while a read is in flight, `Deliver held answers` outside the held scenario) stayed focusable, and Enter on it did nothing. A late answer after `Switch the context` was dropped, and focus moved to the status region.
- The filter narrowed 40 rows to 4 with no new request, and a filter that matches nothing said so.
- At 360px the page had no horizontal overflow beyond the `/inventory` baseline of 0, and the table scrolled inside its own focusable region.
- The request log of the stub run held only same-origin GETs for the page's own files. The HTTP desk made no non-GET request and its scenario control was `aria-disabled` with its reason. The one request to the loopback gate was the existing transport probe, `GET /health`, which every page makes in HTTP mode and this page adds nothing to.
- Not verified: a real mobile device, a screen reader, and the HTTP gate from a browser (no CORS). A UNKNOWN row read in the browser as `UNKNOWN: UNCONFIRMED` and never as closed, done, or lost.

## Hold

The table is a synthetic record. A `closed` row means a synthetic run's last leg was confirmed. It is not a real purchase, a payment, an admission, a refund of funds, or a credit disbursement, and no row is a producer receipt.

## Tests

- `packages/protocol-adapter/test/cross-surface-journeys.test.ts`
- `packages/protocol-adapter/test/cross-surface-controller.test.ts`
- `apps/web/test/cross-surface-journeys.test.tsx`
