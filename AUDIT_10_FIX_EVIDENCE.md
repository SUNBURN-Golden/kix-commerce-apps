# Audit 10 implementation evidence

Worktree: `agent/kixc-audit-10-fix`, based on `a3b63d8e3e0a40c07f035af89ebbcae885ad0524`. Verification applies to the uncommitted working tree. No commit, push, PR, issue or external comment was made. Hosted CI at the supervisor's eventual commit remains the supervisor's check; local equivalents are recorded below.

## Findings

1. All five controllers retain unresolved requests by environment/domain/resource independently of UI incarnation. Lost and refused answers retain detached original context, exact dispatched envelope (including assignment/grant generation), act record and fence. Reads and navigation cannot resolve them. Same-scope, A→B→A, actor/role changes, distinct counting, request identity and unchanged dispatch counts have regressions. View evidence still clears, and in-flight requests still refuse context changes. Retained request payloads are only published to their original principal/role.
2. Notification capabilities and tenant capabilities/resource visibility are frozen at runtime, including nested authority arrays; unknown role names use own-property lookup. Source snapshots, controller ingestion and published nested state are detached. Mutation tests cover arrays, replacement, nested rows/assessments and export/inquiry values; later reads and independent sources retain original permissions, direct-open/export denial and withheld details.
3. `recoverRole()` performs one explicit read through decorated `read()` with a null role floor and the existing watermark floor. It preserves source state and UNKNOWN fences, advances incarnation, drops obsolete reads/exports, and accepts generation only from a ready snapshot. Tests cover rotation, revoked assignment, failed/dropped recovery, connectivity disconnect/reconnect, no additional writes, and the actual rendered recovery control. Browser tests activate that control with Enter in both clean and unresolved-request cases.

Authoritative UNKNOWN resolution and retention policy remain UNDETERMINED. Producer integration remains NOT_BOUND. Cross-reload persistence is outside scope. No protocol contract, pins, production capability, permission value or economic calculation changed.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce

## Environment and commands

Final verification uses Node `v22.23.4` through:

```bash
export PATH=/home/box/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH
```

Browser commands additionally use:

```bash
export KIX_E2E_CHROME=/usr/bin/google-chrome
export KIX_E2E_NO_SANDBOX=1
```

The suites build clean stub bundles and serve loopback origins themselves. Jobs were awaited; none was left running in the background for delivery.

Narrow adapter command (246 tests):

```bash
KIX_REQUIRE_GATE=0 npm test -w @kix/protocol-adapter -- \
  test/credit-origination-controller.test.ts \
  test/credit-servicing-controller.test.ts \
  test/finance-controller.test.ts \
  test/tenant-permissions-controller.test.ts \
  test/notification-inbox-controller.test.ts \
  test/tenant-permissions.test.ts test/notification-inbox.test.ts
```

Narrow web command (179 tests):

```bash
npm exec -w @kix/web -- vitest run \
  test/entry-import-graph.test.ts test/i18n-coverage.test.ts \
  test/tenant-permissions.test.tsx test/connectivity-write-guard.test.ts \
  test/credit-origination.test.tsx test/credit-servicing.test.tsx \
  test/finance-operations.test.tsx test/notification-inbox.test.tsx
```

| Command | Result |
| --- | --- |
| `npm ci` (Node 22) | PASS |
| Narrow adapter command above | PASS — 7 files, 246 tests |
| Narrow web command above | PASS — 8 files, 179 tests |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `KIX_REQUIRE_GATE=0 npm test` | PASS — adapter 2,998 passed / 23 skipped; web 1,640 passed; cold entry 6 passed |
| `npm run lint` | PASS |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS — all workspace floors met |
| `npm run deps:check` | PASS |
| `npm run cycle-check` | PASS — no circular imports |
| `npm run budget` | PASS — initial JS 160,090; initial CSS 4,974; total 785,957 bytes gzip |
| `npm run typecheck:e2e` | PASS |
| `npm run audit:warn` | PASS — production audit found 0 vulnerabilities |
| `npm run test:e2e` | PASS — 51 files, 248 tests; includes clean and UNKNOWN keyboard recovery |
| `npm run test:a11y` | PASS — 22 files, 396 tests; 89/89 keyboard outcome cells |
| `npm run test:budget` | PASS — 3 files, 9 tests |
| `npm run test:visual` | PASS — 3 files, 123 tests; all 108 shots compared against original baselines |
| `git diff --check` | PASS |
| Locked-path diff and SHA-256 commands below | PASS — no locked-path changes; digest matches |


