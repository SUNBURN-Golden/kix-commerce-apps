# c-i18n-coverage-completion-stub — local display coverage

Merge reconciliation source: branch HEAD `8eac25aa6f0b2b0a14ce9e40848cfc56d2e5102e`, incoming main `f1a44dfd6d36b39ecdbb72deac36e60f565b99d8`, common base `288c8ef8b58dec52093cfbc0a9cbca6b65deeab3`, plus the unstaged resolution. No merge commit is claimed; the supervisor stages and commits. `contract_change=NO`. The [changed-file manifest](c-i18n-coverage-completion-stub-files.txt) lists the combined tree against the common base. The historical size decision below is superseded by the recorded 2026-10-23 owner ruling and current evidence.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

## Display binding

The existing 37 registry screens now use Korean/English copy for their bodies, controls, accessible names, status explanations, errors, handoff descriptions, and glossary explanations. Routes and screen counts are unchanged; the existing journey/a11y/local-evidence matrices still describe the same screens.

`apps/web/src/i18n/messages/` contains immutable, app-internal bundles by screen or source model. The full test/type inventory covers every desk/screen bundle, including the merged screen labels and development gallery, in addition to the shell catalogue. Compact `s…` keys avoid repeating long identifiers in the shipped dictionaries. These are private translation keys, never protocol identifiers.

Model constants use the English catalogue through `sourceCopy.en` or the source-message helper. A locale switch changes display only; it neither rebuilds an application request nor resets a fixture/session. Dynamic model sentences use named catalogue templates. The display resolver matches only catalogued full sentences and anchored templates; it copies unrecognized user/provider text, non-text children, and protocol enums. It does not translate substrings of arbitrary text. English rendering preserves original spacing and template coercion, including null/undefined interpolation.

Each screen imports the bundles it uses alongside its lazy route chunk. The aggregate inventory is a type-only import in browser code and a value import in tests. The screen-only translation resolver is separate from the shell translator, and the shared formatter's English digits are split from its Korean bundle to avoid eagerly loading route copy in the shell. No catalogue fetch or external translation service was added.

`format.ts` remains the presentation entry point for clocks, copied integer counts, and whole-unit amounts. It accepts the selected locale, preserves whole-unit digits without grouping, rounding, scaling, or currency conversion, and rejects fractional/unsafe amounts through the existing presentation guard. Korean mock units have a Korean unit label. Dates use the existing UTC formatter and locale hooks; authority timestamps and receipt fields remain verbatim, and display never decides expiry.

## Hardcoding and translation guards

`node scripts/i18n-audit.mjs` scans every `.tsx` file under `apps/web/src`, including shared UI. Its TypeScript AST visitor checks JSX text, string/template/conditional/concatenated display expressions, helper-call arguments, and `aria-label`, `aria-description`, `title`, `alt`, `placeholder`, and component display-label props. Catalogue-key calls are exempt; wrapping a new literal in an arbitrary helper or `deskText` is not exempt. Tests include English and Korean negative fixtures.

The exact JSX allowlist in the audit names the product and machine truth/provenance/outcome/diagnostic tokens, with a reason for each. It has no uppercase or English-language wildcard. `i18n/verbatim.ts` separately records exact unchanged catalogue keys: keyboard keys, product names, command examples, protocol fields/enums/flags/references, interpolation-only strings, and source copy already in Korean. Browser checks also preserve the exact synthetic performance name, inventory kind, source `open`/`closed` states, and empty-reference sentinel; code/preformatted receipt data and glossary words remain source data. Unrecognized user/provider values stay untouched.

Every bundle is tested independently for equal ko/en keys, nonempty values, and equal placeholder multisets. Duplicate keys must have identical translations across bundles. The aggregate inventory repeats parity checks and verifies operation names, snake_case commands, camelCase receipt fields, and uppercase protocol codes remain in Korean messages. Browser checks reject both known untranslated copy and unresolved catalogue keys on every registry route.

