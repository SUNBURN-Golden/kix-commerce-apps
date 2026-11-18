# c-int-pin-bundle app binding and evidence

**kix-protocol SHA: 8ba7f6c36373ac0ec49246f51f7471c164ac3a28** (`SUNBURN-Golden/kix-protocol`)

The contract-only OpenAPI pin, integration-gate merge pin, SDK consumption pin, active fixture and discovery tuples, and CI `KIX_PROTOCOL_GATE_SHA` identify this checkout. The catalogue carries 84 commands, including 40 core commands and 44 FSM commands. Bootstrap-2 binds the new catalogue and its two consumption vectors. Bootstrap-1 is retained for history. The historical fixture v1 tuple retains key `74e2d30c3fd115eb74cb9309dafda79c72d92cc7df75a9fc0947a71216dda1aa`. Fixture v2 keeps its independent 84-action literal. The SDK consumption tuple continues to derive its three digests from the verified pin and manifest.

## Producer provenance

| Evidence | Consumed checkout | SDK and catalogue introduction |
| --- | --- | --- |
| Producer PR | #448 | #433 |
| Merge | `8ba7f6c36373ac0ec49246f51f7471c164ac3a28` | `19cdc1c6393e88528d3918e0f4f1f37645a34042` |
| Head | `648859b1c9cda424f1a4615ac5155edf46fd0524` | `c55f72429e6add41f5326e6eb203685cff537070` |
| Merge tree | `d3f5412ef84f64fe83c5d3a3d3ada173921bfbf9` | `1a240b2d0b717b37b0ee700b814acc7de5194d6d` |
| Merged UTC | `2026-11-12T23:23:08Z` | `2026-11-10T07:39:21Z` |
| Merged by | `BeautifulMind-JT` | `BeautifulMind-JT` |
| Facts file | `kix-protocol-8ba7f6c.PIN_FACTS.json` | `kix-protocol-19cdc1c.PIN_FACTS.json` |

`producer-provenance.json` binds those merges and their check runs separately. All eight #448 checks have a `success` conclusion in the target facts. The #433 facts supply check IDs and names. The introduction record carries those facts and the #433 head.

| Check | #448 check run | #433 check run |
| --- | --- | --- |
| CodeQL | 131558666657 | 129692154327 |
| kernel | 131558430409 | 129691939734 |
| protocol | 131558430672 | 129691935834 |
| rights-scale | 131558431475 | 129691935413 |
| Analyze (actions) | 131558417778 | 129691931165 |
| Analyze (javascript-typescript) | 131558418259 | 129691931194 |
| Analyze (python) | 131558417997 | 129691930750 |
| Analyze (rust) | 131558418236 | 129691931315 |

The SDK manifest's source commit `c2cde86e21a6e5ba6f24a56548636db6d0a34c6f` and source tree `394084b15e01bbe4a5612aeb3431f3278c43dd85` identify the producer's generation inputs. The core source SHA256 is `ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e`. The FSM source is referenced by `docs/contracts/openapi/fsm-command-contract.json`, SHA256 `342e97cb37b199622d7bb436ca9164690d969b797058aaa539ff417cab01411c`, blob `3771a8739b906a478b54c597df37e27d1afc5f21`. It stays in the producer checkout.

CI checks out the #448 merge. Local Git verifies its feature head has the same tree. The gate harness verifies both OpenAPI digests, the checkout identity, the feature tree when applicable, and a clean producer checkout.

## Vendored file ledger

Vendor paths are relative to `packages/protocol-adapter/vendor/`. All 23 producer facts were checked against the clean target checkout. The 19 files below were compared byte-for-byte to that checkout. Four copied files are verified against the pinned Git tree directly because the facts file omits them. The remaining eight facts entries describe producer sources and read-model vectors.

