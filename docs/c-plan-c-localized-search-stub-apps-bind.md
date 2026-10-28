# Localized synthetic discovery search

Scope: `c-plan-c-localized-search-stub`, implemented from the user-supplied node specification and reviewed design at baseline `2b646c95a20b875c31cf1ae1c10752bdcad57693`. This is a local builder session, not ASTRA program execution. No dispatch, manifest reconciliation, GitHub action, commit, or push is performed. The design's manifest discrepancy remains a supervisor concern before any program dispatch or reconciliation; no pending/draft node is consumed here.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce

The existing [Wave 6 gate record](https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343) and `kix-protocol` `docs/decisions/PROGRAM_ROADMAP_20260930.md` remain context only. No protocol catalogue, gate, SDK, receipt, or pin change is consumed.

## Index and matching

`discovery/search-index.ts` builds one shared index over the 360 materialized `DISCOVERY_FIXTURE` rows. Each entry retains the original row ID and deduplicated title/venue labels. Labels come from the English originals and `deskText(makeScreenTranslate(locale, fixtureCopy), label)` for both `ko` and `en`, including the generated `p.t134` title template. Only the fixture message bundle is imported, not the aggregate screen catalogue.

Human labels and the trimmed search needle use NFC, locale-independent `toLowerCase()`, and NFC again. Matching is literal substring matching with the existing sort order. IDs use a separate verbatim substring check, retaining exact IDs and searches such as `resale`; IDs, command fields, rows, and user query text are never rewritten. No fuzzy matching, regex query, transliteration, ranking, query cache, or storage key is introduced.

Only `FIXTURE_IDS.cancelled` receives a family alias derived from the existing `sq5` Lanterns title. Its displayed singular title remains “Cancelled lantern reprint” / “취소된 등불 재인쇄”. Thus `등불`, `Lanterns`, and decomposed Hangul return the same five IDs in order:

1. `syn-event-lanterns`
2. `syn-event-cancelled`
3. `syn-seat-sample`
4. `syn-ga-sample`
5. `syn-resale-sample`

Explicitly supplied rows receive an ephemeral index unless the caller supplies one. The default workspace uses the shared index. The separate synthetic projection reader and million-row scale count/window remain outside this index; search never enumerates `scaleRowAt`.

## URL, locale, and purchase behavior

Existing query fields, URL keys, routes, filters, conflict handling, sorting, page sizes, and out-of-range page behavior are preserved. The original query, including NFD text and whitespace, survives URL serialization. Existing draft handling, reload, browser history, and detail/back navigation need no changes. Locale changes only the display; matching, result IDs, ordering, and page do not depend on the active locale. Existing `lang` startup and `kix-locale` behavior remains intact.

The existing catalogue read lifecycle and `resolvePurchase` are unchanged. Cancelled, sold-out, unlinked, seat, and GA rows still have no booking link; resale stays not-bound. A stale row still displays `STALE` and retains its existing booking link when its event is in the ready catalogue. A not-bound catalogue grants no booking link. Search and locale changes trigger no further catalogue/projection reads and no writes.

## Acceptance evidence

| Acceptance | Tests |
| --- | --- |
| Exact five bilingual Lanterns rows; English case and query whitespace; NFC/NFD equivalence | `discovery-search.test.ts`, browser discovery journey |
| All displayed title/venue labels, generated titles, and all four translated venues | `discovery-search.test.ts`, `discovery-page.test.tsx` |
| Exact/verbatim IDs, literal matching, immutable rows and URL text | `discovery-search.test.ts`, `discovery-model.test.ts` |
| Empty/no-match, combined filters, all filter categories, conflicts, sizes 10/20/50, page reset/bounds | `discovery-search.test.ts`, `discovery-model.test.ts`, browser discovery journey |
| Reload, history, detail/back, ko/en/ko, stable IDs/order/page | browser discovery journey; `discovery-search-live.test.tsx` |
| Cancelled, stale, resale, seat, GA, sold-out, unlinked and not-bound catalogue restrictions | `discovery-page.test.tsx`, browser discovery journey |
| No extra catalogue/projection reads, no commands or remote queries | `discovery-search-live.test.tsx` spies, discovery source-boundary check, browser network ledger and `suite.quiet` before reload |
| Index is exactly 360 entries; no scale entries or generator calls; bounded scale windows retained | `discovery-search.test.ts`, existing scale tests in `discovery-model.test.ts` |

## Verification commands and results

Local commands use Node `v22.20.0` through `PATH=/tmp/kix-node22/node_modules/node/bin:$PATH`. Browser commands use `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1` (Chrome `156.0.8078.47`). Final repeat logs and enabled machine records are kept in `/tmp/cplan-search-evidence/` for this workspace session; temporary files are not versioned evidence. Tables record command results, including failed development attempts.

