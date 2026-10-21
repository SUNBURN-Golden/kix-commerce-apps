# Form input validation — local stub

## Scope and boundaries

`c-form-validation-ux-stub`, contract_change=NO, A2. Source baseline and tested HEAD: `288c8ef8b58dec52093cfbc0a9cbca6b65deeab3` plus the uncommitted files delivered with this document. No commit, push, PR, issue or comment is created by the builder.

This is input-format UX over the existing local stub and synthetic fixtures. It is not real integration, qualification, user acceptance, accessibility conformance, release, live payment, live admission, KYC, credit disbursement or production authorization. Routes and screen counts are unchanged. Session storage behavior is unchanged; record TTL remains UNDETERMINED (legal/designated user). Accessibility target remains UNDETERMINED and user acceptance PENDING. No new dependency, public contract, protocol command, schema or identifier is introduced.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The booking adapter journey still stops after `create_event` → `prepare_trade` → `accept_trade`. `capture`, `settle_capture`, `commit_trade`, `open_admission` and `admit` remain uncomposed there. `placeHold` stays not-bound with consideredAction `reserve_listing`. `commerce-bindings.ts`, pins, PINNED_ACTIONS, protocolMergeSha, CI, .aiops/ and docs/aiops/ remain unchanged. Stub default, explicit loopback HTTP only, one attempt, no fallback/retry/Idempotency-Key/redirect following, production and truth flags false remain the existing boundaries. UI validation makes no request.

## Form inventory

The checkout has **16 native form declarations**, rather than the design's 15 or the node's approximate 30 onSubmit occurrences. Every declaration now uses `ValidatedForm`. This count is checked by `apps/web/test/form-validation.test.tsx`. Sources below are under `apps/web/src/pages/`; browser rows are in `apps/e2e/tests/a11y/forms.a11y.test.ts` unless noted.

| formId | Route | Source | Controls and actions | Input checks / test pointer |
| --- | --- | --- | --- | --- |
| booking-form | /booking/:eventId | Booking.tsx | Quantity; Place hold / Confirm | Existing `bookingQuantityNumber` accepts digits 1–6; booking-quantity browser row and keyboard resubmit |
| admission-gate-form | /admission | Admission.tsx | Gate argument; Enter / credential actions outside form | Required text; admission-gate row |
| admission-event-form | /admission | Admission.tsx | Performance id; Load mock case / reservation actions outside form | Required text; admission-event row |
| resale-form | /resale | Resale.tsx | Booking id, ask label; Open listing | Required text, existing 40-character ask-label limit; resale-booking row |
| gift-form | /gift | Gift.tsx | Gift id, ticket id, expected version, expiresAt, recipient; external Send buttons | Offer requires all fields, integer syntax for caller numbers; accept/cancel check gift id; gift-ticket-id row, gift journey tests |
| organizer-form | /organizer | Organizer.tsx | Event id, seats, optional quota, inventory id, expected inventory version, recipient; external Send buttons | create checks event/seats/quota, invitation checks event/inventory/version/recipient, lifecycle checks event only; organizer-seats row, organizer journey tests |
| organizer-workspace-form | /organizer/workspace | OrganizerWorkspace.tsx | Step-specific row editor including optional quota/seconds/organizer; Add / Preview / Submit | Add checks mounted editor fields; existing preview/stale/single-use guards still govern the change list and submit; organizer-ws-event-id row, workspace unit tests |
| discovery-filters | /discovery | DiscoveryPanels.tsx | Optional search/kind/status/tier/section/date/sort filters | No invented required field; existing source conflict is displayed and linked without recomputing it; optional-forms row and alt-states discovery conflict |
| inventory-ga-form | /inventory?section=sec-pit | InventoryPanels.tsx | GA quantity; Select quantity | Positive integer syntax only; source retains range/availability authority; inventory-quantity row |
| assistant-request-form | /assistant | AssistantPanels.tsx | Request text; Ask | Required text only, no authority/policy parsing; dlg-request-text row |
| handoff-filter-form | /handoff | Handoff.tsx | Optional feature text and diagnosis code; Apply filter | Existing diagnosis/refused-claim result is displayed and linked, unknown code stays unconfirmed; optional-forms row |
| membership-form | /marketing/m01 | marketing/M01Membership.tsx | Display name, tier; Issue demo card | Required display name, existing 1–40 character limit; membership-name row |
| coupon-form | /marketing/m03 | marketing/M03Coupons.tsx | Code; Apply demo code | Required text only; model decides unknown/duplicate code; coupon-code row |
| referral-form | /marketing/m04 | marketing/M04Rewards.tsx | Code; Count demo marker | Required text only; model decides eligibility/duplicate/self-referral; referral-code row |
| consent-flags-form | /marketing/m05 | marketing/M05Consent.tsx | Two booleans; Save / Withdraw flags | Both false is valid; optional-forms row |
| consent-bind-form | /marketing/m05 | marketing/M05Consent.tsx | Event, subject, business, channel, purpose, caller version, allowed; external Send buttons | Required text and canonical nonnegative safe integer; authorize does not require allowed; consent-subject row, existing consent journey/controller tests |