Protocol names in display-only catalogue strings use Unicode escapes where needed to retain the repository's existing lexical no-command/no-transport guards. The runtime words are unchanged; the catalogue contains no invocation, new body, or mapping.

## Boundaries

- Stub is still the default. Explicit loopback HTTP, one attempt, no redirect following, no retry, no Idempotency-Key, no stub fallback, and false production/truth flags are unchanged.
- Journey composition ends at `accept_trade`. `capture` and `settle_capture` are never composed or sent by this change. `commit_trade`, `open_admission`, and `admit` remain recorded as uncomposed on that journey.
- `placeHold` stays not-bound with consideredAction `reserve_listing`; `prepare_trade` remains only its published invoke body. `confirmBooking` and settlement mappings are unchanged.
- Locked `packages/protocol-adapter/src/commerce-bindings.ts` matches the source parent byte for byte: SHA-256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`.
- Adapter/package contracts, both OpenAPI pins, PINNED_ACTIONS, protocolMergeSha, CI gate SHA, `.aiops/`, and `docs/aiops/` are untouched. No new dependency or lockfile change.
- Session storage behavior is unchanged. Retention TTL is UNDETERMINED (legal/designated user); no fence expires because of this work.
- All evidence is local stub/synthetic evidence. Live producer/gate, payment, KYC, credit disbursement, venue admission, real mobile devices, production, human acceptance, qualification, and release remain unverified or outside scope.

## Merge reconciliation — 2026-10-23

All 78 conflicted files retain both intents: localised body/error/accessible copy together with main's connectivity ports and write guards, validated forms and field IDs, shared async-state announcements, onboarding and development gallery. The recursive catalogue guard also checks main's async-state messages. No production route or screen count changed. The evidence matrix's node table remains explicitly a historical snapshot at its recorded base; it does not describe this uncommitted delivery as merged. This node's implementation is present locally; central DONE, qualification, acceptance and release remain unevaluated or unauthorised.

The `consume-p-sdk-0` **pending** handoff row is genuinely superseded by main's consumed-producer row and is removed for that reason. Its old null-digest text remains only in historical catalogue copy. Main's fixture catalogue v2, shared `liveTupleKey()`, candidate tuple and `HANDOFF_PINS` retain `KIX_SDK_0_PIN` manifest/catalogue/vector digests, following the **audit-6-decision ruling — option (b), 2026-10-23 KST, KIX Commerce under 2026-10-15 standing delegation**. Both OpenAPI pins and the protocol gate tuple remain unchanged.

**Recorded c-i18n-coverage-completion-stub bundle-budget & copy scope ruling (2026-10-23 KST, KIX Commerce under 2026-10-15 standing delegation):** Option 2 shared-copy deduplication and the authorised totalGrowth baseline update are applied. The 283 repeated display sentences are shared without changing their runtime text, placeholders or protocol tokens. Development-only gallery copy stays outside production output. `initialJsGzip` remains 290000; CSS, route, landing and render caps are unchanged. Only totalGrowth is rebaselined to base 790000 × ratio 1, recorded in budget history. This is the explicitly authorised ceiling, not a qualification or SLO.

Node 22.20.0 clean build: initial JS **289481**, CSS **4965**, total **789063**, largest route **28279** gzip bytes, 74 JS/CSS assets. Before deduplication the combined Node 22 output was 792978 total, over the authorised ceiling; after deduplication every size gate passes. The prior 633031 ceiling and failed round-1 measurements below are historical.

Korean gallery DOM snapshots and Korean visual baselines are refreshed for the intentional translations; English visual baselines remain identical. Pixel tolerances, viewport coverage, browser guards and existing tests are retained. Screenshot recording is separate from comparison evidence. Browser evidence remains local headless Chrome with vendored Korean fonts; real devices, live integration, human acceptance and production are unverified.

The glossary now preserves every word in its `<code>` cell while translating every explanation; a regression renders all glossary entries in Korean, and the browser check no longer exempts whole glossary rows. The earlier partial-locale notice is superseded because all registry bodies now use the display catalogue; its replacement preserves protocol terms and original data.

Validation also caught untranslated new glossary sentences, a translated glossary code cell, a catalogued `none` sentinel misclassified as prose, and development gallery copy included in production. Those failures were corrected; assertions, literal allowlist scope, pixel tolerance, coverage floors and CI remain intact. Parallel instrumented/browser attempts hit unchanged runner timeouts; successful final evidence uses sequential reruns.

Current validation (Node 22.20.0 for root typecheck/test/build/budget; Node 20.19.2 for browser harnesses, coverage and other local quality commands):

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS: adapter and web. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 65 files / 1335 tests; web 80 files / 1066 tests. The 5 live-gate files / 23 tests remain explicitly skipped, not passed. |
| `npm run build` / `npm run budget` | PASS: Node 22 initial JS 289481/290000, CSS 4965/5000, total 789063/790000, largest route 28279/30000 gzip bytes. |
| `npm run typecheck:e2e` | PASS. |
| `KIX_REQUIRE_GATE=0 KIX_E2E_NO_SANDBOX=1 npm run test:e2e` | PASS: 15 files / 54 tests in the sequential final rerun. |
| `KIX_E2E_NO_SANDBOX=1 npm run test:a11y` | PASS: final standalone full run, 15 files / 269 tests, including every Korean route, glossary explanations, normal/empty/unavailable/pending states, keyboard, gallery and reflow checks. |
| `KIX_E2E_NO_SANDBOX=1 npm run test:visual` | PASS: 3 files / 42 tests; 32 screenshots compared after separate recording and visual inspection. English baseline bytes match incoming main. |
| `KIX_E2E_NO_SANDBOX=1 npm run test:budget` | PASS: 3 files / 9 tests. |
| `node scripts/i18n-audit.mjs` | PASS: zero findings. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS with every existing floor retained: adapter lines/statements 91.22, functions 97.44, branches 84.59; web lines/statements 91.36, functions 76.86, branches 88.07. Values are coverage percentages, not product SLOs. |
| `npm run lint`, `npm run deps:check`, `npm run cycle-check` | PASS. |
| Marker scan / `git diff --check` / locked-bindings comparison | PASS: no markers or whitespace errors; bindings byte-identical to main. |

The manifest records 423 implementation/test/config files from the combined tree against the common base, SHA-256 `b1b8acd46f5a862c5751ce36683134509bd7c3a12ceed6e1d237ffb84c5053d8`. Documentation is excluded from that digest to avoid self-reference. All 78 conflict index entries are deliberately left unstaged for the supervisor; their working files have been resolved. Logs are scratch evidence under `/tmp/kix-merge-*.log` in this workspace. The literal audit reports zero findings. The locked bindings hash above matches incoming main; the restricted aiops trees, CI workflow, both OpenAPI pins, adapter package and production dependencies match incoming main. No stage, commit, merge/rebase/reset/checkout/push, external comment or ASTRA marker was issued.

## Historical PR fix round 1 — blocking review and size evidence

The following record describes reviewed implementation `f7cd60c565416094d55fcf41533a3c4c23877bf3` plus that earlier working tree. It predates the owner ruling and this merge resolution; its failed budget is not the current result.

The blocking finding is valid: the original total-growth limit was `floor(527526 × 1.2) = 633031`; the proposed rebaseline would have allowed `floor(774384 × 1.02) = 789871`. The revised base, ratio and history entry have been removed. At that round, every limit and the history equalled the source parent's configuration. The budget tests at that round required base 527526 and ratio 1.2. `baseline.localized` records an observation only and grants no headroom.

This fixes the configuration relaxation, but the requested overhead reduction and CI remain unresolved. With Node 22.20.0, the current build reproduces CI: initial JS **290543** against **290000**; CSS **4758** against **5000**; total **781123** against **633031**; largest route chunk **29372** against **30000**; 66 JS/CSS assets. The size command exits 1 for both the initial-JS and total-growth overages. Neither is waived. The browser split/render/fault tests are independent checks and do not override that failed size check.

The previous builder measured Node 20.19.2 initial JS 289267 and total 774384. Re-measuring the same assets with Node 22 reproduces the CI overage, so the earlier Node 20 size PASS is not CI evidence. A clean archive of the source parent rebuilt locally measured 288517 initial JS and 621730 total under Node 20; no parent source was changed.

Unsuccessful optimization experiments were run in scratch and discarded:

| Experiment | Observed result | Disposition |
| --- | --- | --- |
| Rollup unused-module elimination | Initial 169961, total 791473, largest chunk 35442 (Node 20 gzip bytes) | Total increased and a route chunk exceeded 30000; not retained. |
| Limit unused-module elimination to the adapter export barrel | Initial 169961, total 791556, largest chunk 35441 (Node 20) | Same failures; not retained. |
| More aggressive tree shaking | Total 791048, largest chunk 35440 (Node 20) | Failed; not retained. |
| Terser 5.44.0, scratch-only JS recompression | JS total fell from 786280 to 776395, before CSS (Node 20) | Still over 633031; no dependency or build change retained. |
| Separate eager English marketing labels from their Korean screen bundle | Initial 290308, total 781507 (Node 22) | Initial remained 308 over and total increased; not retained. |

These attempts do not prove further optimization impossible. They also do not justify changing the cap. No Vite configuration, application code, package manifest, lockfile, CI workflow or checker change survives this fix round. A scope or budget exception requires an owner decision; no exception has been applied.

## Historical validation record — PR fix round 1

Tools: Node 22.20.0, npm 11.21.0, installed lockfile dependencies, local Google Chrome, Vitest 3.2.7. All checks in this historical table used Node 22 except the standalone literal audit. Logs are local scratch evidence under `/tmp/kix-i18n-fix/`. The source was the reviewed implementation named in the historical section plus its then-uncommitted fixes; no new HEAD was claimed.

| Command actually run | Current result |
| --- | --- |
| `npm run build` | PASS, including adapter and web typechecks; existing large-entry warning. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 63 files / 1306 passed tests, 5 files / 23 tests explicitly skipped; web 62 files / 763 passed tests. Skipped live-gate cases are not passes. Includes the restored budget assertions and catalogue/audit tests. |
| `npm run test -w @kix/web -- test/bundle-budget.test.ts test/i18n-coverage.test.ts` | PASS: 2 files / 30 tests after the final budget metadata and evidence documentation update. |
| `node scripts/i18n-audit.mjs` | PASS: zero findings. |
| `npm run lint` | PASS. |
| `npm run typecheck:e2e` | PASS. |
| `npm run budget` | **FAIL (exit 1)**: initial JS 290543 > 290000; total 781123 > 633031. |
| `KIX_E2E_NO_SANDBOX=1 npm run test:budget` | PASS: 3 files / 9 browser split, chunk-failure and render tests. Does not waive the failed static size command. |
| `KIX_E2E_NO_SANDBOX=1 npm run test:a11y` | PASS: 10 files / 232 tests, including all Korean routes and normal/empty/unavailable/pending keyboard probes. |
| `git diff --check` | PASS. |

No protocol checkout, live gate, payment, production runtime, human acceptance, qualification or release was verified. The existing browser a11y suite covers all registry routes in Korean, normal/empty/unavailable/pending display, and keyboard behavior; its result is reported separately from the size failure. The 37-screen journey/a11y/evidence matrices are unchanged.

The locked bindings hash was rechecked as `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`, identical to the source parent. `git diff` against that parent is empty for locked bindings, both restricted aiops trees, CI, package manifests and lockfile. No forbidden node was implemented and no external message was sent.
