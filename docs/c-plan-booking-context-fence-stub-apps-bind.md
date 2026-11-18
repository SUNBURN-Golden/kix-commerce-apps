# Booking context fence — stub apps bind

## Scope and authority

This node is authorized by the user-supplied KIX Commerce planner run `1793941263` (`codex:gpt-6-astra/high`, design lane, `/workspace/commerce-run/logs/planner_1793941263`). It is absent from the executable 18-node `.aiops/program.json`; this delivery implements only the explicitly assigned booking fix, not a pending/draft catalogue node, and adds no program entry. `.aiops/**` and `docs/aiops/**` remain untouched. `docs/aiops/PENDING_NODES.json` and `KIX_COMMERCE_PROGRAM_DRAFT.json` are non-executable and nothing is implemented from them. This is not an ASTRA program-mode delivery. No signer, marker, comment, issue, commit, push, or PR is created by this work.

The objective's `docs/booking-context-fence-stub-apps-bind.md` denotes this same deliverable; the explicit Constraints path is used instead of creating two documents.

> M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce

`placeHold` remains not-bound with `reserve_listing` considered. No new mapping to `reserve_listing` or `prepare_trade` is introduced. `confirmBooking` sends no `capture`; settlement sends no `settle_capture`; no capture/settle sequence or desk-method remap is composed. The independent journey still stops after `create_event` → `prepare_trade` → `accept_trade`, recording the remaining not-bound reasons. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical; its SHA-256 is checked below. Journey composers and reservation/admission/refund panels are unchanged.

### Owner ruling — bundle cap (2026-11-09 14:10 KST, JunTae)

Owner ruling JunTae 2026-11-09 14:10 KST lifts the bundle-size cap that had blocked an earlier draft: raise **only** the specific cap(s) this node exceeds, by the minimum needed for this node's measured size plus small headroom, in the existing budget file; keep every other cap, gate, assertion, timeout, protocol binding, and CI config unchanged; accept only fully green exact-head GitHub Actions CI.

Measured on the final tree with Node 22.23.4, this node exceeds **no** cap, so `apps/web/bundle-budget.json` is **unchanged**. Old value = new value for every cap; reason recorded here as **owner ruling JunTae 2026-11-09**. The exact-head CI remains the acceptance authority for browser jobs.

| Cap | Old value | New value | Final measured |
| --- | --- | --- | --- |
| `initialJsGzip` | 290000 | 290000 (unchanged) | 160089 |
| `initialCssGzip` | 5000 | 5000 (unchanged) | 4997 |
| `chunkJsGzip` | 30000 | 30000 (unchanged) | 27512 |
| `totalGrowth.base` | 790000 | 790000 (unchanged) | 786499 |
| `entry-import-graph` initial target | 282000 | 282000 (unchanged) | 160089 |
| `entry-import-graph` total target | min(790000, base × ratio) | unchanged | 786499 |

## Event ownership and lifetime

`booking-context.ts` keeps one record per exact route event ID in module memory. Quantity, performance, read state/error/generation, hold, booking, write error, pending token, and blocked evidence belong to that record. Selecting B reads B synchronously, including its first render. A never supplies B's form, title, hold, error, or admission link.

Records survive route changes and route unmounts for this page load. Subscription cleanup sends nothing and changes no write state. Reload resets memory. There is no session/local storage, durable recovery, cross-tab coordination, retention limit, or new expiry policy. Retention and reload recovery policy remain **UNDETERMINED**; adapter expiry behavior is retained.

## Interfaces

`createBookingContextStore({ port })` accepts only `listPerformances`, `placeHold`, `releaseHold`, and `confirmBooking`. It exposes stable `subscribe` and cached, referentially stable `getSnapshot(eventId)`, plus `load`, `setQuantity`, `placeHold`, `releaseHold`, and `confirm`. `bookingContextStore` is the page-load default, using the existing guarded desk protocol. `useBookingContext(eventId, store)` subscribes with `useSyncExternalStore`. `BookingPage` accepts an optional isolated store for mounted tests; the route registry is unchanged, so production uses the module singleton.

The page body is keyed by event, as is the validation form, so B never inherits A's validation summary. The existing focus utility skips its first paint: old errors on reentry have no focus intent. Only a newly observed outcome on the mounted event can move focus. Quantity is retained on rejection, and read failures never invalidate the quantity input or use `booking-error`.

## Transition rules