No identifier regex, amount, expiry, capacity, consent policy or protocol state calculation is added. Integer formatting matches the existing caller parsers, including rejection of scientific notation, leading zeroes and unsafe integers. Blank optional quota/seconds are still omitted by the existing controller. Availability and range outcomes on GA selection remain source judgments. A nonempty unknown coupon or referral still reaches the session model rather than being labeled a format error.

## Focus and errors

`useFormValidation` owns touched fields, action-specific submitted fields and submission-attempt counting. `ValidatedForm` preserves existing handlers/values/hint IDs, adds stable control IDs and connects inline errors. It disables browser-native validation so an invalid submission reaches the shared summary. Optional filters and flags retain their valid empty/false values.

Initial render has no local errors or focus movement. Blur validates that field. Editing a touched/submitted field immediately updates errors without moving focus or replacing the input node. Invalid submit/action performs no action/controller invocation and focuses `ErrorSummary`, including identical repeated submissions. Tab to the first summary link and Enter move to the first invalid control; all later links are keyboard reachable. This implements summary-first focus with a direct path to the first error. Values remain editable after local rejection; no halted controller attempt is created. Actual rejection/UNKNOWN fences are not cleared or unlocked.

Source-reported Discovery/Handoff diagnostics use the same summary and field links but preserve the original source judgment. Existing detailed outcome/diagnostic text remains separate. Workspace row validation precedes Add; submission validates the already previewed change list through its existing controller, not a leftover editor draft. Busy booking/resale forms ignore duplicate submissions. External Gift/Organizer/Consent actions retain existing controller pending and UNKNOWN guards.

There are no duplicate role=alert inline announcements: the focused summary names the errors and inline text is linked with aria-describedby. Existing hints are merged, never replaced. Error borders and visible focus supplement the text, and error colours use the existing theme tokens (dark/forced-colours included). Summary links have at least 24px height and spacing, and long content wraps at 320px.

## Localization and acceptance mapping

English/Korean validation, summary and field-label messages share the typed `apps/web/src/forms/catalogue.ts` catalogue, loaded with the form screens. `useFormT` reads the existing locale provider and reuses interpolation. Keeping these messages out of the eagerly loaded shell catalogue preserves the unchanged entry bundle budget on Node 22. State contains message keys, not translated strings, so switching language updates visible errors while preserving values and focus. Protocol words and adjudication are not translated into a different outcome. Full-screen translation is outside scope.

| Required behavior | Evidence |
| --- | --- |
| Every form has consistent invalid fields and linked messages | 16-form static inventory; pure-rule tests; 13 required-input browser rows and 3 optional/boolean form checks |
| Error summary receives focus | Repeated-submit active-element assertions; Tab/Enter links; alt-state and journey assertions retain control-focus checks after link activation |
| Keyboard correction and explicit resubmission | Both locales, booking invalid → correct → explicit hold; all required-input rows correct via keyboard without focus theft |
| One attempt, no automatic retry | Deferred stub browser probe: invalid=0 calls, corrected explicit submit=1, pending requestSubmit adds 0; existing controller/fault/UNKNOWN suites unchanged |
| UI does not decide protocol outcomes | Format-only module boundary test, source diagnostic consumption, full adapter/web tests including no-bypass and locked bindings |

