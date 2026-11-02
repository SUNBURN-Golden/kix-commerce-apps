# M05 synthetic session CRM bind and evidence

Node: `c-plan-c-m05-crm-session-stub`. M05 remains **미착수** in README and UI. This is an app-local fixture workspace, not production CRM qualification or protocol truth.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

Stable-runner ruling — KIX Commerce, 2026-11-02: use GitHub Actions exact-head CI for acceptance, including e2e/a11y/visual; keep the implementation, timeouts, assertions, retries and budgets unchanged. The builder prepares the local evidence and leaves commit, push and PR creation to the supervisor, as instructed for this work session. The earlier stable-runner decision is resolved; exact-head CI acceptance remains pending until the supervisor publishes this branch.

## Scope and boundaries

`/marketing/m05` now reads the existing page-load ConsentDesk/ConsentBind evidence to show a consent-scoped audience preview, per-channel preferences, a purpose ledger, and withdrawal effects. Three deterministic synthetic fan tokens use the existing `fan | member` vocabulary. There are no names, addresses, imported profiles, sender, CRM export, or additional commands. `channelSend: "none"` is invariant.

`set_consent` still uses caller subject as actor and exactly the published domain/allowed/business/channel/eventId/expectedConsentVersion/purpose body. `authorize_marketing` still uses `marketing-adapter` and the published body including subject. Existing `cns:<eventId>:<attempt>:<step>` IDs, ConsentBind validation/fences, fixed stub version `1`, and single-attempt adapter transport remain unchanged. No capture/settle_capture composition, desk method remapping, binding changes, or pin changes occur.

The synthetic workspace is **NOT_BOUND** in integration-http, independently of transport availability; it supplies no fixture fallback there. The existing consent command panel keeps its transport behavior. Preview controls and locale changes send nothing.

## File map and app-internal interfaces

| File | Responsibility |
| --- | --- |
| `apps/web/src/consent-desk.ts` | Capture owned submitted scopes, expected versions, validated typed outcomes and authorization lineage; expose copied evidence plus environment/pending/halted state. |
| `apps/web/src/crm-session.ts` | Fixture fans and pure audience, channel, and purpose projections. No network or storage API. |
| `apps/web/src/pages/marketing/M05CrmWorkspace.tsx` | Native labelled selects, live included count, captioned tables and keyboard-focusable named scroll regions. |
| `apps/web/src/pages/marketing/M05Consent.tsx` | Subscribe to the same page-load desk; retain existing forms and flag controls. |
| `apps/web/src/i18n/messages/pages--marketing--M05Consent.ts`, `apps/web/src/i18n/verbatim.ts` | Lazy ko/en copy and explicit reasons for preserving protocol/status/tier words. |
| `apps/web/test/{crm-session.test.ts,m05-crm-workspace.test.tsx,consent-desk.test.ts,receipt-explorer.test.tsx}` | Projection/lifecycle, mounted localization/interaction, evidence ownership, and export isolation. |
| `apps/web/test/support/receipt-pagination-fixture.ts` | Supply the added environment field in the existing typed receipt fixture. |
| `apps/e2e/tests/journeys/marketing-m05.e2e.test.ts` | Browser preview, native keyboard filter, separate flag withdrawal, confirmed consent withdrawal and reload clearing. |
| `apps/web/build-locale-copy.ts`, `apps/web/vite.config.ts`, `apps/web/test/build-locale-copy.test.ts` | Build-only shared locale row templates; exact evaluated catalogue conservation checks. |
| `README.md` | Describe workspace and link this evidence without promoting any ORIGINAL_32 label. |

All added interfaces are internal view/evidence types, not public schemas:

- `ConsentEvidenceScope`: domain, eventId, subject, business, channel, purpose.
- `ConsentAttemptEvidence`: operationId, step, scope, expectedConsentVersion, status, code, validated result, consentOperationId. The result is the existing consent result or authorization result, copied after ConsentBind validation. An authorization links only to a matching confirmed consent attempt.
- `CrmFixtureFan`: fanId, synthetic subject, tier.
- `CrmSegmentFilter`: eventId, business, channel, purpose, tier (including all). Scope choices come from recorded submissions; they prescribe no channel or purpose policy.
- `CrmAudienceRow`: fanId, observed consent state/version, authorization state, included, exclusion reason.
- `CrmPurposeLedgerRow`: fanId, complete scope, consent and authorization operation IDs, both receipt versions, current/historical status, channelSend none.

## Consent-to-preview rules

Every fan starts excluded. Matching requires exact domain, event, subject, business, channel and purpose. Unsaved drafts, saved flags, and fixture membership never grant inclusion. Only confirmed allowed consent followed by a matching confirmed authorization with the same receipt version and consent operation lineage qualifies. No version increment is calculated.

A new consent attempt invalidates the event preview immediately while pending. A halted event stays excluded. UNKNOWN never becomes confirmed withdrawal. Regrant requires a fresh authorization even when both receipts again say version `1`. Historical authorization rows remain visible as STALE. Each recorded channel/purpose/subject/event scope is projected separately. The purpose ledger records observed synthetic use, not delivery, legal compliance, or retention policy.