| Vendor path | Producer path | SHA256 | Git blob | Evidence |
| --- | --- | --- | --- | --- |
| `kix-protocol.contract-only.openapi.json` | `docs/contracts/openapi/kix-protocol.contract-only.openapi.json` | `2248ff67aa0f43cb98bdd492f63b36fce64c53def6a403a97a7987a128b2d2dc` | `ed23b98fde4ce02607ffda2ba9488ed510645de2` | PIN_FACTS |
| `kix-protocol.integration-gate.openapi.json` | `docs/contracts/openapi/kix-protocol.integration-gate.openapi.json` | `d05beb48c234b924af086b886ce9bb524dc34407ad2e4a57f1e8af84255820f6` | `8d95bf0554f110a6498d7f8e51d0e2cae182e951` | PIN_FACTS |
| `kix-sdk-0/compat/manifests/manifest.bootstrap-1.json` | `sdk/compat/manifests/manifest.bootstrap-1.json` | `1cce4ee5a9aa64ef40825c0e6dedf920050e594cf20ea0aaf087ecbde46f0cca` | `0e79ef22830f7057f247622b682c7c8647e29db6` | PIN_FACTS |
| `kix-sdk-0/compat/manifests/manifest.bootstrap-1.json.sha256` | `sdk/compat/manifests/manifest.bootstrap-1.json.sha256` | `fd568b8117a010d1e259323af6f788efe97d497ec8e15406d99d53cddc389d89` | `616253ae8116f7d842deb68742c148e97fc21346` | Pinned Git tree |
| `kix-sdk-0/compat/manifests/manifest.bootstrap-2.json` | `sdk/compat/manifests/manifest.bootstrap-2.json` | `eec1750532d319ea06d8ae61bafa77316067088a84a9b70d20a1f6966dfba1e0` | `06199b46de4c7d0c9dadd55f39d469936acb601a` | PIN_FACTS |
| `kix-sdk-0/compat/manifests/manifest.bootstrap-2.json.sha256` | `sdk/compat/manifests/manifest.bootstrap-2.json.sha256` | `bb4903cb817829f9513b47fc1f60498744ed93355ae8b61511a15a31aa99c8c3` | `b865a19fd02774a804ff2e47ec8f3e6d68ff2d13` | Pinned Git tree |
| `kix-sdk-0/compat/profiles/bootstrap-1.profile.json` | `sdk/compat/profiles/bootstrap-1.profile.json` | `4c92cf6d905f83fb3f5cd52e166dbadf057451ae46441fce1f91baaaa4367d34` | `70842b7fdc2192b9ea0014d309dc470ea8cef99f` | PIN_FACTS |
| `kix-sdk-0/compat/profiles/bootstrap-2.profile.json` | `sdk/compat/profiles/bootstrap-2.profile.json` | `c356b923997cefc132e63e73a179d5922dd7cb2124b9e9b399c662cd49803b73` | `7f41854b88e4901c1ccb4baf17470e046bdf14a5` | PIN_FACTS |
| `kix-sdk-0/compat/verify_compat.mjs` | `sdk/compat/verify_compat.mjs` | `b1ed26b977666f796a68c5de0a108e5558ca3c98486dc188d385b220a448cf89` | `ea639d297010c501054c78b9263cd8d7645c7c0b` | PIN_FACTS |
| `kix-sdk-0/conformance/vectors/canonical-encoding.vectors.json` | `sdk/conformance/vectors/canonical-encoding.vectors.json` | `3446c13847bb153df06c1d5d3b7f09cd3b1648ac10bb0cc76d7b65c7014e99c2` | `947773687ea9e2226925168129bf0370e20a5a04` | PIN_FACTS |
| `kix-sdk-0/conformance/vectors/manifest-verifier-negative.vectors.json` | `sdk/conformance/vectors/manifest-verifier-negative.vectors.json` | `c5157d96aea3219ec15f443272ded849298b39aff915dc0d96eda51f03deed4f` | `8880a33a6b35d2791741ed862898ce521f7e92eb` | Pinned Git tree |
| `kix-sdk-0/conformance/vectors/mixed-input.vectors.json` | `sdk/conformance/vectors/mixed-input.vectors.json` | `9e2441ddefc22a2f8c7be230436620908b735b128b9445b7a5a916e4d86a2e19` | `74bf25478d57a98c5ee102c362c4870fc8d16456` | PIN_FACTS |
| `kix-sdk-0/generate/generate_client.mjs` | `sdk/generate/generate_client.mjs` | `66f0e2010c6511d322f8dfc7e8932d27d25e154ac0b3d6083f19f97af6124bb7` | `8b91493e3a47a4fe4438d6e8a5951ad88b9d83a3` | PIN_FACTS |
| `kix-sdk-0/generate/generate_manifest.mjs` | `sdk/generate/generate_manifest.mjs` | `c087b30ee22f05f6aa905fca3fcaa6cee924d780ebfc9b7eb394d8be03288769` | `2470c57d8ad18a6298d164fea821eebdc8d7ac55` | Pinned Git tree |
| `kix-sdk-0/generated/catalogue.ts` | `sdk/generated/catalogue.ts` | `3162d47c51ffad755f80086850bbcbb7ae4a846c4df47ffa57b0e44f9eced0b5` | `e0800806c603bc5f182103602281aa4b312046dd` | PIN_FACTS |
| `kix-sdk-0/sdk-pin.json` | `sdk/sdk-pin.json` | `cc68ea950560506a9e8a632ac5b9e634e037d5eaad6b12885d65ea99f9ca160a` | `6d97cdf6f9287f766450e497b0051c9bf09e119b` | PIN_FACTS |
| `kix-sdk-0/src/client.ts` | `sdk/src/client.ts` | `0f3650dc84bd34c74bb9a48fe9e6523c0b51665bdbcbd1313e7f94b5a3a4715e` | `43dbbc63130b73a3b07c1976c0f0615d768f1efd` | PIN_FACTS |
| `kix-sdk-0/src/jsonschema.ts` | `sdk/src/jsonschema.ts` | `bfb69963dd275f80f870125fb312a0214dd473bb6df5b67543b0d7f0267f6afd` | `623152b0c35abee9cb485f59c3278b92fba56bfb` | PIN_FACTS |
| `kix-sdk-0/src/manifest.ts` | `sdk/src/manifest.ts` | `18dc1693e58ad98766495faebe4d2e1ca5e23df92b9864b64ef497336ce1f557` | `c72efdc008d68d1bfaf733b0f0fdc037435ac1d7` | PIN_FACTS |

