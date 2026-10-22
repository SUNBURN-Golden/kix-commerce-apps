# c-component-gallery-stub app bind

Scope: development-only `/dev/gallery`, synthetic fixtures, `contract_change=NO`. All case IDs and coverage records are app-internal. No public schema, operation, capability or identifier is introduced.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The journey stops at `accept_trade`. `capture` and `settle_capture` are never composed or sent. `placeHold.consideredAction` remains `reserve_listing`, not-bound. Locked commerce bindings, OpenAPI pins, PINNED_ACTIONS, CI gate SHA and protocolMergeSha are unchanged. This node sends no command and attaches no source.

## Development route and inventory

Run `npm run dev`, then open `/dev/gallery` on the local development server. The Verification navigation includes the gallery in development only. The normal production route registry and business evidence denominators stay separate. Production `/dev/gallery` draws not-found.

The index lists all cases with isolated, lazy iframe previews and full-document preview links. Each preview owns its landmarks and focus effects; a Shell specimen is never inside another Shell. A React Router location override supplies a deterministic sample path. HTTP selection is refused before mounting any gallery Shell; it is never changed to stub. Browser preferences are inherited by previews. Locale follows the existing `lang=en` / `lang=ko` URL and session choice. Session TTL remains UNDETERMINED; existing sessionStorage behavior is unchanged.

| Shared component | Specimens |
| --- | --- |
| Shell | selected stub adapter, synthetic content |
| SurfaceNav | current and no-current; desktop, narrow closed and keyboard-open |
| Breadcrumb | root, parent-child, parameterized, unmatched empty |
| ScreenLoading | progress, nothing sent |
| StatusMark | all STATUS_MARKS: loading, blocked, selected, review |
| AmountNotice | UNDETERMINED |
| DeadlineLine | fixed expiresAt, expired true / false / null; no local expiry calculation |
| LocaleSwitch | en / ko, keyboard change and retained focus |
| ErrorPanel | render-error and screen-load-error; inert example callback |
| SafeText | literal untrusted text, empty, shortened with inspectable original |
| AsyncState | loading, empty, error, UNKNOWN, STALE, NOT_BOUND |
| AsyncStateFrame | parent-owned announcement |
| ConnectivityBanner | local; offline follows the browser, with an isolated description ID and landmark name |
| CachedReadNotice | hidden while local; retained reads after disconnect |
| ConnectivityWriteButton | inert callback; focusable and blocked while offline |
| ErrorSummary | empty issues; required field with a keyboard link |

## Snapshot and browser policy

`apps/web/test/component-gallery.test.tsx` snapshots each of the 34 cases in en and ko (68 DOM snapshots), using the real components and fixed fixtures. Intentional UI changes require inspecting the snapshot diff; do not regenerate snapshots to hide a defect. Inventory checks compare shared component exports and the independent browser case list, and reject missing components and duplicate IDs.

`apps/e2e/tests/a11y/gallery.a11y.test.ts` scans the index and every isolated case with the existing axe baseline in both locales at 1280px and 320px. It exercises navigation Enter/Tab/Escape, locale keyboard focus, empty/unmatched, loading and error states, and light/dark, forced colours, reduced motion and print. Network ledgers require zero application requests, non-GET requests and external requests. Development check IDs are separate from economic journey outcomes and enforced by a11y teardown.

All observations remain UNQUALIFIED / PENDING / NOT_AUTHORIZED. Automated scans are not assistive-technology evidence, user acceptance, qualification or release. Target accessibility standard and session TTL are UNDETERMINED. Real-device, assistive-technology, HTTP/live gate and real integration checks are unverified here.

## Production exclusion and budget

Both route metadata and dynamic import are guarded by `import.meta.env.DEV`; gallery CSS is imported only by the gallery module. The clean production exclusion test inspects every emitted chunk's module graph and every emitted JS/CSS/HTML asset for gallery routes, fixtures and styles. Negative fixtures prove the checker rejects contamination. A separate browser assertion verifies production not-found and no navigation link.

