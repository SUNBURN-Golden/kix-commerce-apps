# Refund and return states stub apps bind

## Consumption evidence correction — 2026-10-23

Recorded option (b) now binds the consumed p-sdk-0 BOOTSTRAP SDK, manifest, and vector digests into fixture catalogue v2, discovery's shared synthetic-port checks, release, qualification, and handoff. See [audit-6-decision-apps-bind.md](audit-6-decision-apps-bind.md) for the owner ruling, current tuple, historical v1, consumer mapping, verification, and boundaries. Unavailable domain producer tuples retain nulls and NOT_BOUND. BOOTSTRAP remains `catalogue-schema-binding only`; this grants no qualification or release authority.

The original delivery description and run records below are historical. Any statement there that consumption digests stay null describes v1 at that delivery, not the current app evidence tuple. Both OpenAPI pins, `PINNED_ACTIONS`, the CI gate SHA, `protocolMergeSha`, and locked desk bindings are unchanged.

This bind is the stub-scoped composition of pending nodes `api-state-distinction` and `refund-surface`. Both remain in `docs/aiops/PENDING_NODES.json` for later promotion once `kix-protocol` merges the contracts they wait on. This node shows reservation, payment observation, right issuance, return-required, and refund-done as five separate order states, and cancel, void, PG-cancel adjustment, return observation, and refund as five separate flow lines, all read from and written to an in-process synthetic source. It is not a refund integration and does not claim one.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical. `contract_change=NO`.

## What this surface sends

Nothing goes to a protocol. The desk sends no local call and no money posting. Its writes land on an in-process synthetic source (`synthetic-refund`), which is a stand-in for the producer refund surface. `capture` and `settle_capture` are never composed or sent; `commit_trade`, `open_admission`, and `admit` stay uncomposed; `refund_ticket`, `void_unissued`, `adjust_pg_cancel`, and `observe_return` are pinned and recorded in `REFUND_RETURN_NOT_COMPOSED` and are never sent; the catalogue has no booking-cancel command, so the synthetic cancel line names none. `placeHold` stays not-bound with `consideredAction` `reserve_listing` (`REFUND_HOLD_NOT_BOUND` quotes the locked binding). The five synthetic steps (`cancel`, `void`, `adjust`, `observe-return`, `refund`) are not desk methods and not catalogue commands.

On `integration-http` the read and every write are `not-bound`: the contract-only catalogue has no order read or refund command, and `api-state-distinction` and `refund-surface` are not promoted. There is no stub fallback, no third adapter, and no request.

## The five states and the per-screen mapping

`OUTCOME_TRACKS` now carries six badges: `reservation`, `payment`, `issuance`, `admission`, `return-required`, `refund-done`. The buyer flow gained a `return` stage (track `return-required`) and the `refund` stage carries `refund-done`. Return-required is its own state, not a pre-stage of refund-done: observing a return records a return and no refund, and a recorded refund clears no return marker. There is no aggregate completion state, and `refund-done` is a synthetic record label, never a real refund.

| Screen | Route | What it shows |
| --- | --- | --- |
| Booking | `/booking/:eventId` | The full desk for `ord_<eventId>`: five state cells, five flow lines, write controls, session record. A reservation stays its own badge and is never drawn as a payment. |
| Box office / settlement | `/` (with the mock settlement panel open) | The same desk for `ord_<eventId>` beside the settlement case. `CAPTURED`/`COMMITTED` stay mock phase names; the refund lines are synthetic records, not settlement output. |
| Buyer workspace | `/buyer` | The desk read-only for the selected event: five cells and five lines with no write controls. |
| Trading platform | `/platform` | Its own `refund` facet stays `COMPENSATION_UNDEFINED` / `unavailable`. Unchanged. |
| Provider journey | `/provider` | Its own `refund` record facet. Unchanged. |

## Acceptance mapping

| Spec item | Where it lives | Test |
| --- | --- | --- |
| Five states stay separate; no aggregate completion | `REFUND_CELLS`, `OUTCOME_TRACKS` (six), cell strip with `data-track` | `packages/protocol-adapter/test/refund-return.test.ts`, `apps/web/test/refund-return.test.tsx`, `workspace-registry.test.ts` |
| A reservation is never shown as a payment (booking, buyer, box office) | cell copy says "not a payment"; the desk mounts on all three screens | `refund-return.test.tsx` per-state markup assertions |
| Return-required is not a refund pre-stage and composes no refund | `markReturnRequired` is a source event; `observe-return` clears only the marker; `refund-recorded` keeps `required` | `refund-return.test.ts`, `refund-return.test.tsx` |
| Refund, cancel, void, PG-cancel adjustment, return observation are separate lines | `REFUND_FLOW_LINES`, one `data-line` row each, `sent:false`, `executed:false` | `refund-return.test.ts`, `refund-return.test.tsx` |
| No real refund and no `refund_ticket` send | `REFUND_RETURN_NOT_COMPOSED`, non-claim fields on every payload and receipt | `refund-return.test.ts`, `refund-return-controller.test.ts` |
| Empty, error, in-flight, and UNKNOWN screens | `empty`, `stale`, `claims-real`, `refund-lost`, `held-response` scenarios; fence and unknown rendering | `refund-return.test.tsx`, `refund-return-controller.test.ts` |

## The synthetic source

