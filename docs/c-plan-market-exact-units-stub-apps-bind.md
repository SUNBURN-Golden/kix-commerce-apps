# Exact mock-unit input range (stub)

## Scope, provenance and rulings

Standalone node `c-plan-market-exact-units-stub`, baseline `a12df77dba5d5690f922476868eb6e7fccd755fe`, branch `agent/kixc-c-plan-market-exact-units-stub`. This is an app-local form correction, **contract_change=NO**. Implementation is ready for the supervisor's exact-head CI; browser acceptance requires that CI to be fully green and is not claimed by local checks.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce

The journey still ends at `accept_trade`; `capture` and `settle_capture` are never composed or sent. `commit_trade`, `open_admission` and `admit` stay uncomposed. `placeHold` stays not-bound with considered action `reserve_listing`. Nothing in this node changes those decisions or consumes a protocol catalogue/gate change; no pin update is needed.

The owner ruling JunTae 2026-11-09 14:10 KST authorizes raising only exceeded bundle caps in the existing budget file and requires fully green exact-head GitHub Actions as the browser runner. The earlier bundle stop is superseded. The final implementation fits every existing cap, so **no cap increase is needed or made**. See the measured comparison below. The supervisor handles Git/GitHub and the exact-head CI run; this builder has not committed, pushed, opened a PR, dispatched a workflow, posted a comment or written an ASTRA marker.

Source discrepancies: the Objective names `docs/market-exact-units-stub-apps-bind.md`; this document follows the explicit Constraints path, `docs/c-plan-market-exact-units-stub-apps-bind.md`. This checkout's `.aiops/program.json` contains **60 nodes**, not the supplied context's 18, and does not contain this node. The explicitly supplied standalone node specification authorizes this work; no pending/draft node is implemented. `.aiops/**`, `docs/aiops/**`, `PENDING_NODES.json` and `KIX_COMMERCE_PROGRAM_DRAFT.json` stay untouched. This uses the provenance treatment in [market intent validation](c-plan-market-intent-validation-stub-apps-bind.md).

## Form grammar and string flow

This document supersedes the historical sentence in [resale market UI, Syntax boundary](c-plan-c-resale-market-ui-stub-apps-bind.md) stating that the form uses safe-integer validation and limits input to 15 digits. Bid/ask now use `kind: "mockUnits"`. Both the rule's `maxLength: 15` and the input's `maxLength={15}` are removed. No native length limit replaces them: invalid bulk input is retained for validation instead of silently submitting truncated digits. The input remains textual with `inputMode="numeric"`.

The form grammar matches existing `canonicalUnits`: `0` or a nonzero-leading ASCII integer through 30 digits (`/^(0|[1-9][0-9]{0,29})$/`). Validation shares the existing integer syntax expression and checks mock-unit string length; it never takes the `Number` branch for mock units. Shared required/optional handling remains. Leading zeros, signs, decimals, exponent notation, commas, underscores, spaces, Unicode digits and 31+ digits are refused. There is no amount normalization, slicing, parsing or numeric conversion. Safe-integer, positive-integer and booking-quantity rules retain their prior behavior. A fixed corpus checks form/model grammar parity and isolation from the other integer rules.

Following the design review, the rule reuses existing `validation.integer` copy with no new catalogue keys or placeholders:

- en: “Enter a whole number using digits only (0 or greater).”
- ko: “숫자로 된 0 이상의 정수를 입력하세요.”

`preview()` preserves `{ kind: "bid" | "ask", productId, variantId, expectedVersion: number, mockUnits: string }`; confirmation passes that request to the existing submit action exactly once. Offers preserve `offerId`, `productId`, `variantId`, `side`, the exact `mockUnits` string and `state: "open"`. Existing `formatUnits` preserves string digits in review and offer display. Instant actions still use `quoteId` and their existing rules. Routes and IDs remain `/resale/market/:productId`, `market-trade-form`, `market-units`, `market-outcome` and `market-offers-rows`.

## Bundle comparison and design deviations

The clean baseline was independently rebuilt under Node 22.20.0 during this continuation, temporarily restoring only the two runtime files and restoring the draft in a `finally` block. Both unchanged entry-import assertions passed; baseline total JS/CSS gzip was **784,915** bytes. The inherited direct-helper attempt measured 785,337, and its app-local regex fallback measured 785,089. Reusing the integer syntax check and simplifying the private issue helper's default parameter keeps final total at **784,968**. Speculative panel formatting/read refactors were discarded; the panel has only the two required form changes.

