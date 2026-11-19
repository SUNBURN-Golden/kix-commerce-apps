# Resale market journey binding

The market entry links to the ticket fixture on `/resale/market/demo-001`, including when product search has no result or the gate refuses the catalogue read. The product page offers a separate review and confirmation for each fixture command. The synthetic catalogue, variants, quotes and bid/ask simulations retain their original controls. Their product IDs and mock-unit strings never enter a protocol body. The integration-HTTP browser shows the read refusal and an unavailable fixture action under the existing browser policy. Node exercises the same adapter against the reviewed loopback gate.

## Source

| Item | Reviewed value |
| --- | --- |
| Commerce worktree base | `62d63cbaabeed34ca63e850776786a1be79fd6dd` |
| Pinned producer | SUNBURN-Golden/kix-protocol #448, merge `8ba7f6c36373ac0ec49246f51f7471c164ac3a28`, tree `d3f5412ef84f64fe83c5d3a3d3ada173921bfbf9`, PR head `648859b1c9cda424f1a4615ac5155edf46fd0524` |
| Catalogue introduction | #433, head `c55f72429e6add41f5326e6eb203685cff537070`. The introduction tree is `1a240b2d0b717b37b0ee700b814acc7de5194d6d`. |
| Contract OpenAPI SHA-256 | `2248ff67aa0f43cb98bdd492f63b36fce64c53def6a403a97a7987a128b2d2dc` |
| Integration OpenAPI SHA-256 | `d05beb48c234b924af086b886ce9bb524dc34407ad2e4a57f1e8af84255820f6` |
| FSM catalogue SHA-256 | `342e97cb37b199622d7bb436ca9164690d969b797058aaa539ff417cab01411c` |
| Desk bindings SHA-256 | `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249` |

The checked-out manifest has 60 nodes and omits this hand-added node. The supervisor supplied this binding directly, following #145. The build consumed the existing pins and vendored fixture ledger. It required no program execution, producer edit or pin update. [Pin evidence](c-int-pin-bundle-apps-bind.md) · [Journey plumbing](c-int-commerce-journey-apps-bind.md)

## From fixture input to receipt

The shared SDK sends one `POST /x-kix-contract-only/local-call` to the selected explicit loopback origin. Each envelope contains `operationId, actor, action, body`. Each body includes its own `idempotency_key`, distinct from the operation ID. The adapter uses manual redirects, trace echoes, strict receipt shapes and false-claim guards. The locked desk decisions for `placeHold`, `confirmBooking` and settlement retain their recorded reasons.

The first eight setup entries in `resale_session.json` supply the two clocks, show, primary purchase, issued right and adoption. The implementation selects them in the producer's order. It expands the recorded offer into listing fields and uses the subsequent request fixture for purchase. Cancellation uses the producer's console cancel fixture. The four settlement setup entries, repeated transfer and close are outside this journey. Local reads of the producer's catalogue and `integration_gate/fsm_host.py` verified the actions and subject fields before use. [Vendored inputs](../packages/protocol-adapter/vendor/commerce-journey/reference/booking_resale_admission/fixtures/resale_session.json) · [Command catalogue](../packages/protocol-adapter/vendor/commerce-journey/docs/contracts/openapi/fsm-command-contract.json)

| Order / command | Body fields beyond the body key | Required receipt and next action |
| --- | --- | --- |
| 1. `reservation_set_clock` | subject_id, now_ms | Fixture time 1000000. Register the show. |
| 2. `reservation_register_show` | show_id, organizer_role, capacity, gate_roles, primary_price, resale_cap, resale_allowed, organizer_bps, platform_bps | Confirm show-1. Set the resale clock. |
| 3. `resale_set_clock` | subject_id, now_ms | Same logical time. Hold seat 0 on the confirmed show. |
| 4. `reservation_hold` | reservation_id, show_id, slot, buyer_role, expires_ms | HELD for reserve-1. Confirm the order using this reservation. |
| 5. `reservation_confirm` | order_id, reservation_id, amount, quote_ref | CONFIRMED for order-1. Carry its amount and order into the primary observation. |
| 6. `reservation_observe_payment` | order_id, payment_ref, amount | Primary PAYMENT_NOTED. Issue the right. All resale facts still lack evidence. |
| 7. `reservation_issue` | issuance_id, order_id | ISSUED. Carry the right ID and holder into adoption. |
| 8. `resale_adopt_issued` | right_id, show_id, organizer_role, capacity, gate_roles, primary_price, resale_cap, resale_allowed, organizer_bps, platform_bps, slot, buyer_role, expires_ms, order_id, amount, payment_ref, reservation_id, quote_ref | Issued issue-1, eligible, buyer-1, version 1. List the confirmed right for its holder. |
| 9. `resale_list_resale` | listing_id, right_id, version, seller_role, recipient_role, amount, expires_ms, reservation_id | LISTED, list-1, buyer-2, 8000 fixture units. Hold or cancel. |
| 10. `resale_hold_buy` | hold_id, listing_id, buyer_role | BUY_HELD with buy-hold on list-1. Observe resale payment or cancel. |
| 11. `resale_observe_resale_payment` | listing_id, payment_ref, amount, buyer_role | PAYMENT_NOTED for the confirmed amount, buyer and resale payment reference. Accept transfer. |
| 12. `resale_accept_resale` | transfer_id, listing_id | TRANSFERRED, transfer-1, buyer-2, version 2. Null settlement ID, UNBOUND settlement gate and false mock commit observation. |
| Alternative `resale_cancel_listing` | listing_id, seller_role | CANCELLED and detached before payment observation. Retain the listed fact and close the path. |

