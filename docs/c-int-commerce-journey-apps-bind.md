# c-int-commerce-journey app binding and evidence

The booking page runs one of the producer fixture's resale, admission or cancel/refund branches per page load. The panel mounts only after a performance resolves for the event, so the unknown-event view keeps its existing heading structure and accessibility profile. Each click advances one command through the selected adapter and connectivity guard. The default stub reuses the in-memory reservation, resale, settlement and admission store classes with a dedicated fixture instance. Its logical clocks and identities stay independent of the existing desks. Integration HTTP sends the same fixture body through the pinned SDK client. The existing Wave 6-A `BookingJourney` and synthetic `RefundReturnPanel` stay separate from the catalogue receipt panel. Reservation cancellation, mock refund binding and mock acceptance have separate cells. The refund runs on an independent fixture settlement.

## Consumed tuple

| Item | Value |
| --- | --- |
| Reviewed producer merge | SUNBURN-Golden/kix-protocol PR #448, `8ba7f6c36373ac0ec49246f51f7471c164ac3a28`, tree `d3f5412ef84f64fe83c5d3a3d3ada173921bfbf9`, head `648859b1c9cda424f1a4615ac5155edf46fd0524` |
| Catalogue introduction | PR #433, head `c55f72429e6add41f5326e6eb203685cff537070`, introduction tree `1a240b2d0b717b37b0ee700b814acc7de5194d6d` |
| Contract-only OpenAPI SHA-256 | `2248ff67aa0f43cb98bdd492f63b36fce64c53def6a403a97a7987a128b2d2dc` |
| Integration gate OpenAPI SHA-256 | `d05beb48c234b924af086b886ce9bb524dc34407ad2e4a57f1e8af84255820f6` |
| FSM catalogue SHA-256 | `342e97cb37b199622d7bb436ca9164690d969b797058aaa539ff417cab01411c` |
| SDK compatibility manifest | `bootstrap-2`, SHA-256 `eec1750532d319ea06d8ae61bafa77316067088a84a9b70d20a1f6966dfba1e0` |
| Generated SDK catalogue SHA-256 | `3162d47c51ffad755f80086850bbcbb7ae4a846c4df47ffa57b0e44f9eced0b5` |
| Locked desk bindings SHA-256 | `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249` |

The locked desk table records `placeHold` as `NOT_BOUND` for `reserve_listing` and records why `confirmBooking` has no `capture` binding and the desk settlement has no `settle_capture` binding. The fixture commands use the separate FSM catalogue entries. M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The gate SHA, both OpenAPI pins, `PINNED_ACTIONS` and `protocolMergeSha` are those delivered by `c-int-pin-bundle`. The checkout's `.aiops/program.json` contains 60 nodes and omits this node. The supervisor supplied this node directly, as for `c-int-pin-bundle`. No program execution was used.

The byte ledger records SHA-256 and Git blob IDs for the catalogue, the complete `reference/booking_resale_admission/fixtures/` tree, the read-model vectors, and the existing SDK vectors. The runtime projection keeps selected commands, fixture arguments and verified outputs. The full fixture files stay outside the browser module graph. [Byte ledger](../packages/protocol-adapter/vendor/commerce-journey/provenance.json)

## Command boundaries

All names and body fields below are in the pinned `docs/contracts/openapi/fsm-command-contract.json` and dispatched by `integration_gate/fsm_host.py` with `sourceAuthentication: FIXTURE_ONLY`. Each body includes `idempotency_key`. The FSM bodies have no `domain` field. The request is `POST /x-kix-contract-only/local-call` with the SDK envelope `{operationId, actor, action, body}`. The actor is a fixture label. The desk attempts counter mints `jrn:fsm:<eventId>:<attempt>:<step>`, using up to 40 normalized event ID characters, and a distinct body key with prefix `key:`. The exchange sends one request with trace headers, no HTTP idempotency header and manual redirect handling.