The following digests identify consumer-authored files. The declarations mirror the generated 84-name order and pin fields, with the existing client and JSON-schema declarations.

| Consumer file under `vendor/kix-sdk-0/` | SHA256 |
| --- | --- |
| `producer-provenance.json` | `005cf12f1db46133a8753bed1e459e6f829f2732da29a725198e46f1332d2c1a` |
| `types/catalogue.d.ts` | `1c39cb9660dc9d83c54f63d75a4137ac4099e9668931460b605b015f8cbb26d4` |
| `types/client.d.ts` | `c50c3449bb8d2f8af623f5503b8856e0161cdf1a1684258e55215d4fb242c5bf` |
| `types/jsonschema.d.ts` | `a75cf41ea1189e5265cea96b09bba09018be9a7542e0fbb1173a56a5f7495ea9` |

## Desk and bundle evidence

The M2 and H1 decisions remain in effect. `placeHold` records its unbound reason for `reserve_listing`. Booking and settlement send neither `capture` nor `settle_capture`. The locked `commerce-bindings.ts` SHA256 is `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`. Its Git blob matches both the supplied branch base and local `origin/main`.

The default remains stub. Explicit HTTP mode uses the existing loopback and pin checks, one attempt, no retry, no idempotency header, no redirects, and no fallback. BOOTSTRAP grants catalogue-schema binding. Production, truth and conformance claims remain false.

The 2026-11-13 budget history entry records one total gzip change, from 790000 to 802884 bytes, for “owner ruling JunTae 2026-11-13, kix-protocol pin move.” The first browser budget run measured 404605 landing JS bytes against the existing 400000-byte cap. Vite now builds the refund controller with its existing refund source, so the box office no longer loads the secondary controller bundle. The browser check then measured 356404 bytes across 27 scripts. Initial JS, CSS, route-chunk, landing and render limits retain their prior values.

| Build | Initial JS gzip | Initial CSS gzip | Largest lazy JS gzip | Total gzip |
| --- | --- | --- | --- | --- |
| Worktree on `e061e14760cd19a1f2bb19726ba9b76445f3278e` | 160084 | 4997 | 29926 | 800559 |
| Patch applied to isolated archive of local `origin/main` at `3c0dbc23fbd8fc86953d8e100ebdae41f09a44a7` | 160194 | 4997 | 29926 | 802755 |
| Limit | 290000 | 5000 | 30000 | 802884 |

