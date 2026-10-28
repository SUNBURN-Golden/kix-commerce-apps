# IME form safety — local stub binding and evidence

Node: `c-plan-c-ime-form-safety-stub`; `contract_change=NO`; audit floor A2.
Source HEAD: `2acd0a0fd71d21aafcad98b80f58527c536adab4` (uncommitted node worktree).

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
The existing command/binding decisions, stub default, one-attempt transport, UNKNOWN fences and production/truth flags are unchanged. No protocol tuple is consumed. No protocol, page/controller, dependency, copy, CI or bundle-budget changes are needed. No funds, live gate, public deployment, KYC, scanning, bank rail, secrets or external service is used.

## Shared behavior

`ValidatedForm` keeps the browser/control's existing value and consumer `onChange` updates. It adds no competing draft buffer, normalization, replay or send. `useFormValidation` owns synchronous refs so an event or imperative validation call in the same native turn sees the current composition transaction.

| Transition | Guard and validation behavior |
| --- | --- |
| compositionstart | Record the control before consumer callbacks; invalidate pending summary-focus requests. |
| input/change during preedit | Keep controlled state flowing; defer validation, preserving existing issues and hints. |
| imperative validate / native submit during preedit | Return false; no active-field change, submit-attempt increment, new refusal announcement, controller call or focus request. |
| Enter while native isComposing, legacy keyCode 229, tracked composition, or same-turn compositionend | Cancel Enter's default and fence validation until its keyup; repeated Enter stays fenced. Ordinary preedit letter keys (including 229) are not cancelled. Native `key` or physical `code` identifies Enter. |
| compositionend | Retain the browser's actual resulting value. Defer reconciliation to a zero-delay task after final input/change; keep only a target-scoped confirmation guard for the associated event turn. Empty composition data is not interpreted as cancellation. |
| confirmation keyup | Clear the confirmation/end guard and reconcile touched or previously submitted fields. A fresh immediate Enter can submit. |
| blur | Mark touched, defer while composing; clear confirmation/end state on blur. Reconciliation never requests focus. |
| cancellation | Retain the browser's restored value; resolve through compositionend, with either blur/end ordering tested. Never replay a refused action. |
| removed/disabled control, unmount | A removed or disabled editor cannot retain a validation fence; cancel scheduled work on unmount. |
| invalid deliberate submit | Preserve text, connect inline errors and hints, focus the linked error summary; its link takes the keyboard user to the field. |

Incoming form composition, keyboard, blur and change capture callbacks are explicitly chained exactly once. Child/bubbling callbacks continue to run; no propagation is stopped. Consumer submit-capture cancellation is respected. Existing busy, connectivity and controller guards still apply. Summary focus effects recheck the composition transaction and generation; an obsolete request is discarded, never replayed after composition.

The end-before-key guard is limited to the associated browser event turn, not an unconditional swallow-next-Enter flag or time-based debounce. An already observed confirmation key remains held through repeated keydown until keyup/blur. This is automated evidence for the exercised sequences, not a claim about every OS/browser IME ordering.

## Route and action inventory

| Route | Form / composing controls | Deliberate action and boundary |
| --- | --- | --- |
| `/booking/evt_lanterns` | `booking-form`, `booking-quantity` | Fresh Enter or `booking-place` uses existing stub `placeHold`. Korean quantity text stays invalid; correction to `1`–`6` permits a send. `placeHold` remains NOT_BOUND in integration HTTP. |
| `/gift` | `gift-form`, `gift-ticket-id` | Form submission remains inert; external `Send offer_gift` uses action-scoped imperative validation and the existing gift invoker. Korean ticket text is retained. |
| `/organizer` | `organizer-form`, `organizer-event`, `organizer-seats` | Form submission remains inert; external `Send create_event` validates event/seats/quota and uses the existing organizer invoker. Korean identifiers are not assigned new syntax or policy. |

The test-only fault build aliases gift/organizer sources to wrappers around their existing invokers. Probes count boundary calls, hold a response, or lose a response to exercise UNKNOWN. Booking reuses the existing deferred `placeHold` probe unchanged. Existing shell fault aliases remain. These probes do not enter production bundles and cannot choose HTTP, introduce a command or change a receipt body.

## Acceptance and automated evidence