| Measure / cap | Clean baseline | Final measured | Old cap | New cap |
| --- | ---: | ---: | ---: | ---: |
| Initial JS, strict entry assertion | 160,179 | 160,179 | 282,000 | 282,000 |
| Initial JS, budget file | 160,179 | 160,179 | 290,000 | 290,000 |
| Initial CSS | 4,974 | 4,974 | 5,000 | 5,000 |
| All emitted JS/CSS, strict entry assertion | 784,915 | 784,968 | 785,000 | 785,000 |
| Total growth base, budget file (ratio 1) | 784,915 | 784,968 | 790,000 | 790,000 |
| Largest lazy JS chunk | 27,516 | 27,516 | 30,000 | 30,000 |

Cap disposition reason: **owner ruling JunTae 2026-11-09** permits a minimal increase only for exceeded caps; the final measured build exceeds none. Every cap, assertion, CI gate, timeout and budget configuration stays unchanged. `npm run budget` also checks the unchanged landing limit.

Deviations from the initial plan: use the authorized app-local grammar with a parity test instead of importing the model runtime into all form chunks; reuse existing bilingual integer copy instead of adding `validation.mockUnits`; use the Constraints document path; use exact-head GitHub Actions for browser execution under the later owner ruling. The a11y test extends the existing `a11y.resale-market.ime` observation to both locales; it adds no check ID or registry keyboard drive, so matrices and denominators are unchanged.

## Acceptance mapping

| Requirement | Implemented checks and evidence limits |
| --- | --- |
| Exact `0`, 16, 29 and 30 digits | Mounted and browser tests parameterize bid/ask and ko/en with `0`, `9007199254740993`, `12345678901234567890123456789`, `999999999999999999999999999999`. Mounted checks assert draft, locale changes, back-to-edit, literal review text, zero sends at review, one send per confirm, exact request, confirmed state, stored offer and literal offer display. `formatUnits` is independently compared to the raw digit string plus label. Browser checks additionally inspect detached request/result snapshots and all synthetic/false claims. |
| Full syntax and no truncation | Parity corpus includes zero, 1 digit, all required long boundaries, empty/blank, leading zeros, signs, decimal/exponent syntax, comma/underscore/space separators, surrounding spaces, Unicode digits, 31 and 100 digits. Mounted checks retain drafts/source state and send nothing on refusal. Browser checks use bulk `insertText` and a separately typed 31st digit; no `maxlength` is allowed. |
| ko/en errors and focus | Mounted tests check exact inline copy, `aria-invalid`, `aria-describedby`, summary focus on deliberate refusal, error-link field focus, blur without focus theft and correction clearing. Browser a11y extends this with locale switching while retaining an invalid draft and Tab/Enter from summary link to units. |
| IME | DOM tests cover valid 30-digit drafts under key-first/end-first/229 confirmation and repeated Enter suppression. Invalid Korean preedit defers error until end/blur. Browser a11y exercises CDP preedit, all three injected confirmation orders with 30 digits, no review/dispatch during confirmation, and a fresh deliberate Enter. Native OS IME acceptance remains unverified. |
| Keyboard review and confirm | Browser a11y tests both locales: Enter from the 30-digit draft opens/focuses review; Tab/Enter returns to edit; digits survive locale changes in review; Tab reaches confirm; Enter and Space each confirm once. |
| UNKNOWN, stale, offline and duplicates | New browser scenarios use 30 digits with held responses (duplicate keys send once), explicit stale rejection, lost response (UNKNOWN survives read/navigation/reconnect), and offline/reconnect (no send/replay). Existing guard and HTTP NOT_BOUND tests remain unchanged. |
| Other forms and regressions | Integer isolation tests and the full local stub/coverage suites verify existing rules and guards. Exact-head CI/browser results remain a separate supervisor gate. |

The dispatch probe exists only behind `window.__kixResaleFault` in the fault-build fixture. Normal mode and detached request/result snapshots are test-only. The fixture is excluded from the existing e2e tsconfig, so it also received an explicit temporary-config TypeScript check and a fault-build compile check. No product port/controller, package, `apps/web/src/resale-market.ts` or protocol binding changes.

## Continuation command ledger

Commands ran at the repository root. Node 22 commands used `PATH=/tmp/kix-exact-node22/node_modules/node/bin:$PATH`; temporary tools/configs/logs live outside tracked files. Logs use `/tmp/market-exact-resume-*.log`. The initial environment was Node 24.22.1; `npm install --prefix /tmp/kix-exact-node22 --no-package-lock --no-audit --no-fund node@22.20.0` installed the matching local CI runtime (exit 0), without changing repository dependencies.