The browser harness makes a separate test-only build with the development branch enabled. It is never production-exclusion evidence. Programmatic builds explicitly scope NODE_ENV=production because Vitest otherwise supplies NODE_ENV=test. The gallery node adds no dependencies, scripts, budget limits or CI jobs. The merge inherits main's existing Terser dependency and build configuration.

## Source and verification

Implementation source base: `288c8ef8b58dec52093cfbc0a9cbca6b65deeab3` (uncommitted node worktree). The supervisor records the final delivery SHA after committing. Commands and results are recorded below. Local runner: Node v20.19.2 (repository engine >=20; CI specifies Node 22), installed headless Chrome 155.0.8059.84, no browser download or live service.

Initial failures: typecheck caught the compile-time optional dev loader entry; it now has an explicit complete loader type over the guarded route set. Narrow tests caught development navigation assumptions and Vitest retaining development branches in a programmatic production build; production and development assertions are now explicit and NODE_ENV is scoped around builds. The first a11y run had six failures: two production-nav counts, two gallery target-size failures, and two inherited discovery projection failures. Gallery preview navigation now has a spaced 44px back-link target. E2E typecheck required Vite's ImportMeta types after the registry gained the compile-time guard.

## Plan deviations and boundaries

An inherited a11y failure in discovery empty/conflict states came from buttons nested in the independent projection listbox options. Projection options now open detail on mouse click or Enter/Space without a nested control. A Node assertion and browser keyboard/mouse check cover it; existing findings and a11y checks were not relaxed. The final review also caught a trailing-slash URL nesting two Shells; registry matching now handles both forms and tests assert one Shell/main.

Gallery-only chrome lives in its lazy module and the guarded route label helper instead of the eager production message catalogue, so production carries no gallery messages. SafeText was included because it is shared on the merged base. A single shared development coverage matrix is referenced from both journey and a11y matrices; it adds no business outcome or surface denominator. No new npm command was needed.

STOP if an unmerged contract/dependency, new protocol command, product policy value, paid service, equipment, credentials, production runtime, or public contract change is needed. No such dependency is needed for this synthetic gallery. Preserve stub default, loopback-only explicit HTTP, one attempt, no fallback/retry/Idempotency-Key/redirect/proxy/UI fetch, all truth and production flags false. No real payment, KYC, bank rail, venue scanning, credit disbursement, marketplace, deployment or SLO claim.

## Original node locked-file verification

`git show HEAD:packages/protocol-adapter/src/commerce-bindings.ts | sha256sum` and `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` both returned `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`. `git diff --name-only -- packages .github .aiops docs/aiops package.json package-lock.json` is empty.

## Changed files

- `README.md`
- `apps/e2e/src/a11y-global-setup.ts`
- `apps/e2e/src/a11y-matrix.ts`
- `apps/e2e/src/build.ts`
- `apps/e2e/src/gallery-matrix.ts`
- `apps/e2e/src/journey-matrix.ts`
- `apps/e2e/src/suite.ts`
- `apps/e2e/tests/a11y/gallery.a11y.test.ts`
- `apps/e2e/tests/a11y/keyboard.a11y.test.ts`
- `apps/e2e/tests/a11y/nav.a11y.test.ts`
- `apps/e2e/tsconfig.json`
- `apps/web/src/App.tsx`
- `apps/web/src/components/Breadcrumb.tsx`
- `apps/web/src/components/ScreenLoading.tsx`
- `apps/web/src/components/SurfaceNav.tsx`
- `apps/web/src/dev/gallery/ComponentGallery.tsx`
- `apps/web/src/dev/gallery/cases.tsx`
- `apps/web/src/dev/gallery/gallery.css`
- `apps/web/src/i18n/use-page-identity.ts`
- `apps/web/src/pages/DiscoveryPanels.tsx`
- `apps/web/src/screens.ts`
- `apps/web/src/shell/route-registry.ts`
- `apps/web/test/__snapshots__/component-gallery.test.tsx.snap`
- `apps/web/test/component-gallery.test.tsx`
- `apps/web/test/discovery-live.test.tsx`
- `apps/web/test/gallery-production-exclusion.test.ts`
- `apps/web/test/route-registry.test.tsx`
- `docs/c-a11y-acceptance-stub-apps-bind.md`
- `docs/c-component-gallery-stub-apps-bind.md`
- `docs/c-local-evidence-matrix-stub-apps-bind.md`
- `docs/c-route-registry-navigation-stub-apps-bind.md`

