# KIX Protocol 4472b0f and Commerce fixture conformance

kix-protocol SHA: 4472b0fb64d377d97fd2993673a4485459986606

The active Commerce SDK, OpenAPI and CI gate pins consume kix-protocol PR #483. The merge tree is `b2a13db82366784df1c01b8c80d12a094832db93` and the second parent is `f678040e9de475aaa42602b85c2adcb120cf83ef`. The previous OpenAPI bytes and the 84-command catalogue carry forward. `PINNED_ACTIONS` still comes from `COMMANDS`. The pin move and the fixture grant are distinct. `bootstrap-2` grants catalogue-schema binding only. [Producer PR #483](https://github.com/SUNBURN-Golden/kix-protocol/pull/483) · [Pin provenance](../packages/protocol-adapter/vendor/kix-sdk-0/producer-provenance.json)

The separate `SEMANTIC_CONFORMANCE` manifest `commerce-fixture-8ba7f6c-1` grants the table below. Its SHA-256 is `76ea72c6249ec0f90cb426dfbb8efda8308610f79c4f0ac6ff0a2445cab59a4f`. The evidence identifies Protocol `8ba7f6c36373ac0ec49246f51f7471c164ac3a28` and Commerce `9a55fe4e257376f9db3f877a11b65e3ecc43c661`. The audit 11 program ruling of 2026-11-20 holds fixture HTTP writes outside the merged evidence. Commerce now enforces that ruling at the adapter boundary. [Producer consumer note](../packages/protocol-adapter/vendor/commerce-journey/docs/status/COMMERCE_FIXTURE_TUPLE_CONFORMANCE_V1.md) · [Qualification table](../packages/protocol-adapter/vendor/commerce-journey/docs/status/COMMERCE_FIXTURE_TUPLE_CONFORMANCE_V1.json)

The receipt-driven fixture journey supplies a one-use context and last confirmed step for the exact call object. The Node adapter consumes that grant before fetch. It checks the active file pins, semantic manifest, method, path, action, machine, operation, subject field, canonical body schema and exact fixture body. The published transport carries distinct `operationId` and `body.idempotency_key` values on one attempt. The browser build resolves the runtime condition to a local refusal and eliminates the grant, qualification and dedicated HTTP receipt code. Stub remains the default.

## Qualified tuples

All 28 rows use `POST /x-kix-contract-only/local-call`, `SEMANTIC_CONFORMANCE` and `FIXTURE_ONLY`. The 62 unique context/step pairs allow 63 predecessor/step combinations because market cancellation has two qualified starting states. All tuple identities matched at 4472b0f.