`packages/protocol-adapter/src/refund-return.ts`. State lives in the object, so a new port is a new session. A read names an order reference (`ord_<label>`); the source seeds a case for it in the scenario's start state. Every read and every answer carries six non-claim fields, all false: `realPayment`, `fundsMoved`, `refundExecuted`, `voidExecuted`, `integrationComplete`, `productionEnvironment`. A read that omits one or says otherwise is refused whole before a row shows; an answer that says otherwise is untrusted and the write becomes `UNKNOWN`.

Source rules (stub policy, not protocol law): a cancel applies only while no payment is observed — once paid, `CANCEL_AFTER_PAYMENT` sends the operator to the refund line. A void applies only while the order is paid and unissued. An adjustment and a refund each name the recorded payment observation. A return observation applies only while a return is required; marking one required is a source event (`markReturnRequired`). A refund records `rfd-` and touches no other cell: `returnRequired` stays required. Nothing is refunded and nothing is queued.

| Scenario | What the source does |
| --- | --- |
| `clean` | Confirmed reservation, observed payment, issued right. |
| `held-only` | A held reservation only; a cancel can be recorded. |
| `unissued` | Paid and unissued; a void can be recorded. |
| `returned` | A return observation is already recorded. |
| `refund-recorded` | A refund record exists and the return marker stays required. |
| `empty` | No case for the order. |
| `stale` | Serves a watermark older than the floor. |
| `refund-lost` | A refund is applied and its answer is lost; a late result can be delivered. |
| `held-response` | Answers are held until `deliverHeld`. |
| `claims-real` / `receipt-claims` | The read claims `realPayment`, or the confirmed answer does. |

## The controller

`packages/protocol-adapter/src/refund-return-controller.ts`. One write at a time per order, each intent once, no resend. A write while another is in flight is `FENCED` (`in-flight`); a write after an unknown result is `FENCED` (`unknown-outcome`) until a new session; a read never resolves an unknown write; a late result is evidence only; a result that lands after a context switch is quarantined. Step gates fence a refund or adjustment until a payment is observed (`payment-unobserved`), a return observation until a return is required (`return-not-required`), a void once the order is issued (`already-issued`), and a cancel once the order is paid or cancelled (`cancel-closed`).

## Screen

`apps/web/src/refund-return.ts` holds the hook and the pure view builder. `apps/web/src/pages/RefundReturnPanel.tsx` renders the strip, the lines, the controls, and the session record, and mounts on the booking page and beside the box-office settlement panel with write controls, and on the buyer workspace read-only. Off controls use `aria-disabled` and `aria-describedby`, so they stay in the keyboard order and name their reason. The page posts nothing and calls no `fetch`.

## Hold

The real surfaces are `api-state-distinction` and `refund-surface`. This node consumes no SDK, manifest, or vector and serves no producer. No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Refund policy values stay `UNDETERMINED` and `COMPENSATION_UNDEFINED` stays visible on the platform trade.

## Browser run

Observed in a real browser: headless Google Chrome (`/usr/bin/google-chrome`, playwright-core 1.59.1) against `vite preview` on `http://127.0.0.1:5173`, stub mode, 1280×900. Every check below was scripted and observed, 26/26 pass.

- `/booking/evt_lanterns`, scenario `clean`: the desk reached `data-refund-state="ready"` and showed the five cells `reservation=confirmed`, `payment=observed`, `issuance=issued`, `return-required=none`, `refund-done=none`, each on its own `data-track`, and the five lines `cancel`, `void`, `pgAdjust`, `returnObservation`, `refund`, each `none` with `sent:false`/`executed:false`. The reservation cell says "not a payment" and never says paid or complete. The refund control was enabled; cancel and void were off with `aria-disabled="true"` and a named reason ("not the refund path" / `already-issued`) reachable by `aria-describedby`.
- Recorded a refund: `refund-done` became `recorded` on its own cell and line; `return-required` stayed `none`. `Mark a return required` (synthetic source event) flipped only the return cell to `required`; the return-observation control then enabled; recording it flipped the cell to `observed` and changed no other line or cell.
- Keyboard: after `Tab` from the status region every guarded control was reached in order — including the off `cancel`, `void`, `pgAdjust`, `returnObservation`, `held`, and `late` controls — and an off control took focus and announced its fence reason.
- Scenario select covered the remaining states without a reload trap: `empty` showed "No refund case"; `stale` showed "Stale refund read"; `claims-real` showed "refused whole"; `held-response` showed the refund line `in-flight` until `Deliver held response` made it `confirmed`; `refund-lost` showed the refund line `unknown` (`RESPONSE_LOST`), fenced the next write (`pgAdjust` `aria-disabled`), and `Deliver late result` recorded the late result as evidence while the write stayed unknown.
- `/buyer`: the desk mounted read-only (`data-refund-variant="buyer"`), zero buttons, five `data-track` cells. `/`: opening "Mock settlement" mounted the desk beside the settlement panel (`data-refund-variant="settlement"`, `ready`).
- Request log: no POST and no fetch to any api path was observed; the page calls no `fetch`.

A live environment and a real provider/producer integration are not available by design and stay unverified; every row above is a synthetic in-process state, not a protocol receipt.

## Tests

`npm run typecheck`; `npm run build`; `KIX_REQUIRE_GATE=0 npm test` covers the source (`packages/protocol-adapter/test/refund-return.test.ts`), the controller (`refund-return-controller.test.ts`), the screen (`apps/web/test/refund-return.test.tsx`), and the registry vocabulary (`workspace-registry.test.ts`).