## Verification evidence

Actual commands/results and the source fingerprint are recorded below. Browser runs use local installed Chrome and Playwright, build a clean stub production bundle, serve 127.0.0.1 and assert no external/non-GET/application network requests. A second existing test-only shell fixture build holds a stub promise to observe the in-progress screen; it is not a product route or runtime feature.

Initial narrow tests: `npm test -w @kix/web -- --run test/form-validation.test.tsx test/i18n.test.tsx` passed (46 tests). Initial `npm ci` passed (493 packages; npm reported 5 existing vulnerabilities: 2 moderate, 1 high, 2 critical). No dependency was changed.

During implementation the first typecheck caught catalogue-key typing, which was corrected. A later lint run caught a missing effect dependency; it was corrected without disabling the rule. The first browser run caught insufficient summary-link target spacing and test setup mistakes (wrong synthetic GA section and locale parameter); these were corrected. The deferred probe was added while that first fixture snapshot was already built, so it required a fresh build/run. On Node 22, the initial entry bundle measured 290657 bytes gzip against the unchanged 290000 limit; moving form copy into its own typed catalogue reduced it to 289793. Three intermediate coverage runs were below the unchanged 60.4% function floor (60.36%, then 60.38% twice); focused syntax, source-diagnostic linkage and action-scoped hook tests bring the final run to 60.51%. No test, floor, budget or CI rule was lowered. Failures are not counted as passes.

## Unverified and deviations

Live integration gate tests are skipped under KIX_REQUIRE_GATE=0; no readable kix-protocol checkout or credentials were used. No real service, hardware, payment, production runtime, external provider or assistive-technology/user acceptance run was performed. Existing unrelated accessibility findings remain OPEN; only the gift error-link findings are marked FIXED after the updated probes. No release or conformance claim follows from these tests.

Design deviations supported by repository evidence: 16 real forms; form copy uses a separate typed ko/en catalogue loaded with form screens to meet the unchanged Node 22 bundle budget; shared native-control wrapping centralizes aria/error wiring instead of repetitive per-control fieldProps calls; source diagnostics stay source-owned; workspace editor validation is on Add while preview/submission retain their existing plan guards. The deferred fixture extends the existing test-only protocol wrapper rather than adding any product route. No protected file or CI gate is changed.

## Final command ledger and source identity

All final checks below use **Node v22.20.0** via the prefix `PATH=/tmp/kix-form-node22/node_modules/.bin:$PATH`. The shell initially had Node v20.19.2, so Node 22 was provisioned outside this worktree with the first command below. No dependency or lockfile changed. Chrome is `/usr/bin/google-chrome`, version `155.0.8059.84`; browser commands use `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1`. Paths under `/tmp` are local artifacts, not published evidence or external storage.

