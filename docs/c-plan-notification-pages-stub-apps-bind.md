# Local notification pages (synthetic stub)

## Scope and ruling

The notification inbox projects already-adjudicated rows into deterministic local pages of 20. The action list and evidence table consume the same slice. No producer schema, controller, adapter, command binding, pin, URL schema, storage key, dependency, CI check or bundle limit changes.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce

`placeHold` remains not-bound with `reserve_listing` considered; the journey stops after `accept_trade`. `capture`, `settle_capture`, `commit_trade`, `open_admission` and `admit` remain recorded, never composed here. The locked commerce bindings remain byte-identical.

## Interfaces

`notification-pagination.ts` exports `NOTIFICATION_PAGE_SIZE = 20`, `NotificationFilter`, `NotificationPage`, `filterNotificationRows`, `buildNotificationPage` and `notificationPageForItem`. Filtering uses the model's canonical English source catalogue words before display translation. Filtering and slicing preserve order and row references; they never sort, deduplicate, mutate or truncate source evidence. Nonpositive, fractional and nonfinite page numbers normalize to 1; oversized positive integers clamp. Empty results have page/pageCount/start/end 0.

`NotificationsPage` retains the production hook. `NotificationsScreen` accepts its existing live model/actions shape for controlled tests. The full model still feeds status, unread summary, authority, direct-open detail, inquiry, request and session sections. `NotifyInboxSection` accepts optional page/onPageChange props; direct panel consumers receive a bounded first page with non-interactive controls. `data-row-count` means rendered rows; `data-filtered-count` and `data-total-count` expose the separate totals.

## Selection and lifecycle

All filtered references form the selection domain before slicing. The existing `/notifications?filter=all|unread|read&item=<reference>` and optional `lang=en|ko` remain the complete URL state; page position is local only. Valid URL selection derives a page on settled URL visits, selection changes and ordered membership changes. Newly allocated models and unchanged-membership refreshes do not undo explicit pager navigation, including across a pending read. Selection remains replace-history; a filter change pushes history and clears dependent selection. Back/forward and reload restore the selected item's derived page without moving focus.

Initially invalid links are cleaned by `useReadState`. A formerly valid selection removed by a later snapshot becomes unselected without rewriting that visit's URL. Normalized/clamped page state is committed so 41→20→0→21 cannot resurrect page 3. A restored valid selection can still identify another page. Mark-read keeps the old snapshot/behind state until the existing explicit Read again action; nothing is removed optimistically and pagination performs no refresh.

Stable First/Previous/Next/Last buttons use guarded `aria-disabled` handlers and `aria-controls="notify-inbox"`. `#notify-page-status` gives atomic ko/en range and page announcements, initially off and polite after presentation changes. A new attention token and cleared, unsettled source reads keep the pager quiet so the outcome status owns its announcement. Later paging of retained UNKNOWN rows remains polite. Removal recovery tracks focused inbox elements and focuses this status only after the old element is disconnected and focus is lost. Surviving controls and external focus remain in place; a new attention token takes precedence at `#notify-status`. Native buttons support Enter and Space without custom key handlers.

## Authority boundaries

Pagination grants no mark-read, resolve, inquiry or sensitive-read capability. The original `GuardedButton`/`ConnectivityWriteButton`, controls, reasons and withheld details remain authoritative. Selection and paging send no read or command; explicit source controls continue using the existing controller. Real notification delivery remains NOT_BOUND. UNKNOWN fences, stale grants, stale-issued rows and denied scopes retain their original meanings. A notification arrival confirms no economic effect. No UI fetch, transport, retry, fallback, external send or persistence is introduced.

## Acceptance evidence

