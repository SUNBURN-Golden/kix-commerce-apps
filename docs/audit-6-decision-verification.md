# Audit 6 decision — local verification

Date: 2026-10-23. Branch: `agent/kixc-audit-6-decision`. Base/unchanged HEAD: `ccfcc4e7f7d0c5aa123279ca0e139ca27392066b`. All work remains uncommitted for the supervisor. No git/GitHub write action was taken.

## Summary and authority

Implemented fixture catalogue v2 with verified consumed SDK catalogue, manifest, and vector digests shared by live fixture identity, discovery and its synthetic ports, release, qualification, and handoff. Historical v1 literals and their original key are preserved and refused as current evidence. Unavailable domain producers retain NOT_BOUND and null digests. BOOTSTRAP grants catalogue-schema-binding only.

- audit-6-decision ruling — 2026-10-23 KST, KIX Commerce under the 2026-10-15 standing delegation: option (b).
- M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The detailed binding is [audit-6-decision-apps-bind.md](audit-6-decision-apps-bind.md).

## Commands actually run and results

All requested local CI equivalents passed on the completed implementation. The host default was Node 20.19.2; verification used `npm exec --yes --package=node@22 --` (resolved Node 22.23.4), matching CI's Node major. npm was 11.21.0. Commands below ran in the worktree. Long output was redirected to `/tmp/kix-audit-6-*.log`; no shell background jobs were used. Browser suites used the existing Chrome 155.0.8059.84 on loopback only.

| Command | Actual result |
| --- | --- |
| `node --version` / `npm --version` | Host v20.19.2 / npm 11.21.0. |
| `npx --yes --package=node@22 node --version` | v22.23.4. |
| `npm exec --yes --package=node@22 -- npm ci` | PASS; 535 packages installed; lockfile unchanged. Install audit reported 5 development-tree vulnerabilities (2 moderate, 1 high, 2 critical); no dependency changes made. |
| `KIX_REQUIRE_GATE=0 npm exec --yes --package=node@22 -- npm test -w @kix/protocol-adapter -- test/sdk-consumption-tuple.test.ts test/sdk-pin.test.ts test/contract-fixture-library.test.ts test/discovery-read.test.ts test/inventory-read.test.ts test/platform-release.test.ts test/operational-qualification.test.ts test/sdk0-mock-scenarios.test.ts` | PASS: 8 files, 139 tests. |
| `KIX_REQUIRE_GATE=0 npm exec --yes --package=node@22 -- npm test -w @kix/web -- test/handoff-packet.test.tsx test/local-evidence-matrix.test.ts test/contract-fixture-library.test.tsx test/platform-release.test.tsx test/operational-qualification.test.tsx` | Initial run: 52 passed, 2 failed (stale catalogue version and scope denominator in docs). Corrected docs; rerun PASS: 5 files, 54 tests. |
| `npm exec --yes --package=node@22 -- npm run typecheck` | PASS, including final source/test changes. |
| `npm exec --yes --package=node@22 -- npm run build` | PASS on all three runs. Existing Vite large-entry warning; thresholds were not altered. Final log: `/tmp/kix-audit-6-build-final.log`. |
| `KIX_REQUIRE_GATE=0 npm exec --yes --package=node@22 -- npm test` | PASS on all three runs; final adapter: 65 files passed, 5 skipped; 1,335 tests passed, 23 skipped. Web: 79 files / 1,052 tests passed. 2,387 passed total; 23 live-gate tests intentionally skipped, never counted as passed. |
| `npm exec --yes --package=node@22 -- npm run lint` | PASS, rerun after final source/test changes. |
| `KIX_REQUIRE_GATE=0 npm exec --yes --package=node@22 -- npm run coverage:check` | PASS on both runs; final coverage met every adapter/web floor. Adapter lines 91.22%, functions 97.44%, branches 84.59%; web lines 88.31%, functions 76.68%, branches 88.12%. |
| `npm exec --yes --package=node@22 -- npm run deps:check` | PASS: 4 manifests, 630 lockfile entries. |
| `npm exec --yes --package=node@22 -- npm run cycle-check` | PASS: no cycles in adapter, web, or e2e. |
| `npm exec --yes --package=node@22 -- npm run budget` | Initial FAIL: 633,107 total gzip bytes > 633,031; retry FAIL: 633,079. Shortened repeated binding observations while keeping full digests in packet fields and UI. Final PASS: initial JS 288,402 <= 290,000; CSS 4,965 <= 5,000; total 632,896 <= 633,031; largest route chunk 21,529 <= 30,000. No threshold/baseline change. |
| `npm exec --yes --package=node@22 -- npm run typecheck:e2e` | PASS. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kix-audit-6-e2e-record.json npm exec --yes --package=node@22 -- npm run test:e2e` | PASS: 15 files, 54 browser tests. Record includes separate fault ledger. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kix-audit-6-a11y-record.json npm exec --yes --package=node@22 -- npm run test:a11y` | PASS: 15 files, 267 tests; existing known-findings ratchet, keyboard, structure, reflow, gallery and axe scans passed. Observation only, not accessibility acceptance. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-audit-6-visual-record.json KIX_VISUAL_OUT=/tmp/kix-audit-6-visual-out npm exec --yes --package=node@22 -- npm run test:visual` | PASS: 3 files, 42 tests; all 32 screenshots match the committed linux-d29b2e9b profile. Baselines unchanged. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_BUDGET_RECORD_OUT=/tmp/kix-audit-6-browser-budget-record.json npm exec --yes --package=node@22 -- npm run test:budget` | PASS: 3 files, 9 browser tests (route split, chunk failure, long-list rendering). |
| `npm exec --yes --package=node@22 -- npm run audit:warn` | PASS (warning-only gate): production dependency audit found 0 vulnerabilities. |
| `git diff --check` | PASS after removing one extra trailing blank line in the barrel. Final check repeated after documentation completion. |
| `python3` byte comparison of protected files against the base (using `git ls-files`, `git show <base>:<path>`, and `Path.read_bytes()`) | PASS: all 36 protected files byte-identical. Locked bindings sha256: `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`. |

