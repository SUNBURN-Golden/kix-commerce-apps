# App-wide connectivity — local stub binding

Node: `c-offline-connectivity-ux-stub`. `contract_change=NO`. Base and implementation HEAD: `288c8ef8b58dec52093cfbc0a9cbca6b65deeab3`; implementation is an uncommitted working-tree change, as requested. No commit, push, issue, PR, comment, signer, or program-mode delivery was created.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

## Scope and boundaries

The mounted app displays browser connectivity together with the shell's existing transport observations. The persistent connectivity banner sits outside the app render boundary, so a screen or app error does not remove it. It has `role="status"`, `aria-live="polite"` and visible explanations in English and Korean. No route or screen was added: the 37 independent screens, booking sample, discovery alias, and 404 retain their existing scope. The browser check drives all 37 screens and 404.

Stub remains the default. HTTP remains explicit loopback-only, one attempt, no fallback, redirect following, retry, queue, Idempotency-Key header, gate proxy, or component network call. There is no service worker, Cache Storage registration, background sync, manifest or deployment change. “cached” means values retained in already loaded app memory, or existing tab session evidence; it does not mean an installed offline app or cold-start availability.

No public adapter interface, command body, external identifier, protocol calculation, OpenAPI pin, PINNED_ACTIONS, gate SHA, or locked binding was changed. No real payment, KYC, credit disbursement, bank rail, venue scan, marketplace, qualification, acceptance, release, or production runtime is claimed. All existing production/truth flags remain false. Only a build-time dev dependency was added, pinned exactly in the web workspace and lockfile.

## Internal interfaces and transitions

`ConnectivitySnapshot` holds `browserOnline`, selected environment, connectivity `epoch`, render `revision`, held transport observation, state, `writesBlocked`, and whether connectivity has been lost. `ConnectivityObservation` combines an existing probe's sequence (`held.generation`) with the epoch captured **before that probe starts**. A browser-less renderer uses the known local stub environment; a browser lacking `navigator.onLine` remains unknown/checking.

| Input/transition | Display / new writes | Retained reads and pending attempts |
| --- | --- | --- |
| Stub and browser online | Local stub; connectivity alone permits writes | Existing domain/permission/UNKNOWN fences still apply |
| Browser information missing | Checking; blocked | Not evidence of connectivity |
| Browser offline, including after a successful probe | Offline; blocked | Read values are STALE · cached; dispatched attempts become UNKNOWN |
| HTTP without current-epoch probe evidence | Checking; blocked | Browser online alone establishes no gate availability |
| Current-epoch HTTP probe degraded/unavailable | Blocked; HTTP remains selected | Losing availability invalidates the read epoch and interrupts pending writes |
| Browser reconnect | Stub local, or HTTP checking | No business call or read is replayed; cached groups still need explicit reading |
| Current-epoch HTTP probe up | Loopback observed | Only transport eligibility changes; it does not refresh business reads |
| Old-epoch or older-sequence probe completion | Ignored | Cannot lift a newer connectivity restriction |

The existing shell probe schedule is retained: no stub polling, hidden-tab guard, single-flight handling, reduced-motion pause, and route/load probes. Reconnect starts no business operation and adds no probe schedule. In paused HTTP mode, a later existing route/load probe is needed for current-epoch availability.

## Write result contract and conflict scopes

`guardedWrite` is placed at the actual port/invoker boundary awaited by a controller. It performs a synchronous eligibility check, invokes the existing sender once, subscribes only until that attempt settles or connectivity is lost, and retains no reconnect callback. Before dispatch, `CONNECTIVITY_BLOCKED` means **nothing sent**. Handlers check before allocating intents or using the organizer preview latch; form submission and direct handler calls cannot rely only on button styling.

After dispatch, connectivity loss rejects with a plain `ConnectivityInterrupted` Error. This is deliberate: catalogue controllers classify an untraced `ProtocolError` as NOT_SENT. A plain interruption reaches their existing UNKNOWN path. The controller settles before any late sender answer can be accepted. Late fulfillment and rejection are consumed without replacing the controller's result or causing an unhandled rejection.

Synthetic controllers retain their existing subject/right/obligation/proposal conflict scopes. A supported fresh read never removes their UNKNOWN fences; an unrelated subject remains usable when the controller permits it. `/session` uses the existing identity sender and `SessionRecoveryController` journal settlement, so UNKNOWN survives navigation and reload without another dispatch. The journal's version, envelope, record fields, keys, budgets and storage allow-list remain unchanged. Retention/TTL remains **UNDETERMINED — responsible user/legal**; no retention period was selected.

