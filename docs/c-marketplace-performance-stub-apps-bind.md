# Marketplace performance stub apps bind

This bind is the stub-scoped marketplace scale bench at `/marketplace-performance`. It is the synthetic reduction of pending node `c-marketplace-performance` (plan revision 2026-10-13, 준태님 승인): the real connection stays pending on `kix-protocol:ps-07-scale-qualification`, and the pending node stays unimplemented. This node wires the scale seam — a lazy 150000-row listing stream served only as bounded windows, a synthetic queue in front of the contended page, rapid search transitions, cancellation, stale and late answers, permission and context changes, a fixed memory denominator, and per-workload per-device browser-boundary measurements — onto a deterministic synthetic source. It is not a producer connection and does not claim one, a row confirms no price, no right, no sale, and no ownership, a fast page never confirms a stale price or a stale right, an emulated device is never real mobile evidence, and no producer load figure is mixed into the browser measurement denominator.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical (`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). The branch base is `60fcde92b982daa2c855d5b03c98e72b042d2af2`. This delivery is the uncommitted diff on `agent/kixc-c-marketplace-performance-stub`. The supervisor commits.

## What this page sends

Nothing goes to a protocol. The page sends no local call, no `create_event`, `prepare_trade`, or `accept_trade`, and no external marketplace call. Its reads, its one join, and its one queue check land on an in-process synthetic source, which is a stand-in for the producer. `capture` and `settle_capture` are never composed or sent, `commit_trade`, `open_admission`, `admit`, and `refund_ticket` are recorded and not sent, and `placeHold` stays not-bound with `consideredAction` `reserve_listing` (`MARKETPLACE_HOLD_NOT_BOUND` quotes the locked binding). `prepare_trade` is not mapped onto it.

On `integration-http` the read and the queue are `not-bound`: "No current producer tuple exists for the marketplace scale bench: kix-protocol:ps-07-scale-qualification is not merged and pending node c-marketplace-performance is not promoted. The contract-only catalogue has no marketplace read, queue, or search command. The bench stays NOT_BOUND on integration-http." There is no stub fallback, no third adapter, and no request.

## Scope and acceptance

| Spec item | Where it lives | Test |
| --- | --- | --- |
| Bounded reads and a virtualization-oriented denominator | `MARKETPLACE_PAGE_BOUND` 50 and `MARKETPLACE_TEXT_BOUND` 64 refuse larger asks rather than clamp; the stream holds `MARKETPLACE_TOTAL_LISTINGS` 150000 and materializes the window only, with `scannedCount` and `totalEstimate` on every ready read | `packages/protocol-adapter/test/marketplace-performance.test.ts` (bounded window, over-bound, bounded filter) |
| Virtualization: the page keeps only the last ready window | the controller's single `MarketplaceSnapshot` and the `MarketplaceMemory` denominator `heldRows` / `totalEstimate` / `pageBound` | `marketplace-performance-controller.test.ts` (memory denominator), `marketplace-performance.test.tsx` |
| Cursor paging | `MARKETPLACE_CURSOR_VERSION` 1 cursors carry projection name, revision, tenant, filter key, terms ref, sequence, and watermark; every field is checked and a wrong one is `cursor-invalid` with a named code | `marketplace-performance.test.ts` (cursor paging and validation) |
| Cancellation | `cancelReads` marks the in-flight seqs; the call is never sent again, and the late answer is counted `cancelled`, never applied | `marketplace-performance-controller.test.ts` (cancelled answer counted), `marketplace-performance.test.tsx` |
| Stale and late answers | an answer older than the newest applied read is `DROPPED older-read`; an answer landing after the actor, device, or incarnation changed is `DROPPED context-changed`; a watermark under the floor is `stale`; moved terms are `terms-moved`; all of them clear the rows | `marketplace-performance-controller.test.ts` (rapid transition, context switch, terms move), `marketplace-performance.test.ts` (stale, terms-moved) |
| A lost answer stays unknown | the `read-lost` scenario never resolves; the call stays in flight, unknown, and unsent-again | `marketplace-performance-controller.test.ts` (lost read), `marketplace-performance.test.ts` (read-lost) |
| Slow network | the `slow` scenario declares `offeredMs` 1400 and the `held` scenario holds every answer until `deliver-held`; the measured figure is the controller's own clock | `marketplace-performance.test.ts` (held delivery), controller suite |
| Queue, permission change, and duplicate tab journeys | `joinQueue`/`readQueue` are one serialized call at a time; `hot-page` reads are `queue-blocked` until admitted and `queue-expired` after; `revoke-permission` denies every call; `duplicateTab` bumps the incarnation and drops the old context's late answers | `marketplace-performance.test.ts` (queue journey, contended, lapsed, expiry, permission), `marketplace-performance-controller.test.ts` (serialization, duplicate tab) |
| Rapid search transition | `search` is a new call; the applied snapshot keeps that call's own filter; the older answer is dropped | `marketplace-performance-controller.test.ts` (filter kept, older answer dropped) |
| Device-specific latency and error and UNKNOWN reporting | every settled call lands one `MarketplaceSample` with workload, device class, `realDevice`, outcome, measured ms, offered ms, and denominator `browser-boundary`; `measurementReport` groups them and lists `real-mobile`/`real-tablet` as unverified with zero calls | `marketplace-performance-controller.test.ts` (report denominators, grouping, emulation label) |
| Producer load and browser measurement denominators stay separate | `MarketplaceReportRow.denominator` is `browser-boundary-measurement`, `producerLoadShare` is `none`, `realDeviceEvidence` is `false`, and `offeredMs` stays the source's own label | `marketplace-performance-controller.test.ts` (report row), the port's `producerLoadMeasurement: false` |
| UNKNOWN, NOT_BOUND, STALE, REFUSED, DENIED, and INVALID stay separate | the read and queue outcome unions; a fast page confirms nothing from any of them | all three suites |
| Hidden controls are not enforcement | the source checks scope, bounds, cursor, queue, and terms on every call; the port tests call `readPage`, `joinQueue`, and `readQueue` with no screen | `marketplace-performance.test.ts` |

The spec asks for a real marketplace producer, a real load test, and real device measurements. None exists in this repository — `c-marketplace-performance` is pending on `kix-protocol:ps-07-scale-qualification` — so the adapter is the synthetic port, the load figures are the source's declared labels kept on their own line, and the real handset and tablet classes stay unverified. That is the stub scope this node was reduced to, and the deviation the spec already records.

## The synthetic source

`packages/protocol-adapter/src/marketplace-performance.ts`. State lives in the object, so a new port is a new session. `marketplaceRowAt` generates rows lazily — the source materializes only the window a read asks for — and each row carries a sequence, tenant, listing ref, event and venue labels, an opaque tier, a terms ref, a status, a watermark, and the four non-claims `confirmsPrice`, `confirmsRight`, `confirmsSale`, `confirmsOwnership`, each literally `false`.

A read outcome is `ready`, `empty`, `stale`, `terms-moved`, `queue-blocked`, `queue-expired`, `denied` (`PERMISSION_REVOKED`, `FOREIGN_TENANT`), `refused` (`PRICE_CLAIM`, `RIGHT_CLAIM`, `DEVICE_CLAIM`, `LOAD_CLAIM`), `gap` (`SEQUENCE`, `ORDER`, `DUPLICATE`, `OVER_BOUND`), `cursor-invalid` (`VERSION`, `REBUILT`, `FILTER`, `TENANT`, `TERMS`, `SHAPE`), `invalid-request` (`BOUND`, `SCOPE`, `FILTER`, `PAGE_SIZE`, `CURSOR`, `WORKLOAD`, `DEVICE`), `tuple-changed`, `not-bound`, or `unknown`. A queue outcome is `queued`, `queue-state`, `denied`, `invalid-request`, `tuple-changed`, `not-bound`, or `unknown`. Every outcome carries `offeredMs`, the latency the synthetic source declares for that call — a source-side label, not a measurement.

The queue is the source's own record. `none` becomes `waiting` on join, `waiting` walks down one position per check (`contended` starts at position 2), and position 1 admits with an `admittedUntil` instant. `expire-queue` or the `queue-lapsed` scenario marks it expired: `grantsBrowseAccess` goes false, and `grantsReservation`, `grantsPayment`, and `grantsRight` stay literal `false` throughout. Only the `hot-page` workload is queue-gated; `browse-window`, `fast-search`, and `queue-expiry` reads are not.

Ref delivery is one-shot per session: `seenListingRefs` makes a second read of an already-delivered window a `DUPLICATE` gap, and a sequence that skips or reorders is a `gap` with its named code. No row from a gapped window is shown.

The synthetic controls are `deliver-held`, `expire-queue`, `revoke-permission`, `restore-permission`, and `move-terms`. The scenarios are `clean`, `empty`, `stale`, `slow`, `held`, `contended`, `queue-lapsed`, `permission-lost`, `terms-moved`, `read-lost`, `claims-price`, and `claims-device`. The port checks the pin tuple before the first row (`checkDiscoveryReadTuple`); a drifted tuple answers `tuple-changed` on reads and queue calls alike. The not-bound port answers `not-bound` on every call and accepts no synthetic control.

## The controller

`packages/protocol-adapter/src/marketplace-performance-controller.ts` holds the context key, the read reducers, the cancellation and drop rules, the queue call serialisation, the memory denominator, and the measurement ledger.

| Event | What the controller does |
| --- | --- |
| A read answer older than the newest applied read | `DROPPED older-read`, counted, sampled as `dropped`. |
| A read or queue answer landing after the context key changed — actor switch, device switch, second tab | `DROPPED context-changed`, counted, sampled as `dropped`. |
| A read whose seq was cancelled | `CANCELLED`, counted, sampled as `cancelled`. The call is never sent again. |
| A thrown or cut-off call | `unknown`. It is not sent again. |
| A read that stops being ready | Rows, the held terms, and the held filter are cleared before the state is set. Nothing stale stays on screen. |
| `switchActor`, `switchDevice`, `duplicateTab` | A new context at the next incarnation. Rows, terms, queue view, and the watermark floor are cleared, and an answer still in flight for the old context is dropped when it lands. |
| A second queue call while one is in flight | `NOT_SENT in-flight`. One queue call goes at a time. |
| `nextPage` with no issued cursor | `NOT_SENT no-cursor`. Nothing is paged past the stream end. |
| A search text over the bound | `NOT_SENT invalid`. The port is never called. |
| Every settled call | One sample in the measurement ledger under its own workload and device labels. |

There is no retry, no `Idempotency-Key`, no polling, and no stub fallback. A started synthetic session is the page-load equivalent of a reload.

## Screen

`apps/web/src/marketplace-performance.ts` holds the hook and the pure view builders. `apps/web/src/pages/MarketplacePerformancePanels.tsx` renders them, and `apps/web/src/pages/MarketplacePerformance.tsx` composes the page. The sections are the banner, controls (scenario, workload label, desk actor, device profile, second tab, new session, and the five simulate buttons), status, queue, the held window, measurements, and the session record.

Loading, stale, denied, refused, blocked, expired, and unavailable each print a word, not only a color: the status region carries a `StatusMark` word and `role="status"`, the queue carries its phase word, and every off control stays focusable through `aria-disabled` with its reason in a named paragraph. A dropped, cancelled, or unsent last result moves focus to the status region through the model's `focusToken`. The window is a labelled `role="region"` table capped at the page bound; the empty case prints the state, not a fake row. The measurement table lists the unverified real-device classes as their own rows with zero calls, and the emulation profile is labelled emulation. The banner prints `SYNTHETIC`. The page posts nothing and calls no `fetch`.

The hook starts a read when the page opens and one read after an actor, device, or tab switch. Nothing polls and nothing sets a timer; a queue check is the person's own click.

## Contract fixture rows

The screen is registered as `marketplace-performance-bench` in `contract-fixtures.ts` with eleven synthetic rows: `stale-read`, `terms-moved`, and `late-answer` as `STALE`; `queue-blocked`, `queue-expired`, `over-bound`, `permission-revoked`, `claim-refused`, `device-claim`, and `gap` as `REJECT` with their codes; and `read-lost` as `UNKNOWN`. None owns a pass and none substitutes a stub for a failed live call. The mapping table is `docs/c-contract-fixture-library-apps-bind.md`.

## Hold

The real connection is `c-marketplace-performance`, which waits on `kix-protocol:ps-07-scale-qualification`. This node consumes no SDK, manifest, or vector and serves no producer. No real payment, no credit disbursement, no venue scan, no bank rail, no public host or production deploy, no real KYC, and no live marketplace. A queue admission is browse access only and grants no hold, payment, right, or entry. No SLO and no producer load test: the `slow` and `contended` offered latencies are declared labels, never measured load. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol.

## Browser run

Not separately recorded for this node: the page is a static React tree over the same in-process port the tests drive, the web suite renders every read state — ready, empty, stale, terms-moved, queue-blocked, queue-expired, denied, refused, gap, cursor-invalid, invalid, tuple-changed, not-bound, and unavailable — the queue journey from blocked through admitted to expired, the rapid search transition with the dropped older answer, the cancelled and the lost calls, the actor/device/tab context clears, the emulated-device row labelled emulation next to the unverified real-device rows, the memory denominator line, and it mounts the `/marketplace-performance` route. The keyboard-reach mechanics (`aria-disabled` controls that name their reason, the focusToken move to the status region) are the same ones the finance, tenant-permissions, delegated-assistant, and notification-inbox runs recorded. Real device measurements stay unverified by design for this stub scope.

## Tests

`packages/protocol-adapter/test/marketplace-performance.test.ts` covers the scenario and control vocabulary, the bounded window over the lazy stream, cursor paging and every cursor refusal, the over-bound page and filter refusals, the bounded filter scan, the stale watermark, the queue-blocked, contended, admitted, expired, and lapsed journeys, the terms-move refusals, the permission revocation and restore, the held and lost answers, the price and device claim refusals, the drifted tuple, the sequence, order, and duplicate gaps, the empty read, the not-bound port, and the environment factory. `packages/protocol-adapter/test/marketplace-performance-controller.test.ts` covers the memory denominator, one-call paging, the not-sent refusals, the per-call filter kept in the snapshot, the dropped older and context answers, the cancelled count, the lost read that stays unknown and unsent, the duplicate tab and actor and device context clears, the emulation label, the hot-page journey through expiry, the queue call serialisation, the terms-move clearing, the stale, denied, and unavailable states, the throwing port, the not-bound environment, the drifted tuple, and the measurement report's denominators and grouping. `apps/web/test/marketplace-performance.test.tsx` covers the screen for each state, the queue section, the window and paging control, the measurement table with the unverified device rows, the registry surface, the pending producer row, the fixture rows, the mounted route, and a source scan of the new web modules.