| Command | Body fields in the fixture beyond the body key | Receipt accepted and next action |
| --- | --- | --- |
| `reservation_set_clock`, `resale_set_clock`, `admission_set_clock` | `subject_id, now_ms` | Exact fixture clock enables register or adopt for that machine. |
| `reservation_register_show` | `show_id, organizer_role, capacity, gate_roles, primary_price, resale_cap, resale_allowed, organizer_bps, platform_bps` | Show identity and fixture inputs checked. Hold copies the show identity. |
| `reservation_hold` | `reservation_id, show_id, slot, buyer_role, expires_ms` | `HELD`. Confirm copies the reservation ID. The fixture's attempts at unavailable or occupied slots return `SLOT` or `SLOT_OCCUPIED`. |
| `reservation_confirm` | `order_id, reservation_id, amount, quote_ref` | `CONFIRMED`. Observation copies the order ID and amount, or cancellation copies the reservation ID. |
| `reservation_cancel` | `reservation_id` | Before observation, `CANCELLED` with the slot freed. After observation, `COMPENSATION_UNDEFINED` with the existing observed fact retained. Issuance attempted on the cancelled branch returns `TERMINAL_IMMUTABLE`. |
| `reservation_observe_payment` | `order_id, payment_ref, amount` | `PAYMENT_NOTED` records only the fixture observation. Issue copies the order ID. |
| `reservation_issue` | `issuance_id, order_id` | `ISSUED` with settlement `UNBOUND`. Adoption copies the issued right ID and combines it with reservation, order, quote and observation receipts. |
| `resale_adopt_issued`, `admission_adopt_issued` | Show fields, `right_id, reservation_id, slot, buyer_role, expires_ms, order_id, amount, quote_ref, payment_ref` | Eligible version 1 right. The next step uses that right/version for listing or authorization. |
| `resale_list_resale` | `listing_id, right_id, version, seller_role, recipient_role, amount, expires_ms, reservation_id` | `LISTED`. Following steps copy the listing identity. |
| `resale_hold_buy` | `hold_id, listing_id, buyer_role` | `BUY_HELD`. The next step observes resale payment on the same listing. |
| `resale_observe_resale_payment` | `listing_id, payment_ref, amount, buyer_role` | `PAYMENT_NOTED`. Opens the distinct fixture settlement steps. |
| `settlement_initiate` | `settlement_id, trade_id, gross, debtor_role, policy` with `kind: PRIMARY_FEE_BPS, fee_bps, residual_payee, fee_payee` | `INITIATED`. Following steps copy this settlement ID. |
| `settlement_authorize`, `settlement_capture` | `settlement_id` | Separate `AUTHORIZED` and `CAPTURED` mock phases. The FSM host dispatches its local settlement method, distinct from the core catalogue's `capture`. |
| `resale_bind_settlement` | `listing_id, settlement_id` | `BOUND`. The optional early transfer is refused with `SETTLEMENT_NOT_COMMITTED`. Commit is the next allowed success step. |
| `settlement_commit` | `settlement_id, movement_id, gross, amount, fee, tax, held, adjustment` | `COMMITTED` fixture movement. The listing can then be transferred. |
| `resale_accept_resale` | `transfer_id, listing_id` | `TRANSFERRED` with `MOCK_COMMIT_OBSERVED` and version 2. Split values are verified only in the gate receipt. |
| `settlement_distribute` | `settlement_id, order` | The gate receipt records the fixture payee order and allocations. The stub records guarded mock distribution. Both carry `funds_executed: false`. |
| `admission_authorize_admission` | `admission_id, right_id, version, holder_role, gate_role, request, expires_ms` | `AUTHORIZED` records the fixture credential and its request. Consume copies gate role, request and version. |
| `admission_consume` | `consume_id, right_id, version, gate_role, request` | `CONSUMED_ONCE` with version 2. A fresh second-consumption attempt returns `ALREADY_CONSUMED`. |
| `settlement_cancel`, `settlement_fail` | `settlement_id, reason` | Independent `CANCELLED` and `FAILED` fixture cases. The refund fixture starts with its own settlement identity. |
| `settlement_bind_refund` | `settlement_id, refund_id, amount, beneficiary_role, reason` | `BOUND` after the mock settlement phase. Monetary claim fields are gate-only. |
| `settlement_observe_mock_cancel_acceptance` | `settlement_id, source_id, amount` | `MOCK_ACCEPTANCE_OBSERVED` after refund binding. The gate additionally records fixture reclassification, zero outstanding and false bank-debit and funds flags. |