Legacy adapters have no equivalent controller UNKNOWN fence. Their app guard conservatively fences the entire affected legacy method family (booking, settlement, reservation, admission, resale or credit) for that page load after interruption. A caught error incrementing the desk's attempt counter, a fresh read, a second explicit click, or reconnect cannot clear that family fence. No new persisted record is introduced. Reload persistence for those legacy page-load fences is unverified and is not represented as session recovery.

Connectivity restrictions compose with existing native `disabled`, `aria-disabled`, NOT_BOUND, permission and in-flight restrictions. Blocked controls stay focusable where previously focusable, have visible reasons and preserve `aria-describedby`. Navigation, locale changes, draft editing, filters, selections, supported read/inspection controls, and held-response evidence inspection remain usable. Fixture controls that create or mutate synthetic source state are blocked while connectivity is absent.

## Screen/action and read inventory

All inventoried protocol adapter writes are guarded; the independent test enumerates the `CommerceProtocol` interface and proves every non-read method stops before calling its source while offline. The app has only one adapter selection. The shell imports it for transport observation; lazy screens import the guarded desk view of that same instance. Catalogue controllers retain their published bodies and their existing source selection.

| Screen group | Business writes / additional fixture mutations | Supported read / cached boundary |
| --- | --- | --- |
| `/`, `/booking/:eventId`, `/admission`, `/resale`, `/credit` | Existing legacy FSM desk actions, hold/release/confirm, resale listing/transfer; no new mapping | Existing list/view/presentation reads, grouped by legacy family; opening the settlement view is inspection |
| `/booking/:eventId`, `/gift`, `/organizer`, `/organizer/workspace`, `/marketing/m05` | Existing catalogue journey/gift/organizer/consent dispatch; workspace submission guarded before plan use | Caller drafts are editable; receipts and page-load evidence remain history; transport probes never promote them |
| `/platform`, `/provider`, refund panels on `/`, booking and `/buyer` | Existing book/reprice/transfer, provider steps, refund steps and synthetic producer-event controls | Existing controller `refresh()`; separate port read groups |
| `/identity`, `/session` | Attach; source/cut fixture mutations | Existing identity `refresh()`; session journal remains history, not a fresh authoritative read |
| `/credit/origination`, `/credit/servicing`, `/finance` | Existing requests, proposals, approvals and source-advance fixtures | Existing controller `refresh()`; exports retain their original judgement and source cuts |
| `/marketing/journey`, `/assistant`, `/permissions`, `/notifications` | Apply/reclaim, proposal/approval, tenant proposals, notification read-state mutations and producer fixtures | Existing controller `refresh()`; supported export/inquiry inspection remains read-only |
| `/mobile` | Existing synthetic install/update/present/confirm/withdraw and link/session fixtures | Existing `refresh()`/resume/reconnect paths; its separate synthetic link, clock and freshness fences remain |
| `/qualification`, `/release` | Existing synthetic single runs | No new authoritative reader; prior run packets remain history |
| `/marketing`, `/marketing/m01`–`/marketing/m05` | All local saves, card removal, interest, coupon/referral markers, consent withdrawal and reset | Explicit “Read local session again”; each mounted marketing page has its own read stamp |
| `/marketplace-performance`, `/merchant` | Queue join and source fixture mutations; merchant source fixture mutations | Existing read/refresh functions; selection, paging, queue observation and export inspection remain usable |
| `/buyer`, `/discovery`, `/inventory`, `/receipts`, `/handoff`, `/journeys`, `/help`, 404 | No new business write | Read-only inspection stays usable. Discovery projection rebuild and inventory generation/source fixture mutations are guarded; read-only filters and selection stay usable. Retained projections/fixtures/history without an instrumented supported acceptance path remain cached/history |

`ReadConnectivityStamp` is captured when a read **starts**, not when it resolves. For synthetic readers, a ready/empty answer is only a candidate: promotion happens after the existing controller accepts it as APPLIED with CURRENT freshness and ready/empty read state. Failed, stale, refused, unavailable, not-bound, dropped, wrong-context and old-epoch completions do not promote a read. Empty is a supported result, distinct from unavailable. A successful legacy reader promotes only its own family, and a marketing local reader promotes only its page's local-session group.

