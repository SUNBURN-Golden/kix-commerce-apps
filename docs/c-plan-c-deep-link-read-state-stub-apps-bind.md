# Synthetic desk deep-link read state

Node: `c-plan-c-deep-link-read-state-stub`. `contract_change=NO`.
Base HEAD: `a0c6f89ec15fdecbaea74c5a64d3ce99c586f9a4`.

A shared link is a **view pointer**, not evidence, authority, an approval or a
replay. Opening it sends no write and grants nothing. Normal screen reads still
run. Writes, intents, actor strings, scenarios, attach controls and session
journal entries are never serialized.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
The locked commerce bindings remain byte-identical. No command composition,
producer contract, protocol pin, gate SHA or adapter behavior changes.

The scope owner ruling of **2026-10-24 20:52 KST**, under 준태님's 2026-10-15
standing delegation, selects Option 1: origination uses lane + selected
application (`applicationRef`, `ORIGINATION_LANES`). Obligation selection belongs
only to servicing. This resolves the previous stopped draft; no burden or
installment is substituted for an obligation.

## View pointers

| Screen | Search parameters | Valid source domain |
| --- | --- | --- |
| Buyer | `receipt` | Evidence `kind:refId:step`; the step distinguishes receipts for the same event/gift without an operation or journal identifier. |
| Platform | `channel`, `trade` | Listing channel, then the rendered trades for that channel. |
| Merchant | `cut`, `row` | Source cut, then event/listing/trade refs within that cut. |
| Finance | `queue`, `case` | **Case category**, then case refs in that category; case state is a separate fact. |
| Credit origination | `lane`, `application` | `ORIGINATION_LANES`, current read's actual application ref. |
| Credit servicing | `lane`, `obligation` | `SERVICING_LANES`, current obligation ref only when that authorized read supplies obligation facts. It never calls `setObligationRef` or switches scope. |
| Marketing journey | `benefit` | Rendered benefit refs. |
| Assistant | `grant` | Rendered grant refs. |
| Permissions | `workspace` | `TENANT_ROLES`; a display projection of the last authorized snapshot, as described below. |
| Notifications | `filter`, `item` | `all` / `unread` / `read`, then notification refs in that subset. |
| Identity | `item` | Read item ids. |
| Session | `item` | Read item ids, never journal entries. |
| Journeys | `row` | Rendered journey row ids. |
| Provider | `step` | `orderRef:facet` from the order's actual journey facets, including order context. Binding-register rows and intent refs are excluded. |

Selections replace the history entry. Filters and lane/workspace tabs push an
entry; their draft selects apply only on **Apply view**. Changing channel, cut,
queue or inbox filter clears its dependent selection. A restored selection marks
the actual rendered row with `aria-current="true"` and
`data-read-selected="true"`. It moves no focus.

Permissions pointers do not switch actor, controller role, capabilities or source
scope. The selected role's existing `tenantRoleResources` definition filters
**all** resource families: members by role; orders, events, accounts, cases,
proposals and audit by permitted kind. It intersects the current snapshot and
cannot fetch or manufacture another role's workspace. Content absent from the
current authorized snapshot remains absent; the existing empty state remains
available. A role encoded as display state conveys no authority. Tests use each
real role's already-authorized snapshot and verify the actor/role stay fixed
while the URL projection changes.

Origination keeps the application summary visible and selects review,
commitment or drawdown detail independently. Servicing selects the existing draw,
reservation, exposure, schedule, payment, case and proposal views. Neither tab
selects a write target. The session model can report an empty journal before its
item read finishes: membership stays pending until item ids are available.

## Validation and lifecycle

`src/shell/read-state-params.ts` owns the complete per-screen key allow-list.
Both parsing and serialization validate exact single values against bounded
syntax and the supplied source domain. Duplicates, empty values, malformed values,
unknown ids, invalid parent/child combinations and unlisted keys are omitted.
Only one valid `lang=en|ko` is preserved, using the existing locale validator.
New values with an unavailable domain cannot be serialized. Unvalidated values
are never rendered as restored state.

Unknown keys and syntax/locale failures are cleaned immediately with replace
navigation, even while source membership is pending. Membership checks wait for
a settled source. The invalid-link notice survives cleanup. Validation is tracked
per location visit (and carried across its own cleanup), so a later write or
source refresh that removes a once-valid row renders it unselected **without
changing the URL**. A new URL visit is validated anew. Bare page fixtures use
local React view state and introduce no storage.