| Observed situation | Preview result |
| --- | --- |
| Unset consent / flags only / unsaved draft | Excluded; unset |
| Confirmed allowed consent, no authorization | Excluded; fresh authorization required |
| Exact scope, confirmed allowed, matching lineage and receipt versions | Included, synthetic only |
| Tier mismatch / foreign scope or subject | Excluded |
| Any event command pending | Excluded immediately; pending |
| Lost or malformed receipt | Excluded; UNKNOWN where observed |
| Rejected / not-sent halted event | Excluded; blocked |
| Confirmed allowed false | Excluded; confirmed withdrawal |
| Consent version changed, prior authorization | Excluded; STALE |
| Withdrawal then regrant at repeated literal version 1 | Excluded until fresh matching authorization; old authorization STALE |
| Withdraw flags | Changes separate flag state only; no protocol consent withdrawal |
| integration-http | NOT_BOUND; no fixture tables/controls or fallback |

## Storage, lifecycle and exports

Evidence and filters live only in process memory for this page load. Snapshot scopes/results are deep-copied from internal records; changing a submitted draft or exposed snapshot cannot mutate the retained source. Desk reset/reload clears all evidence; delayed outcomes from an orphaned pre-reset record cannot repopulate it. Route navigation preserves consent evidence; local filter selections reset when the workspace remounts. Locale changes preserve the mounted workspace's selection and evidence without sending anything.

The existing allowed sessionStorage attempt counters remain unchanged to avoid reusing operation IDs on reload. They store counters, not consent scopes, results, preferences or audience inclusion. Existing support diagnostics still project the original receipt rows and their existing redacted actor labels. New scope/version-input/lineage evidence is never added to those exports or outcome diagnostics. Browser tests reject application network calls; DOM tests stub network to fail and check storage excludes submitted CRM fields.

Campaign editing, real messaging, legal-purpose/channel policy, retention TTL, persistent CRM records and production qualification remain out of scope or UNDETERMINED. No policy or permission is inferred from an authorization receipt.

## Acceptance and verification

This continuation reviewed and retained the complete earlier implementation, then reran the commands below on Node 22.20.0. Local logs are `/tmp/kix-m05-review-*.log`; the tables preserve their results here. These observations do not claim unpublished GitHub Actions results.

Environment setup (outside the repository; exit 0):

```sh
npm install --prefix /tmp/kix-m05-node22 --no-save --package-lock=false node@22.20.0
export PATH=/tmp/kix-m05-node22/node_modules/node/bin:$PATH
```

The first focused invocation ran before dependencies were installed and exited 1 during config loading: `vitest/config` and `react-router-dom` were absent. `npm exec` attempted a temporary Vitest bootstrap; no tests ran and no repository manifest or lockfile changed. After `npm ci` installed the locked dependencies, the focused command below used repository Vitest 3.2.7 and passed. This setup failure is not counted as a test pass.

The focused, full unit and coverage runs used the existing worker environment to bound local resource use, without changing test assertions, timeouts, retries or configuration:

```sh
export VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 VITEST_MAX_FORKS=1 VITEST_MIN_FORKS=1
npm exec --no -w @kix/web -- vitest run test/build-locale-copy.test.ts test/crm-session.test.ts test/consent-desk.test.ts test/m05-crm-workspace.test.tsx test/i18n-coverage.test.ts test/marketing-contracts.test.ts test/marketing-routes.test.tsx test/storage-allow-list.test.ts test/receipt-explorer.test.tsx
```

The first invocation used the same file arguments without `--no`. The successful focused run covers withdrawal/unset exclusion; literal version changes and fixed-version lineage; domain/event/subject/business/channel/purpose/tier isolation; pending, UNKNOWN, rejected and malformed outcomes; submitted-scope ownership and reset/delayed outcomes; mounted ko/en selection preservation; labels, captions, live status and keyboard-focusable scroll regions; storage/export privacy; command and label boundaries; and evaluated catalogue preservation.

| Actual command | Result in this continuation |
| --- | --- |
| Initial focused invocation before install | Exit 1; config-loading failure, no tests executed. Resolved by `npm ci`. |
| `npm ci` | Exit 0; 535 packages installed; manifests and lockfile unchanged. Existing audit warnings were reported; no dependency changes were made. |
| Focused command above, after install | Exit 0; 9 files / 90 tests. |
| `npm run typecheck` | Exit 0. |
| `npm run build` | Exit 0; package typechecks and Vite production build. |
| `KIX_REQUIRE_GATE=0 npm test` | Exit 0; adapter 1,663 passed / 23 skipped; web 1,350 passed; cold-start 6 passed. Live-gate skips are not passes. |
| `npm run budget` | Exit 0; initial JS 160,165, CSS 4,974, total 780,504 gzip bytes. Budget file and stricter 785,000-byte entry assertion unchanged. |
| `npm run lint` | Exit 0. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | Exit 0; all floors met. Adapter lines/statements 91.30%, functions 97.47%, branches 85.10%; web lines/statements 93.33%, functions 83.43%, branches 89.66%. |
| `npm run deps:check` | Exit 0; 4 manifests / 630 lockfile entries. |
| `npm run cycle-check` | Exit 0; no circular imports in any workspace. |
| `npm run typecheck:e2e` | Exit 0. |
| Read-only Python protected-path / README comparison | Exit 0; protected paths unchanged; all five ORIGINAL_32 marketing labels preserved. Locked binding SHA-256: `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`. |
| `git diff --check` | Exit 0. |