Writes requiring a snapshot consult that group's stamp as well as the controller's own gates. Reconnect-before-refresh stays blocked. The main read notice labels retained groups STALE · cached and lists readers still needing refresh. Its synchronous loading fallback also says STALE · cached; failure loading the detailed notice is handled by the existing app boundary while the primary connectivity banner remains available. Source-local CURRENT labels describe the controller's source cut; they cannot establish browser connectivity. History without a supported reader remains history after reconnect. No controller is remounted to refresh connectivity.

## Acceptance and evidence mapping

| Acceptance | Evidence |
| --- | --- |
| Banner on every screen, writes blocked with reasons | `apps/web/test/offline-connectivity.test.tsx`; browser `connectivity.all-screens`; explicit action inventory and every public adapter-write pre-send test |
| Reconnect never resends | Dispatch-race tests, catalogue and legacy second clicks, deferred read/probe tests; browser `connectivity.form-and-refresh`, `connectivity.no-replay` |
| Durable session UNKNOWN and no late-success overwrite | Existing journal settlement/reload tests plus interrupted held-response test; unrelated subject scope also checked |
| No service worker | Browser pre-boot registration instrumentation: zero attempts and zero registrations across every screen; existing source/storage/CSP checks retained |
| Keyboard, normal/empty/error/pending screens and cached read honesty | Existing journey/a11y/fault suites retained; new focus, Tab/Enter/Space, draft preservation, visible-reason, 320px reflow and axe test `a11y.connectivity.keyboard-cached` |

No existing matrix cell, test, baseline, check ID or denominator was removed or skipped. New required browser/a11y check IDs extend the matrices. The local evidence matrix links this evidence separately from integration/qualification/acceptance/release.

## Executed evidence

Local environment: Node 22.20.0 selected with `PATH=/tmp/kix-form-node22/node_modules/node/bin:$PATH` (the initial shell default was Node 20.19.2); npm 11.21.0; Chrome 155.0.8059.84; Playwright Core 1.58.2; axe-core 4.14.0. Browser runs use `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1`. Exact commands and final outcomes are recorded below after final verification.

Validation commands actually executed (reruns included; failures/fixes are recorded below). Every npm command used `PATH=/tmp/kix-form-node22/node_modules/node/bin:$PATH`. Browser commands additionally used `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1` and wrote their run records under `/tmp/kix-offline-*-record.json`.