- Pure projection tests traverse all six pages of 105 fixed unique rows and all filters, compare the concatenation with the complete ordered input, verify reference identity, totals, normalization, withheld details and stale-issued evidence.
- Mounted real-screen tests compare action/table IDs, full unread counts, filters, empty results, deep links, deferred membership, invalid and removed selections, replace/push history, back/forward, ordered membership changes and delayed unchanged reads. They cover 41→20→0→21, a real synthetic mark-read on the 21st unread row followed by explicit refresh, single-unread→empty, focus recovery/survival/attention precedence, and ko/en filtering and announcements.
- Real controller tests retain UNKNOWN, stale grant, stale issue, denied and NOT_BOUND fences across paging and filtering; source read/action/inquiry counters remain unchanged during presentation operations. The existing inbox suite and its presentation-only source scan remain in force and now include the helper.
- Browser journey coverage retains SUCCESS/REJECT/UNKNOWN/NOT_BOUND/one-attempt on the normal origin. Large-fixture traversal, matching IDs, selection/history/reload, shrinking/regrowth and real mark-read/refresh use the fault origin with `window.__kixNotificationPagination = true`. The new gate renders the real page unless explicitly flagged. The shared fixture validates snapshots through `refuseNotifySnapshot` and the real controller/model builder; actions still delegate to the real synthetic source. Fixtures never enter the production bundle.
- Browser accessibility coverage exercises Enter/Space, boundary focus, removed-row recovery, surviving/external focus, ko/en ranges, axe and 320px reflow.

## Commands and results

Verification uses Node 22.23.4 (installed under `/tmp/kix-notify-node22`, outside the repository). Browser commands use `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1`. After unrelated host-load timeouts, the final full test/coverage/browser runs additionally set `VITEST_MAX_FORKS=1 VITEST_MIN_FORKS=1 VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1`. Only local concurrency changed; assertions, timeouts, CI and all limits remain intact. Commands below ran from the repository root with `PATH=/tmp/kix-notify-node22/node_modules/node/bin:$PATH` (unless the isolated baseline directory is stated). Logs use `/tmp/kix-notify-*.log`; no commands commit, push or write to GitHub.

| Command actually run | Result |
| --- | --- |
| `npm install --prefix /tmp/kix-notify-node22 --no-save node@22` | PASS; external Node 22.23.4, no repository dependency change. |
| `npm ci` | PASS under Node 22; 535 packages installed. Development advisories remain unchanged; production audit below is clean. |
| `npm exec -w @kix/web -- vitest run test/notification-pagination.test.ts test/notification-pagination-interactions.test.tsx test/notification-inbox.test.tsx test/read-state-screens.test.tsx test/tenant-permissions.test.tsx test/i18n-coverage.test.ts test/entry-import-graph.test.ts` | PASS: 7 files, 190 tests after the announcement regression. |
| `npm exec -w @kix/web -- vitest run test/operations-interactions.test.tsx` | PASS: 4 existing interaction tests; asserted copy retained. |
| `npm run typecheck` | PASS. |
| `npm run build` | PASS; includes adapter and web typechecks. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS after the announcement fix: adapter 2,298 passed / 23 skipped, web 1,515 passed, cold-entry 6 passed. Live-gate cases intentionally skipped. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: every existing floor met; web lines/statements 94.07%, functions 86.28%, branches 90.50%. |
| `npm run lint` | PASS, zero warnings. |
| `npm run deps:check` | PASS. |
| `npm run cycle-check` | PASS: no circular imports. |
| `npm run audit:warn` | PASS: 0 production vulnerabilities. |
| `node scripts/i18n-audit.mjs` | PASS: 0 findings; duplicate-key/placeholder consistency also passes in web tests. |
| `npm run budget` | PASS after the announcement/selection fixes and final concise copy: initial JS 160,183 / 290,000; CSS 4,974; total 785,000. All route/growth limits unchanged and passing; `test/entry-import-graph.test.ts` also passes its unchanged <= 785,000 assertion. |
| `npm run typecheck:e2e` | PASS. |
| `npm run test:e2e` | PASS: 49 files, 219 tests, including normal-origin notification outcomes and gated large-fixture pagination. |
| `npm run test:a11y` | PASS after the announcement fix: 22 files, 396 tests, including all 89 keyboard outcome cells and notification pagination. |
| `npm run test:budget` | PASS: 3 files, 9 tests; loopback-only browser budget checks. |
| `KIX_VISUAL_UPDATE=1 npm run test:visual` | PASS: 3 files, 123 tests; 108 matrix shots recorded/compared. Reviewed the four affected notification/permission images. |
| `npm run test:visual` (without update mode, after review) | PASS: 3 files, 123 tests; every matrix shot matches within the unchanged tolerance. |
| `git diff --check` | PASS. |
| `git diff --exit-code HEAD -- packages .aiops docs/aiops .github apps/web/bundle-budget.json package.json package-lock.json` | PASS: prohibited/locked paths and dependency files unchanged. |