Browser commands used the existing Chrome configuration and loopback-only harness. They did not use the unit-test worker overrides:

```sh
export KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1
```

| Actual command | Result in this continuation |
| --- | --- |
| `KIX_E2E_RECORD_OUT=/tmp/kix-m05-review-e2e-record.json npm run test:e2e` | Exit 0; 47 files / 198 tests, including all four M05 cases. All 171 recorded checks passed. |
| `KIX_A11Y_RECORD_OUT=/tmp/kix-m05-review-a11y-record.json npm run test:a11y` | Exit 0; 19 files / 371 tests; keyboard facet 85/85. M05 axe, keyboard/reflow, consent forms and Korean catalogue observations passed. Existing recorded findings on other surfaces remain; this is not a conformance claim. |
| `KIX_BUDGET_RECORD_OUT=/tmp/kix-m05-review-browser-budget-record.json npm run test:budget` | Exit 0; 3 files / 9 tests; route splitting, chunk failures and long-list render tripwires passed. |
| `KIX_VISUAL_RECORD_OUT=/tmp/kix-m05-review-visual-record.json KIX_VISUAL_OUT=/tmp/kix-m05-review-visual-out npm run test:visual` | Exit 0; 3 files / 109 tests; 94/94 PNG comparisons MATCH on `linux-d29b2e9b`. Both M05 shots have 0 differing pixels. |

Journey, accessibility, browser-budget and visual records each report `nonLoopback: 0`, `nonGet: 0`, `appNetworkCalls: 0`. No live protocol gate checkout or credentials were used. The live-gate CI job and exact-head GitHub Actions acceptance have not been executed by this builder.

A separate foreground `node --input-type=module` Playwright observation served the built app on `127.0.0.1`, entered synthetic consent/authorization and scope selections, and captured `/tmp/kix-m05-review-panel.png` (exit 0; `Included: 1`). The full CRM panel was reviewed by eye, including audience, channel and purpose tables below the 2,000-pixel baseline capture cap. Existing named scroll regions handle long ledger rows. No screenshot baseline or manifest has been changed.

READY in the builder handoff means ready for the supervisor to publish this branch and run the selected exact-head CI. It does not claim unpublished GitHub Actions results, user acceptance, production qualification or release approval.

## Deviations and limitations

No product-scope deviation or additional runtime-code fix was needed. This continuation retained the earlier implementation and refreshed its evidence, including clarifying that filters reset on remount while consent evidence survives route navigation. It did not commit, push, open a PR/issue, post comments, edit protected paths, or change dependencies, budgets, timeouts, assertions or CI.

Build-plan deviation retained from the earlier attempt: the earlier builder recorded a clean baseline build at `1fd6f014765a24bd98b4245d3da2a118ce6364ff` of 784,948 gzip bytes, only 52 bytes below the stricter 785,000-byte entry assertion, and an initial CRM build of 788,436 bytes. Those historical baseline measurements were not repeated in this continuation. Concise copy and a shared table renderer alone did not fit. A build-only TypeScript AST transform templates supported static bilingual dictionaries as rows with one copy of their keys and a shared constructor. It preserves existing string/constant expressions and skips unsupported/effectful/prototype/differently ordered shapes. Both locales, ordering, placeholders and protocol/status words are checked against the original evaluated catalogues. This follows the recorded 2026-10-23 owner authorization for shared-template deduplication; no budget relaxation or other-screen copy changes are needed. The current build independently measured 780,504 total gzip bytes. The typed receipt-pagination fixture supplies the added snapshot environment field. Existing page-load attempt counters and diagnostic actor labels keep their prior behavior.

The earlier stopped attempts reported browser timeouts accompanied by host clock steps and event-loop stalls. The 2026-11-02 owner ruling resolved that runner decision by selecting GitHub Actions exact-head CI. Local results above supersede earlier local observations for this continuation, but do not replace that acceptance gate. The supervisor must obtain complete green exact-head CI, including journeys, accessibility and visual comparison; no gate is waived or weakened.

A local observation is not user acceptance, a screen-reader/real-device run, production readiness, legal compliance, or release approval. Stop for unmerged dependencies/contracts, new commands/public schemas, legal policy/retention values, secrets, paid services, hardware, live operations, locked binding changes, or a fail-closed rule violation. None is needed for this synthetic implementation.