## Executed commands and results

The commands in this section are the original node evidence before the current merge. All commands below were actually run in this worktree. Repeated commands were rerun after relevant fixes. No commit, push, PR, issue, comment, deployment or protocol write was performed.

| Command | Result |
| --- | --- |
| `npm ci` | Exit 0; 493 packages installed. Full dependency audit reported 5 findings (2 moderate, 1 high, 2 critical); no dependency changed. |
| `npm test -w @kix/web -- --run test/component-gallery.test.tsx test/gallery-production-exclusion.test.ts test/route-registry.test.tsx test/lazy-routes.test.tsx -u` | Initial run: 3 failures of 74; 44 snapshots written. Failures corrected as described above. |
| `npm test -w @kix/web -- --run test/component-gallery.test.tsx test/gallery-production-exclusion.test.ts test/route-registry.test.tsx test/lazy-routes.test.tsx` | Reruns: 74 passed, then 75 passed after HTTP-refusal coverage. |
| `npm test -w @kix/web -- --run test/discovery-live.test.tsx` | Exit 0; 10 passed. |
| `npm test -w @kix/web -- --run test/component-gallery.test.tsx test/gallery-production-exclusion.test.ts test/route-registry.test.tsx test/lazy-routes.test.tsx test/discovery-live.test.tsx` | Exit 0; final narrow suite 86 passed in 5 files; all 44 snapshots matched. |
| `npm run typecheck` | Initial optional development-loader type error; corrected. Final exit 0 for adapter and web. |
| `npm run typecheck:e2e` | Initial missing ImportMeta env type; corrected with existing Vite types. Final exit 0. |
| `npm run build` | Exit 0. Existing >500 kB chunk advisory remains; no gallery module or CSS emitted. |
| `KIX_REQUIRE_GATE=0 npm test` | Exit 0; adapter 1306 passed, 23 live-gate tests skipped; web 802 passed. Skipped live gate is not a pass. |
| `npm run budget` | Exit 0; initial JS gzip 288526 bytes, CSS 4768, total 621793; all existing limits maintained. |
| `KIX_E2E_NO_SANDBOX=1 npm run test:e2e` | Exit 0; 51 passed in 14 files, including fault/evidence checks. |
| `KIX_E2E_NO_SANDBOX=1 npm run test:budget` | Exit 0; 9 passed in 3 files (split, chunk failure, bounded lists). |
| `KIX_E2E_NO_SANDBOX=1 npm run test:a11y` | Initial run: 6 failures of 237; corrected without relaxing checks. |
| `KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kix-gallery-a11y-record.json npm run test:a11y` | Exit 0; 238 passed in 11 files, including all gallery cases/locales/viewports, production absence, display and keyboard probes. |
| `npm run lint` | Exit 0; no new lint finding. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | Exit 0; all unchanged floors met. Adapter lines/statements 91.18%, functions 97.44%, branches 84.52%; web lines/statements 83.85%, functions 60.64%, branches 84.76%. |
| `npm run deps:check` | Exit 0; production dependency gate passed, 4 manifests and 589 lockfile entries checked. |
| `npm run cycle-check` | Exit 0; no circular import in any workspace. |
| `npm run audit:warn` | Exit 0; production audit found 0 vulnerabilities. |
| `npm test -w @kix/web -- --run test/local-evidence-matrix.test.ts test/component-gallery.test.tsx` | Exit 0; 70 passed after evidence documentation. |
| `npm test -w @kix/web -- --run test/local-evidence-matrix.test.ts test/component-gallery.test.tsx test/route-registry.test.tsx` | Exit 0; final documentation/registry check 88 passed. |
| `git diff --check` | Exit 0; no whitespace error. |