Protected files include both OpenAPI pin modules, `sdk-pin.ts`, `commerce-bindings.ts`, all vendor files, CI workflows, `.aiops/`, and `docs/aiops/`.

## Deviations and remaining verification

No behavior/scope deviation from the approved design. Additional domain-producer comments explicitly distinguish unavailable domain SDKs from consumed app SDK evidence. Repeated display observations were shortened to preserve existing bundle limits; full protocol words and digests remain in their packet fields. The authorized bilingual-copy budget adjustment was not needed.

The referenced state decision-answer file is absent; the supplied authoritative owner ruling was used, without fabricating that file. The program-count discrepancy remained informational and no program metadata was touched.

Live-gate execution is intentionally skipped (`KIX_REQUIRE_GATE=0`). It is not a live-gate pass. No live contract or producer change, production runtime, payment, qualification, acceptance, or release is claimed. Exact committed-head CI remains the supervisor's post-commit check; local dirty-worktree results cannot establish that remote CI result.

## Files changed

- `README.md`
- `apps/web/src/handoff/packet.ts`
- `apps/web/test/handoff-packet.test.tsx`
- `apps/web/test/local-evidence-matrix.test.ts`
- `apps/web/test/operational-qualification.test.tsx`
- `apps/web/test/platform-release.test.tsx`
- `docs/audit-6-decision-apps-bind.md`
- `docs/audit-6-decision-verification.md`
- `docs/c-contract-fixture-library-apps-bind.md`
- `docs/c-credit-origination-stub-apps-bind.md`
- `docs/c-credit-servicing-journey-stub-apps-bind.md`
- `docs/c-cross-surface-journeys-stub-apps-bind.md`
- `docs/c-delegated-assistant-stub-apps-bind.md`
- `docs/c-discovery-live-stub-apps-bind.md`
- `docs/c-finance-operations-stub-apps-bind.md`
- `docs/c-installable-mobile-stub-apps-bind.md`
- `docs/c-inventory-venue-stub-apps-bind.md`
- `docs/c-journey-identity-stub-apps-bind.md`
- `docs/c-local-evidence-matrix-stub-apps-bind.md`
- `docs/c-local-workspace-closeout-apps-bind.md`
- `docs/c-marketing-journey-stub-apps-bind.md`
- `docs/c-marketplace-performance-stub-apps-bind.md`
- `docs/c-merchant-operations-stub-apps-bind.md`
- `docs/c-notification-inbox-stub-apps-bind.md`
- `docs/c-platform-journey-stub-apps-bind.md`
- `docs/c-platform-operational-qualification-stub-apps-bind.md`
- `docs/c-platform-release-stub-apps-bind.md`
- `docs/c-provider-connected-journey-stub-apps-bind.md`
- `docs/c-refund-return-states-stub-apps-bind.md`
- `docs/c-sdk0-mock-scenario-kit-stub-apps-bind.md`
- `docs/c-session-recovery-stub-apps-bind.md`
- `docs/c-tenant-permissions-stub-apps-bind.md`
- `packages/protocol-adapter/src/contract-fixtures.ts`
- `packages/protocol-adapter/src/credit-origination.ts`
- `packages/protocol-adapter/src/credit-servicing.ts`
- `packages/protocol-adapter/src/discovery-read.ts`
- `packages/protocol-adapter/src/finance-operations.ts`
- `packages/protocol-adapter/src/index.ts`
- `packages/protocol-adapter/src/marketplace-performance.ts`
- `packages/protocol-adapter/src/notification-inbox.ts`
- `packages/protocol-adapter/src/operational-qualification.ts`
- `packages/protocol-adapter/src/platform-release.ts`
- `packages/protocol-adapter/src/sdk-consumption-tuple.ts`
- `packages/protocol-adapter/src/sdk0-mock-scenarios.ts`
- `packages/protocol-adapter/src/tenant-permissions.ts`
- `packages/protocol-adapter/test/contract-fixture-library.test.ts`
- `packages/protocol-adapter/test/credit-origination.test.ts`
- `packages/protocol-adapter/test/credit-servicing.test.ts`
- `packages/protocol-adapter/test/cross-surface-journeys.test.ts`
- `packages/protocol-adapter/test/discovery-read.test.ts`
- `packages/protocol-adapter/test/finance-operations.test.ts`
- `packages/protocol-adapter/test/inventory-read.test.ts`
- `packages/protocol-adapter/test/merchant-operations.test.ts`
- `packages/protocol-adapter/test/notification-inbox.test.ts`
- `packages/protocol-adapter/test/operational-qualification-controller.test.ts`
- `packages/protocol-adapter/test/operational-qualification.test.ts`
- `packages/protocol-adapter/test/platform-release-controller.test.ts`
- `packages/protocol-adapter/test/platform-release.test.ts`
- `packages/protocol-adapter/test/sdk-consumption-tuple.test.ts`
- `packages/protocol-adapter/test/sdk0-mock-scenarios.test.ts`
- `packages/protocol-adapter/test/tenant-permissions.test.ts`