The first full stub run correctly failed the unchanged 785,000-byte cold-entry assertion at 786,126 bytes; the 790,000-byte budget-file check alone was insufficient. An isolated archive of unchanged HEAD `a12df77dba5d5690f922476868eb6e7fccd755fe` measured 784,915 total gzip bytes. Notification-only prose changes and catalogue placement experiments did not free enough space; the placement experiments were discarded. Final copy keeps matching notification/tenant-permission guard explanations concise together, preserving grants versus assignments, inquiry versus export, maker/checker, UNKNOWN and stale semantics. This uses the recorded concise-copy/shared-template ruling; no limit or check was relaxed. After the announcement/selection fixes and final copy, initial JS is 160,183 bytes and total JS/CSS gzip is 785,000 bytes, at the unchanged cold-entry ceiling.

Early narrow runs exposed invalid test fixture references, a test harness that unmounted its router on rerender, one unchanged merchant test timeout during competing builds, a duplicated catalogue label and an existing workspace-copy assertion. The fixture/harness were corrected, the shared label and asserted workspace wording retained, and the seven-file final narrow run passed 189 tests. No existing test assertion was removed or weakened. Full-suite copy assertions additionally required retaining “never guessed,” “destination, not a send,” and “moved a generation”; their wording was restored without weakening tests. An initial browser-only file run also failed the harness's expected full-matrix teardown. The first complete browser journey run passed the notification cases but had three unrelated timeout failures (assistant UNKNOWN, qualification REJECT, Korean resale-market history); the later complete run passed all 219 tests as recorded above.

Continuation verification repeated `npm ci`, the seven-file narrow suite, `npm run typecheck`, `npm run build`, `KIX_REQUIRE_GATE=0 npm test`, lint, dependency/cycle/production-audit checks, the i18n audit, bundle budget and e2e typecheck; every command exited 0 with the results above. These logs are `/tmp/kix-notify-resume-*.log`. The inherited sequential verification runner also recorded successful full coverage and browser-journey runs in `/tmp/kix-notify-results.jsonl`.

The first full accessibility run passed 395 tests but failed notification REJECT: clearing the inbox during a new synthetic session announced the zero-row page as well as the denial. A token-only suppression still missed the interim loading render. The final guard keeps a cleared unsettled read and a new attention token quiet, while retained UNKNOWN paging and settled filtered-empty results remain live. The existing keyboard REJECT assertion was retained and passed after this correction. A focused retry had a module-load timeout in the i18n suite (176 tests passed); its complete rerun passed all 190 tests. An overlapping, already-failing duplicate accessibility run was stopped (exit 130) after preserving the loading/reset correction from the other builder. No matrix, assertion, timeout or CI setting was weakened.

The cleared-read selection regression also verifies that an empty interim view restores a valid URL item's page when membership returns; retained pending rows still preserve explicit pager navigation. Its four-file narrow run passed 148 tests. That correction initially measured 785,006 total gzip bytes. Concise-copy attempts then measured 785,047 and 785,010: the budget-file check passed, but the tighter entry-graph assertion failed. A 784,839-byte variant passed the size assertion but the retained inbox assertion caught missing “confirms no economic effect” wording. Restoring that exact wording and its Korean meaning while keeping the direct-open/scenario copy concise produced the final 785,000-byte build; all seven focused files passed 190 tests. The stale-issued warning remains fully stated in the banner and rows. These iterations are logged under `/tmp/kix-notify-resume-copy*-{build,budget,narrow}.log`.

