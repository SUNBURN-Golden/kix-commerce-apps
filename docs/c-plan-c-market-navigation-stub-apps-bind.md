# Resale market navigation — app-internal stub read state

`contract_change=NO`. This change preserves committed list search and pagination through the two existing resale market routes. It grants no protocol completion, production qualification, user acceptance, or release claim.

## Scope and file plan

- `apps/web/src/pages/ResaleMarket.tsx`: committed URL query/page, separate draft, matching settled response availability check, contextual product links.
- `apps/web/src/pages/ResaleProduct.tsx`: validated context and fixed return-to-results route.
- `apps/web/src/shell/market-read-state.ts`: narrowly scoped parser, canonical serializer, push/replace navigation. The generic `READ_STATE_VALUE`, identifier source-domain checks and exhaustive screen registry stay unchanged.
- `apps/web/src/i18n/messages/pages--Resale.ts` and `resale-market.ts`: combine existing resale copy in its grouped build-time locale template and add English/Korean cleanup feedback, preserving all prior display text.
- `apps/web/src/pages/ResaleMarketPanels.tsx`: share the existing list/detail read-status markup and read controls, preserving loading, error, NOT_BOUND and STALE semantics.
- `apps/web/test/market-read-state.test.tsx` and `apps/e2e/tests/journeys/resale-market.e2e.test.ts`: parser, mounted controller and actual browser regressions.
- This bind document records the plan, behavior, verification and limits. Adapter packages, CI, bundle budgets and program metadata are outside scope.

## Interfaces and URL contract

Both `/resale/market` and `/resale/market/:productId` accept only `lang`, `q` and `page`, serialized in that order with URLSearchParams encoding. Preserve exactly one valid `lang=en|ko` if supplied; omit absent language, empty query and default page 1. Query input is bounded to 100 JavaScript string units before trimming; Korean, ordinary Unicode and internal spaces round-trip. Trim outer whitespace without changing case or Unicode normalization. Reject control characters, lone surrogates and replacement characters. This is app read-input validation, not identifier or protocol command validation.

Duplicate query, oversized/invalid query: discard query and reset its dependent page to 1. Duplicate/empty/invalid page: page 1. Page syntax is canonical decimal positive safe integer (no signs, leading zeros, fractions, exponent notation or unsafe integers). Duplicate/invalid language and unknown parameters are dropped. Empty query and explicit page 1 normalize to defaults without an error notice. Hashes are removed. Invalid/unavailable context shows one localized notice after replacement cleanup; the history entry stores only a display-notice boolean, never trading evidence.

Submitting search commits query and page 1 atomically with PUSH. Pagination also PUSHes. Cleanup and unavailable-page recovery REPLACE. Draft input follows the committed query on URL visits, including back/forward between pages sharing a query. Editing alone changes neither URL nor read request. Fixed product routes encode the validated product identifier; product/return links reconstruct only validated read parameters and accept no return destination. No write intent, amount field, quote identity, operation ID or outcome is serialized. A user's search text remains opaque text with no execution authority.

A page is unavailable only when a CURRENT, settled list response matches both requested query and page, and page exceeds `max(1, ceil(total/pageSize))`. Recovery returns to page 1 with the query/language intact and the localized notice. Loading, error, STALE, NOT_BOUND or a foreign snapshot do not establish unavailability. A legitimate zero-result first page remains empty.

## Acceptance mapping