- Connectivity, quantity, owned hold, booking, pending, and blocked eligibility are checked before dispatch. The pending identity token is acquired synchronously before the adapter call. Two activations before React rerenders, including release/confirm competition, send once.
- Event, quantity, and hold ID are captured in pending metadata. Internal tokens are identities, never protocol operation IDs. Only the owning token clears pending, through success, rejection, interruption, or mismatch.
- Each event makes one initial catalogue read. Loading reuses the in-flight promise; ready/empty/error reuse the settled promise. Reentry and StrictMode do not replay a read or retry a failed read. There is no manual-refresh control in this legacy form.
- Successful hold, release, and confirm each perform one event-owned catalogue refresh; pending remains held through that refresh. Read generations invalidate earlier observations, and reads never release a write fence. The public API cannot initiate overlapping same-event reads while a write/refresh is unresolved.
- Read errors are separate from write errors. A refresh failure retains a successful hold, release, or booking and renders the existing `desk.performance.singleLoadError` without `booking-error` or `aria-invalid`. Confirmation clears its hold and retains the booking. Release clears its captured hold; its return type is `void`, with no invented response identity.
- Foreign or missing hold/booking evidence is withheld, pending is cleared by its owner, and the event remains blocked. No compensation, release, retry, or recovery is invented. `ConnectivityInterrupted` also keeps the event blocked after pending clears; late underlying results remain governed by the existing guarded port.
- `HOLD_EXPIRED` and `HOLD_NOT_ACTIVE` clear only the captured hold, retain the write error, and refresh that event. No other event is changed.
- Admission uses the confirmed booking's own encoded `rightsRef` and `eventId`. The resale link retains the booking ID.

## Acceptance matrix

| Requirement | Evidence |
| --- | --- |
| A→B→A during hold/release/confirm | Parameterized deferred store and mounted tests; exact write arguments and counts; B's independent completion cannot unlock A |
| Catalogue refresh during navigation | Deferred event reads and post-write refreshes settled out of order; refresh blocks stay with their owning event; no reentry read replay for ready/empty/error; refresh failure preserves successful writes |
| Same-turn single flight | Two DOM activations in one `act`, direct competing store calls, and release versus confirm |
| Page lifetime | StrictMode, route unmount/remount, event quantities and unresolved tokens retained |
| Labels, validation, links, focus | Mounted event titles/controls/quantities, reset validation summary, matching link parameters, foreign evidence withholding, inactive focus suppression, active rejection focus |
| No navigation writes | Exact adapter write logs; no cancellation, compensation, or retry |
| Real browser | Four registered `booking.context.*` checks on the test-only fault origin, through Box office links without reload |
| Fail-closed transport | Existing protocol tests and NOT_BOUND/error preservation test; protected binding hash checked |

Controlled promises use an inert-by-default `__kixBookingFence` probe in the **shell-fault test build only**. There are no production hooks; opt-in test-only flags exist only in that shell-fault build. Existing `__kixShellFault`, `__kixFormDeferred`, and `__kixAsyncReadMode` probes are preserved. Other panels also read the catalogue, so browser assertions filter booking writes; isolated unit tests count legacy reads. Every new browser check is registered in `SHARED_CHECKS`.

## Changed files

- `apps/web/src/booking-context.ts` — new event-owned store, hook, and synchronous write fence.
- `apps/web/src/pages/Booking.tsx` — consumes the event snapshot; event-keyed page and form; matching admission link.
- `apps/web/test/booking-context-fence.test.ts` — deferred store tests.
- `apps/web/test/booking-context-fence.test.tsx` — mounted navigation, controls, focus, validation, links.
- `apps/web/test/locale-instant-presentation.test.tsx` — fresh injected booking store per locale case.
- `apps/web/test/journey-panel.test.tsx` — sibling source assertion after consolidating loading/empty rendering; composer/binding checks retained.
- `apps/e2e/shell-fixtures/protocol-fault.ts` — inert-by-default, test-only `__kixBookingFence` probe.
- `apps/e2e/src/journey-matrix.ts` — registers the four new browser checks.
- `apps/e2e/tests/journeys/booking-context-fence.e2e.test.ts` — browser A→B→A regressions.
- this document.

No budget, CI, package, lockfile, protected-binding, `.aiops/**`, or `docs/aiops/**` file is changed. No `DECISION_REQUIRED.md` remains; the earlier budget STOP is resolved by the 2026-11-09 owner ruling and the measured fit above.

## Executed verification