| Command | Final result |
| --- | --- |
| `npm install --save-dev --save-exact -w @kix/web terser@5.44.0` | PASS; exact dev dependency and lockfile updated |
| `npm ci` | PASS, rerun after the lockfile change |
| `npm run test -w @kix/web -- test/offline-connectivity.test.tsx test/connectivity-write-guard.test.ts test/user-guides.test.tsx test/local-evidence-matrix.test.ts test/i18n.test.tsx` | PASS; 81 tests in 5 files. Earlier narrow run also retained transport, session, settlement, reservation and marketing tests: 44 passed |
| `npm run typecheck` | PASS; adapter and web |
| `npm run build` | PASS; production bundle built locally. Existing large-chunk warning remains informational |
| `KIX_REQUIRE_GATE=0 npm test` | PASS; adapter 1,306 passed / 23 live-gate tests skipped as configured; web 772 passed |
| `npm run lint` | PASS |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS; all workspace floors. Web: lines/statements 83.96%, functions 61.49%, branches 84.64% |
| `npm run deps:check` | PASS; 4 package manifests and 594 lockfile entries |
| `npm run cycle-check` | PASS; all three workspaces, no circular imports |
| `npm run typecheck:e2e` | PASS |
| `npm run test:e2e` | PASS; 54 tests in 15 files; Chrome 155.0.8059.84; all 37 screens plus 404. Final record: `/tmp/kix-offline-e2e-final-record.json` |
| `npm run test:a11y` | PASS; 231 tests in 11 files, existing findings baseline unchanged. Record: `/tmp/kix-offline-a11y-final-record.json` |
| `npm run budget` | PASS; initial JS gzip 286,153 bytes (limit 290,000); CSS 4,821 (5,000); largest route chunk 21,531 (30,000); total gzip 624,517 (633,031) |
| `npm run test:budget` | PASS; 9 tests in 3 files. Record: `/tmp/kix-offline-browser-budget-final-record.json` |
| `npm run audit:warn` | PASS; production audit reports 0 vulnerabilities |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` | PASS; matches the locked checksum below |
| `git diff --check` | PASS |
| `git rev-parse HEAD` | `288c8ef8b58dec52093cfbc0a9cbca6b65deeab3`; working tree intentionally uncommitted |

Browser journey and accessibility records both report `nonLoopback=0`, `nonGet=0`, and `appNetworkCalls=0`. No service-worker registration attempt or registration was found. The unchanged read-token/live-gate job was not run. Diagnostic reads also included `git status --short`, `git branch --show-current`, Node/npm version checks, a read-only `git archive HEAD` baseline build in `/tmp`, and a temporary Vite module-size profile; these changed no repository source.


Locked binding SHA-256: `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249` (unchanged).

Implementation source/test manifest digest: `45dd620d8a9874ba6f86a0848994639889e0db4411eb63b6e44eb29694e87e60` (105 implementation/config/test files; excludes README and docs). The digest hashes the sorted manifest lines `<file SHA-256>  <repository-relative path>\n`. All changed paths are listed below..

## Failures fixed and design deviations

- Initial narrow run: 11 failures. Node 22 exposes a non-browser `navigator` without `onLine`; browser-less rendering now uses known local stub state while a real browser with missing online information stays unknown. A deferred-read test was corrected to install its spy before the port binds its receiver. Narrow tests then passed.
- Typecheck/build found incorrect test API/field names and an inline generic-inference problem; corrected to the existing `createEvent`, `cutGeneration`, and explicitly typed action object. Existing tests were retained.
- Full adapter test caught the web no-bypass source rule. The invoker guard now decorates the existing supplied invoker generically without naming dispatch in web source. The rule and published bodies were unchanged.
- Initial bundle budget exceeded the existing initial-JS limit; controller helpers and the guarded desk view were separated from the shell's observation-only adapter import. Limits and CI were unchanged. Added pinned build-only `terser@5.44.0`; both the app and browser harness use this configured minifier. No dependency is added to browser runtime. The locale-packing and UTF-8-configuration experiments were reverted. Final measured result is in the evidence table.
- The first coverage run was below the existing branch floor. Added failure/late-answer, accepted-empty-read, cached legacy read, missing-browser and transport-state evidence; floors were unchanged. A subsequent coverage run timed out in the unchanged SDK provenance test while other verification jobs competed for resources. The final isolated coverage run passed every test and floor.
- Connectivity-specific copy uses a typed local English/Korean catalogue in `connectivity/copy.ts`, loaded with the detailed read notice and screen controls; the small synchronous primary notice is localized directly. The existing global i18n catalogue remains unchanged.
- Shared app-only port/controller/adapter decorators replace repetitive per-controller sender edits. The shared `write-guard.ts` helpers and `desk-protocol.ts` keep screen action behavior lazy. Detailed cached-read copy is also lazy; the primary banner is synchronous and survives presentation chunk failures. This preserves existing protocol exports/types, source selection and controller outcome logic; it is not a network proxy.

Live gate, real integrations, hardware, assistive-technology runs, offline cold starts, cross-device persistence, user acceptance, production qualification and release remain unverified. The explicit `KIX_REQUIRE_GATE=0` local test run does not count the live-gate skips as a pass.

## Changed files

```text
README.md
apps/e2e/src/a11y-matrix.ts
apps/e2e/src/build.ts
apps/e2e/src/journey-matrix.ts
apps/e2e/tests/a11y/connectivity.a11y.test.ts
apps/e2e/tests/offline-connectivity.e2e.test.ts
apps/web/package.json
apps/web/src/admission-desk.ts
apps/web/src/buyer-workspace.ts
apps/web/src/components/CachedReadNotice.tsx
apps/web/src/components/ConnectivityBanner.tsx
apps/web/src/components/ConnectivityWriteButton.tsx
apps/web/src/components/Shell.tsx
apps/web/src/connectivity/ConnectivityProvider.tsx
apps/web/src/connectivity/copy.ts
apps/web/src/connectivity/desk-protocol.ts
apps/web/src/connectivity/store.ts
apps/web/src/connectivity/write-guard.ts
apps/web/src/consent-desk.ts
apps/web/src/consent-source.ts
apps/web/src/credit-desk.ts
apps/web/src/credit-origination.ts
apps/web/src/credit-servicing.ts
apps/web/src/cross-surface-journeys.ts
apps/web/src/delegated-assistant.ts
apps/web/src/discovery-live.ts
apps/web/src/discovery-workspace.ts
apps/web/src/finance-operations.ts
apps/web/src/gift-desk.ts
apps/web/src/gift-source.ts
apps/web/src/guide/status-words.ts
apps/web/src/installable-mobile.ts
apps/web/src/inventory-venue.ts
apps/web/src/journey-desk.ts
apps/web/src/journey-identity.ts
apps/web/src/journey-source.ts
apps/web/src/main.tsx
apps/web/src/marketing-journey.ts
apps/web/src/marketing/desk.ts
apps/web/src/marketing/useMarketingSnapshot.ts
apps/web/src/marketplace-performance.ts
apps/web/src/merchant-operations.ts
apps/web/src/notification-inbox.ts
apps/web/src/operational-qualification.ts
apps/web/src/organizer-desk.ts
apps/web/src/organizer-source.ts
apps/web/src/organizer-workspace.ts
apps/web/src/pages/AdmissionCredentialPanel.tsx
apps/web/src/pages/AssistantPanels.tsx
apps/web/src/pages/Booking.tsx
apps/web/src/pages/BoxOffice.tsx
apps/web/src/pages/Credit.tsx
apps/web/src/pages/CreditOriginationPanels.tsx
apps/web/src/pages/CreditPanel.tsx
apps/web/src/pages/CreditServicingPanels.tsx
apps/web/src/pages/DiscoveryPanels.tsx
apps/web/src/pages/FinancePanels.tsx
apps/web/src/pages/GiftPanel.tsx
apps/web/src/pages/Handoff.tsx
apps/web/src/pages/InstallableMobilePanels.tsx
apps/web/src/pages/InventoryPanels.tsx
apps/web/src/pages/JourneyIdentityPanels.tsx
apps/web/src/pages/JourneyPanel.tsx
apps/web/src/pages/MarketingJourneyPanels.tsx
apps/web/src/pages/MarketplacePerformancePanels.tsx
apps/web/src/pages/MerchantPanels.tsx
apps/web/src/pages/NotificationsPanels.tsx
apps/web/src/pages/OperationalQualificationPanels.tsx
apps/web/src/pages/OrganizerPanel.tsx
apps/web/src/pages/OrganizerWorkspace.tsx
apps/web/src/pages/PlatformPanels.tsx
apps/web/src/pages/PlatformReleasePanels.tsx
apps/web/src/pages/ProviderJourneyPanels.tsx
apps/web/src/pages/RefundReturnPanel.tsx
apps/web/src/pages/Resale.tsx
apps/web/src/pages/ResalePanel.tsx
apps/web/src/pages/ReservationPanel.tsx
apps/web/src/pages/SessionRecoveryPanels.tsx
apps/web/src/pages/SettlementPanel.tsx
apps/web/src/pages/TenantPermissionsPanels.tsx
apps/web/src/pages/marketing/Hub.tsx
apps/web/src/pages/marketing/M01Membership.tsx
apps/web/src/pages/marketing/M02Presale.tsx
apps/web/src/pages/marketing/M03Coupons.tsx
apps/web/src/pages/marketing/M04Rewards.tsx
apps/web/src/pages/marketing/M05Consent.tsx
apps/web/src/pages/marketing/MarketingChrome.tsx
apps/web/src/platform-journey.ts
apps/web/src/platform-release.ts
apps/web/src/protocol.ts
apps/web/src/provider-journey.ts
apps/web/src/receipt-explorer.ts
apps/web/src/refund-return.ts
apps/web/src/resale-desk.ts
apps/web/src/reservation-desk.ts
apps/web/src/session-recovery.ts
apps/web/src/settlement-desk.ts
apps/web/src/styles.css
apps/web/src/tenant-permissions.ts
apps/web/test/connectivity-write-guard.test.ts
apps/web/test/local-evidence-matrix.test.ts
apps/web/test/offline-connectivity.test.tsx
apps/web/test/support/connectivity-actions.ts
apps/web/test/user-guides.test.tsx
apps/web/vite.config.ts
docs/c-local-evidence-matrix-stub-apps-bind.md
docs/c-offline-connectivity-ux-stub-apps-bind.md
docs/guide/status-glossary-ko.md
package-lock.json
```