| Requirement | Evidence |
| --- | --- |
| Korean draft, cancel, final change ordering | `apps/web/test/form-ime.test.tsx`: mounted controlled input sequences; browser tests use actual Chrome CDP preedit, commit and cancel. |
| End-before-key, key-before-end, native flag false + 229, held/repeated keys | DOM sequences and browser-injected variants; confirmation causes zero sends. Ordinary 229 letter key remains uncancelled. |
| Blur/end both orders, previously invalid fields | DOM tests defer blur and freeze issues until resolution; browser blur fills errors without summary focus. |
| No focus theft/new refusal during preedit | DOM active-element and refusal checks; browser submits and activates buttons while CDP preedit is active, asserting zero sends, no summary and retained focus. |
| Fresh valid submission exactly once | DOM real booking/gift/organizer pages and controllers; browser counts actual underlying sends, holds responses, refuses duplicates and releases once. |
| Invalid text and error navigation | ko/en DOM tests preserve text and hints across repeated invalid submissions; browser Tab/Enter follows summary link to field and checks `formProblems`. |
| Handlers, action fields and lifecycle | DOM capture/bubble callbacks, submit-capture cancellation, textarea, select, scoped/hidden/disabled controls, stale focus generation and removal/unmount cleanup. |
| Offline / busy / UNKNOWN | Browser guards on all three routes: no send offline or replay on reconnect; held request duplicate sends zero; gift/organizer lost response stays unconfirmed and later actions send zero. Existing fault/connectivity suites retain their checks. |
| Mandatory browser matrix | Adds six `a11y.forms.ime.{booking,gift,organizer}[.guards]` checks; all existing mandatory checks/findings remain. |

Automated DOM, browser-engine and injected-event evidence are distinct:

- **DOM**: React mounted in jsdom, explicit native event sequences; no OS IME involved.
- **Browser engine**: Playwright CDP `Input.imeSetComposition` changes preedit `한` → `한글`; `Input.insertText` commits an already-active composition; empty preedit cancels it. `fill()` only prepares/corrects fields and does not count as composition evidence.
- **Injected browser sequences**: explicit `CompositionEvent`/`KeyboardEvent` variants exercise ordering and default-action suppression separately from CDP.
- **Native OS IME**: PENDING. CDP/injected automation does not establish native IME user acceptance, cross-platform behavior or accessibility conformance. Those remain UNDETERMINED until separately observed.

The accessibility run record contains Chrome version, `ko-KR` browser locale, source HEAD, per-route observed event ordering, values, focus flags and send count in `a11y.forms.ime.*.engine` observations. Local raw logs are in `/tmp/kix-ime-{narrow,typecheck,build,test-final,e2e-typecheck,a11y-final,e2e,budget,visual,lint,coverage}.log`; browser records are `/tmp/kix-ime-{a11y-final,e2e,budget,visual}.json`. These host-local artifacts are supplemental to this tracked command ledger and observation table. The normal screen scans retain their existing axe baseline and known findings. No acceptance/release claim is promoted.

## Observed composition run (2026-10-28 KST)

Chrome `156.0.8078.47`, Playwright Core `1.58.2`, Node `v22.20.0`, headless Linux host, browser locale `ko-KR`; source HEAD is the baseline above plus these uncommitted changes. The six IME checks pass in the completed-source run with no page/context/route/API leaks. Native OS Korean IME was not used.

For each of booking quantity, gift ticket ID and organizer event ID, Chrome recorded the same engine ordering:
`compositionstart → compositionupdate → input(한, isComposing=true) → compositionupdate → input(한글, true) → compositionupdate → input(한글, true) → compositionend(한글)`.
All trace entries retained focus on the control; composing and confirmation sends were zero. Browser cancellation restored the preedit-start value `한글`.

| Route | Later valid input/action | Actual stub boundary count | Other observed result |
| --- | --- | --- | --- |
| Booking | quantity `1`, fresh Enter | 1; pending duplicate remains 1 | Empty invalid quantity focuses summary, keyboard link returns to quantity; offline/reconnect adds 0. |
| Gift | ticket `한글`, external offer button | 1; pending duplicate remains 1 | Empty ticket focuses summary; native form Enter remains inert; lost response keeps unconfirmed at 1. |
| Organizer | event `한글`, seats `A1`, external create button | 1; pending duplicate remains 1 | Empty seats focuses summary under valid event; native form Enter remains inert; lost response keeps unconfirmed at 1. |

## Command ledger

Commands run from the repository root. Verification uses Node `v22.20.0` by prefixing `PATH=/tmp/kix-node22/node_modules/node/bin:$PATH`. The initial `npm ci` also ran on host Node `v20.19.2`, then was rerun successfully under Node 22. Browser commands use `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1` because this host runs as root; the harness retains its loopback/network restrictions. All jobs run in foreground tool sessions; no detached/background jobs.

Final command results are recorded below. Local success does not establish hosted CI success; live-gate checks are skipped with `KIX_REQUIRE_GATE=0`.