The supplied branch base is 11 commits behind that local main ref. `git apply --check` found no overlapping changes. The isolated archive build leaves the worktree branch ref under supervisor control. The checked-out `.aiops/program.json` has 60 nodes and no `c-int-pin-bundle` entry. This delivery uses the explicitly supplied node and owner handoff.

## Commands and results

Node 22.23.4 was selected from the local npm cache for npm, build and test commands. The browser budget used Chrome 156.0.8078.47. The loopback gate ran with Python 3.13.5.

| Command | Result |
| --- | --- |
| `npm ci` | Passed. Installed 535 packages. npm reported deprecation, install-script and audit warnings. |
| `KIX_REQUIRE_GATE=0 npm exec --workspace @kix/protocol-adapter -- vitest run test/openapi-pin.test.ts test/gate-requirement.test.ts test/sdk-pin.test.ts test/sdk-consumption-tuple.test.ts test/admission-fsm.test.ts test/resale-fsm.test.ts test/reservation-fsm.test.ts test/http-integration-gate.test.ts test/prod-readiness.test.ts test/sdk0-mock-scenarios.test.ts test/discovery-read.test.ts test/contract-fixture-library.test.ts test/local-call-schema.test.ts` | Passed, 205 tests with 3 gate-only tests skipped. |
| `npm exec --workspace @kix/web -- vitest run test/handoff-packet.test.tsx test/bundle-budget.test.ts test/contract-fixture-library.test.tsx test/local-evidence-matrix.test.ts test/entry-import-graph.test.ts` | Passed, 53 tests. The earlier run matched 3 suites and passed 30 tests because the evidence-matrix filter ended in `.tsx`. |
| `npm run typecheck` and `npm run build` | Passed on rerun after the chunk change. Vite emitted a warning about the existing marketing chunk cycle. |
| `KIX_REQUIRE_GATE=0 npm test` | Passed on rerun, 2998 adapter tests with 23 gate-only tests skipped, 1653 web tests and 6 cold-start tests. |
| `KIX_PROTOCOL_ROOT=/workspace/commerce-run/integration/kix-protocol-8ba7f6c KIX_REQUIRE_GATE=1 npm test -w @kix/protocol-adapter` | Passed, 3021 tests with every gate test executed. |
| `npm run lint`, `npm run deps:check`, `npm run cycle-check`, `npm run typecheck:e2e` | Passed. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | Passed. Both workspaces met every coverage floor. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:budget` | First run failed at 404605 landing bytes. Rerun with `KIX_BUDGET_RECORD_OUT=/tmp/kix-pin-bundle-browser-budget.json` passed all 9 checks. |
| `npm run budget` | Passed, 800559 total gzip bytes on the final worktree build. |
| `git archive origin/main`, `git apply --check`, `git apply`, then `npm ci --offline --no-audit`, `npm run build` and `npm run budget` in the isolated archive | Passed. Final total gzip 802755. |
| `npm exec --workspace @kix/web -- vite build`, `npm run budget` and `node /tmp/kix-pin-bundle-landing.cjs` | Compared chunk layouts with a loopback browser. Splitting the refund source and discovery tuple alone still loaded the secondary controllers. Moving the controller by itself fixed landing at a higher total size. Grouping the controller with its source gave the final measurements. |
| `python3 /tmp/kix-pin-bundle-vendor.py --copy` and `python3 /tmp/kix-pin-bundle-vendor.py` | Passed. The initial copy attempt hit a read-only worktree sidecar. The rerun verified existing matching bytes and copied missing files. |
| `python3 /tmp/kix-pin-bundle-parity.py` | Passed. A first parity script appended a second trailing comma. The corrected script confirmed declaration parity and the sole budget exception. |
| `git grep -n 'BeautifulMind-JT/kix-protocol' -- . ':!docs/**' ':!README.md' ':!.aiops/**'` | No matches. |
| `git diff --check` and `git diff --exit-code -- .aiops docs/aiops DECISION_REQUIRED.md packages/protocol-adapter/src/commerce-bindings.ts package-lock.json` | Passed. The pinned producer worktree also reported clean. |

Exact-head GitHub Actions run [44210764730](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/44210764730) (PR #144, head `1544f04855ab5d05db1308bb8984d68c36948419`, merge with main `3c0dbc23fbd8fc86953d8e100ebdae41f09a44a7`) reported **Typecheck, build, and test (stub)** and **Adapter tests against the reviewed gate** SUCCESS, the latter checking out `SUNBURN-Golden/kix-protocol` at `8ba7f6c36373ac0ec49246f51f7471c164ac3a28`. Every other job passed except **Visual baselines (stub, headless Chrome)**, which failed six pixel comparisons. Fix round 1 below addresses that job. A fresh exact-head run remains pending supervisor submission. The checked-in workflow still requires its read token for that checkout.

## Fix round 1 — visual baseline maintenance (2026-11-18)

The six failing comparisons had two distinct causes, established before any baseline changed:

1. **Pin-move content (four light shots).** The diagnostics screens render the build-identity pin digest and the vendored file SHA256 values; the journey-context identity screens render the pin tuple. The pin move changes those strings. Reviewed diffs show the differences confined to the digest panel (diagnostics) and the single pin-tuple line (identity); the rendered values equal the pin constants and the PIN_FACTS ledger above (`2248ff67…`, `d05beb48…`, `eec17505…`, `3162d47c…`, tuple `8ba7f6c36373…`). Layout probes passed; the diagnostics panel's downstream shift is text re-wrap of the new digests, not a layout defect.
2. **Runner Chrome drift (two forced-colors shots).** Main's own green run [42994636719](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/42994636719) (2026-11-11) used runner image provisioner `20261028.624`; the failing PR run used `20261103.629`, whose Google Chrome is 157.0.8103.50 against the recorded 156.0.8078.47. Chrome 157's forced-colors mode draws link underlines and button labels differently (handoff nav links and "Skip the guide"; booking "안내 건너뛰기" and "예약 신청"). Light-mode rendering is unchanged: all four light-shot actual pictures from the CI artifact are byte-identical to local Chrome 156 renders. This drift is environmental and would fail any PR's visual job on the new image; it is not a pin-bundle defect.

Verification of the cause: Chrome for Testing **157.0.8103.50** (free public download, isolated under `/tmp/kix-chrome157/`, selected with the harness's existing `KIX_E2E_CHROME`) reproduces all six CI failures with the exact CI pixel counts, and **all six CI artifact actual pictures are byte-identical to its local renders** on the merged tree. The font fingerprint stays `linux-d29b2e9b` with vendored Hangul present, because `FONTCONFIG_FILE` pins the four OFL fonts; the Chrome version is not part of the profile key.

`git merge --no-commit --no-ff origin/main` (`3c0dbc2`) applied cleanly and is left staged and uncommitted for the supervisor, as in the sibling visual fix round. Main's four merged PRs touch no baseline, workflow, budget or visual-harness file. Recording then ran on the merged tree with `KIX_VISUAL_UPDATE=1` and Chrome 157; the recorder's exact-RGBA rule refreshed 14 of 108 PNGs and retained 94 byte-identical. Every refreshed picture was reviewed: full old/new/diff inspection for the six substantive shots, and per-pixel numerical review plus a representative crop for the eight drift shots. The eight drifts are 1–4 pixels each, every changed channel exactly 1/255 in the shared banner background, zero pixels above channelDelta 8 — the same class the coverage binding recorded for the 155→156 Chrome update. No tolerance, mask, viewport, harness, threshold or workflow change was made; `TOLERANCE` stays channelDelta 8 / maxDiffPpm 200 and a size change still always fails.

| Refreshed shot | Exact changed pixels | Above channelDelta 8 | Cause |
| --- | --- | --- | --- |
| `diagnostics.desktop.en.light` | 86460 | 83056 | New pin digest and vendored SHA256 panel |
| `diagnostics.phone.ko.light` | 24262 | 22591 | Same panel, Korean |
| `identity.desktop.en.light` | 714 | 653 | Pin tuple line |
| `identity.phone.ko.light` | 571 | 531 | Pin tuple line, Korean |
| `handoff.desktop.en.forced-colors` | 6817 | 6787 | Chrome 157 forced-colors links/buttons |
| `booking.phone.ko.forced-colors` | 2587 | 2545 | Chrome 157 forced-colors buttons |
| `handoff.desktop.en.light` | 4 | 0 | 1/255 banner drift |
| `handoff.desktop.ko.light` | 4 | 0 | 1/255 banner drift |
| `handoff.phone.en.light` | 3 | 0 | 1/255 banner drift |
| `marketing-m03.phone.ko.light` | 1 | 0 | 1/255 banner drift |
| `marketing-m04.phone.ko.light` | 1 | 0 | 1/255 banner drift |
| `marketing-m05.desktop.en.light` | 4 | 0 | 1/255 banner drift |
| `marketing-m05.phone.ko.light` | 3 | 0 | 1/255 banner drift |
| `permissions.phone.ko.light` | 4 | 0 | 1/255 banner drift |

The six substantive new baselines are byte-identical to the CI artifact actual pictures, so the committed set matches what the failing runner produced. The manifest records Chrome 157.0.8103.50, `recordedOn` 2026-11-18, appHead `1544f04855ab5d05db1308bb8984d68c36948419` (merge and baselines uncommitted at recording time), 108 shots and the unchanged tolerance; all 108 hashes were independently recomputed and match, and every PNG stays within the 2000px cap. Because the profile key excludes the Chrome version, a local Chrome 156 comparison now differs on the two forced-colors shots; the committed set targets the CI runner's Chrome, exactly as the coverage binding's 155→156 update did. Future runner-image Chrome updates are repo-wide baseline maintenance, outside this node.

| Command (merged tree, Node v24.22.1 local) | Result |
| --- | --- |
| `KIX_VISUAL_UPDATE=1 KIX_E2E_CHROME=/tmp/kix-chrome157/chrome-linux64/chrome KIX_E2E_NO_SANDBOX=1 npm run test:visual` | PASS: 123/123 tests, complete 108-shot recording, manifest written. Recording is not comparison evidence. |
| `CI=1 KIX_E2E_CHROME=/tmp/kix-chrome157/chrome-linux64/chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_RECORD_OUT=… KIX_VISUAL_OUT=… npm run test:visual` | PASS: 123/123, 3 files; 108 MATCH, summed diffPixels 0; profile linux-d29b2e9b, Chrome 157.0.8103.50; bind 127.0.0.1; ledger nonLoopback/nonGet/appNetworkCalls all 0; all claims false. |
| `npm run typecheck`, `npm run typecheck:e2e` | PASS. |
| `npm test` | PASS: 3091 adapter tests (23 gate-only skipped), 1720 web tests, 6 cold-start tests. |
| `KIX_PROTOCOL_ROOT=/workspace/commerce-run/integration/kix-protocol-8ba7f6c KIX_REQUIRE_GATE=1 npm test -w @kix/protocol-adapter` | PASS: 81 files, 3114/3114 tests, no skips; pinned checkout still clean afterwards. |
| `npm run build`, `npm run budget` | PASS: initial JS gzip 160194, CSS 4997, total 802755 ≤ 802884; every route cap passes. |
| `npm run lint` | PASS. |
| Independent SHA-256 recomputation of all 108 manifest hashes; byte comparison of the 94 retained PNGs; `git diff --check`; locked-file comparison | PASS. `commerce-bindings.ts` SHA256 remains `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`; `.aiops/`, `docs/aiops/`, the visual harness and all thresholds unchanged. |

Browser journeys and accessibility are not re-run locally this round: the only authored change is baseline PNG data, which only the visual suite consumes, and both jobs already reported SUCCESS on the exact-head merged tree at Chrome 157 in run 44210764730. This round's baseline refresh is maintenance, not design review, not acceptance and not a release; user acceptance stays PENDING and release NOT_AUTHORIZED.

## Changed files

- `.github/workflows/ci.yml`
- `README.md`
- `apps/web/build-identity.ts`
- `apps/web/bundle-budget.json`
- `apps/web/test/bundle-budget.test.ts`
- `apps/web/test/entry-import-graph.test.ts`
- `apps/web/test/handoff-packet.test.tsx`
- `apps/web/vite.config.ts`
- `docs/c-bundle-performance-budget-stub-apps-bind.md`
- `docs/c-contract-fixture-library-apps-bind.md`
- `docs/c-int-pin-bundle-apps-bind.md`
- `docs/c-local-evidence-matrix-stub-apps-bind.md`
- `docs/c-sdk0-mock-scenario-kit-stub-apps-bind.md`
- `packages/protocol-adapter/src/admission-case.ts`
- `packages/protocol-adapter/src/contract-fixtures.ts`
- `packages/protocol-adapter/src/credit-case.ts`
- `packages/protocol-adapter/src/discovery-read.ts`
- `packages/protocol-adapter/src/integration-gate-pin.ts`
- `packages/protocol-adapter/src/openapi-contract-pin.ts`
- `packages/protocol-adapter/src/resale-case.ts`
- `packages/protocol-adapter/src/reservation-case.ts`
- `packages/protocol-adapter/src/sdk-pin.ts`
- `packages/protocol-adapter/src/settlement-case.ts`
- `packages/protocol-adapter/src/surfaces.ts`
- `packages/protocol-adapter/test/admission-fsm.test.ts`
- `packages/protocol-adapter/test/gate-requirement.test.ts`
- `packages/protocol-adapter/test/http-integration-gate.test.ts`
- `packages/protocol-adapter/test/openapi-pin.test.ts`
- `packages/protocol-adapter/test/prod-readiness.test.ts`
- `packages/protocol-adapter/test/resale-fsm.test.ts`
- `packages/protocol-adapter/test/reservation-fsm.test.ts`
- `packages/protocol-adapter/test/sdk-pin.test.ts`
- `packages/protocol-adapter/test/sdk0-mock-scenarios.test.ts`
- `packages/protocol-adapter/test/support/reviewed-gate.ts`
- `packages/protocol-adapter/vendor/kix-protocol.contract-only.openapi.json`
- `packages/protocol-adapter/vendor/kix-protocol.integration-gate.openapi.json`
- `packages/protocol-adapter/vendor/kix-sdk-0/compat/manifests/manifest.bootstrap-2.json`
- `packages/protocol-adapter/vendor/kix-sdk-0/compat/manifests/manifest.bootstrap-2.json.sha256`
- `packages/protocol-adapter/vendor/kix-sdk-0/compat/profiles/bootstrap-2.profile.json`
- `packages/protocol-adapter/vendor/kix-sdk-0/compat/verify_compat.mjs`
- `packages/protocol-adapter/vendor/kix-sdk-0/conformance/vectors/manifest-verifier-negative.vectors.json`
- `packages/protocol-adapter/vendor/kix-sdk-0/generate/generate_client.mjs`
- `packages/protocol-adapter/vendor/kix-sdk-0/generate/generate_manifest.mjs`
- `packages/protocol-adapter/vendor/kix-sdk-0/generated/catalogue.ts`
- `packages/protocol-adapter/vendor/kix-sdk-0/producer-provenance.json`
- `packages/protocol-adapter/vendor/kix-sdk-0/sdk-pin.json`
- `packages/protocol-adapter/vendor/kix-sdk-0/src/client.ts`
- `packages/protocol-adapter/vendor/kix-sdk-0/types/catalogue.d.ts`

Fix round 1 adds only baseline data and this document:

- `apps/e2e/visual-baselines/linux-d29b2e9b/manifest.json`
- `apps/e2e/visual-baselines/linux-d29b2e9b/booking.phone.ko.forced-colors.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/diagnostics.desktop.en.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/diagnostics.phone.ko.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/handoff.desktop.en.forced-colors.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/handoff.desktop.en.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/handoff.desktop.ko.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/handoff.phone.en.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/identity.desktop.en.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/identity.phone.ko.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/marketing-m03.phone.ko.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/marketing-m04.phone.ko.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/marketing-m05.desktop.en.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/marketing-m05.phone.ko.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/permissions.phone.ko.light.png`

The staged `origin/main` merge (`3c0dbc2`) is integration content owned by the supervisor, not authored by this round.