| Action | Machine / operation | Subject field | Qualified context and step |
| --- | --- | --- | --- |
| `admission_adopt_issued` | `admission` / `adopt_issued` | `right_id` | `booking-admission` `adopt-B` |
| `admission_authorize_admission` | `admission` / `authorize_admission` | `admission_id` | `booking-admission` `authorize-B` |
| `admission_consume` | `admission` / `consume` | `consume_id` | `booking-admission` `consume-B`, `double-consume` |
| `admission_set_clock` | `admission` / `set_clock` | `subject_id` | `booking-admission` `admission-clock` |
| `resale_accept_resale` | `resale` / `accept_resale` | `transfer_id` | `booking-resale` `accept-A`, `accept-A-before-commit` · `resale-market` `market-accept` |
| `resale_adopt_issued` | `resale` / `adopt_issued` | `right_id` | `booking-resale` `adopt-A` · `resale-market` `market-adopt` |
| `resale_bind_settlement` | `resale` / `bind_settlement` | `listing_id` | `booking-resale` `bind-resale` |
| `resale_cancel_listing` | `resale` / `cancel_listing` | `listing_id` | `resale-market` `market-cancel` from `LISTED` or `BUY_HELD` |
| `resale_hold_buy` | `resale` / `hold_buy` | `hold_id` | `booking-resale` `hold-A` · `resale-market` `market-hold` |
| `resale_list_resale` | `resale` / `list_resale` | `listing_id` | `booking-resale` `list-A` · `resale-market` `market-list` |
| `resale_observe_resale_payment` | `resale` / `observe_resale_payment` | `listing_id` | `booking-resale` `resale-payment-A` · `resale-market` `market-pay` |
| `resale_set_clock` | `resale` / `set_clock` | `subject_id` | `booking-resale` `resale-clock` · `resale-market` `resale-clock` |
| `reservation_cancel` | `reservation` / `cancel` | `reservation_id` | `booking-resale` `cancel-after-payment` · `booking-admission` `cancel-after-payment` · `booking-refund` `cancel-C` |
| `reservation_confirm` | `reservation` / `confirm` | `order_id` | `booking-resale` `order-A` · `booking-admission` `order-B` · `booking-refund` `order-C` · `resale-market` `market-order` |
| `reservation_hold` | `reservation` / `hold` | `reservation_id` | `booking-resale` `hold-occupied-slot`, `hold-over-capacity`, `reserve-A` · `booking-admission` `reserve-B` · `booking-refund` `reserve-C` · `resale-market` `market-reserve` |
| `reservation_issue` | `reservation` / `issue` | `issuance_id` | `booking-resale` `issue-A` · `booking-admission` `issue-B` · `booking-refund` `issue-cancelled` · `resale-market` `market-issue` |
| `reservation_observe_payment` | `reservation` / `observe_payment` | `order_id` | `booking-resale` `payment-A` · `booking-admission` `payment-B` · `resale-market` `market-primary-payment` |
| `reservation_register_show` | `reservation` / `register_show` | `show_id` | `booking-resale` `register-show` · `booking-admission` `register-show` · `booking-refund` `register-show` · `resale-market` `market-show` |
| `reservation_set_clock` | `reservation` / `set_clock` | `subject_id` | `booking-resale` `reservation-clock` · `booking-admission` `reservation-clock` · `booking-refund` `reservation-clock` · `resale-market` `reservation-clock` |
| `settlement_authorize` | `settlement` / `authorize` | `settlement_id` | `booking-resale` `settle-resale-authorize` · `booking-refund` `settle-refund-authorize` |
| `settlement_bind_refund` | `settlement` / `bind_refund` | `settlement_id` | `booking-refund` `bind-refund` |
| `settlement_cancel` | `settlement` / `cancel` | `settlement_id` | `booking-refund` `settle-cancel` |
| `settlement_capture` | `settlement` / `capture` | `settlement_id` | `booking-resale` `settle-resale-capture` · `booking-refund` `settle-refund-capture` |
| `settlement_commit` | `settlement` / `commit` | `settlement_id` | `booking-resale` `settle-resale-commit` |
| `settlement_distribute` | `settlement` / `distribute` | `settlement_id` | `booking-resale` `distribute-resale` |
| `settlement_fail` | `settlement` / `fail` | `settlement_id` | `booking-refund` `settle-fail` |
| `settlement_initiate` | `settlement` / `initiate` | `settlement_id` | `booking-resale` `settle-resale-initiate` · `booking-refund` `settle-cancel-initiate`, `settle-fail-initiate`, `settle-refund-initiate` |
| `settlement_observe_mock_cancel_acceptance` | `settlement` / `observe_mock_cancel_acceptance` | `settlement_id` | `booking-refund` `observe-mock-acceptance` |

## Still held