Node 22.23.4 (CI's major) was selected from the command-local cache with `PATH=/home/box/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH`. Browser commands added `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1` for this container. No long job was detached.

| Command actually executed | Result |
| --- | --- |
| `node --version` under the Node 22 path | `v22.23.4` |
| `npm ci` | PASS; 535 packages. Audit reports 14 dev-inclusive advisories (11 moderate, 1 high, 2 critical); no lockfile change |
| `npm exec -w @kix/web -- vitest run test/booking-context-fence.test.ts test/booking-context-fence.test.tsx` | PASS: 2 files, 26/26 (16 store, 10 mounted) |
| `npm run typecheck` | PASS (adapter + web) |
| `npm run typecheck:e2e` | PASS |
| `npm run build` | PASS (existing M05 circular-chunk warning remains) |
| `npm run budget` | PASS: initial JS 160089, initial CSS 4997, total gzip 786499, largest chunk 27512 |
| `npm exec -w @kix/web -- vitest run test/entry-import-graph.test.ts` | PASS: 2/2; initial 160089 ≤ 282000 and total 786499 ≤ 790000 |
| `npm run test -w @kix/protocol-adapter` | PASS: 76 files passed / 5 skipped; 2998 passed / 23 skipped |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 2998 passed / 23 skipped; web 112 files, 1679 passed; cold shell 6 passed. Live-gate skips are not treated as passes |
| `npm run lint` | PASS |
| `npm run cycle-check` | PASS: no circular imports |
| `npm run deps:check` | PASS: 4 manifests / 630 lockfile entries |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: lines 94.53%, functions 86.93%, branches 90.79%, statements 94.53%; all floors met |
| `npm run audit:warn` | PASS: 0 production vulnerabilities |
| `KIX_E2E_CHROME=… KIX_E2E_NO_SANDBOX=1 npm run test:e2e` (first run) | FAIL: 3 tests in unrelated `buyer`/`shared` files lost the browser context; 259 passed. Isolated rerun of both files passed 10/10, indicating a transient browser crash |
| `KIX_E2E_CHROME=… npm run test:e2e` (full rerun) | PASS: 53 files, 262 tests, including `booking.context.hold`, `.release`, `.confirm`, `.refresh`, and the complete required-check teardown |
| `KIX_E2E_CHROME=… npm run test:a11y` | PASS: 23 files, 446 tests |
| `KIX_E2E_CHROME=… npm run test:budget` | PASS: 3 files, 9 tests |
| `KIX_E2E_CHROME=… npm run test:visual` | PASS: 3 files, 123 tests |
| `git diff --check` | PASS |
| `git diff --name-only -- packages .aiops docs/aiops .github apps/web/bundle-budget.json package.json package-lock.json` | Empty: protected paths unchanged |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` | `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249` (locked hash) |

Exact-head GitHub Actions CI remains the acceptance authority; the owner ruling requires it to be fully green, and browser jobs run there rather than being replaced by local evidence. No live-gate test skipped under `KIX_REQUIRE_GATE=0` is represented as a pass.

## Deviations and limitations

The implementation uses `useRestoreFocus` with an event-keyed page body instead of storing inactive focus intents. The store retains an error-control target as outcome data; old outcomes on reentry do not create a focus intent. Loading/empty rendering and the submit button share markup to contain bundle growth; the unused `off` translation import was removed, with no copy or catalogue edits. Tests requiring a fresh legacy page lifetime now explicitly inject a fresh store. A quantity rejection restores through `heldAfterError` and keeps the typed value. The first full browser run failed transiently in unrelated files; the complete rerun and the isolated files were green.

Stub remains default. HTTP stays explicit loopback `http://127.0.0.1` only, one attempt, no retry, Idempotency-Key, redirect following, fallback, proxy around the gate, or UI fetch. Production/truth flags remain false. There is no real payment, bank rail, venue scan, KYC, lending, public deployment, live marketplace, new command, SLO, secret, or copied protocol/kernel/settlement math. No `kix-protocol` change or catalogue/gate update is consumed; pins remain unchanged.

STOP and seek an owner decision if a missing executable authority, unmerged contract/dependency, new protocol command, hardware, money/paid service, secret, production runtime, product policy, protected binding change, or wider implementation scope becomes necessary. If exact-head CI or a later build exceeds one specific cap, only that cap may be raised by the minimum measured need plus small headroom under the 2026-11-09 owner ruling, with old value, new value, and reason recorded; every other cap, gate, assertion, timeout, protocol binding, and CI config stays unchanged.