| Command | Result |
| --- | --- |
| `npm ci` | PASS under Node 20 and Node 22; existing dev dependency audit warnings (2 moderate, 1 high, 2 critical); no dependency changes. |
| `npm exec -w @kix/web -- vitest run test/form-ime.test.tsx test/form-validation.test.tsx` | PASS: 39 tests (14 IME + 25 existing validation). |
| `npm run typecheck` | PASS on completed web source. |
| `npm run build` | PASS; clean production Vite build. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 1,659 passed / 23 live-gate skips; web 1,294 passed; cold-entry 6 passed. Rerun after the build to include the dist-dependent check. |
| `npm run typecheck:e2e` | PASS. |
| `KIX_A11Y_RECORD_OUT=/tmp/kix-ime-a11y-final.json npm run test:a11y` | PASS: 369 tests / 18 files; 359 mandatory/recorded checks including all 6 IME checks; keyboard facet 85/85; zero non-loopback, non-GET or app-network calls. Full first run had 5 driver failures; completed-source rerun passes. |
| `KIX_E2E_RECORD_OUT=/tmp/kix-ime-e2e.json npm run test:e2e` | PASS: 197 tests / 47 files; full journey, fault, connectivity and harness checks. |
| `npm run lint` | PASS after replacing the new helper's non-null assertion with an explicit missing-form check. |
| `npm run deps:check` | PASS: production dependency gate, 4 manifests / 630 lockfile entries. |
| `npm run cycle-check` | PASS: no circular imports in adapter/web/e2e. Existing resolver warnings retained. |
| `npm run audit:warn` | PASS: 0 production vulnerabilities. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: adapter lines/statements 91.30%, functions 97.47%, branches 85.09%; web lines/statements 93.05%, functions 82.28%, branches 89.43%; all floors met. |
| `KIX_BUDGET_RECORD_OUT=/tmp/kix-ime-budget.json npm run test:budget` | PASS: 9 tests / 3 files; runtime split, chunk failure and render caps unchanged. |
| `npm run budget` | PASS: initial JS gzip 161,456 / 290,000; CSS 4,974; total gzip 782,556 / 790,000; route limits unchanged and passing. |
| `KIX_VISUAL_UPDATE=0 KIX_VISUAL_RECORD_OUT=/tmp/kix-ime-visual.json npm run test:visual` | PASS: 109 tests / 3 files; 94 screenshot baselines checked, none updated. |
| `git diff --check` | PASS after final evidence edits. |

During development: the first e2e typecheck found the fixture global declaration outside the e2e compiler scope; moved it to the composition helper. Focused regressions caught a premature blur timer and a spy attached after booking methods had been bound; retained blur deferral and observed the actual page port. A full stub run overlapped an in-progress source/test edit and saw the old 229 handler against the new typing-key test; final checks were rerun on the completed source. The first full accessibility run caught driver assumptions about offline button accessible names/activation and organizer's domain-disabled empty-event action, plus a blur expectation that should allow unfocused errors after resolution. The driver now uses keyboard activation offline and the editable seats error under a valid organizer event. No test/gate setting is relaxed.

## Protected-file comparison

Starting/locked SHA-256 for `packages/protocol-adapter/src/commerce-bindings.ts`:
`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`.

`sha256sum` matches the locked SHA above. `git diff 2acd0a0fd71d21aafcad98b80f58527c536adab4 --exit-code -- .aiops docs/aiops .github/workflows/ci.yml packages apps/web/bundle-budget.json package.json package-lock.json` exits 0 (byte-identical tracked files). `.aiops/**`, `docs/aiops/**`, CI, protocol packages/pins and `apps/web/bundle-budget.json` must remain byte-identical. Nothing changes in `kix-protocol`.

## Native-IME handoff checklist — PENDING

| Native environment | Tester/date | Booking | Gift | Organizer | Acceptance |
| --- | --- | --- | --- | --- | --- |
| OS/browser/Korean IME to be recorded by tester | PENDING | PENDING | PENDING | PENDING | PENDING |

For each actual OS/browser/IME tested, record source revision, locale and exact ordering where observable. Enter Korean text, confirm with Enter, cancel a composition, blur during/after preedit, then deliberately submit. Observe retained text, focus and real stub boundary count. Verify Korean quantity remains invalid until corrected; invalid deliberate actions focus a linked summary; valid deliberate actions send once; offline/busy/UNKNOWN states never replay. Record assistive technology separately. No native testing is claimed by this node's automation.

## Plan deviations

Use the constraints' document path (`c-plan-c-ime-form-safety-stub-apps-bind.md`). The existing booking deferred probe is reused without changing `protocol-fault.ts`. No copy, budget, dependency or business/controller changes are needed. Host Chrome needs the existing harness's opt-in no-sandbox setting. The first install ran on Node 20 and was repeated on Node 22; the final dist-dependent stub test ran after build completion. Native IME acceptance remains PENDING as planned.