- Every expanded write outside the table, including direct calls without a grant, mismatched contexts, altered bodies and market cancellation after payment. The adapter returns `NOT_BOUND` before fetch. Generic `invokeLocalCall` stays Core-only.
- Producer-only controls, including `replay-consume-B`, remain offline. Unresolved `UNKNOWN` fences subsequent writes and permits zero retries.
- Market, settlement and operation-recovery reads remain `NOT_BOUND`. Browser fixture HTTP writes remain unavailable.
- `placeHold` records `reserve_listing` as considered. `confirmBooking` sends no Core `capture`, and settlement sends no Core `settle_capture`. `commerce-bindings.ts` matches main at SHA-256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`.
- Product policy, production, user acceptance and release retain their existing owners and scope.

## Vendored file digests

Producer paths beginning with `sdk/` map to `packages/protocol-adapter/vendor/kix-sdk-0/`. The two OpenAPI files live at the vendor root. The remaining vendored paths retain their producer-relative names under `vendor/commerce-journey/`. `PIN_FACTS` identifies the digests supplied by KIX Commerce. Pinned Git identifies additional files checked byte for byte at the merge. The full 181-entry fixture inventory records each file’s SHA-256 and Git blob, including the original 159 entries. [Fixture inventory](../packages/protocol-adapter/vendor/commerce-journey/provenance.json)

| Producer path | SHA-256 | Source |
| --- | --- | --- |
| `docs/contracts/openapi/fsm-command-contract.json` | `342e97cb37b199622d7bb436ca9164690d969b797058aaa539ff417cab01411c` | PIN_FACTS |
| `docs/contracts/openapi/kix-protocol.contract-only.openapi.json` | `2248ff67aa0f43cb98bdd492f63b36fce64c53def6a403a97a7987a128b2d2dc` | PIN_FACTS |
| `docs/contracts/openapi/kix-protocol.integration-gate.openapi.json` | `d05beb48c234b924af086b886ce9bb524dc34407ad2e4a57f1e8af84255820f6` | PIN_FACTS |
| `docs/status/COMMERCE_FIXTURE_TUPLE_CONFORMANCE_V1.json` | `daf936e65421d8f35fec42afff622eeb2dfcc246f474ffd36059aa2f7b128678` | PIN_FACTS |
| `docs/status/COMMERCE_FIXTURE_TUPLE_CONFORMANCE_V1.md` | `1443f3b38e1f91202afc79ef5ca96244b3714b889c12bf4fa8e6c1687f337769` | PIN_FACTS |
| `reference/booking_resale_admission/fixtures/commerce_journey_conformance_v1.json` | `f9555d84790b91eafe74c71453a2dbd301fae43566a5f0a3a47e19059151e9cc` | Pinned Git |
| `reference/booking_resale_admission/fixtures/commerce_journey_receipts_v1.json` | `6819d46a7b86e1a16bae83be90666560bb45aa66d3d6f0d5e050e03e7a952998` | Pinned Git |
| `reference/v0.3-rc1/protocol_contract.json` | `ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e` | PIN_FACTS (upstream source pin) |
| `sdk/compat/manifests/manifest.bootstrap-1.json` | `1cce4ee5a9aa64ef40825c0e6dedf920050e594cf20ea0aaf087ecbde46f0cca` | PIN_FACTS |
| `sdk/compat/manifests/manifest.bootstrap-1.json.sha256` | `fd568b8117a010d1e259323af6f788efe97d497ec8e15406d99d53cddc389d89` | PIN_FACTS |
| `sdk/compat/manifests/manifest.bootstrap-2.json` | `eec1750532d319ea06d8ae61bafa77316067088a84a9b70d20a1f6966dfba1e0` | PIN_FACTS |
| `sdk/compat/manifests/manifest.bootstrap-2.json.sha256` | `bb4903cb817829f9513b47fc1f60498744ed93355ae8b61511a15a31aa99c8c3` | PIN_FACTS |
| `sdk/compat/manifests/manifest.commerce-fixture-8ba7f6c-1.json` | `76ea72c6249ec0f90cb426dfbb8efda8308610f79c4f0ac6ff0a2445cab59a4f` | PIN_FACTS |
| `sdk/compat/manifests/manifest.commerce-fixture-8ba7f6c-1.json.sha256` | `977e754047c454912defcc84b3343b2812320c7a49a1bd00ce60486fb3906f91` | PIN_FACTS |
| `sdk/compat/profiles/bootstrap-1.profile.json` | `4c92cf6d905f83fb3f5cd52e166dbadf057451ae46441fce1f91baaaa4367d34` | PIN_FACTS |
| `sdk/compat/profiles/bootstrap-2.profile.json` | `c356b923997cefc132e63e73a179d5922dd7cb2124b9e9b399c662cd49803b73` | PIN_FACTS |
| `sdk/compat/profiles/commerce-fixture-8ba7f6c-1.profile.json` | `240bc0b2f200ca3256b8fdb6a3eab0c2fa1f4e1b6e51cc9a4e663e155750ef0d` | PIN_FACTS |
| `sdk/compat/verify_compat.mjs` | `8628518c41b4110f0adf9a5d841240ae06dc6c1fa5d5c4974f00d96a718c5de6` | PIN_FACTS |
| `sdk/conformance/vectors/canonical-encoding.vectors.json` | `3446c13847bb153df06c1d5d3b7f09cd3b1648ac10bb0cc76d7b65c7014e99c2` | PIN_FACTS |
| `sdk/conformance/vectors/commerce-fixture-tuple.vectors.json` | `c9fbeee6a04da371dd054a325c9435a401b9694a1619ac9939de38f257495e22` | PIN_FACTS |
| `sdk/conformance/vectors/manifest-verifier-negative.vectors.json` | `c5157d96aea3219ec15f443272ded849298b39aff915dc0d96eda51f03deed4f` | PIN_FACTS |
| `sdk/conformance/vectors/mixed-input.vectors.json` | `9e2441ddefc22a2f8c7be230436620908b735b128b9445b7a5a916e4d86a2e19` | PIN_FACTS |
| `sdk/generate/generate_client.mjs` | `66f0e2010c6511d322f8dfc7e8932d27d25e154ac0b3d6083f19f97af6124bb7` | Pinned Git |
| `sdk/generate/generate_manifest.mjs` | `c087b30ee22f05f6aa905fca3fcaa6cee924d780ebfc9b7eb394d8be03288769` | Pinned Git |
| `sdk/generated/catalogue.ts` | `3162d47c51ffad755f80086850bbcbb7ae4a846c4df47ffa57b0e44f9eced0b5` | Pinned Git |
| `sdk/sdk-pin.json` | `cc68ea950560506a9e8a632ac5b9e634e037d5eaad6b12885d65ea99f9ca160a` | PIN_FACTS |
| `sdk/src/client.ts` | `0f3650dc84bd34c74bb9a48fe9e6523c0b51665bdbcbd1313e7f94b5a3a4715e` | Pinned Git |
| `sdk/src/jsonschema.ts` | `bfb69963dd275f80f870125fb312a0214dd473bb6df5b67543b0d7f0267f6afd` | Pinned Git |
| `sdk/src/manifest.ts` | `18dc1693e58ad98766495faebe4d2e1ca5e23df92b9864b64ef497336ce1f557` | Pinned Git |
| `toolchains.json` | `f4a37d32d50340db6caf8a1f914b1cceb344d410d6c7a5a6299552bd9764e3b5` | Pinned Git |

Consumer declarations and provenance are derived files.

| Consumer path under `vendor/kix-sdk-0/` | SHA-256 |
| --- | --- |
| `types/catalogue.d.ts` | `1c39cb9660dc9d83c54f63d75a4137ac4099e9668931460b605b015f8cbb26d4` |
| `types/client.d.ts` | `c50c3449bb8d2f8af623f5503b8856e0161cdf1a1684258e55215d4fb242c5bf` |
| `types/jsonschema.d.ts` | `a75cf41ea1189e5265cea96b09bba09018be9a7542e0fbb1173a56a5f7495ea9` |
| `producer-provenance.json` | `1dd0ff098fcc1002f185fe3d22776bf956516147ce6309b0e4d58fe44d454fe5` |

The prior build verified PR #483 metadata with read-only GitHub API calls for the pull request and its feature-head check runs. The PR merge timestamp is `2026-11-20T04:25:13Z`, merged by `BeautifulMind-JT`. The eight feature-head checks concluded `success`. The pinned Git object independently confirms the merge, tree and feature head. The SDK introduction record still identifies PR #433.

## Local and hosted checks

The Node 24 verifier produced `ok: true` in both the vendored staging layout and pinned checkout, with the published manifest digest and exact kind and revision. The supplied `kix-protocol-4472b0f.PIN_FACTS.json` also records a producer verifier PASS on the box. CI uses Node 22, where the spec test verifies manifest and file bytes and records a skip for the producer CLI’s Node 24 requirement. The live job checks the vendored bytes against the checked-out producer.

The local worktree is based on Commerce main `6a3ce09e06a3f9820c24ff824f63b5c7ad876a47`. Commerce checks used Node 22.23.5 and npm 11.21.1. Gate tests used Python 3.12.15 with `KIX_PROTOCOL_ROOT=/workspace/commerce-run/integration/kix-protocol-4472b0f`. The producer verifier and SDK offline checks used Node 24.22.1. Browser checks used the committed render profile with Chrome for Testing 157.0.8103.50, `KIX_E2E_NO_SANDBOX=1` and a local D-Bus session.

| Command | Result |
| --- | --- |
| `GIT_OPTIONAL_LOCKS=0 python3 /tmp/kix-4472b0f-audit-pins.py` | Passed. The original 159 and current 181 ledger entries, all 21 PIN_FACTS digests, 21 SDK files, 37 producer evidence pins and nine historical Commerce Git objects matched. The source contract was verified upstream. Locked bindings matched `origin/main`. |
| Producer declaration emit with `tsc --noCheck --declaration --emitDeclarationOnly` into a temporary directory, then `tsc --noEmit --strict` against the consumer declarations | Passed. The existing declaration surfaces accept the pinned producer exports, including the exact command tuple. A direct strict check of the producer source hit its existing readonly-array narrowing error, so comparison used emitted declarations. |
| `KIX_PROTOCOL_ROOT=… KIX_REQUIRE_GATE=1 npm test -w @kix/protocol-adapter -- commerce-fixture-qualification verify-fixture-compat openapi-pin sdk-pin gate-requirement commerce-journey.test resale-journey.test` | 150 passed on Node 24. |
| `KIX_PROTOCOL_ROOT=… KIX_REQUIRE_GATE=1 npm test -w @kix/protocol-adapter -- verify-fixture-compat commerce-fixture-qualification` | 72 passed on Node 24. The test invokes the unchanged verifier command in the pinned checkout and a staging tree assembled from the vendors. |
| `node sdk/compat/verify_compat.mjs --manifest sdk/compat/manifests/manifest.commerce-fixture-8ba7f6c-1.json --expect-kind SEMANTIC_CONFORMANCE --expect-revision commerce-fixture-8ba7f6c-1` | Passed in the pinned checkout and in staged vendored layout. Both returned the published digest. |
| `python3.12 -B -m unittest discover -s reference/booking_resale_admission -p test_commerce_fixture_tuple_conformance.py` and `npm --prefix sdk run conformance` in the pinned checkout | 4 producer replay tests and 12 producer SDK tests passed. |
| `KIX_PROTOCOL_ROOT=… KIX_REQUIRE_GATE=1 npm test -w @kix/protocol-adapter -- commerce-journey-live resale-journey-live` | 69 passed against 4472b0f. Covered qualified dispatch, pre-fetch holds and UNKNOWN fencing. |
| `npm ci` | Passed. Installed 535 packages. |
| `npm run typecheck` and `npm run build` | Passed. Corrected a TypeScript error in the updated market test helper and reran. |
| `npm run budget` and `rg` inspection of `apps/web/dist/assets` | Passed. Total gzip was 799,362 of 802,884 bytes. The browser artifacts contain no qualification, semantic manifest, vectors or dedicated HTTP receipt chunk. |
| `npm exec -w @kix/web -- vitest run test/local-evidence-matrix.test.ts` | 22 passed after updating the ledger count and gate-aware test inventory. |
| `KIX_REQUIRE_GATE=0 npm test` | 3,212 adapter, 1,745 web and six entry tests passed. The adapter skipped 95 gate-dependent or Node-24-only tests. Earlier runs identified stale current-pin documentation, ledger expectations and the verifier test inventory, which were corrected. |
| `KIX_PROTOCOL_ROOT=… KIX_REQUIRE_GATE=1 npm test -w @kix/protocol-adapter` | 3,305 passed against the exact 4472b0f checkout. The only two skips were the Node 24 verifier calls, which passed separately. |
| `npm run lint`, `npm run cycle-check`, `npm run deps:check`, `npm run audit:warn`, `npm run typecheck:e2e` | Passed. The production audit reported zero vulnerabilities. |
| `node --input-type=module < /tmp/kix-4472b0f-launch-gap.mjs` | Documented route and link checker passed. It checked 40 canonical routes and 166 relative links and fragments. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | Passed all eight coverage floors. |
| `dbus-run-session -- npm run test:visual` | The first run found four stale pin screenshots. Reviewed and refreshed the two Diagnostics and two Journey Context images. The comparison rerun passed all 123 tests with zero differing pixels across all 108 screenshots. |
| `dbus-run-session -- npm run test:e2e` | All 274 tests passed. The browser record reported zero application requests, off-loopback requests and non-GET requests. |
| `dbus-run-session -- npm run test:a11y` | All 451 tests passed on the loopback stub browser. |
| `dbus-run-session -- npm run test:budget` | All nine browser budget tests passed. The request ledger recorded zero application requests, off-loopback requests and non-GET requests. |
| `git diff --check` and `git diff --exit-code origin/main -- <protected paths and thresholds>` | Passed. The locked binding, program files, bundle cap, coverage floors and lockfile match main. |

## Delivery

The owner’s 16:25 KST decision is implemented through browser and Node package import conditions. The first build after isolation measured 799,346 total gzip bytes. The final build also passed the existing 802,884-byte cap. The manifest hash test is visible to Vitest on Node 22. Its two producer CLI checks run on Node 24 because the pinned toolchain requires that major.

The pin changes and semantic grant are separate review units in the uncommitted worktree. The sole workflow edit is `KIX_PROTOCOL_GATE_SHA`. The supervisor owns the GitHub PR and exact-head evidence. The required hosted checks are **Typecheck, build, and test (stub)** and **Adapter tests against the reviewed gate**. The hosted gate run must report success and its checkout log must identify protocol merge `4472b0fb64d377d97fd2993673a4485459986606`. Both hosted results are pending.