| Command actually run (after the environment prefix above) | Result |
| --- | --- |
| `npm ci` | Passed first on Node 20, then repeated and passed on Node 22; install audit reported 5 development-inclusive findings. No lockfile change. |
| `npm exec -w @kix/web -- vitest run test/discovery-search.test.ts test/discovery-model.test.ts test/discovery-page.test.tsx` | Passed: 3 files, 27 tests. |
| `npm exec -w @kix/web -- vitest run test/discovery-search-live.test.tsx test/discovery-live.test.tsx test/discovery-search.test.ts test/discovery-model.test.ts test/discovery-page.test.tsx` | Two development failures from invalid spies, then passed: 5 files, 38 tests. |
| `npm run typecheck` | Initial invalid-spy type error; passed after correction. |
| `npm run build` | Initial invalid-spy type error; passed after correction. |
| `KIX_REQUIRE_GATE=0 npm test` | Passed: adapter 70 files / 1,659 tests; 5 files / 23 live-gate tests skipped. Web 92 files / 1,280 tests; cold entry 1 file / 6 tests. |
| `npm run typecheck:e2e` | Passed. |
| `npm run budget` | Passed with unchanged caps: initial JS 161,453, CSS 4,974, total 782,010 gzip bytes; largest chunk 28,279; Discovery route 7,161. |
| `npm run lint` | Passed. |
| `npm run deps:check` | Passed: 4 manifests, 630 lockfile entries. |
| `npm run cycle-check` | Passed: no cycles in adapter, web, or e2e. |
| `node scripts/i18n-audit.mjs` | Passed: 0 findings. |
| `npm run audit:warn` | Passed: production audit found 0 vulnerabilities. |
| `npm exec -w @kix/e2e -- vitest run tests/journeys/discovery.e2e.test.ts` | Diagnostic runs exposed two premature render assertions, now fixed. Final focused run: all 5 tests passed; exit 1 because the global teardown deliberately requires the full journey matrix. Not a full-suite pass. |
| `npm run test:e2e` | First full run exposed the new test's premature page capture. Second full run: 195/197 tests passed, including both new journeys; two existing tests timed out while overlapping host events (72,331 ms loop stall; wall-clock jump 2,019,686 ms). Third full run: 196/197 passed; existing merchant timeout overlapped host events (33,675 ms loop stall; wall-clock jump 283,826 ms). Fourth full run passed: 47 files / 197 tests, complete matrix teardown, zero non-loopback/non-GET/application network calls. |
| `npm run test:a11y` | First run: 361/363 passed, two existing gallery timeouts overlapped host events. Full repeat passed: 17 files / 363 tests, keyboard facet 85/85. |
| `npm run test:budget` | First run: 8/9 passed; one 20,861 ms cold load overlapped an 18,218 ms host stall. Full repeat passed: 3 files / 9 tests, unchanged caps. |
| `npm run test:visual` | Passed: 3 files / 109 tests against unchanged committed baselines. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | First run failed with 3 existing web-test timeouts during an overlapping run. Sequential rerun passed all tests and all floors: web lines/statements 92.97%, functions 81.30%, branches 89.36%. |
| `git diff --exit-code 2b646c95a20b875c31cf1ae1c10752bdcad57693 -- .aiops/ docs/aiops/ packages/ .github/ package.json package-lock.json apps/web/bundle-budget.json apps/e2e/visual-baselines/` | Passed: all listed protected boundaries unchanged. |
| `git diff --check` | Passed. |

Final browser records: `browser-record-complete.json` (journeys), `a11y-record-final.json`, `budget-record-final.json`, and `visual-record.json` under `/tmp/cplan-search-evidence/`. All four report zero non-loopback requests, non-GET requests, and application network calls. Full-suite results supersede focused diagnostics; all requested local CI equivalents pass. Repeated E2E typecheck and lint also passed after the final browser-test corrections. Protected-path comparison and whitespace checks were repeated at handoff.

## Boundaries, deviations, and unverified work

No adapter, transport, protocol pin, CI, dependency, budget, baseline, `.aiops/`, or `docs/aiops/` change. `packages/protocol-adapter/src/commerce-bindings.ts` remains byte-identical to the baseline. The default remains stub, with all existing fail-closed transport and false production/truth claims intact. No command, remote search, real payment, real KYC, disbursement, venue scanning, bank rail, marketplace, public deployment, or SLO is added. Price, fee, currency, and retention policies remain `UNDETERMINED`.

Implementation follows the design. One extra discovery DOM test file isolates read/write spies from server-rendered page tests. No page or locale-provider correction was needed. The initial `npm ci` used the shell's Node 20; it was repeated successfully with Node 22 before verification. During test development, spies for nonexistent `rebuildProjection` and `invokeLocalCall` members failed; the test now observes existing catalogue/projection reads and desk write methods. The initial typecheck/build caught the latter test error and were rerun after correction.

Browser tests must wait for rendered results in addition to URL changes because React navigation renders in a transition. Two initial assertions observed the previous result page or empty state too early; they now poll the rendered IDs/counts. No application behavior or test timeout was changed. Full-suite repeats address measured host interruptions without weakening gates.

Live integration-gate tests are skipped with `KIX_REQUIRE_GATE=0`, not reported as passed. No credentials or sibling protocol checkout are required. Hosted CI at a committed HEAD, independent review, protected receipts, user acceptance, production qualification, and release remain outside this local builder's evidence.