## Corrections and deviations

- The design review's connectivity correction is implemented by `recoverRole()` dynamically calling the existing decorated `read()`; no connectivity guard API needed changing.
- Rotation existed in the hook but had no rendered control. The added synthetic rotation button uses the current assignment's snapshot reference so mounted and browser tests can rotate the same source. Recovery is refused during an in-flight write.
- Shared fence copy now serves all five bilingual catalogues. No new package or shared controller abstraction was retained. Broader copy compaction, a shared retention helper and native-private-field experiments were discarded after measurement; they did not improve the bundle enough.
- The clean starting commit measures **784,838** bytes total gzip, leaving 162 bytes below the import-graph test's duplicated 785,000 target. The final build measures **785,957** total gzip and **160,090** initial JS gzip. The existing configured totalGrowth ceiling remains **790,000**, initial JS remains **290,000**, and every route budget remains strict. The import-graph assertion now consumes that configured ceiling, capped at the owner-approved 790,000; its tighter 282,000 initial target remains. `apps/web/bundle-budget.json` records the measured baseline without changing any limit. This uses the supplied **2026-10-23 KST c-i18n-coverage-completion-stub bundle-budget & copy scope ruling**, under the 2026-10-15 standing delegation.
- No program registration or manifest reconciliation was performed. No changes were made to `.aiops/`, `docs/aiops/`, CI workflows, protocol pins/SDK artifacts, `commerce-bindings.ts` or kix-protocol.
- Live-gate suites are skipped under `KIX_REQUIRE_GATE=0`: no kix-protocol checkout or credentials were requested. Skipped is not passed.

## Earlier attempts (not represented as passes)

- The first `npm ci` used the host Node 24 and passed; it was repeated successfully under Node 22. A prematurely started `npm run typecheck` failed with `tsc: not found` before installation completed.
- Initial narrow adapter runs found reset-expecting and shared-object-identity assertions; corrected assertions now verify retained fences and detached but equal content. Initial new tests also exposed readonly mutation casts, a missing `focusRef`, and an incorrectly captured spy implementation; those test helpers were fixed.
- `npm test -w @kix/web -- ...` unexpectedly ran the full first web suite because its script contains two Vitest invocations. Later narrow runs use `npm exec ... vitest run`. Initial web/full-stub runs found old copy/translation assertions and the duplicated total-gzip target; these were corrected as described above. Initial lint rejected non-null assertions in own-property lookups; those assertions were removed.
- The first `KIX_REQUIRE_GATE=0 npm run coverage:check` failed on the 785,000 import-graph target despite passing coverage percentages. The final run is reported separately.
- The initial focused browser setup overlapped dependency reinstallation and failed when Terser was temporarily unavailable. No browser check passed in that attempt. The next full browser run passed the new recovery tests and 246 tests overall, but failed two existing tests with timeouts (all-screen offline sweep and marketing-m04 open). The sequential rerun passed all 248 tests in 51 files, including both formerly timed-out tests and both new keyboard recovery cases. No browser test or timeout limit was changed.
- Clean baseline evidence was obtained with `git archive HEAD | tar -x -C /tmp/audit10-baseline`, a symlink to installed dependencies, `npm run build --prefix /tmp/audit10-baseline`, and `node scripts/check-bundle-budget.mjs --dist /tmp/audit10-baseline/apps/web/dist --budget apps/web/bundle-budget.json`: build and size checks passed, total gzip 784,838. This exported no new commit and modified no repository history.

## Locked-file verification

```bash
git diff --check
git diff --exit-code a3b63d8e3e0a40c07f035af89ebbcae885ad0524 -- \
  packages/protocol-adapter/src/commerce-bindings.ts .aiops docs/aiops .github/workflows/ci.yml
sha256sum packages/protocol-adapter/src/commerce-bindings.ts
git rev-parse HEAD
```

Locked binding SHA-256: `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249` (matches the supplied lock).


## Visual verification and run records

Executed the repository's complete recording mode, followed by compare mode:

