# Structured support exports (stub)

Node: `c-plan-c-structured-support-export-stub`. Base: `ea44effa37f0bbe1008f2198f6996879364e64a8` (`origin/main` at start).
`contract_change=NO`. This is app-internal presentation work for `/receipts` and `/diagnostics`.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The exporters now project the existing permitted fields, redact text leaves, and then call `JSON.stringify(projected, null, 2)` once. They never rewrite serialized JSON. `redactSupportText` accepts string/null scalars; `sweepExport` remains compatible for existing scalar callers. Existing replacement patterns, replacement order and markers are preserved (a 12-digit phone body is still replaced as an account before the phone rule).

## Field and trust boundaries

Receipt export keys and their order remain unchanged. The earlier `publicToken`, `publicActor`, `publicNote`, `publicFields`/deny-key filtering, and source/profile validation remain intact. Scalar redaction covers `sessionId`; entry `operationId`, `action`, `code`, `unconfirmedReason`, `nextAction`, `requestId`, `correlationId`, `refId`, `actorLabel`, and every permitted field's `key`/`value`; quarantine `action`/`operationId`; and recorded-not-sent `sender`/`action`/`reason`. Receipt role, mode, status, source, context, code class and quarantine reason are closed vocabularies. Profile/version pairs and domain come from existing validated pins; explanatory note and non-claims are fixed application copy/literals. Those trusted leaves retain their exact values. Counters and false flags are copied as primitives. The export still includes all authorized receipts regardless of pagination, and no raw evidence or arbitrary notes are newly exported.

Diagnostics explicitly copies only `appVersion`, `pinDigestAlgorithm`, `pinDigest`, and `pins.{contractOnlyOpenApiSha256,integrationGateOpenApiSha256,sdk0ManifestSha256,sdk0CatalogueSha256}` from `diagnostics/build-identity.ts`. These are trusted build-time values and bypass string patterns; no input key named `pin` or `digest` receives an exemption. Fresh objects preserve the original field insertion order, including build identity and pin sub-order, so default textarea content stays stable. The displayed model and parsed export share the same identity values.

Diagnostics scalar redaction covers `locale`, all three `display` strings, journal `cause`, and all outcome strings (`context`, `journeyRef`, `action`, `operationId`, `requestId`, `correlationId`, `outcome`, `code`, `reason`). Mode, derived origin, connectivity state, derived journal state, kind and non-claims are enums/fixed literals. Connectivity epoch/writes-blocked, journal record counters, outcome ordinal/limit and omitted count stay numeric/boolean/null as appropriate. Journal projection retains precedence for evidence loss. The recorder's actor substitution, stronger identifier suppression and arbitrary-note suppression remain unchanged, as does the ten-outcome export limit. No builder mutates input snapshots, retained outcomes, evidence or trusted identity.

## Acceptance evidence

- Focused tests parse both JSON exports and assert decoded text, exact schemas and unchanged status/non-claim values. Receipt fixtures include empty, populated, quarantined, UNKNOWN, stale and integration-http-classified inputs. Existing role/session isolation and pagination tests still execute.
- Scalar tests and export seams (`screenSessionId`, diagnostics `display.*`) cover actual tab/LF/CR, quotes, backslashes, literal escape sequences, and sensitive strings adjacent to escaping. More restrictive receipt-field/recorder allowlists remain restrictive.
- Bearer/API-key/JWT/email/account/phone sentinels remain suppressed. Receipt denied name fields and arbitrary notes still suppress personal-data sentinels; recorder tests exercise actor suppression through normal observations. An untrusted receipt `pinDigest` field receives no exemption.
- Diagnostics fixtures cover every digit length from 12 through 16 plus `Number.MAX_SAFE_INTEGER`. Parsed epoch, used/max records, ordinal, omitted count and outcome limit have explicit numeric assertions. The MAX_SAFE_INTEGER fixture has one retained outcome, so omitted-count addition is zero and stays safe. Another test checks truncation/count addition. Null journal cause/used/max and nullable outcome code remain null; flags stay boolean.
- Isolated test-only identity mocks contain a 16-digit synthetic digest that demonstrably triggers the scalar account pattern, alongside digit-heavy 64-character hexadecimal pin fixtures; exported identity equals both the model and rendered trusted identity. The real identity test remains unmocked and checks the actual diagnostics export, independent digest calculation, compiled identity and lazy Diagnostics gzip size below 30,000 bytes.

## Verification

Commands ran from the node worktree with Node `v22.23.4`. The initial PATH prefix was `/tmp/kix-notify-node22/node_modules/node/bin`. Initial logs were under `/tmp/kix-structured-support-export/`; that directory and the initial temporary Node installation disappeared during the first accessibility run. The results already captured in tool output are recorded here. Subsequent logs/records are in ignored `apps/web/node_modules/.cache/structured-support-export/`, with a local copy of the same Node v22.23.4 binary prepended to PATH. No long jobs were launched in the background.

