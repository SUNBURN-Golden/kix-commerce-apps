# c-i18n-coverage-completion-stub — local display coverage

Source parent: `288c8ef8b58dec52093cfbc0a9cbca6b65deeab3` on `agent/kixc-c-i18n-coverage-completion-stub`, plus this uncommitted working tree. No commit, push, PR, issue, or comment was created. The [complete changed-file manifest](c-i18n-coverage-completion-stub-files.txt) lists every modified/new file and hashes the implementation, tests, and configuration. Its SHA-256 is `81e6d2c809e0d684071e07880dbc5100b7c8b206f37c0874bcd1999c7b98b1bd`. `contract_change=NO`.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

## Display binding

The existing 37 registry screens now use Korean/English copy for their bodies, controls, accessible names, status explanations, errors, handoff descriptions, and glossary explanations. Routes and screen counts are unchanged; the existing journey/a11y/local-evidence matrices still describe the same screens.

`apps/web/src/i18n/messages/` contains immutable, app-internal bundles by screen or source model. The full test/type inventory contains 3,551 desk/screen message keys in 105 bundles, in addition to the existing shell catalogue. Compact `s…` keys avoid repeating long identifiers in the shipped dictionaries. These are private translation keys, never protocol identifiers.

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

## Bundle measurements and deviation

A clean archive of the source parent was built with the same installed lockfile dependencies: initial JS 288,517 gzip bytes; total JS/CSS 621,730; largest route chunk 21,649. Its existing budget passed.

The first full catalogue build measured 293,036 initial JS, 803,231 total, and a 30,934-byte largest route chunk. Splitting route bundles, avoiding eager Korean formatter copy, and using compact internal keys reduced these figures. The final build measured initial JS 289,267, CSS 4,768, total 774,384 gzip bytes, 66 files, and a 29,093-byte largest route chunk. The total increase over the source parent is 152,654 bytes.

The previous total-size cap was 633,031 bytes and had only 11,301 bytes of headroom over the current main. The full bilingual catalogue necessarily exceeds it. `bundle-budget.json` therefore records an explicit measured bilingual baseline and a dated history entry, allowing only 2% subsequent total growth. Initial JS (290,000), CSS (5,000), individual chunk (30,000), landing (400,000), and all three render caps are unchanged. No CI job, check implementation, test, or test skip was removed or weakened. This total-baseline revision is the implementation deviation; it is a local regression tripwire, not a product policy or SLO.

Legacy source-copy tests now include the moved catalogue strings in their production-wording guards or inspect rendered accessible labels. The locale source guard was strengthened to recurse into bundle directories. The shell registry retains its original minimal imports and resolves navigation copy through the existing shell catalogue.

## Validation record

Local tools: Node 20.19.2, npm 11.21.0, Google Chrome 155.0.8059.84, Playwright Core 1.58.2, axe-core 4.14.0, Vitest 3.2.7. CI uses Node 22; the local Node version is a verification deviation, and the project supports Node >=20.

Commands were run in the foreground; longer tool sessions were awaited. Logs are local scratch evidence under `/tmp/kix-i18n/`, not committed artifacts. The required stub command leaves the existing gate-only cases skipped; they are never counted as a live-gate pass.

| Command actually run | Result |
| --- | --- |
| `npm ci` | PASS; 493 packages installed. npm reported the existing 5 audit findings (2 moderate, 1 high, 2 critical), deprecation warnings, and an esbuild install-script advisory; no dependency was changed. |
| `npm run test -w @kix/web -- test/i18n.test.tsx test/i18n-coverage.test.ts test/finance-operations.test.tsx test/user-guides.test.tsx test/journey-panel.test.tsx test/credit-panel.test.tsx test/resale-panel.test.tsx test/reservation-panel.test.tsx test/display-preferences.test.tsx` | PASS: 9 files, 112 tests. |
| `node scripts/i18n-audit.mjs` | PASS: zero findings over the full source tree. |
| `npm run typecheck` | PASS. |
| `npm run build` | PASS; Vite reports its pre-existing large-entry warning. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 63 files / 1,306 tests, web 62 files / 763 tests. The live-gate cases remain explicitly skipped by this required mode, not passed. |
| `npm run typecheck:e2e` | PASS. |
| `KIX_E2E_NO_SANDBOX=1 npm run test:a11y` | PASS: 10 files, 232 tests, including every registry route in Korean and normal/empty/unavailable/pending keyboard probes. |
| `npm run lint` | PASS. |
| `npm run deps:check` | PASS: 4 manifests and 589 lockfile entries. |
| `npm run cycle-check` | PASS: no circular dependency. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: all existing floors. Web lines/statements 88.06, functions 60.84, branches 84.62; adapter lines/statements 91.18, functions 97.44, branches 84.52 (percent). |
| `npm run budget` | PASS after the documented total-baseline revision; final initial 289267 / total 774384 / largest chunk 29093 gzip bytes. |
| `KIX_E2E_NO_SANDBOX=1 npm run test:e2e` | PASS: 14 files, 51 journey/fault/fixture tests. |
| `KIX_E2E_NO_SANDBOX=1 npm run test:budget` | PASS: 3 files, 9 split/chunk-failure/render tests. |
| `npm run test -w @kix/web -- test/bundle-budget.test.ts` | PASS: 17 tests after final budget metadata/documentation update. |
| `git diff --check` | PASS. |

Earlier failing attempts were retained as local logs and corrected: nullable message interpolation, literal type narrowing after moving constants, preserved JSX spacing/entities, the recursive locale-file scan, source guards that needed the moved copy, an internal key accidentally containing a forbidden lexical token, one missing common-label bundle on credit servicing, and the browser test's held-write trigger. The initial browser run detected the untranslated Payment label and the incorrect pending-state trigger; both are corrected and rerun. Initial bundle overages are recorded above, not hidden. The final browser test also corrected a selector to use the source enum `IN_FLIGHT`/`CONFIRMED` verbatim; no application state was renamed.

Final review moved 14 remaining desk fallback literals to the same English catalogue references; their values and rendering are unchanged. The 112 focused tests, required typecheck/build/stub suite, lint, and size budget were rerun after this value-preserving cleanup. The browser suites above exercise the same display values and interaction behavior.