```bash
KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_UPDATE=1 KIX_VISUAL_RECORD_OUT=/tmp/audit10-visual-update-record.json KIX_VISUAL_OUT=/tmp/audit10-visual-update-out npm run test:visual
KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_RECORD_OUT=/tmp/audit10-visual-compare-record.json KIX_VISUAL_OUT=/tmp/audit10-visual-compare-out npm run test:visual
```

Recording completed (123 tests), but recording is not compare evidence. It rewrote eight PNGs by only 1–17 bytes and the manifest, including unrelated handoff/marketing shots. Inspected the generated handoff and permissions images, then restored all nine recording changes from their original HEAD bytes. The subsequent **compare** run passed all 123 tests and 108 shots against the original baselines and tolerance. No screenshot, manifest, mask, viewport or tolerance change remains. The standard pictures stop at 2,000px; the rendered recovery control is independently exercised by mounted interaction and real-browser keyboard tests.

Browser JSON records (all loopback/stub, no production/release claim):

- `/tmp/audit10-e2e-final-record.json`
- `/tmp/audit10-a11y-record.json`
- `/tmp/audit10-browser-budget-record.json`
- `/tmp/audit10-visual-compare-record.json` (`run: compare`, profile `linux-d29b2e9b`, Chrome `156.0.8078.47`)

Final verification logs are `/tmp/audit10-npm-ci-node22.log`, `/tmp/audit10-narrow-adapter-final.log`, `/tmp/audit10-narrow-web-final.log`, `/tmp/audit10-typecheck-final.log`, `/tmp/audit10-build-final.log`, `/tmp/audit10-test-final.log`, `/tmp/audit10-lint-final.log`, `/tmp/audit10-coverage-final.log`, `/tmp/audit10-deps.log`, `/tmp/audit10-cycle.log`, `/tmp/audit10-budget-final.log`, `/tmp/audit10-typecheck-e2e-final.log`, `/tmp/audit10-audit.log`, `/tmp/audit10-e2e-final.log`, `/tmp/audit10-a11y.log`, `/tmp/audit10-browser-budget.log`, and `/tmp/audit10-visual-compare.log`.

## Files changed

- `AUDIT_10_FIX_EVIDENCE.md`
- `apps/e2e/tests/journeys/permissions.e2e.test.ts`
- `apps/web/bundle-budget.json`
- `apps/web/src/i18n/messages/finance-operations.ts`
- `apps/web/src/i18n/messages/shared-copy.ts`
- `apps/web/src/i18n/messages/tenant-permissions.ts`
- `apps/web/src/pages/TenantPermissions.tsx`
- `apps/web/src/pages/TenantPermissionsPanels.tsx`
- `apps/web/src/tenant-permissions.ts`
- `apps/web/test/connectivity-write-guard.test.ts`
- `apps/web/test/entry-import-graph.test.ts`
- `apps/web/test/i18n-coverage.test.ts`
- `apps/web/test/tenant-permissions.test.tsx`
- `docs/c-credit-origination-stub-apps-bind.md`
- `docs/c-credit-servicing-journey-stub-apps-bind.md`
- `docs/c-finance-operations-stub-apps-bind.md`
- `docs/c-notification-inbox-stub-apps-bind.md`
- `docs/c-tenant-permissions-stub-apps-bind.md`
- `packages/protocol-adapter/src/credit-origination-controller.ts`
- `packages/protocol-adapter/src/credit-servicing-controller.ts`
- `packages/protocol-adapter/src/finance-controller.ts`
- `packages/protocol-adapter/src/notification-inbox-controller.ts`
- `packages/protocol-adapter/src/notification-inbox.ts`
- `packages/protocol-adapter/src/tenant-permissions-controller.ts`
- `packages/protocol-adapter/src/tenant-permissions.ts`
- `packages/protocol-adapter/test/credit-origination-controller.test.ts`
- `packages/protocol-adapter/test/credit-servicing-controller.test.ts`
- `packages/protocol-adapter/test/finance-controller.test.ts`
- `packages/protocol-adapter/test/notification-inbox-controller.test.ts`
- `packages/protocol-adapter/test/notification-inbox.test.ts`
- `packages/protocol-adapter/test/tenant-permissions-controller.test.ts`
- `packages/protocol-adapter/test/tenant-permissions.test.ts`