A matched transport response must carry the original trace, the expected operation label and the expected identity. The validator checks each envelope and nested receipt key set, the fixture's flags and evidence fields, and the causal fields used for the next body. A validated `400` or `422` gate refusal shows its code. A requested fixture decline permits the published next step only on its declared refusal code. An unexpected receipt on a declared refusal leaves `UNKNOWN`. Contradictory receipt subjects also yield traced `INVALID_FSM_RECEIPT` and `UNKNOWN`. An unexpected rejection of the planned step closes that path. A duplicate, malformed or lost response is `UNKNOWN`, as is a timeout or interrupted exchange. The controller retains its last confirmed step and facts and fences later requests. Stage identifiers, observed payment references, issuance and admission proofs come from separate receipts.

Route re-entry on the same page load renders the retained controller. Before dispatch the FSM panel records the originating event, branch, step and operation ID, current build pin and last confirmed step and operation ID under `kix-journey-intent:fsm:<mode>`. Because branches and event routes share fixture subjects, an unresolved intent holds all FSM branches and events in that mode. Reload displays `UNKNOWN` and confirmation history only on the originating event. Current facts, receipt bodies and links live in memory. Re-entry, reads and reconnect leave the fence in place. Invalid or inaccessible history yields `SESSION_EVIDENCE_LOST`. Retention is `UNDETERMINED`, with no TTL. [Change requests](c-int-commerce-journey-change-requests.md)

Stub proofs come from the case stores' clock, reservation, issuance, listing/right, admission and settlement results. They include the stored quote, issued right/version and accepted admission request used as receipt links. Guarded fixture markers record distribution, refund binding and mock acceptance. Tests compare the independently observed phase and identity facts in each mode and verify the producer's monetary receipt fields on the reviewed Node gate.

The local gate checks use Node transport. The production stub browser exercises the user-facing controls under the existing same-origin CSP and loopback browser ledger. A reviewed cross-origin browser transport is outside this binding.

## Verification

Evidence below is for the worktree based on `1e7628c`, re-run and verified in this build pass. The supervisor owns submission and exact-head GitHub Actions evidence. The desk and live-gate jobs were re-run under Node 22.23.4 (selected from the local npm cache) and Python 3.12.15 to match `.github/workflows/ci.yml`; the live command used the read-only producer checkout as `KIX_PROTOCOL_ROOT` with `KIX_REQUIRE_GATE=1`.

