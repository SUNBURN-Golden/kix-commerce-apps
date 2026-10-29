# Audit 8 implementation evidence

Tested workspace: branch `agent/kixc-audit-8-fix`, base/HEAD `376de037e5b0f684ff6e11b6313d8fcdec954b2c` plus the uncommitted audit-8 changes. No commit, push, PR, issue or comment is created. The supervisor owns the delivery SHA and its remote CI; local results do not establish remote CI status.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce. The implementation composes no additional command and changes no binding. Locked bindings SHA-256 remains `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`.

| Finding / acceptance | Implementation and evidence |
| --- | --- |
| Repeatable command evidence identity | Consent and organizer store terminal attempts by operation ID, copy receipt fields and start clean successor controls. Desk matrices exercise successive successes, deferred pending, UNKNOWN, gate rejection and pre-send validation failure; failures remain fenced. Invitations use distinct result literals to prove field ownership. |
| Authorization history / summaries | Set → authorize → set → authorize retains all four operations. Both desk and explorer summaries follow latest confirmed completion, rather than step order. Snapshot mutation cannot change retained fields. Reset clears page-load evidence. |
| Explorer/export | Actual desk snapshots project each operation once. Tests compare timeline, fields, selection identity, deterministic export, roles/sessions and false diagnostic flags. Non-confirmed exports have empty fields. Existing pagination/redaction tests remain active. |
| Direct HTTP envelope ownership | Deferred fetch tests mutate consent fields and event ID/nested seats; original-matching responses pass and mutation-only responses fail with traced GATE_STATUS. Exactly one fetch uses manual redirects and the original serialized body. Injected cloning/serialization failures make zero fetches and fabricate no trace. |
| Browser exercise | Added a production-bundle browser regression for four consent/authorization operations, a subsequent validation refusal, two distinct invitations, role navigation, detail/export and keyboard selection. Pending/UNKNOWN/gate rejection use controlled unit invokers: the default browser stub does not generate those transport outcomes. |

## Files changed

| Area | Files |
| --- | --- |
| Web models | `apps/web/src/consent-desk.ts`, `apps/web/src/organizer-desk.ts`, `apps/web/src/receipt-explorer.ts` |
| Web regressions | `apps/web/test/consent-desk.test.ts`, `apps/web/test/organizer-desk.test.ts`, `apps/web/test/receipt-explorer.test.tsx`, `apps/web/test/organizer-workspace.test.tsx` |
| HTTP adapter | `packages/protocol-adapter/src/http-adapter.ts`, `packages/protocol-adapter/test/http-transport-hardening.test.ts` |
| Browser regression | `apps/e2e/tests/journeys/receipts.e2e.test.ts` |
| Ownership documentation | `docs/m05-consent-bind-apps-bind.md`, `docs/organizer-admin-console-apps-bind.md`, `docs/c-receipt-explorer-apps-bind.md`, `docs/http-integration-gate-apps-bind.md`, this evidence file |

## Commands and results

All npm commands use Node `v22.20.0` via `PATH=/tmp/kix-node22/node_modules/node/bin:$PATH`. Browser budget and visual commands use `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1` (Chrome `156.0.8078.47`). After host-event timeouts on that runner, the passing E2E command uses the existing alternate binary via `KIX_E2E_CHROME=/opt/ungoogled-chromium/chrome KIX_E2E_NO_SANDBOX=1` (Chromium `139.0.7258.154`). Accessibility is retried alone with the original Chrome 156 binary after Chromium 139 showed existing keyboard/gallery incompatibilities; no harness, CI, timeout or baseline is changed. Commands run in the foreground; no long background job is started.

