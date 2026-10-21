# Async state patterns (stub) apps bind

Shared presentation for loading, empty, error, UNKNOWN, STALE and NOT_BOUND, with an executable screen × state matrix over the 37 registry routes (222 cells). Local synthetic evidence only; no integration, qualification, acceptance or release is claimed.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

`contract_change=NO`. The component props, presentation vocabulary, matrix and check ids are app-internal. They are not a public schema, operation, capability or identifier. Nothing is composed past `accept_trade`. `capture` and `settle_capture` are never composed or sent. `placeHold` remains not-bound with `consideredAction: reserve_listing`; `prepare_trade` never receives a hold body.

## What did not change

- The locked `packages/protocol-adapter/src/commerce-bindings.ts` remains byte-identical: sha256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`.
- No package, dependency, lockfile, OpenAPI pin, `PINNED_ACTIONS`, `protocolMergeSha`, CI workflow or gate SHA changed. `.aiops/` and `docs/aiops/` are untouched; kix-protocol is read-only context.
- No route, screen, workspace surface or contract fixture row was added. The journey/a11y screen counts and historical local evidence-matrix tables remain unchanged. The historical node status is not re-typed at this older base.
- Stub remains the default. No fetch, proxy, automatic retry, Idempotency-Key, redirect following or fallback was introduced. No UI action replays a write. No session fence or journal is cleared by this component. Session retention remains UNDETERMINED; existing sessionStorage behavior is retained and no TTL is chosen.
- The shell boundary and its recovery policy remain intact. Its own cause-specific “sent nothing and cleared nothing” facts apply to the boundary, not to arbitrary errors. No existing test or accessibility finding was removed, skipped or relaxed.

## Behaviour

`components/AsyncState.tsx` renders a presentation, never an outcome reducer. It owns no adapter, storage, request or effect. UNKNOWN may coexist with a stale read; a fresh read establishes no business outcome. Existing last-confirmed steps, unconfirmed requests, blocked next actions and receipt/journal fields remain on their screens.

| Presentation | Word | Announcement owner | Busy | Next action |
|---|---|---|---|---|
| loading | Loading / 불러오는 중 | status, polite | true | Caller retains its existing controls |
| empty | Empty / 빈 값 | status, polite | false | Caller retains its existing empty-state controls |
| error | Error / 오류 | alert, assertive | false | Help always; a read button only with a caller-supplied supported read |
| unknown | UNKNOWN | status, polite | false | Inspect fence/receipts; no recovery or retry button |
| stale | STALE | status, polite | false | Help; caller-supplied read if supported; UNKNOWN remains unresolved |
| not-bound | NOT_BOUND | status, polite | false | Recorded reason, never a send |

Every kind has a visible word and border treatment. Error has a solid border and UNKNOWN a double border; STALE and NOT_BOUND retain different dashed/dotted treatments and a wider leading border. Colours use the existing ink/card/line tokens. Browser tests inspect computed borders, text/background differences and automatic forced-colour adjustment in dark and forced-colour modes. This is not a conformance target or a contrast certification.

The read action is a non-submitting button. The component calls the supplied handler once per activation; it neither reloads nor remounts the page. Only discovery's existing catalogue read is supplied in this adoption. Other error and stale presentations offer help and retain their own existing screen controls. Unsafe codes are omitted using the existing uppercase code shape. Typed desk records come from `COMMERCE_COMMAND_BINDINGS`, preserving nullable `consideredAction`; synthetic/uncomposed reason text remains caller-owned and is not converted into a desk mapping.

Progressive adoption covers screen-code loading, booking read/error states, discovery catalogue and empty results, receipt empty/detail/unbound states, organizer batch progress/empty/unbound records, session status/unknown records, journey unknown rows and loading/empty/unbound status, and notification read/request states. The shell's existing fault panel and other screen presentations are deliberately retained with executable evidence.

Live-region ownership is explicit. A shared standalone region owns its announcement; a presentation within `#receipt-detail` or a journal/request/table row whose update is already announced by `#session-status`, `#notify-status` or `#xs-status` uses `announcement="parent"` and emits no nested role or aria-live. Existing focus targets, tabindex and describedby ids remain. `#session-status` now marks only an in-progress write busy. Organizer keeps its existing outer submitting/fieldset busy regions; its progress note reports the same transition. No new moving focus or focus-stealing effect was added.