Buyer evidence and platform trades created during a page load are ephemeral.
The receipt selector is unique across receipt steps, but a real reload does not
recreate a missing receipt/trade. Tests supply deterministic receipt and booked
trade fixtures for independent view mounts; separate fresh-source tests verify
that unavailable pointers show the notice and are removed. This is not a claim
that retained module state proves reload persistence. Chrome tests verify actual
reload, back and forward restoration on notifications and finance, whose source
fixtures are available after reload. No persistence or replay is added.

## Boundaries

The default remains stub. HTTP remains explicit loopback-only, one attempt, no
redirect following, no retry, no fallback, no Idempotency-Key and no gate proxy.
No UI component fetch is added. Production and truth/qualification flags stay
false. There is no payment, KYC, credit disbursement, bank rail, venue scanning,
live marketplace, public deployment, SLO, copied protocol math or secret.

Desk models/controllers, adapters, route registry, breadcrumbs, a11y matrices,
fixed bundle budgets, pins, CI, storage/untrusted-render/connectivity guard tests,
`.aiops/` and `docs/aiops/` are unchanged. The shell's pathname focus behavior is
exercised through the real App: search restoration preserves focused input;
changing route focuses the new heading.

## Changed files

- `apps/web/src/shell/read-state-params.ts`: parser, serializer, navigation hook.
- `apps/web/src/pages/ReadState.tsx`: notices, draft/apply filters, row selection
  controls and credit lane projections.
- Pages and their selected-row panels: `Buyer`, `Platform`, `Merchant`, `Finance`,
  `CreditOrigination`, `CreditServicing`, `MarketingJourney`, `Assistant`,
  `Notifications`, `JourneyIdentity`, `SessionRecovery`, `CrossSurfaceJourneys`,
  `ProviderJourney`; plus `TenantPermissions.tsx` for workspace projection.
- `apps/web/vite.config.ts`: groups related lazy credit and platform/provider copy catalogues for compression, with explicit-only manual chunks; keeps their dependencies out of the entry bundle.
- `apps/web/src/i18n/messages/read-state.ts` and
  `apps/web/src/i18n/generated-catalogue.ts`: English/Korean copy and type/test
  inventory; browser routes load the copy lazily.
- `apps/web/test/read-state-params.test.ts`,
  `apps/web/test/read-state-screens.test.tsx`,
  `apps/web/test/support/render-route.tsx`: allow-list and screen/lifecycle tests.
- `apps/e2e/src/journey-matrix.ts` and
  `apps/e2e/tests/shared.e2e.test.ts`: shared check registration and two-desk
  history/reload check.
- This bind/evidence document.

## Verification

Commands actually run from the worktree (browser steps use the environment
shown below). The table records the final completed run of each command.
Final runtime: Node `v22.23.4` (CI Node 22), Google Chrome `156.0.8078.47`.
The runtime was supplied through `npm exec --yes --package=node@22 -- bash` with temporary verification scripts (`/tmp/kix-read-node22-verify.sh` and `/tmp/kix-read-final-checks.sh`) that ran the commands below serially. No repository dependency was added. Browser commands use headless
`/usr/bin/google-chrome`, loopback serving and
`KIX_E2E_NO_SANDBOX=1`. Live-gate checks without a protocol checkout are **skipped,
not passed**. No signer, comments, issue changes, commits, pushes or PRs are used.

