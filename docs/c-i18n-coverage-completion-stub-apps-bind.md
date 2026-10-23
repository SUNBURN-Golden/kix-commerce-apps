# c-i18n-coverage-completion-stub — local display coverage

Source parent: `288c8ef8b58dec52093cfbc0a9cbca6b65deeab3`. Reviewed implementation HEAD: `f7cd60c565416094d55fcf41533a3c4c23877bf3`, plus this PR fix round 1 working tree. The [complete changed-file manifest](c-i18n-coverage-completion-stub-files.txt) records the feature and fixes against the source parent. No commit, push, PR, issue or comment was created during this fix round. `contract_change=NO`. Current outcome: **DECISION_REQUIRED**, because the original size gate still fails; see [the root decision record](../DECISION_REQUIRED.md).

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

## PR fix round 1 — blocking review and size evidence

The blocking finding is valid: the original total-growth limit was `floor(527526 × 1.2) = 633031`; the proposed rebaseline would have allowed `floor(774384 × 1.02) = 789871`. The revised base, ratio and history entry have been removed. **Every current limit and the history equal the source parent's configuration.** The repository budget tests again require base 527526 and ratio 1.2. `baseline.localized` records an observation only and grants no headroom.

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

## Validation record — PR fix round 1

Tools: Node 22.20.0, npm 11.21.0, installed lockfile dependencies, local Google Chrome, Vitest 3.2.7. All current checks below use Node 22 except the standalone literal audit. Logs are local scratch evidence under `/tmp/kix-i18n-fix/`. The source is the exact reviewed HEAD above plus the uncommitted configuration/test/documentation changes in the manifest; no new HEAD is claimed.

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