The shared tests compare the ordered dispatch sequence including setup. They exercise the actual refusal paths in the stub store and producer FSM, including adoption payment mismatch, stale listing version, acceptance before payment, wrong seller, wrong recipient, competing hold, held buyer mismatch, wrong payment amount, repeat payment, late cancellation, terminal mutation and expiry at exactly the deadline. The previous confirmed facts survive each refusal.

## Facts, display and recovery

Listed, resale payment observed and accepted/transferred are recorded independently from the corresponding validated receipts. Primary payment and a buyer hold leave the resale payment cell at `NO_EVIDENCE`. The active listing's settled cell stays `NO_EVIDENCE`, including after transfer. The settlement display renders two separately identified examples, without transport.

- The organizer's `get_settlement("settle-1")` vector reports `COMMITTED`, `MOCK_SETTLEMENT_ONLY`, `funds_executed: false` and refund bearer policy `NONE`. [Settlement vector](../packages/protocol-adapter/vendor/commerce-journey/reference/read_model/vectors/settlement.json)
- The independent partial refund on `claim-2` records 4000 synthetic units and `refund_bearer_policy: REQUESTER`. The label is “Partial refund · requester-borne (B5)” / “부분 환불 · 요청자 부담 (B5)”. [Pinned producer example](https://github.com/SUNBURN-Golden/kix-protocol/blob/8ba7f6c36373ac0ec49246f51f7471c164ac3a28/reference/booking_resale_admission/README.md#L2896-L2914)

A pending attempt blocks a second click. Before dispatch the browser records the operation ID, step, last confirmed step and the two prior listing/payment markers under a mode-specific tab key. Losing storage access before dispatch holds the write. A validated refusal displays its gate code. Timeout, lost reply, duplicate, mismatched trace and invalid evidence leave the operation UNKNOWN. Departure while pending closes the originating panel's receipt channel. The other product receives no receipt. Reload with an unresolved intent displays the last confirmed history, uncertain operation and blocked action. Re-entry, reconnect, display and reads never replay the write. A known response clears the intent. Successful page-load receipts remain in memory only. [Missing recovery and market reads](kix-resale-journey-binding-change-requests.md)

## Local verification

The builder ran these checks on the uncommitted changes over the Commerce base above. The environment used Node 22.23.4, Python 3.12.15 and npm 11.21.1. `$KIX_PROTOCOL_ROOT` pointed to the clean read-only checkout at `/workspace/commerce-run/integration/kix-protocol-8ba7f6c`. Browser checks used `dbus-run-session`, `KIX_E2E_NO_SANDBOX=1` and loopback-only test servers. The standard Chrome executable was `/usr/bin/google-chrome`. The visual comparison used Chrome for Testing 157.0.8103.50 to match the recorded Linux profile.

| Command or check run | Local evidence |
| --- | --- |
| `npm ci` | Exit 0. Installed 535 packages. The installation audit reported 14 findings including development dependencies. |
| `KIX_REQUIRE_GATE=1 npm test -w @kix/protocol-adapter -- resale-journey commerce-journey` | 48 tests passed. Includes the existing settlement-bound branch and the market's unbound branch. |
| From `apps/web`, `../../node_modules/.bin/vitest run test/local-evidence-matrix.test.ts test/resale-market.test.tsx test/resale-market-return-focus.test.tsx test/market-read-state.test.tsx` | 98 tests passed, including both languages, read refusals, return focus, and departure during acceptance. |
| `npm run typecheck`, `npm run typecheck:e2e`, `npm run build` | Each exited 0. |
| `KIX_REQUIRE_GATE=0 npm test` | 3,112 adapter tests, 1,726 web tests and 6 entry-integrity tests passed. The stub environment intentionally skipped 50 gate-only tests. |
| `KIX_REQUIRE_GATE=1 npm test -w @kix/protocol-adapter` | 85 files, 3,162 tests passed, zero skipped. The adapter used the producer's Python gate and fresh loopback listeners. |
| `CI=1 npm run test:e2e` | 54 files, 272 tests passed. This includes all 31 market browser tests and the booking return-to-event check. The browser ledger recorded zero application, off-loopback and non-GET requests. |
| `CI=1 npm run test:a11y -w @kix/e2e -- --fileParallelism --maxWorkers=2` | 24 files, 451 tests passed under the existing accessibility baseline, including the narrow English and Korean fixture reviews. All 89 keyboard outcome cells ran. |
| `npm run budget` | Passed. Initial JS 160,309 bytes gzip, initial CSS 4,997, largest route chunk 29,928, total 802,677 against the 802,884-byte cap. |
| `CI=1 npm run test:budget` | All 9 checks passed. The box office requested 30 scripts totaling 358,405 gzip bytes against the 400,000-byte cap. The browser ledger recorded zero application, off-loopback and non-GET requests. |
| Integration-HTTP Vite build with `VITE_KIX_PROTOCOL_MODE=integration-http` and `VITE_KIX_PROTOCOL_API_BASE=http://127.0.0.1:49153`, then a local Playwright smoke check | Chrome followed the fixture link on the refused list, showed the detail and settlement read reasons, and disabled the first write. Zero application requests. |
| `KIX_VISUAL_UPDATE=1 npm run test:visual`, then `CI=1 npm run test:visual` in comparison mode | 123 tests passed on each run. The comparison covered all 108 screenshots. The 14 refreshed baselines show the affected market and product screens. |
| `npm run lint`, `npm run deps:check`, `npm run cycle-check`, `npm run audit:warn` | Each exited 0. Production-only npm audit reported zero findings. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | Passed all eight existing floors. Adapter line and branch coverage were 91.83% and 86.12%. Web line and branch coverage were 94.58% and 90.92%. |
| `git diff --check`, protected-path `git diff --exit-code`, `sha256sum packages/protocol-adapter/src/commerce-bindings.ts`, and Python byte/hash comparison against the producer | Both diffs passed. The locked binding matched the digest in the source table. Both OpenAPI files matched producer bytes. All 159 files in the journey ledger matched producer bytes, SHA-256 and Git blob IDs. |

### Files changed

| Directory | Files |
| --- | --- |
| Repository root | `README.md` |
| `packages/protocol-adapter/src` | `resale-journey.ts`, `resale-journey-fixture.ts`, `resale-market-reads.ts`, `resale-market.ts`, `resale-case.ts`, `types.ts`, `commerce-journey.ts`, `commerce-journey-command.ts`, `commerce-journey-fixture.ts`, `commerce-journey-receipts.ts`, `commerce-journey-stub.ts` |
| `packages/protocol-adapter/test` | `resale-journey.test.ts`, `resale-journey-live.test.ts`, `support/resale-journey.ts` |
| `apps/web` | `src/pages/ResaleJourneyPanel.tsx`, `src/pages/ResaleMarketPages.tsx`, `src/pages/ResaleMarketPanels.tsx`, `src/resale-journey-session.ts`, `src/storage-allow-list.ts`, `src/i18n/messages/pages--Resale.ts`, `vite.config.ts` |
| `apps/web/test` | `resale-market.test.tsx`, `market-read-state.test.tsx`, `resale-market-return-focus.test.tsx` |
| `apps/e2e` | `shell-fixtures/protocol-fault.ts`, `shell-fixtures/resale-market.ts`, `src/resale-fault-types.ts`, `tests/journeys/resale-market.e2e.test.ts`, `tests/journeys/booking-context-fence.e2e.test.ts`, `tests/a11y/resale-market.a11y.test.ts` |
| `apps/e2e/visual-baselines/linux-d29b2e9b` | `manifest.json`, 4 `resale-market.*.png` files and 10 `resale-product.*.png` files |
| `docs` | This binding, `kix-resale-journey-binding-change-requests.md` and `c-local-evidence-matrix-stub-apps-bind.md` |

### Delivery evidence

The supervisor owns the commit and GitHub delivery. The hosted checks **Typecheck, build, and test (stub)** and **Adapter tests against the reviewed gate** require `SUCCESS` on that commit. Their check-run IDs and results are pending publication. The [NOT_BOUND list](kix-resale-journey-binding-change-requests.md#not_bound-list) is ready to include in the supervisor's PR body.

### Design adjustments

The producer checkout and both vendored OpenAPI files identify #448 as the pinned merge. #433 introduced the FSM catalogue. The market uses the router's existing history state to open the fixture because the read-state normalization removes fragments. The fixture remains an explicit choice on the synthetic product page. Grouping shared fixture code and related lazy desk modules kept the bundle inside the existing size limits. The local evidence matrix now names the additional live suite and counts ten gate-dependent files.

Initial checks caught a translation-key collision, strict TypeScript errors, untranslated display literals and an outdated gate-suite inventory. The first browser pass exposed the discarded fixture-link fragment. A static size pass also hid a 464,622-byte box-office load. Reading the browser's script requests identified a booking module that pulled secondary catalogue desks onto the landing route. Grouping it with the booking/refund controls brought both bundle measurements within budget. Earlier full browser runs timed out on finance, gallery and keyboard tests. The reruns used the repository's time limits. A separate booking browser check matched both the page title and the confirmed ticket title on return. Its selector now identifies the level-two page title explicitly.