Focused command (run initially, after correcting a fixture expectation, and again after build):

```bash
npm exec -w @kix/web -- vitest run test/structured-support-export.test.ts test/receipt-explorer.test.tsx test/receipt-pagination.test.ts test/receipt-pagination-interactions.test.tsx test/diagnostics.test.tsx test/build-identity.test.ts
```

| Command | Result |
| --- | --- |
| `npm ci` | PASS, 535 packages added. npm reported 19 audit findings including dev dependencies and an esbuild install-script warning; no dependency changes made. |
| Focused command above, initial | FAIL: one phone-marker expectation differed from existing account-before-phone replacement order; 66 passed, 1 failed, 1 compiled check skipped before build. Corrected expectation without changing runtime patterns. |
| Focused command above, first retry | PASS: 68 passed, 1 compiled check skipped before build. |
| `npm run typecheck` | PASS initially and after final test additions. |
| `npm run build` | PASS; lazy Diagnostics chunk about 4.17 kB gzip, below 30,000 bytes. |
| Focused command above, after build | PASS: 70 tests across 6 files, no skips, compiled-identity check executed. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 2,980 tests (23 live-gate tests skipped), web 1,574 tests, cold entry 6 tests. |
| `npm run budget` | PASS: initial JS 160,249 bytes, initial CSS 4,974 bytes, total gzip 784,368 bytes; below both existing total budget and stricter 785,000-byte entry-graph assertion. |
| `npm run lint` | Initial PASS; final-test pass found five unnecessary quote escapes in the new fixture. Removed unnecessary escapes; corrected run PASS. |
| `npm run deps:check` | PASS: 4 manifests / 630 lock entries. |
| `npm run cycle-check` | PASS: no circular imports. |
| `npm run audit:warn` | PASS: production audit found 0 vulnerabilities. |
| `npm run typecheck:e2e` | PASS. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check`, first attempt | FAIL: unchanged adapter resale late-answer test timed out; web 1,574 tests passed and all web coverage floors met. No threshold or unrelated test changes. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check`, isolated retry | PASS: adapter 2,980 tests (23 skipped), web 1,574 tests. Adapter lines/functions/branches/statements: 91.73/97.91/85.91/91.73%; web: 94.26/86.38/90.61/94.26%. All existing floors met. |
| `npm run test:e2e`, first attempt | FAIL: 229 passed; unchanged resale-market URL cleanup (en) timed out at 60 seconds. No timeout/test/runtime changes; passing full retry recorded below. |

Browser command environment (installed Chrome, existing repository settings):

```bash
export KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1
export KIX_E2E_RECORD_OUT=/tmp/kix-structured-support-export/browser-record.json
export KIX_A11Y_RECORD_OUT=/tmp/kix-structured-support-export/a11y-record.json
export KIX_BUDGET_RECORD_OUT=/tmp/kix-structured-support-export/browser-budget-record.json
export KIX_VISUAL_RECORD_OUT=/tmp/kix-structured-support-export/visual-record.json
export KIX_VISUAL_OUT=/tmp/kix-structured-support-export/visual-out
npm run test:e2e
npm run test:a11y
npm run test:budget
npm run test:visual
```

The first `test:a11y` invocation ended with exit 1 after the temporary directory disappeared; its final assertions/record are unavailable. The first loop's `test:budget` and `test:visual` never started because shell log redirection failed after directory loss. They are not counted as executed passes.

All four browser commands were rerun sequentially with the same Chrome/no-sandbox settings and record filenames under the worktree cache instead. Command environment for that run:

```bash
support_export_cache="$PWD/apps/web/node_modules/.cache/structured-support-export"
export PATH="$support_export_cache/node22/bin:$PATH"
export KIX_E2E_RECORD_OUT="$support_export_cache/browser-record.json"
export KIX_A11Y_RECORD_OUT="$support_export_cache/a11y-record.json"
export KIX_BUDGET_RECORD_OUT="$support_export_cache/browser-budget-record.json"
export KIX_VISUAL_RECORD_OUT="$support_export_cache/visual-record.json"
export KIX_VISUAL_OUT="$support_export_cache/visual-out"
```