Supplementary final-source browser probe: `KIX_E2E_NO_SANDBOX=1 node node_modules/vite-node/vite-node.mjs .gallery-smoke.ts` passed after copying the one-off `/tmp/kix-gallery-smoke.ts` into the worktree; the temporary worktree script was removed. The first attempt using the script directly under `/tmp` was rejected by Vite's root boundary. The successful probe rebuilt the final source, checked both `/dev/gallery` and `/dev/gallery/` for exactly one Shell/main and 22 cases, exercised narrow Enter/Escape, and observed zero application/non-GET/external requests. Screenshots `/tmp/kix-gallery-desktop.png` and `/tmp/kix-gallery-narrow.png` were inspected. They are local observations, not committed visual baselines. Normal, empty/unmatched, loading and error states were also exercised in the actual Chrome a11y tests.

The final a11y record reports `appHead: 288c8ef8b58dec52093cfbc0a9cbca6b65deeab3` (uncommitted source changes listed above), axe 4.14.0 / Playwright 1.58.2 / Chrome 155.0.8059.84, and ledger `nonLoopback: 0`, `nonGet: 0`, `appNetworkCalls: 0`. WCAG conformance, user acceptance, assistive-technology run, release and production qualification claims all remain false.

## Merge resolution verification (2026-10-22)

Merge inputs: gallery branch HEAD `e65ee0f52d100a5e9e8eb7b08f810b311a00c45e`, main/MERGE_HEAD `1ef36841d4a93ea7886550a5745584fc2f8fe33d`. The merge remains in progress; the supervisor stages and commits the result and records its final SHA.

Both README feature sections and both evidence sections are retained. The evidence matrix's original NOT_STARTED rows are a test-bound historical snapshot, explicitly separated from the current combined implementation inventory; no central completion, qualification, acceptance or release is inferred. Main's async, form, connectivity and SDK0 work remains present alongside the development-only gallery. Both browser registries retain their existing checks, and both shared async/form/connectivity styles and gallery-local CSS remain present.

ScreenLoading combines AsyncStateFrame's announcements/busy state with APP_ROUTES and routeLabel, preserving localized development labels and unknown caller labels. The scoped production NODE_ENV and gallery build flag remain; the old explicit `minify: true` override is superseded by main's configured Terser minifier so browser evidence uses the production size settings. No minification intent is lost. All other conflict content is retained.

The merged reporter imports the route registry when Vitest loads configuration in plain Node. Optional environment access prevents a missing import.meta.env from crashing that import; production exclusion remains checked by the existing emitted-module and artifact tests. Gallery specimens now include all newly merged shared component exports. ConnectivityBanner accepts an optional description ID and landmark label for its isolated specimen, preserving the app defaults and avoiding duplicate IDs or landmark names with the global banner. Two ScreenLoading snapshots were reviewed and updated for the intended async markup; 24 new snapshots cover the added specimens. The form-error specimen includes its parent section heading so ErrorSummary retains the same heading order as a real form. Browser coverage includes the form-error keyboard link, blocked offline write focus and cached-read axe checks.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce. Locked bindings remain byte-identical to main; no pin, command mapping, gate, CI, program or aiops change is made by this resolution.