## Checks

`src/async-state/matrix.ts` is the executable declaration. Each route × state has an id, a driver, a reason and an evidence pointer. CHECKED cells execute the new owning-route/shell assertions. REFERENCE cells name an exact existing screen assertion by file and test title, or a registered browser check. A test title merely present in source does not count: the Vitest reporter requires every referenced web test to have executed and passed exactly once whenever the matrix suite runs. Filtered runs containing the matrix but omitting evidence therefore fail. A component-only narrow run does not claim the screen matrix.

`async-state-matrix.test.tsx` mounts every actual registry route, drives each code loader with a synthetic pending import, renders each route-labelled shell fault panel, and injects synthetic model dependencies before loading the actual owning pages for lost journey/consent answers and stale refund reads. These are module mocks in the test, not runtime switches in the app. Booking's resolved no-event state, M02's effect-resolved empty catalogue, and the box-office refund desk after selection have browser drivers because server rendering cannot execute their effects/interactions. Existing tests continue driving the other real screen/panel models with their synthetic source controllers. They assert their own screen, not another screen's explanatory reference text.

The matrix rejects missing/duplicate cells, unsupported or unexecuted check ids, missing check metadata and undocumented exclusions. Reference validation rejects absent, skipped, failed or ambiguous test results. Excluded states have a route-specific reason, owner and an executable route mount audit with source pointer. NOT_APPLICABLE means the current screen has no corresponding outcome (for example, glossary text is not a live UNKNOWN). NOT_REACHABLE records a source/port limitation, not a fabricated successful state. No state is manufactured just to fill a cell.

`async-state-patterns.test.tsx` checks both locales, code filtering, nullable binding records, action restrictions, role/live/busy semantics and parent-owned announcements. Additive assertions close existing model-only gaps for assistant empty/stale, permissions empty/stale/unknown, organizer stale-selection rendering and gift unbound-reason assertions. Existing fault, evidence, i18n and display checks remain in force.

`apps/e2e/tests/a11y/async-state.a11y.test.ts` adds six mandatory check ids to the a11y ledger:

- `a11y.async.read-states`: normal discovery; held catalogue read; synthetic read fault; error help; keyboard Enter on Read again; exactly one additional explicit read; settled empty state. Loading/error/empty alternate states also run axe against the unchanged ratchet.
- `a11y.async.catalogue-empty`: effect-resolved empty states on M02 and booking, on their actual routes.
- `a11y.async.refund-stale`: select a mock settlement on box office, select the stale synthetic refund scenario, and assert STALE on that route.
- `a11y.async.unknown-fence`: lost session attach; the existing polite status region owns the announcement and the shared UNKNOWN row stays silent, with no recovery button; read again retains the UNKNOWN record and disabled attach; Tab/Enter opens receipts.
- `a11y.async.dark` and `a11y.async.forced-colors`: actual journey UNKNOWN and actual discovery error keep different computed borders and readable token combinations.

The existing test-only protocol wrapper holds/fails/empties `listPerformances` in the fault build. It performs no HTTP request and changes no product bundle. The harness can retain React StrictMode's initial effect probe; the assertion measures one additional read for one explicit activation, not an assumed number of initial effect executions. New ids must be recorded by the a11y suite teardown; a missing driver is a failure. The existing booking-missing alternate driver and journey assertion now assert empty/status and absence of an alert: a resolved absent performance is not a load error. No new violation is absorbed into KNOWN_FINDINGS.

## Screen × state snapshot

C = new executable owning-route/shell check; R = exact existing executed screen assertion or registered browser driver; A = NOT_APPLICABLE; N = NOT_REACHABLE. Full reasons, source pointers and owners are in the executable matrix. A reference word on a different screen is never coverage.