| Command | Actual result |
| --- | --- |
| `npm ci` | PASS, run twice. 535 packages added; existing install/deprecation warnings and 5 audit findings (2 moderate, 1 high, 2 critical). No lockfile or dependency change. Production audit below is clean. |
| `npm exec --workspace @kix/web -- vitest run test/consent-desk.test.ts test/organizer-desk.test.ts test/receipt-explorer.test.tsx` | PASS: 3 files, 54 tests on the final implementation. |
| `KIX_REQUIRE_GATE=0 npm test -w @kix/protocol-adapter -- test/http-transport-hardening.test.ts test/composer-isolation.test.ts` | PASS: 2 files, 59 tests on the final implementation. |
| `npm exec --workspace @kix/web -- vitest run test/entry-import-graph.test.ts` | PASS: 2 tests after the bundle reduction. |
| `npm run typecheck` | PASS after updating the organizer workspace fixture. |
| `npm run build` | PASS, including after the bundle reduction. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS on the final implementation: adapter 1,663 passed / 23 skipped; web 1,326 passed; cold-entry 6 passed (2,995 total passed). The 23 live-gate skips are not passes. |
| `npm run lint` | PASS. |
| `npm run deps:check` | PASS: 4 manifests / 630 lockfile entries. |
| `npm run cycle-check` | PASS: adapter, web and E2E source graphs have no cycles. |
| `npm run budget` | PASS: initial JS gzip 161,460 bytes, CSS 4,974, total gzip 784,948; all route/growth limits unchanged and passing. |
| `npm run typecheck:e2e` | PASS after correcting the test-only Locator assertion. |
| `npm run test:e2e` | PASS on local Chromium 139: 47 files, 198 tests. |
| `npm run test:a11y` | PASS on isolated Chrome 156 rerun: 19 files, 371 tests. |
| `npm run test:budget` | PASS: 3 files, 9 browser tests. |
| `npm run test:visual` | PASS: 3 files, 109 tests; existing baselines unchanged. |
| `npm run audit:warn` | PASS: `npm audit --omit=dev` reports 0 vulnerabilities. |
| `git diff --exit-code -- packages/protocol-adapter/vendor package-lock.json apps/web/bundle-budget.json` | PASS: vendored SDK, lockfile and bundle limits unchanged. |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` | PASS: matches the locked hash above. |
| `git diff --check` | PASS. |
| `git diff --exit-code 376de037e5b0f684ff6e11b6313d8fcdec954b2c -- packages/protocol-adapter/src/commerce-bindings.ts .aiops docs/aiops .github` | PASS: byte-identical protected paths. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS on rerun: adapter lines/statements 91.30%, functions 97.47%, branches 85.10%; web lines/statements 93.25%, functions 82.74%, branches 89.64%. All floors unchanged and met. |

The completed E2E run reports zero non-loopback requests, zero non-GET requests and zero application network calls, with no failed tests or lifecycle leaks. The isolated Chrome 156 accessibility run passes all 371 tests. Browser budget and visual results above are Chrome 156 observations. These local results are not remote CI or production qualification.

## Deviations and limits

- Added `history: []` to the existing organizer workspace test fixture because the snapshot interface now requires history.
- Added browser coverage in the existing receipts E2E file and this shared evidence document in addition to the planned files.
- Initial focused test assertions used a nonexistent diagnostic `receipts` member and expected absent properties on a schema validation error; corrected to the existing `entries` schema and explicit clone/serialization failure injection. Typecheck also caught the updated snapshot fixture and Locator/Page assertion mismatch; both were corrected before final verification.
- No live kix-protocol checkout is available. Live-gate tests are skipped under `KIX_REQUIRE_GATE=0`, never reported as passed. No protected directory, CI, pin, SDK or locked-binding edit is needed. No owner decision or product policy value is needed.
- The first full stub run found total gzip 785,009 against an existing 785,000-byte test target. Using `structuredClone` to copy history snapshots reduced it to 784,948 without changing limits. The initial coverage run also had two Vitest module-fetch worker timeouts while other heavy checks were running; the final coverage run is recorded separately.
- The initial added browser test attempted authorization after `allowed: false`, which is correctly fenced by the existing helper. The test now keeps consent allowed for its four-operation authorization history; withdrawal remains exercised separately in the desk matrix. No fence was relaxed. That first E2E run also hit an unrelated 60-second booking-reference timeout and a subsequent lifecycle leak assertion; the unchanged cases passed in the full rerun. That rerun then timed out on an unchanged M04 button action (197/198 tests passed). The first accessibility run similarly timed out in the unchanged admission desktop axe scan (370/371 passed). An isolated E2E retry timed out in unchanged discovery (197/198 passed); its timing record attributes the failed test to a host event, with a 197,719 ms wall-clock step and 10,492 ms event-loop stall. A further Chrome run timed out on unchanged diagnostics and box-office cases (196/198 passed); both failed-test records again report host events (up to 80,814 ms clock step and 34,467 ms event-loop stall). Switching only the existing local browser-path setting to Chromium 139 yielded a complete E2E pass. An accessibility attempt with Chromium 139 failed existing keyboard/gallery assertions and a receipt-pagination timeout; it was stopped with SIGINT (exit 130) after those failures rather than treated as a pass. The subsequent isolated Chrome 156 accessibility run passes all 371 tests, with no timeout or baseline change.
- Remote CI on the eventual delivery SHA remains for the supervisor. Persistent evidence recovery, retention/TTL, authoritative UNKNOWN resolution and production qualification remain outside scope.