| Command | Result |
| --- | --- |
| `npm ci` | Passed. npm reported install-script and dependency audit notices. |
| `npm run typecheck`, `npm run build` | Passed under Node 22.23.4 (and Node 24.22.1). |
| `KIX_REQUIRE_GATE=0 npm test` | Adapter 3,096 passed, 30 gate-only skipped by design (77 files passed, 6 skipped); web 1,721 passed (114 files); cold-start 6 passed (1 file). |
| `KIX_PROTOCOL_ROOT=/workspace/commerce-run/integration/kix-protocol-8ba7f6c KIX_REQUIRE_GATE=1 npm test -w @kix/protocol-adapter` | 3,126 passed across 83 files, zero skips, under Node 22.23.4 + Python 3.12.15. `commerce-journey-live.test.ts` 7 passed: three happy branches plus lost-response, invalid-receipt, timeout and duplicate-receipt fences, each after exactly one request. |
| `npm run budget` | Initial JS 160,173, initial CSS 4,997, largest lazy chunk 29,928, total 801,563 gzip bytes (Node 22). Within the unchanged 802,884 total and 30,000 route-chunk caps. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:e2e` | 269 passed (54 files) under Node 22, Chrome 156.0.8078.47. `booking.pinned-commerce-journey` and `booking.pinned-commerce-journey.refund` both pass: independent payment/issuance/admission facts, `COMPENSATION_UNDEFINED` and `ALREADY_CONSUMED` refusals, `NOT_BOUND` read, and separate cancellation/refund-binding/mock-acceptance. Ledger nonLoopback/nonGet/appNetworkCalls all 0. |
| `CI=1 KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:a11y -w @kix/e2e -- --fileParallelism --maxWorkers=3` | 449 passed across 24 files, Chrome 156. The new panel's active controls and read refusal are axe-clean at 320 px; `booking:missing` keeps its documented OPEN `heading-order` finding deterministically. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:budget` | 9 passed. Landing 357,856 gzip bytes. Ledger nonLoopback/nonGet/appNetworkCalls all 0. |
| `CI=1 KIX_E2E_CHROME=<Chrome-for-Testing 157> KIX_E2E_NO_SANDBOX=1 npm run test:visual` (private `dbus-run-session`) | 123 passed. All 108 screenshots MATCH with summed diffPixels 0 on Chrome 157.0.8103.50, profile `linux-d29b2e9b`. Ledger all 0; all claims false. |
| `npm run typecheck:e2e`, `npm run lint`, `npm run deps:check`, `npm run cycle-check` | Passed. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | All floors met. Adapter lines/functions/branches 91.82% / 98.02% / 86.09% (floors 91.1 / 97.4 / 84.5). Web 94.56% / 87.06% / 90.57%. |
| `npm run audit:warn` | Production-only audit reported zero vulnerabilities. |
| SHA-256 + Git blob + `cmp` against the producer; `git diff --check`; protected-path `git diff --exit-code 1e7628c` | 159 vendored files verified byte-for-byte against the ledger and the producer checkout. `commerce-bindings.ts` (SHA-256 `83816276…`), `.aiops/`, `docs/aiops/`, both OpenAPI pins, `sdk-pin.ts`, `ci.yml`, `bundle-budget.json` and `coverage-floors.json` all match the base; whitespace clean. |

### Deviations from the design plan

- **Panel mount location.** The plan mounted the panel unconditionally on `/booking/:eventId`. It is instead mounted inside the resolved-performance branch of `BookingEventPage`. Mounting it on the unknown-event view made the `booking:missing` accessibility scan non-deterministic: the lazy panel's trailing `<h2>` sometimes loaded before the axe scan and masked the documented OPEN `heading-order` finding. axe orders headings by DOM ancestry depth, so a trailing `<h2>` changes the level pairing rather than genuinely repairing the `H1 → H3` skip; marking that finding FIXED would record a false fix. Gating the panel to a resolved performance keeps the unknown-event view's structure unchanged, the finding honestly OPEN, and the scan deterministic. No `KNOWN_FINDINGS` entry changed.
- **Visual baselines unchanged.** The panel renders at y≈9668 on a 10024 px booking page, below the 2000 px capture clip, so all 108 committed Chrome 157 baselines stay byte-identical (measured directly against the stub build). No re-recording was needed.
- **Refund stop withdrawn.** Per design-review correction 1, `settlement_capture` is the FSM host's mock `AUTHORIZED → CAPTURED` op, not the core catalogue `capture`; the refund branch is driven from the vendored fixture's refund group with `funds_executed: false`. No `DECISION_REQUIRED.md` was written.
- **Execution authority.** Per correction 5, the 60-node `.aiops/program.json` omission of this hand-added node is recorded above and did not halt the build, following the merged `c-int-pin-bundle` precedent.
- **Local browser environment.** The host clock jumped forward by hours between serial runs, firing 120 s test timeouts on unrelated gallery/keyboard/notifications screens (the new panel check passed throughout). The accessibility suite was therefore run with `--fileParallelism --maxWorkers=3` — runtime flags only; the CI workflow, test timeouts and serial CI execution are unchanged. e2e/a11y/budget used local Chrome 156.0.8078.47; visual used Chrome for Testing 157.0.8103.50 from a durable local cache (`/home/box/.cache/kix-commerce-journey/`), matching the committed baseline profile.

Vite shares compression across related lazy screens, catalogue desks and mock operations to stay under the unchanged 802,884-byte cap; the new booking panel has its own dynamic-import chunk and its fixtures stay test-time-only, outside the browser module graph. The workflow and all thresholds retain the base values.