| Command actually run (with the common Node 22 prefix above) | Result |
| --- | --- |
| `npm install --prefix /tmp/kix-form-node22 --no-save --package-lock=false node@22.20.0` | PASS; temporary runtime only |
| `node -v` | v22.20.0 |
| `npm ci` | PASS; 493 packages, 5 existing development-dependency advisories; package/lock files unchanged |
| `npm test -w @kix/web -- --run test/form-validation.test.tsx test/i18n.test.tsx` | PASS; final 51 tests (initial 46, then 49 and 50 as coverage was extended) |
| `npm run typecheck` | PASS; adapter and web |
| `npm run build` | PASS; existing large-chunk warning retained |
| `KIX_REQUIRE_GATE=0 npm test` | PASS; adapter 1306 passed / 23 skipped; web 775 passed; live gate skipped, not passed |
| `npm run typecheck:e2e` | PASS |
| `KIX_E2E_RECORD_OUT=/tmp/kix-form-browser-final-record.json npm run test:e2e` | PASS; 51 tests / 14 files, existing journey and fault matrices retained |
| `KIX_FORM_SCREENSHOTS=/tmp/kix-form-screenshots KIX_A11Y_RECORD_OUT=/tmp/kix-form-a11y-final-record.json npm run test:a11y` | PASS; 248 tests / 11 files, including 18 form browser tests; gift linkage findings FIXED; unrelated OPEN findings retained |
| `npm run lint` | PASS; zero warnings |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS; every existing floor met. Web lines/statements 83.86%, functions 60.51%, branches 84.81%; adapter lines/statements 91.18%, functions 97.44%, branches 84.52% |
| `npm run deps:check` | PASS; 4 manifests / 589 lockfile entries |
| `npm run cycle-check` | PASS; adapter/web/e2e have no circular imports |
| `npm run budget` | PASS; initial JS gzip 289793, CSS gzip 4873, total gzip 627676 bytes; limits unchanged |
| `KIX_BUDGET_RECORD_OUT=/tmp/kix-form-budget-final-record.json npm run test:budget` | PASS; 9 tests / 3 files |
| `npm run audit:warn` | PASS; production audit reports 0 vulnerabilities |
| `git diff --check` | PASS |
| `git diff --name-only -- packages .github .aiops docs/aiops` | Empty; protected paths untouched |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` and `git show HEAD:packages/protocol-adapter/src/commerce-bindings.ts \| sha256sum` | Identical: `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249` |

Browser ledgers report zero non-loopback requests, zero non-GET requests and zero application network calls. Assertions and screenshots inspect normal, empty, invalid and deferred in-progress states in a real headless browser; the screenshots are `normal.png`, `empty.png`, `invalid.png`, `pending.png` under `/tmp/kix-form-screenshots`. Keyboard tests also cover Korean at 320px, repeated invalid submission, immediate correction, live language changes, source-owned filter diagnostics, optional fields/false booleans, and explicit corrected resubmission. No assistive-technology run is claimed.

Exact tested source baseline/HEAD remains `288c8ef8b58dec52093cfbc0a9cbca6b65deeab3`; this delivery is deliberately uncommitted. SHA-256 of the **30 changed app source/test files**, sorted by path and hashed as UTF-8 path + NUL + file bytes + NUL, is `69ee871f20eee1a2a31454190f03e31b72d249bbf2cecfdcb0739cb2c7414d77`. Documentation is excluded from that fingerprint so this ledger can identify its source without hashing itself.

## Changed files

The delivery contains these 32 files (no generated bundles, coverage output or screenshots are checked in):

- `apps/e2e/shell-fixtures/protocol-fault.ts`
- `apps/e2e/src/a11y-matrix.ts`
- `apps/e2e/src/journey-matrix.ts`
- `apps/e2e/tests/a11y/alt-states.a11y.test.ts`
- `apps/e2e/tests/a11y/forms.a11y.test.ts`
- `apps/e2e/tests/journeys/booking.e2e.test.ts`
- `apps/e2e/tests/journeys/gift.e2e.test.ts`
- `apps/e2e/tests/journeys/organizer.e2e.test.ts`
- `apps/web/src/components/ErrorSummary.tsx`
- `apps/web/src/forms/ValidatedForm.tsx`
- `apps/web/src/forms/catalogue.ts`
- `apps/web/src/forms/useFormT.ts`
- `apps/web/src/forms/useFormValidation.ts`
- `apps/web/src/forms/validation.ts`
- `apps/web/src/pages/Admission.tsx`
- `apps/web/src/pages/AssistantPanels.tsx`
- `apps/web/src/pages/Booking.tsx`
- `apps/web/src/pages/DiscoveryPanels.tsx`
- `apps/web/src/pages/Gift.tsx`
- `apps/web/src/pages/Handoff.tsx`
- `apps/web/src/pages/InventoryPanels.tsx`
- `apps/web/src/pages/Organizer.tsx`
- `apps/web/src/pages/OrganizerWorkspace.tsx`
- `apps/web/src/pages/Resale.tsx`
- `apps/web/src/pages/marketing/M01Membership.tsx`
- `apps/web/src/pages/marketing/M03Coupons.tsx`
- `apps/web/src/pages/marketing/M04Rewards.tsx`
- `apps/web/src/pages/marketing/M05Consent.tsx`
- `apps/web/src/styles.css`
- `apps/web/test/form-validation.test.tsx`
- `docs/c-a11y-acceptance-stub-apps-bind.md`
- `docs/c-form-validation-ux-stub-apps-bind.md`