| Route id | Loading | Empty | Error | UNKNOWN | STALE | NOT_BOUND |
|---|---|---|---|---|---|---|
| `box-office` | C | C | C | C | R | C |
| `buyer` | C | R | C | R | C | R |
| `discovery` | C | R | C | N | R | R |
| `inventory` | C | R | C | R | R | R |
| `platform` | C | R | C | R | R | R |
| `merchant` | C | R | C | N | R | R |
| `booking` | C | R | C | C | C | C |
| `admission` | C | C | C | A | R | A |
| `resale` | C | C | C | A | A | A |
| `gift` | C | A | C | R | A | R |
| `organizer-workspace` | C | C | C | R | R | C |
| `organizer` | C | A | C | R | A | R |
| `receipts` | C | R | C | R | R | R |
| `handoff` | C | R | C | N | A | N |
| `credit-origination` | C | R | C | R | R | R |
| `credit-servicing` | C | R | C | R | R | R |
| `credit` | C | C | C | A | A | A |
| `finance` | C | R | C | R | R | R |
| `marketing` | C | A | C | A | A | A |
| `marketing-journey` | C | R | C | R | R | R |
| `marketing-m01` | C | C | C | A | A | A |
| `marketing-m02` | C | R | C | N | A | N |
| `marketing-m03` | C | A | C | A | A | A |
| `marketing-m04` | C | C | C | A | A | A |
| `marketing-m05` | C | A | C | C | A | C |
| `assistant` | C | R | C | R | R | R |
| `permissions` | C | R | C | R | R | R |
| `notifications` | C | R | C | R | R | R |
| `provider` | C | R | C | R | R | R |
| `marketplace-performance` | C | R | C | R | R | R |
| `mobile` | C | R | C | R | R | R |
| `qualification` | C | R | C | R | A | R |
| `release` | C | R | C | R | A | R |
| `identity` | C | R | C | R | R | R |
| `session` | C | R | C | R | A | R |
| `journeys` | C | R | C | R | A | R |
| `help` | C | A | C | A | A | A |

## Limits and deviations from the design plan

- The repository's shell import rule forbids importing the shared component into its fault boundary. That boundary is kept byte-identical; every route's error cell checks the actual existing fault presentation, and browser fault recovery remains covered by the original suite.
- The state vocabulary is in a small `.ts` module so the e2e matrix can consume it without importing JSX. The reference-run reporter and its validation helper are added beyond the proposed file list to enforce actual execution of exact evidence pointers.
- Booking and M02 effect states and box-office post-selection states use browser drivers; SSR is used only for synthetic injectable models and code-loader fallback. Handoff is a local filtered feature table, not a catalogue read.
- No route-count or historical evidence-table update is needed. Existing a11y alternate-state assertions were updated for the corrected empty semantics; the baseline was not expanded.

## Files changed

- `README.md`
- `apps/e2e/shell-fixtures/protocol-fault.ts`
- `apps/e2e/src/a11y-matrix.ts`
- `apps/e2e/tests/a11y/alt-states.a11y.test.ts`
- `apps/e2e/tests/a11y/async-state.a11y.test.ts`
- `apps/e2e/tests/journeys/booking.e2e.test.ts`
- `apps/web/src/async-state/kinds.ts`
- `apps/web/src/async-state/matrix.ts`
- `apps/web/src/components/AsyncState.tsx`
- `apps/web/src/components/ScreenLoading.tsx`
- `apps/web/src/i18n/catalogue.ts`
- `apps/web/src/pages/Booking.tsx`
- `apps/web/src/pages/CrossSurfaceJourneysPanels.tsx`
- `apps/web/src/pages/DiscoveryPanels.tsx`
- `apps/web/src/pages/NotificationsPanels.tsx`
- `apps/web/src/pages/OrganizerWorkspace.tsx`
- `apps/web/src/pages/Receipts.tsx`
- `apps/web/src/pages/SessionRecoveryPanels.tsx`
- `apps/web/src/styles.css`
- `apps/web/test/async-state-matrix.test.tsx`
- `apps/web/test/async-state-patterns.test.tsx`
- `apps/web/test/delegated-assistant.test.tsx`
- `apps/web/test/gift-panel.test.tsx`
- `apps/web/test/organizer-workspace.test.tsx`
- `apps/web/test/support/async-state-references.ts`
- `apps/web/test/support/async-state-reporter.ts`
- `apps/web/test/tenant-permissions.test.tsx`
- `apps/web/vitest.config.ts`
- `docs/c-async-state-patterns-stub-apps-bind.md`

## Local runs observed