Merge-run failure evidence: the initial web test command failed while loading Vitest configuration because the reporter reached import.meta.env in plain Node. After the guard, the focused suite found two intentional ScreenLoading snapshot differences; both were inspected and updated. The first complete a11y merge run reported 258 passed / 5 failed: duplicated connectivity landmark names, an ambiguous global status selector and one narrow-preview timeout. The specimen now has its own landmark name and status assertions select the specimen region. Two intermediate reruns were interrupted (exit 130) to correct the offline axe setup and the form specimen heading order before completing the full suite. The offline probes preload the existing loopback axe script, then scan the in-memory script without fetching offline. A supplementary Chrome structure scan passed for all 24 new locale snapshots after correcting the form heading. Required matrix checks and axe rules remain unchanged.

### Merge commands and evidence

| Command/check | Result |
| --- | --- |
| `npm ci` | Exit 0; installed the merged lockfile, including main's Terser. No additional dependency/lockfile edit. |
| `npm run typecheck` and `npm run typecheck:e2e` | Exit 0 for adapter, web and browser workspace. |
| `KIX_REQUIRE_GATE=0 npm test` | Exit 0; adapter 1317 passed / 23 live-gate tests skipped, web 1015 passed. Skipped live-gate work remains unverified. Final gallery inventory: 34 specimens / 68 locale snapshots. |
| `KIX_REQUIRE_GATE=0 KIX_E2E_NO_SANDBOX=1 npm test -w @kix/e2e` | Exit 0; 54 passed in 15 files, including all journey/fault/evidence checks. |
| `KIX_REQUIRE_GATE=0 KIX_E2E_NO_SANDBOX=1 npm run test:budget` | Exit 0; 9 passed in 3 files, with the existing split/chunk-failure/render limits. |
| `npm run build` and `npm run budget` | Exit 0; final initial JS gzip 285648 bytes, CSS 4996, total 630660. Existing limits unchanged; production gallery exclusion also passed in the web suite. |
| `KIX_REQUIRE_GATE=0 KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kix-gallery-merge-a11y-record.json npm run test:a11y` | Final exit 0; 263 passed in 14 files, including all 34 specimens in both locales/viewports and complete matrix teardown. |
| `npm run lint` | Exit 0. |
| `git diff --check`; tracked-file conflict marker scan | Exit 0; no markers or whitespace errors. |
| Locked bindings versus `origin/main` | Byte-identical; SHA-256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`. |

Resolution follow-up files (in addition to the four conflicted paths): `apps/e2e/src/gallery-matrix.ts`, `apps/e2e/tests/a11y/gallery.a11y.test.ts`, `apps/web/src/components/ConnectivityBanner.tsx`, `apps/web/src/dev/gallery/cases.tsx`, `apps/web/src/shell/route-registry.ts`, `apps/web/test/component-gallery.test.tsx`, its snapshot file, and this binding document. The pre-existing main merge changes are retained. No staging, commit, merge/rebase/reset/checkout or push command is performed. The four index entries intentionally remain unmerged until the supervisor stages the marker-free files.

The next complete a11y run passed 261 of 263 tests with no remaining axe finding, but timed out in Korean/narrow gallery scanning and the inherited resale keyboard probe. The full suite was rerun alone with the original 120-second test timeout, retry=0, rules and matrix assertions unchanged.

The serial run passed all gallery variants and all 111 screen probes, then finished 262 passed / 1 failed after a 30-second locator timeout in the inherited all-screens no-dialog keyboard check. During that run a requested 20-second runner wait reported 105.2465 seconds elapsed. The next full run used short process polling; no application, timeout, retry or assertion change was made for these timeout failures.

Final full accessibility run: exit 0, 263/263 passed in 14 files (343.63 seconds). The record at `/tmp/kix-gallery-merge-a11y-record.json` reports `nonLoopback: 0`, `nonGet: 0`, `appNetworkCalls: 0`, with `appHead: e65ee0f52d100a5e9e8eb7b08f810b311a00c45e` plus the uncommitted merge resolution described above. No timeout, retry, test, axe rule, matrix check or budget was relaxed. Final marker, whitespace and protected-file checks also passed. These remain local stub observations, not live-gate, integration, qualification, acceptance or release evidence. Supervisor staging and the final merge SHA are still outstanding by design.