| Command | Result |
| --- | --- |
| `(cd apps/web && npx vitest run test/read-state-params.test.ts test/read-state-screens.test.tsx)` | PASS; 2 files, 122 tests. Enumerates all 14 allow-lists and all parameters; independent source fixtures, every credit lane, per-role resource intersections, malformed and unknown ids, deferred reads, dependent selections, no-action restoration, actual write callbacks, fresh controls per write, real booking/transfer and maker/checker effects, session attach/recovery and real-shell focus (including apply/back/forward preserving the focused control). |
| `npm exec --yes --package=node@22 -- node --version` | PASS; `v22.23.4`; temporary npm-cache runtime, package manifests/lock unchanged. |
| `npm ci` | PASS; 534 packages added. npm reports 5 development-inclusive audit findings (2 moderate, 1 high, 2 critical), deprecation and existing esbuild install-script notices. No dependencies changed. |
| `npm run typecheck` | PASS; adapter + web. |
| `npm run build` | PASS; 417 modules. Existing large-chunk advisory remains; fixed budget check is separate. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS; adapter 65 files / 1,335 tests; web 83 files / 1,190 tests. Five live-gate files / 23 tests skipped because no protocol checkout is available. The unchanged storage-allow-list, untrusted-render-static and connectivity-write-guard suites pass. |
| `npm run lint` | PASS; zero ESLint warnings/errors. |
| `npm run cycle-check` | PASS; no circular imports. Existing resolution warnings remain diagnostic only. |
| `npm run deps:check` | PASS; 4 manifests and 630 lock entries checked. |
| `npm run audit:warn` | PASS (warning-only command); production audit reports 0 vulnerabilities. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS; all adapter and web floors met. Adapter lines/statements 91.22%, functions 97.44%, branches 84.59%; web lines/statements 92.09%, functions 79.89%, branches 88.86%. Live-gate tests skipped, not passed. |
| `npm run budget` | PASS; initial JS gzip 289,686 bytes, CSS 4,965 bytes, total gzip 787,651 bytes; largest route chunk 26,062 bytes. Every fixed limit unchanged. |
| `npm run typecheck:e2e` | PASS. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kix-read-a11y.json npm run test:a11y` | PASS; 15 files, 269 tests. Korean route catalogue, gallery, all-screen axe, keyboard, focus, reflow and alternate-state checks green; matrices unchanged. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kix-read-e2e.json npm run test:e2e` | PASS; 43 files, 175 tests, including real reload and back/forward on notifications + finance. Run-record ledger: non-loopback 0, non-GET 0, app network calls 0. HTTP mode, production qualification, real payment and release claims all false. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-read-visual.json KIX_VISUAL_OUT=/tmp/kix-read-visual-out npm run test:visual` | PASS; 3 files, 42 tests; 32 screenshots match the existing unchanged baselines, profile `linux-d29b2e9b`. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_BUDGET_RECORD_OUT=/tmp/kix-read-browser-budget.json npm run test:budget` | PASS; 3 files, 9 tests; split/landing, chunk-failure, and long-list render tripwires unchanged. Not an SLO. |
| `git diff --exit-code -- packages apps/web/bundle-budget.json .github .aiops docs/aiops apps/web/test/storage-allow-list.test.ts apps/web/test/untrusted-render-static.test.ts apps/web/test/connectivity-write-guard.test.ts apps/web/src/shell/route-registry.ts apps/web/src/components/Breadcrumb.tsx apps/e2e/src/a11y-matrix.ts package.json package-lock.json` | PASS; no protected changes. |
| `git hash-object packages/protocol-adapter/src/commerce-bindings.ts` and `git rev-parse HEAD:packages/protocol-adapter/src/commerce-bindings.ts` | PASS; both `47ab5e10cbf5f8f10bed718b4dd5190fe5dfe76f`. |
| `git diff --check` | PASS; no whitespace errors. |

Development attempts are not counted as final passes. Early narrow/typecheck
runs exposed fixture construction, Node/jsdom AbortSignal realms, catalogue type
registration, dependent-filter expectations and source-read timing; those were
fixed and rerun. An initial Chrome history assertion observed the previous DOM
immediately after the URL moved; it now polls the rendered selection using the
existing harness. A Korean route sweep caught the raw inbox `all` option; its
display labels are now translated while parameter values stay unchanged.
Separate development runs timed out in existing booking, finance, session-quota
gallery, marketing, offline, axe and keyboard tests (and one narrow test); those failures are retained as failed
attempts, with no test timeout, CI or budget relaxation.

## Deviations

- Node 22 compression exposed a total of 793,884 bytes, exceeding the unchanged
  790,000-byte limit. Grouping the two credit catalogues and the platform/provider
  catalogues into separate lazy copy chunks reduced it below the fixed limit (final build: 787,651 bytes) without
  changing any copy, budget, locale key, route, capability or protocol pin.
  `onlyExplicitManualChunks` prevents dragging shared dependencies into these
  chunks; the entry stays within 290,000 bytes and every chunk stays below 30,000.
  This adds a justified Vite build-configuration change to the original file plan; no budget baseline update or extra owner ruling was used.

- Initial diagnostics used Node 20.19.2; final verification uses Node 22.23.4 to match CI.
- The Constraints-specified document path is used instead of the shorter,
  conflicting Objective path.
- The owner's origination scope correction selects applications; obligations
  remain servicing-only.
- Finance uses category, provider uses order facets, receipts include the step,
  and permissions use snapshot intersections, applying the design review.
- Unavailable ephemeral receipts/trades are explicitly tested and documented;
  reload persistence is not manufactured.
- Prohibited-name assertions live in tests, avoiding banned shell-source words.
  The actual `SessionRecord` fields are checked rather than a nonexistent
  `JournalEntry` type.
- The shared UI is a page-only context and row wrapper. Optional router contexts
  keep the same hook order in routed pages and bare fixtures; no shell/App eager
  import is added. The row wrapper puts its selection button in an existing
  table cell without introducing an extra column.
- jsdom uses Node's AbortController with Node's Request for the data router.
  Its reload action is observed without asking jsdom to navigate a document;
  the unchanged Chrome session test performs a real recovery reload.