Source base: `288c8ef8b58dec52093cfbc0a9cbca6b65deeab3` on `agent/kixc-c-async-state-patterns-stub`. Changes remain uncommitted; the supervisor owns the delivery HEAD. Commands run from the repository root unless a workspace is explicitly selected. Browser commands use `/usr/bin/google-chrome` with the container sandbox flag; all app origins stay on `127.0.0.1`. Logs and optional browser records were written under `/tmp/kix-async-*`, outside the repository.

The initial narrow screen command was:

```bash
npm test -w @kix/web -- async-state-patterns.test.tsx screen-loader.test.tsx app-shell-resilience.test.tsx discovery-page.test.tsx receipt-explorer.test.tsx organizer-workspace.test.tsx session-recovery.test.tsx cross-surface-journeys.test.tsx notification-inbox.test.tsx
```

It initially reported 122 passed and 2 failed: importing the shared component into the shell boundary violated the existing import boundary, and an UNKNOWN sentence included a forbidden positive-outcome word even in a negation. The shell was restored unchanged and UNKNOWN copy was corrected. The component-only narrow command below then passed. The broader web matrix runs caught wrong fixture types, untraced synthetic transport errors (correctly classified NOT_SENT), unsupported SSR assumptions and overly broad assertion selectors. These were fixed with existing typed records, traced lost-response fixtures, actual owning-page model injection and browser state drivers; no existing safety assertion was removed.

Browser failures observed and fixed: duplicate `p.empty` selectors introduced by the shared wrapper; a fixed count of initial effect executions in a StrictMode-capable harness; the pre-existing journey assertion treating an absent performance as an alert; and an exact label selector that included a synthetic scenario note. The assertions now require exactly one additional explicit read, an empty/status result with no alert, and the specific refund scenario control. A final ARIA pass made the existing session/notification/journey status regions the sole announcement owners for their row updates.

| Command | Observed result |
|---|---|
| `npm ci` | Passed; 493 packages installed. npm reported 5 existing audit advisories; lockfile unchanged. |
| `npm test -w @kix/web -- async-state-patterns.test.tsx` | Passed: 10 component-contract tests. |
| `npm test -w @kix/web` | Passed after correcting fixture/driver failures; complete matrix references executed. |
| `npm run typecheck -w @kix/web` | Initially failed on binding/export/status typing; corrected locally. |
| `npm run typecheck` | Passed on the final implementation. |
| `npm run build` | Passed on the final implementation; existing large-entry-chunk advisory remains. |
| `KIX_REQUIRE_GATE=0 npm test` | Passed: adapter 1306 and web 890 tests (2196 total); 23 existing live-gate tests intentionally skipped under gate=0. |
| `npm run lint` | Passed. |
| `npm run cycle-check` | Passed for adapter, web and e2e; no circular imports. |
| `npm run deps:check` | Passed: 4 package manifests, 589 lockfile entries. |
| `npm run audit:warn` | Passed; production audit reported 0 vulnerabilities. |
| `npm run budget` | Passed: initial JS 289323 B gzip, initial CSS 4922 B gzip, total 623061 B gzip; largest route chunk 21646 B gzip. |
| `npm run typecheck:e2e` | Passed. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | Passed all floors: adapter lines/statements 91.18%, functions 97.44%, branches 84.52%; web lines/statements 84.22%, functions 60.72%, branches 84.99%. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:e2e` | Passed after correcting the missing-performance assertion: 51 tests. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:a11y` | Passed on the final UI: 236 tests, 37 screen records and all 6 new checks; unchanged findings ratchet. Both browser records report zero non-loopback, non-GET and application network calls. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:budget` | Passed: 9 tests; existing limits unchanged. |
| `git diff --check` | Passed. |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` | Matches the locked hash above. |

Final browser reruns also supplied `KIX_E2E_RECORD_OUT=/tmp/kix-async-e2e-record.json` and `KIX_A11Y_RECORD_OUT=/tmp/kix-async-a11y-record.json` respectively. These record paths add no product behavior and are not committed.

## Not verified

The authenticated live protocol gate (`KIX_REQUIRE_GATE=0` deliberately skips it), hosted CI, HTTP mode in a browser, real producers/providers/SDKs, real devices, screen readers and user acceptance. Nothing authorizes payment, credit disbursement, venue scanning, a public deployment or production operation. The a11y target standard and session TTL remain UNDETERMINED.

## Hold

This is local stub product-quality evidence only. Integration, qualification, acceptance and release retain their independent gates and authorities.