| Command | Result |
| --- | --- |
| `npm run test:e2e`, worktree-cache retry | PASS: all 230 tests across 50 files. Previously timing-out resale URL-cleanup cases passed (en and ko); receipt browser cases passed. |
| `npm run test:a11y`, worktree-cache attempt | FAIL: 378 passed across 21 files; first form suite encountered a closed browser on initial page load (18 cascading failures). Full isolated retry recorded below. |
| `npm run test:budget`, worktree-cache run | PASS: 9 tests across 3 files (route split, chunk failures, long-list rendering). |
| `npm run test:visual`, worktree-cache first run | FAIL: 122 passed, 1 resale-market phone screenshot test timed out. All 108 screenshot records were MATCH, including both Diagnostics shots at zero differing pixels. Profile `linux-d29b2e9b`, Chrome `156.0.8078.47`. No baseline changes. |

The current repository visual matrix has 108 shots (123 tests including harness checks), rather than the older CI comment's 32; the actual current matrix is executed without changes. The final identity fixture also explicitly proves that its trusted 16-digit digest would be redacted if treated as ordinary text. Final typecheck/build/focused/full stub/lint/budget and isolated browser retries were run, with cache logs `final-*.log`, `visual-rerun.log`, `a11y-rerun.log` and separate `*-rerun-record.json` records.

| Final command after tightening the trusted digest fixture | Result |
| --- | --- |
| `npm run typecheck` | PASS. |
| `npm run build` | PASS. |
| Focused six-file Vitest command above | PASS: 70 tests, no skips (including compiled identity). |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 2,980 (23 skipped), web 1,574, cold entry 6. |
| `npm run lint` | PASS. |
| `npm run budget` | PASS: initial JS 160,249, CSS 4,974, total gzip 784,368 bytes; unchanged limits. |
| `npm run test:visual`, second complete run | FAIL: 122 passed, 1 organizer-workspace desktop screenshot test timed out (a different case from the first run). All 108 screenshot records again MATCH; no baseline/threshold edits. Passing standalone retry recorded below. |
| `npm run test:a11y`, isolated complete retry | PASS: all 396 tests across 22 files; keyboard facet 89/89. Form suite 18/18 passed; Diagnostics axe checks passed at 390px and 1280px. Log `a11y-rerun.log`, record `a11y-rerun-record.json`. |
| `npm run test:visual`, standalone final retry | PASS: all 123 tests across 3 files; all 108 shots MATCH on `linux-d29b2e9b`, including both Diagnostics shots with zero differing pixels. Log `visual-final.log`, record `visual-final-record.json`, output `visual-final-out/`. No baseline updates. |

The final visual run used the same Chrome/no-sandbox/PATH settings with `KIX_VISUAL_RECORD_OUT="$support_export_cache/visual-final-record.json"` and `KIX_VISUAL_OUT="$support_export_cache/visual-final-out"`; the passing accessibility retry used `KIX_A11Y_RECORD_OUT="$support_export_cache/a11y-rerun-record.json"`.

Final repository checks (all exit 0):

```bash
git diff --check
git diff --name-only
git ls-files --others --exclude-standard
git diff --exit-code origin/main -- packages .github .aiops docs/aiops apps/web/bundle-budget.json
git show origin/main:packages/protocol-adapter/src/commerce-bindings.ts | cmp - packages/protocol-adapter/src/commerce-bindings.ts
```

The complete changed-path list is the three source files `apps/web/src/{receipt-redaction.ts,receipt-explorer.ts,diagnostics/model.ts}`, four tests `apps/web/test/{structured-support-export.test.ts,receipt-explorer.test.tsx,diagnostics.test.tsx,build-identity.test.ts}`, and this document. Branch remains `agent/kixc-c-plan-c-structured-support-export-stub`; HEAD and origin/main remain the recorded base.

Implementation scope follows the corrected design without deviation. Verification deviations were retries for the recorded timeouts/browser closure, relocation of ephemeral logs/Node after temporary-directory loss, and executing the repository's current larger visual matrix. No test threshold, baseline, policy, pin or contract was changed. All required local checks have a passing completed run; no decision is required.

## Unchanged locks and limitations

Only `apps/web/**` and this document change. No dependency, budget, CI, protocol pin, adapter binding, `.aiops/**` or `docs/aiops/**` changes. Locked paths were compared against the recorded base / `origin/main`, including a passing direct byte comparison of `commerce-bindings.ts`.

No protocol command, contract consumption, storage, networking, policy, payment behavior or production qualification is added. Stub remains default; loopback-only HTTP, one attempt, no retry/fallback/redirect following/Idempotency-Key/UI fetch and false production/truth claims remain intact. `placeHold` remains not-bound and no capture/settlement composition is introduced. Retention/TTL, refund and price policies remain `UNDETERMINED`.

Live-gate and hosted CI checks are not local passes: live-gate checks are skipped with `KIX_REQUIRE_GATE=0`; hosted CI is for the supervisor. No signer, ASTRA markers, GitHub writes, commit or push were used. Local browser observations imply no acceptance, conformance or release.