| Requirement | Evidence |
| --- | --- |
| Korean/English queries, Unicode/spaces, bounded/default/malformed parameters | Parser tests; bilingual browser search and malformed URL cases |
| Page two, product opening, fixed return link | Mounted route tests; both browser locales search `object` and `오브제` and open demo-003 |
| Reload and actual browser back/forward | Browser history/reload cases restore query, page, results and input; mounted page-only draft restoration |
| Unavailable page and localized persistent cleanup feedback | Matching-response mounted cases; bilingual page 999 and malformed URLs; product URL cleanup |
| No navigation submissions or network | Controller submit spy and browser fault-port dispatch counter stay zero; existing browser harness rejects external/non-GET/application network |
| Late reads across search-only and page-only transitions | Held real-hook reads released after a newer request cannot replace current results or reset current URL |
| UNKNOWN persists and blocks writes | Mounted lost-answer controller plus browser UNKNOWN scenarios navigate/search/reopen and retain one dispatch and disabled review |
| Existing identifier validation remains strict | Existing `read-state-params.test.ts` included in narrow run |
| Bundle limits and repository checks | Actual results below; no limits changed |

## Verification plan and execution

Use Node 22.20.0 by prefixing commands with `PATH=/tmp/kix-m05-node22/node_modules/node/bin:$PATH` (host default is Node 24). Browser commands use the repository Chrome harness, loopback only; `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1` where specified. No long job is shell-backgrounded. Commands with redirected logs still run as tracked foreground tool sessions.

Execution results are recorded below. The initial root-directory narrow command found no tests; rerunning from `apps/web` passed. A mistaken relative-path Python edit command also found no file, made no edit, and was rerun from the repository root. A focused browser invocation ran all ten marketplace cases successfully but exited 1 because the existing global teardown requires every journey matrix cell; the full suite is the authoritative browser check. The first full stub/coverage runs exposed the stricter 785,000-byte total gzip assertion; locale template/group reuse and shared read feedback address it without changing limits. Two intermediate budget probes were also used during size work. One premature budget invocation ran while `dist` was being rebuilt and reported missing index.html; subsequent completed-build budget checks passed. The first full browser run exposed an ambiguous card locator in the new UNKNOWN case (fixed by waiting for the committed single result), plus an unrelated receipts page/context closure; both were rerun. That first full browser command was bare `npm run test:e2e` with default Chrome discovery; later runs explicitly set the Chrome environment shown in the table. An intermediate full browser run hit an unrelated `/platform` reload timeout. A final-source visual rerun had 122 passes and one unrelated buyer-screen load timeout; the subsequent clean rerun passed all 123 tests, with no baseline or timeout changes. A concurrent coverage run hit two existing 5-second test timeouts (locale catalogue and credit-servicing pointers); the final coverage run is performed after the other heavy checks finish. No retry setting or CI check was weakened. Live-gate checks are skipped with `KIX_REQUIRE_GATE=0`, never counted as passed.

## Risks, locks and STOP conditions

Reuse `useResaleMarket` and its shared page-load controller without recreating or resetting it. Its input-key effect cleanup invalidates the controller generation for search/page transitions even though the global navigation observer watches pathname only. Reads do not clear UNKNOWN. URL reload restores read state only: a fresh page load starts a fresh synthetic demo, persists no synthetic trading evidence and replays no request.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce. `commerce-bindings.ts` must remain byte-identical: baseline Git blob `47ab5e10cbf5f8f10bed718b4dd5190fe5dfe76f`. No protocol pin/catalogue/gate change is consumed. No new binding, command, capture sequence or desk-body remapping is introduced.

README fail-closed restrictions remain: stub default; explicit loopback `http://127.0.0.1` HTTP only; one attempt; no retries, Idempotency-Key, redirects, stub fallback, gate proxy or component fetch; truth/production flags false. No funds, live marketplace, real payment/KYC/credit/admission, secrets, public deployment, SLO or copied protocol math.

Source discrepancy: this checkout's `.aiops/program.json` contains 60 nodes and lacks this node, whereas the supplied instruction describes an 18-node executable program. Follow only this expressly authorized standalone node scope. Do not dispatch anything from pending/draft catalogues or edit metadata. The explicit Constraints section determines this document's `c-plan-c-...` path despite the shorter path in Objective.

STOP and create root `DECISION_REQUIRED.md` if completion requires an unmerged producer contract/dependency, hardware, money, paid services, secrets, production runtime, product-policy decision, new protocol command or crossing any locked rule. None is required for app-internal read navigation. No signer, ASTRA marker, issue, PR, comment, commit or push is part of this work.