| Command | Result |
| --- | --- |
| `npm ci` (initial missing old Node-22 PATH, actually Node 24) | Exit 0; 535 installed; npm reported 14 development-inclusive audit findings (11 moderate, 1 high, 2 critical). |
| `npm ci` (Node 22.20.0) | Exit 0; clean install; same 14 development-inclusive findings; dependencies/lockfile unchanged. |
| `npm exec -w @kix/web -- vitest run test/form-validation.test.tsx test/form-ime.test.tsx test/resale-market.test.tsx` | Exit 0, 70 tests. Repeated on final source; final full suite also covers the strengthened literal-format assertion. |
| `npm run build` | Exit 0 on each of the three intermediate implementations and final implementation. Existing circular-chunk warning retained. |
| `npm exec -w @kix/web -- vitest run test/entry-import-graph.test.ts` | Intermediate failures at 785,008 and 785,021 bytes (1 passed / 1 failed). Clean baseline rerun passed 2/2 at 784,915. Final rerun passed 2/2 at 784,968. |
| `npm exec -w @kix/web -- vitest run test/entry-import-graph.test.ts test/form-validation.test.tsx test/form-ime.test.tsx test/resale-market.test.tsx` | Intermediate failure at 785,091: 71 passed / 1 failed; only emitted-total assertion failed. |
| `npm exec -w @kix/web -- vite build` then `npm run budget` | Every command exited 0. Clean baseline: 784,915. Intermediate variants: 785,028, 785,035, 785,037, 785,019, 784,968, 784,988, 785,095. All configured budgets passed; only variants below 785,000 meet the stricter test. Final code selects the simpler shared grammar/default-parameter variant at 784,968. No budget or minifier changes. |
| `npm run typecheck` | Exit 0 (initial and final), adapter and web. |
| `npm run typecheck:e2e` | Exit 0 (initial and final). |
| `node_modules/.bin/tsc --noEmit --project /tmp/market-exact-fixture-tsconfig.json` | Initial temporary config exited 2 because `/tmp` did not resolve node/vite types. Corrected temporary config uses absolute existing type paths: exit 0, including the test-only resale fixture. No repository tsconfig changes. |
| `node_modules/.bin/vite-node /tmp/market-exact-fault-build.ts` | Initial runner exited 1 because its default root could not resolve the `/tmp` entry. Reran the same temporary entry inside `apps/e2e`, removed in `finally`: exit 0. Builds `buildShellFaultApp()` and immediately cleans up; launches no browser. |
| `npm run budget` (final build) | Exit 0; initial JS 160,179; CSS 4,974; total 784,968; largest chunk 27,516 gzip bytes. |
| `npm run lint` | Exit 0 (initial and final). |
| `npm run deps:check` | Exit 0; 4 manifests / 630 lock entries checked. |
| `npm run cycle-check` | Exit 0; no circular imports. |
| `npm run audit:warn` | Exit 0; production dependency audit found 0 vulnerabilities (warning-only command). |
| `KIX_REQUIRE_GATE=0 npm test` | Exit 0; adapter: 75 files / 2,298 passed, 5 files / 23 gate-dependent tests skipped; web: 105 files / 1,510 passed plus 6 cold-start tests passed. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | Exit 0; every existing floor met. Adapter lines/statements 91.61%, functions 97.79%, branches 85.77%; web lines/statements 94.06%, functions 86.22%, branches 90.43%. |
| `git diff --check` | Exit 0. |
| `git diff --no-index --check /dev/null docs/c-plan-market-exact-units-stub-apps-bind.md` | Expected new-file difference exit 1, no whitespace diagnostics. |
| Protected-path diff and locked-binding hashes (commands below) | Exit 0; all protected paths unchanged; binding hash matches baseline. |

No local `test:e2e`, `test:a11y`, `test:budget` or `test:visual` invocation is claimed. The owner explicitly assigns the browser runner to GitHub Actions exact-head CI. Those full suites, their mandatory matrix teardown and visual comparison remain **PENDING** supervisor CI, not skipped-as-passed or replaced by focused subsets. Live-gate-dependent skips under `KIX_REQUIRE_GATE=0` remain skips, not passes.

## Protected-file comparison

```bash
git diff a12df77dba5d5690f922476868eb6e7fccd755fe --exit-code -- packages .aiops docs/aiops .github package.json package-lock.json apps/web/bundle-budget.json apps/web/test/entry-import-graph.test.ts apps/web/src/resale-market.ts
git hash-object packages/protocol-adapter/src/commerce-bindings.ts
git rev-parse a12df77dba5d5690f922476868eb6e7fccd755fe:packages/protocol-adapter/src/commerce-bindings.ts
```