A later full visual comparison passed 122/123 tests but timed out on the unchanged `receipts.phone.ko.light` shot, leaving the harness incomplete. The final comparison is rerun without changing its timeout, tolerance or baseline for that route.

One overlapping comparison passed all 123 test assertions but exited 1 during teardown because another builder was recording baselines concurrently: three handoff PNG hashes temporarily disagreed with the manifest. After that recording completed, the seven unrelated sub-threshold-noise images were restored again and the manifest hashes were reconciled with an atomic file replacement. The final comparison passed all 123 tests, including complete teardown, with that stable four-image change set (`/tmp/kix-notify-resume-stable-visual.log`, exit 0). The final full `KIX_REQUIRE_GATE=0 npm test` rerun after the copy changes passed 2,298 adapter tests (23 live-gate cases skipped), 1,515 web tests and 6 cold-entry tests. Lint and the zero-finding i18n audit were repeated after the final copy as well.

The reviewed baseline changes are `apps/e2e/visual-baselines/linux-d29b2e9b/{notifications,permissions}.{desktop.en,phone.ko}.light.png` and that directory's `manifest.json`. They reflect the concise notification/permission copy; the existing 2,000px screenshot crop does not reach the pager, which is covered by interactive browser tests. Recording also touched seven unrelated images by channel deltas no greater than 8 (zero significant pixels under the existing comparator). Those seven files were restored byte-for-byte from HEAD, and the manifest hashes were recomputed; no tolerance, matrix, mask or screenshot limit was changed.

## Changed files

- `apps/web/src/notification-pagination.ts`
- `apps/web/src/pages/Notifications.tsx`
- `apps/web/src/pages/NotificationsPanels.tsx`
- `apps/web/src/i18n/messages/pages--NotificationsPanels.ts`
- `apps/web/src/i18n/messages/notification-inbox.ts`
- `apps/web/src/i18n/messages/tenant-permissions.ts`
- `apps/web/test/notification-pagination.test.ts`
- `apps/web/test/notification-pagination-interactions.test.tsx`
- `apps/web/test/notification-inbox.test.tsx`
- `apps/web/test/support/notification-pagination-fixture.ts`
- `apps/e2e/src/build.ts`
- `apps/e2e/shell-fixtures/notifications-fault.tsx`
- `apps/e2e/shell-fixtures/notifications-pagination.tsx`
- `apps/e2e/tests/journeys/notifications.e2e.test.ts`
- `apps/e2e/tests/a11y/notifications-pagination.a11y.test.ts`
- `apps/e2e/visual-baselines/linux-d29b2e9b/notifications.desktop.en.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/notifications.phone.ko.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/permissions.desktop.en.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/permissions.phone.ko.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/manifest.json`
- `docs/c-plan-notification-pages-stub-apps-bind.md`

## Deviations and limits

The constraints' `docs/c-plan-notification-pages-stub-apps-bind.md` path takes precedence over the objective's shorter path. Applied all design-review corrections: gated fault wrapper, optional panel props, notification-scoped locale keys, fault-origin browser fixtures, explicit removal focus, rendered/filtered/total data attributes and canonical source words. A delayed-read regression additionally prevents temporary pending selection from undoing an explicit page. The 85-byte baseline headroom required concise matching copy in `i18n/messages/tenant-permissions.ts` as well as notification catalogues; this is the additional locale-only footprint under the recorded owner copy ruling. Notification rendering also shares repeated paragraph/table markup and uses a mount ref to keep the first page announcement quiet. No other screen logic, producer, controller or bundle configuration was changed.

Real delivery channels, producer integration, retention, persistence, authoritative UNKNOWN resolution and production qualification remain UNDETERMINED or NOT_BOUND. No contract/gate update is consumed. An unmerged contract/dependency, new protocol command or policy value, equipment, money, credentials or production runtime would require a separate owner decision under the node's STOP rules. None is needed for this local projection.