## Command evidence

All npm/npx verification below uses the Node 22 PATH prefix stated above. Counts and final outcomes are filled from completed runs; no skipped live gate is presented as passing.

| Command | Result |
| --- | --- |
| `npm ci` | PASS; 535 packages installed. npm reported 24 development-inclusive audit findings; no dependency/lockfile changes made. |
| Root `npx vitest run --config apps/web/vitest.config.ts apps/web/test/market-read-state.test.tsx apps/web/test/resale-market.test.tsx apps/web/test/read-state-params.test.ts` | Exit 1: incorrect root for the workspace-relative include patterns, no tests found. |
| In `apps/web`: `npx vitest run test/market-read-state.test.tsx test/resale-market.test.tsx test/read-state-params.test.ts` | PASS, 3 files / 48 tests after both search-only and page-only race regressions. |
| In `apps/e2e`: `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npx vitest run tests/journeys/resale-market.e2e.test.ts` | 10 tests passed; overall exit 1 from mandatory full-matrix teardown (unselected cells missing). |
| `npm run typecheck` | PASS (adapter and web). |
| `npm run build` | PASS; repeated after size reductions. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 1,981 passed / 23 skipped; web 1,443 passed; cold entry 6 passed. Earlier run: 1 web size assertion failed (785,428 > 785,000); other 1,442 web tests passed. |
| `npm run typecheck:e2e` | PASS. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:e2e` | PASS on final source/bundle: 48 files / 211 tests. Earlier runs: 209 passed / 2 failed (card wait and receipts closure), then 210 passed / 1 failed (unrelated platform reload timeout). |
| `npm run budget` | PASS, total gzip 784,977; initial JS 160,224; initial CSS 4,974 bytes. Both the stricter 785,000-byte test ceiling and unchanged configured limits are satisfied. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:budget` | PASS, 3 files / 9 tests. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:a11y` | PASS on final source/bundle, 21 files / 394 tests (both runs passed). |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:visual` | PASS on final source/bundle, 3 files / 123 tests; no baseline edits. Intermediate buyer load timeout was rerun cleanly. |
| `npm run lint` | PASS. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS, all floors met. Adapter: lines/statements 91.57%, functions 97.78%, branches 85.57%; web: lines/statements 93.85%, functions 84.87%, branches 90.18%. Earlier size assertion and concurrent test timeouts were rerun cleanly; no floor changed. |
| `npm run deps:check` | PASS, 4 package manifests / 630 lockfile entries. |
| `npm run cycle-check` | PASS, no cycles in adapter/web/e2e. |
| `npm run audit:warn` | PASS, production dependency audit reported 0 vulnerabilities. |
| `git diff --check` | PASS. |
| Node/TypeScript AST comparison against both HEAD resale catalogues | PASS: all 96 existing localized entries preserved exactly; only two cleanup messages added. |
| `git hash-object packages/protocol-adapter/src/commerce-bindings.ts` | Unchanged `47ab5e10cbf5f8f10bed718b4dd5190fe5dfe76f`; protected-file diff empty. |

Deviations: the supplied design was exploratory; this document supplies the six requested plan sections. Kept market validation separate rather than expanding `READ_STATE_PARAMS`. Reused the existing grouped resale locale template and shared read feedback to meet the stricter existing startup test as well as the configured budget. Used the constraint-mandated bind filename. Existing Vite circular-chunk and Node listener warnings are recorded as warnings, not hidden or repaired by changing CI. Live-gate and real-service qualification remain unrun/skipped.

Final result: all required local checks passed on Node 22.20.0. Browser journeys, accessibility, visual checks and browser budget checks passed on the final source. The live gate remains skipped, and no real-service qualification is claimed. All changes are limited to the permitted app/test/bind-document scope. No commits, pushes or GitHub writes were performed.