Both binding hashes: `47ab5e10cbf5f8f10bed718b4dd5190fe5dfe76f`. No `.aiops/**`, `docs/aiops/**`, CI, dependency, budget, strict-assertion or historical bind file was edited.

## Boundaries and unresolved items

Amounts remain explicitly synthetic mock units with `source: "synthetic"`, `unit: "mock-unit"` and false `fundsExecuted`, `economicFinalityClaimed`, `productionEndpoint`, `protocolTruth`, `productionConformance`. Producer mappings, currency, fees, matching, expiry, ownership transfer, settlement and persistence/recovery remain **UNDETERMINED**.

Stub remains default; loopback HTTP only, one attempt, no fallback/retry/Idempotency-Key/redirect following/proxy/UI fetch. No real payment, live marketplace, public deployment, real KYC, credit disbursement, hardware/equipment, bank rail, SLO, copied Move/kernel/settlement math, secret or new protocol command is introduced. No unmerged dependency is consumed. No new owner decision is needed; final acceptance still requires the supervisor's fully green exact-head CI. Native OS IME, screen reader, real-device and production acceptance are not claimed.

## Inherited stopped-attempt ledger (historical)

The earlier draft already contained the following ledger. It is retained as history, not claimed as fresh continuation evidence. The owner ruling above supersedes its STOP; the final measurements and current results are in the continuation ledger.

| Command | Actual result |
| --- | --- |
| `npm ci` (initial environment, Node 24.22.1) | Exit 0; 535 packages installed. Audit reported 19 vulnerabilities (16 moderate, 1 high, 2 critical); no dependency changes made. |
| `npm run build` (initial clean baseline, Node 24.22.1) | Exit 0. |
| `npm exec -w @kix/web -- vitest run test/entry-import-graph.test.ts` (Node 24, started before that build finished) | Exit 0, 1 passed / 1 skipped because dist was not yet available. Not accepted as bundle evidence; rerun below. |
| `npm ci` (Node 22) | Exit 0; clean install completed. |
| `npm run build` (clean Node 22 baseline) | Exit 0. |
| `npm exec -w @kix/web -- vitest run test/entry-import-graph.test.ts` (clean Node 22 baseline) | Exit 0; 2 tests passed; 784,915 total JS/CSS gzip bytes. |
| `npm run build` (direct model helper import) | Exit 0. |
| `npm exec -w @kix/web -- vitest run test/entry-import-graph.test.ts` (direct import) | Exit 1; 1 passed / 1 failed; total 785,337 > 785,000. |
| `npm run build` (first local-regex attempt) | Exit 2; test used unsupported display locale `en-US`; corrected the test to existing `en-GB`. No budget assertion ran in this attempt. |
| `npm exec -w @kix/web -- vitest run test/form-validation.test.tsx test/form-ime.test.tsx test/resale-market.test.tsx` | Exit 0; 3 files, 70 tests passed. This ran before the display-locale type correction, which changes no string-path output. |
| `npm run build` (local regex, corrected test locale) | Exit 0; final partial runtime builds. |
| `npm exec -w @kix/web -- vitest run test/entry-import-graph.test.ts` (local regex) | Exit 1; 1 passed / 1 failed; total 785,089 > 785,000. Explicit STOP condition reached. |
| `npm run typecheck` | Exit 0; adapter and web TypeScript checks pass. |
| `KIX_REQUIRE_GATE=0 npm test` | Exit 1; adapter has 2,298 tests passed / 23 skipped (75 files passed / 5 skipped); web has 104 files / 1,509 tests passed and 1 file / 1 test failed, solely the strict emitted-total cap (785,089 > 785,000). The chained separate entry configuration does not run after that failure. |
| `npm run typecheck:e2e` | Exit 0. Does not include the shell fixture's runtime validation. |
| `git diff a12df77dba5d5690f922476868eb6e7fccd755fe --exit-code -- packages .aiops docs/aiops .github package.json package-lock.json apps/web/bundle-budget.json apps/web/test/entry-import-graph.test.ts apps/web/src/resale-market.ts` | Exit 0; protected paths unchanged. |
| `git hash-object packages/protocol-adapter/src/commerce-bindings.ts` and `git rev-parse a12df77dba5d5690f922476868eb6e7fccd755fe:packages/protocol-adapter/src/commerce-bindings.ts` | Both `47ab5e10cbf5f8f10bed718b4dd5190fe5dfe76f`; byte-identical. |
| `git diff --check` | Exit 0, including after writing these records. |
| `git diff --no-index --check /dev/null DECISION_REQUIRED.md` and the equivalent command for this bind document | Each exits 1 for the new-file difference, with no whitespace diagnostics. Final protected-path comparison was run independently and still exits 0. |
