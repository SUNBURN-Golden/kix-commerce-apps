# Keyboard outcome journeys — bind

Node: `c-plan-d-keyboard-outcome-journeys-stub`. Base: main at `0990caf` (merge of #107). App-internal evidence for this repository. Not a public schema, operation, capability or ID.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce. `contract_change=NO`. No protocol command, binding, OpenAPI pin, `PINNED_ACTIONS` entry or CI file changes. `packages/protocol-adapter/src/commerce-bindings.ts` is byte-identical to main. Nothing composes `capture` or `settle_capture`, and `placeHold` stays not-bound with `consideredAction` `reserve_listing`.

Fence ruling: owner ruling 2026-10-26 13:06 KST (KIX Commerce, delegation 10-15), no product change. Outcome cells on genuinely read-only screens are NO_WRITE: the check asserts that no next-write control exists and that the outcome is reached and announced by keys. Controls are neither added nor disabled for them. Every other REJECT or UNKNOWN cell keeps the disabled or aria-disabled control with a non-empty `aria-describedby` reason.

Implementation: 85 declarative keyboard outcome checks, with pointer and announcement helper checks. Complete local verification passes: full stub, journey, accessibility, browser budget, visual and quality suites. Earlier runner timeouts and the discovery setup race are recorded below as failed runs, superseded by complete successful commands. No product, contract or runner decision remains pending. Human acceptance remains PENDING; release stays NOT_AUTHORIZED. The supervisor owns git/GitHub and hosted CI.

## Keyboard facet denominator

`keyboard facet: 85 / 85 BROWSER SUCCESS/REJECT/UNKNOWN cells`. The matrix has 140 cells (35 journeys × 4 outcomes). BROWSER cells with outcome SUCCESS, REJECT or UNKNOWN: 35 + 35 + 15 = 85. Each has one check id `a11y.kbd.outcome.<journey>.<outcome>`. The other 55 cells are keyboard NOT_APPLICABLE with a reason:

- 35 NOT_BOUND cells: a standing notice, not the result of a write.
- 20 UNKNOWN cells that are REFERENCE or NOT_REACHABLE. They keep their `pointer` and `owner`.

The facet lives in `apps/e2e/src/journey-matrix.ts` (`keyboardFacet`, `KEYBOARD_OUTCOME_CHECK_IDS`, `KEYBOARD_DENOMINATOR`, `KEYBOARD_NO_WRITE`, `keyboardFacetProblems`). `apps/e2e/tests/matrix.e2e.test.ts` asserts the facet, prints the line, and compares this document's tables with the data. The accessibility teardown prints the same line and writes it to the record as the observation `a11y.kbd.outcome.facet`. `MATRIX` cells and the journey suite's own expected ids are unchanged.

Fence kinds over the 85 checks:

| Fence | Cells |
| --- | --- |
| NONE (SUCCESS) | 35 |
| FENCED | 40 |
| NO_WRITE | 10 |

## How a check runs

`apps/e2e/tests/a11y/keyboard-outcomes.a11y.test.ts` is registered in the accessibility matrix through `expectedCheckIds()` in `apps/e2e/src/a11y-matrix.ts`, together with `a11y.kbd.outcome.pointer-guard` and `a11y.kbd.outcome.live-probe`. The teardown fails if any of them did not pass. Each drive is declarative (`apps/e2e/src/keyboard-outcomes.ts`). It mirrors the existing scenario in `apps/e2e/tests/journeys/<journey>.e2e.test.ts`, starts with one full load of its path, and then uses keys only.

- **Keys.** Tab and Shift+Tab: the walk uses the skip link when focus is on the document. Enter, Space and arrow keys: a native select moves by arrow keys and never by `selectOption`. Text entry goes through `keyboard.type` into an empty field, or into a field whose value Tab selected. The table records the number of typed fields per check.
- **Pointer guard** (`apps/e2e/src/keyboard-guard.ts`). The page a drive gets is a Proxy. These calls record a violation and throw `PointerInputError`, on the page, on every chained locator (including FrameLocator chains) and on every element handle:
  - `click`, `dblclick`, `tap`, `hover`, `check`, `selectOption`, `fill`, `focus`, `press`, `type` and `dispatchEvent`;
  - any `page.mouse.*` or `page.touchscreen.*` call;
  - any key outside Tab, Shift+Tab, Enter, Space and the four arrows.

  An init script counts trusted pointer, mouse, touch and wheel events, mouse-initiated clicks and calls to `HTMLElement.prototype.click`. The guarded page flushes that count before any goto or reload. `assertNoPointer()` fails even when a refusal was caught. The guard test proves that chained `click` (also through FrameLocator), `tap`, `dblclick`, `focus`, `fill`, handle `click`, `mouse.move`, `mouse.click`, `touchscreen.tap`, `page.click`, `Escape` and `keyboard.down` all fail. A raw `mouse.move` and `mouse.click` are seen by the page and survive a reload. A keys-only walk leaves the ledger empty. Deliberate violations run on their own pages.
- **One announcement** (`installLiveCounter`, `settleLive` in `apps/e2e/src/keyboard-probes.ts`). A MutationObserver starts immediately before the final trigger key. Regions are `[aria-live]` (not off), `role=status`, `role=alert` and `role=log`. Each region counts its own text, excluding nested regions and `aria-live="off"` subtrees, so two live attributes on one element count once. A nested or sibling region that updates on its own is counted separately.
  - A text change in a region that is already in the page counts.
  - Every inserted live region with non-empty text counts, including polite regions inserted during same-document navigation.
  - A busy region, or a region under a busy ancestor, holds its update until busy clears.
  - The window opens at the final key and closes once the outcome is present, at least 1000 ms have passed and no region text has changed for 500 ms. A region still changing at 6000 ms fails.

  The probe test proves these counts: no change 0, one change 1, sibling duplicate 2, delayed duplicate 2, nested inner 1, nested both 2, busy region 1, busy ancestor 1, polite insert 1, alert insert 1, off line 0. The fixtures and journeys use the same `liveProblems` verdict: zero, duplicate, delayed duplicate and unsettled observations fail. Every check asserts exactly 1. The outcome selector must also be absent before the final key.
- **Focus rule.** STATUS passes when focus is on the outcome status, inside it, or on an element whose `aria-describedby`, `aria-labelledby` or `aria-controls` names it. TRIGGER passes when focus is still on the control that took the final key. Focus on the document always fails.
- **Fence.**
  - FENCED: every matching control is disabled or aria-disabled, and its `aria-describedby` reaches non-empty text.
  - NO_WRITE: no send-style button and none of the cell's write selectors are present.
  - Drives with a refusal replay press the fenced control again. The refusal adds no announcement and the state does not move.
- **Reflow.** After the other probes, the window is set to 360 × 800 CSS px and the document must not scroll sideways.
- Every check ends with `assertNoPointer()`. `suite.pass` then asserts zero application network calls.

## Per-desk focus rule

STATUS means focus is on the outcome status or programmatically associated with it. Validation outcomes keep the existing summary-to-field keyboard navigation. Organizer workspace success preserves its deliberate results-heading focus; the heading belongs to the outcome results region. TRIGGER means focus stays on the control that took the final key. Route outcomes (`receipts`, `buyer.REJECT`, `marketing.SUCCESS`, `marketing-m02.REJECT`) land focus on the page heading, which names the outcome section through `aria-describedby`.

| Desk | SUCCESS | REJECT | UNKNOWN |
| --- | --- | --- | --- |
| box-office | TRIGGER | TRIGGER | NOT_APPLICABLE |
| booking | STATUS | STATUS | NOT_APPLICABLE |
| admission | TRIGGER | TRIGGER | NOT_APPLICABLE |
| resale | TRIGGER | TRIGGER | NOT_APPLICABLE |
| credit | TRIGGER | TRIGGER | NOT_APPLICABLE |
| gift | STATUS | STATUS | NOT_APPLICABLE |
| organizer | STATUS | STATUS | NOT_APPLICABLE |
| receipts | STATUS | STATUS | NOT_APPLICABLE |
| buyer | TRIGGER | STATUS | NOT_APPLICABLE |
| discovery | STATUS | STATUS | NOT_APPLICABLE |
| inventory | TRIGGER | TRIGGER | NOT_APPLICABLE |
| mobile | TRIGGER | TRIGGER | STATUS |
| assistant | TRIGGER | STATUS | STATUS |
| organizer-workspace | STATUS | STATUS | NOT_APPLICABLE |
| merchant | TRIGGER | TRIGGER | NOT_APPLICABLE |
| finance | TRIGGER | STATUS | STATUS |
| provider | TRIGGER | STATUS | STATUS |
| credit-origination | TRIGGER | STATUS | STATUS |
| credit-servicing | TRIGGER | TRIGGER | STATUS |
| marketing | STATUS | TRIGGER | NOT_APPLICABLE |
| marketing-journey | TRIGGER | TRIGGER | STATUS |
| platform | TRIGGER | STATUS | TRIGGER |
| marketplace-performance | TRIGGER | TRIGGER | NOT_APPLICABLE |
| permissions | TRIGGER | STATUS | STATUS |
| notifications | TRIGGER | STATUS | STATUS |
| identity | TRIGGER | STATUS | STATUS |
| session | TRIGGER | STATUS | STATUS |
| journeys | TRIGGER | TRIGGER | TRIGGER |
| qualification | TRIGGER | STATUS | TRIGGER |
| release | TRIGGER | STATUS | TRIGGER |
| marketing-m01 | TRIGGER | STATUS | NOT_APPLICABLE |
| marketing-m02 | STATUS | STATUS | NOT_APPLICABLE |
| marketing-m03 | TRIGGER | TRIGGER | NOT_APPLICABLE |
| marketing-m04 | TRIGGER | TRIGGER | NOT_APPLICABLE |
| marketing-m05 | STATUS | STATUS | NOT_APPLICABLE |

## Per-check results

Paths are the full load each drive starts from. All 85 outcome tests and both helper tests pass in `/tmp/kixc-resume-a11y3.log`; `/tmp/kixc-resume-a11y3.json` records focus, exactly one announcement, fence/NO_WRITE, pointer guard and reflow assertions. The full accessibility command passes all 363 tests, with ledger 0/0/0 and every production, release, conformance and user-acceptance claim false.

| Check | Path | Focus rule | Live announcements | Fence | Control / absence selectors | Typed fields | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `a11y.kbd.outcome.box-office.SUCCESS` | `/` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.box-office.REJECT` | `/` | TRIGGER | 1 | FENCED | `aside[aria-label="Mock settlement case"] button:text-is("Simulate COMMITTED phase")` | 0 | PASS |
| `a11y.kbd.outcome.booking.SUCCESS` | `/booking/evt_lanterns` | STATUS | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.booking.REJECT` | `/booking/evt_lanterns` | STATUS | 1 | FENCED | `#booking-place` | 1 | PASS |
| `a11y.kbd.outcome.admission.SUCCESS` | `/` | TRIGGER | 1 | NONE | `—` | 1 | PASS |
| `a11y.kbd.outcome.admission.REJECT` | `/admission` | TRIGGER | 1 | FENCED | `aside[aria-label="Admission credential"] button:text-is("Adopt issued mock credential")` | 1 | PASS |
| `a11y.kbd.outcome.resale.SUCCESS` | `/` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.resale.REJECT` | `/resale` | TRIGGER | 1 | FENCED | `button:text-is("Open listing")` | 1 | PASS |
| `a11y.kbd.outcome.credit.SUCCESS` | `/` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.credit.REJECT` | `/` | TRIGGER | 1 | FENCED | `aside[aria-label="Mock credit case"] button:text-is("Close mock case")` | 0 | PASS |
| `a11y.kbd.outcome.gift.SUCCESS` | `/gift` | STATUS | 1 | NONE | `—` | 4 | PASS |
| `a11y.kbd.outcome.gift.REJECT` | `/gift` | STATUS | 1 | FENCED | `aside.gift-panel button[disabled]` | 1 | PASS |
| `a11y.kbd.outcome.organizer.SUCCESS` | `/organizer` | STATUS | 1 | NONE | `—` | 2 | PASS |
| `a11y.kbd.outcome.organizer.REJECT` | `/organizer` | STATUS | 1 | FENCED | `aside.organizer-panel button:text-is("Send create_event")` | 1 | PASS |
| `a11y.kbd.outcome.receipts.SUCCESS` | `/` | STATUS | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.receipts.REJECT` | `/` | STATUS | 1 | NO_WRITE | `no next-write control` | 0 | PASS |
| `a11y.kbd.outcome.buyer.SUCCESS` | `/buyer` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.buyer.REJECT` | `/` | STATUS | 1 | NO_WRITE | `no next-write control` | 0 | PASS |
| `a11y.kbd.outcome.discovery.SUCCESS` | `/discovery` | STATUS | 1 | NONE | `—` | 1 | PASS |
| `a11y.kbd.outcome.discovery.REJECT` | `/discovery` | STATUS | 1 | NO_WRITE | `no next-write control` | 2 | PASS |
| `a11y.kbd.outcome.inventory.SUCCESS` | `/inventory` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.inventory.REJECT` | `/inventory` | TRIGGER | 1 | NO_WRITE | `no next-write control` | 0 | PASS |
| `a11y.kbd.outcome.mobile.SUCCESS` | `/mobile` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.mobile.REJECT` | `/mobile` | TRIGGER | 1 | FENCED | `#mobile-confirm-ord-0001` | 0 | PASS |
| `a11y.kbd.outcome.mobile.UNKNOWN` | `/mobile` | STATUS | 1 | FENCED | `#mobile-confirm-ord-0001` | 0 | PASS |
| `a11y.kbd.outcome.assistant.SUCCESS` | `/assistant` | TRIGGER | 1 | NONE | `—` | 1 | PASS |
| `a11y.kbd.outcome.assistant.REJECT` | `/assistant` | STATUS | 1 | FENCED | `#dlg-ask` | 0 | PASS |
| `a11y.kbd.outcome.assistant.UNKNOWN` | `/assistant` | STATUS | 1 | FENCED | `button[id^="dlg-approve-"]` | 1 | PASS |
| `a11y.kbd.outcome.organizer-workspace.SUCCESS` | `/organizer/workspace` | STATUS | 1 | NONE | `—` | 2 | PASS |
| `a11y.kbd.outcome.organizer-workspace.REJECT` | `/organizer/workspace` | STATUS | 1 | FENCED | `.organizer-ws button[disabled]` | 0 | PASS |
| `a11y.kbd.outcome.merchant.SUCCESS` | `/merchant` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.merchant.REJECT` | `/merchant` | TRIGGER | 1 | NO_WRITE | `no next-write control` | 0 | PASS |
| `a11y.kbd.outcome.finance.SUCCESS` | `/finance` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.finance.REJECT` | `/finance` | STATUS | 1 | FENCED | `#finance-approve-prp-0001` | 0 | PASS |
| `a11y.kbd.outcome.finance.UNKNOWN` | `/finance` | STATUS | 1 | FENCED | `#finance-propose-rcs-0001-link-observation` | 0 | PASS |
| `a11y.kbd.outcome.provider.SUCCESS` | `/provider` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.provider.REJECT` | `/provider` | STATUS | 1 | FENCED | `#provider-issue-ord-0001` | 0 | PASS |
| `a11y.kbd.outcome.provider.UNKNOWN` | `/provider` | STATUS | 1 | FENCED | `#provider-observe-ord-0001` | 0 | PASS |
| `a11y.kbd.outcome.credit-origination.SUCCESS` | `/credit/origination` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.credit-origination.REJECT` | `/credit/origination` | STATUS | 1 | FENCED | `#origination-drawdown` | 0 | PASS |
| `a11y.kbd.outcome.credit-origination.UNKNOWN` | `/credit/origination` | STATUS | 1 | FENCED | `#origination-submit` | 0 | PASS |
| `a11y.kbd.outcome.credit-servicing.SUCCESS` | `/credit/servicing` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.credit-servicing.REJECT` | `/credit/servicing` | TRIGGER | 1 | FENCED | `#servicing-propose-adjustment` | 0 | PASS |
| `a11y.kbd.outcome.credit-servicing.UNKNOWN` | `/credit/servicing` | STATUS | 1 | FENCED | `#servicing-propose-adjustment` | 0 | PASS |
| `a11y.kbd.outcome.marketing.SUCCESS` | `/marketing` | STATUS | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.marketing.REJECT` | `/marketing` | TRIGGER | 1 | FENCED | `button:text-is("Reset marketing session")` | 1 | PASS |
| `a11y.kbd.outcome.marketing-journey.SUCCESS` | `/marketing/journey` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.marketing-journey.REJECT` | `/marketing/journey` | TRIGGER | 1 | FENCED | `#mkj-apply-ben-0002-ord-0001` | 0 | PASS |
| `a11y.kbd.outcome.marketing-journey.UNKNOWN` | `/marketing/journey` | STATUS | 1 | FENCED | `#mkj-apply-ben-0002-ord-0001` | 0 | PASS |
| `a11y.kbd.outcome.platform.SUCCESS` | `/platform` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.platform.REJECT` | `/platform` | STATUS | 1 | FENCED | `#platform-transfer-trd-0001` | 0 | PASS |
| `a11y.kbd.outcome.platform.UNKNOWN` | `/platform` | TRIGGER | 1 | FENCED | `button[id^="platform-transfer-"]` | 0 | PASS |
| `a11y.kbd.outcome.marketplace-performance.SUCCESS` | `/marketplace-performance` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.marketplace-performance.REJECT` | `/marketplace-performance` | TRIGGER | 1 | NO_WRITE | `no next-write control` | 0 | PASS |
| `a11y.kbd.outcome.permissions.SUCCESS` | `/permissions` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.permissions.REJECT` | `/permissions` | STATUS | 1 | NO_WRITE | `absent: button[id^="tenant-account-"]` | 0 | PASS |
| `a11y.kbd.outcome.permissions.UNKNOWN` | `/permissions` | STATUS | 1 | FENCED | `#tenant-account-acc-0001` | 0 | PASS |
| `a11y.kbd.outcome.notifications.SUCCESS` | `/notifications` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.notifications.REJECT` | `/notifications` | STATUS | 1 | NO_WRITE | `absent: button[id^="notify-mark-"], button[id^="notify-resolve-"]` | 0 | PASS |
| `a11y.kbd.outcome.notifications.UNKNOWN` | `/notifications` | STATUS | 1 | FENCED | `#notify-mark-ntf-0001` | 0 | PASS |
| `a11y.kbd.outcome.identity.SUCCESS` | `/identity` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.identity.REJECT` | `/identity` | STATUS | 1 | FENCED | `tr[data-verdict="foreign"] button[aria-disabled="true"]` | 0 | PASS |
| `a11y.kbd.outcome.identity.UNKNOWN` | `/identity` | STATUS | 1 | FENCED | `#attach-obs-0001` | 0 | PASS |
| `a11y.kbd.outcome.session.SUCCESS` | `/session` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.session.REJECT` | `/session` | STATUS | 1 | FENCED | `#session-attach-obs-0001` | 0 | PASS |
| `a11y.kbd.outcome.session.UNKNOWN` | `/session` | STATUS | 1 | FENCED | `#session-attach-obs-0001` | 0 | PASS |
| `a11y.kbd.outcome.journeys.SUCCESS` | `/journeys` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.journeys.REJECT` | `/journeys` | TRIGGER | 1 | NO_WRITE | `no next-write control` | 0 | PASS |
| `a11y.kbd.outcome.journeys.UNKNOWN` | `/journeys` | TRIGGER | 1 | NO_WRITE | `no next-write control` | 0 | PASS |
| `a11y.kbd.outcome.qualification.SUCCESS` | `/qualification` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.qualification.REJECT` | `/qualification` | STATUS | 1 | FENCED | `#oq-run` | 0 | PASS |
| `a11y.kbd.outcome.qualification.UNKNOWN` | `/qualification` | TRIGGER | 1 | FENCED | `#oq-run` | 0 | PASS |
| `a11y.kbd.outcome.release.SUCCESS` | `/release` | TRIGGER | 1 | NONE | `—` | 0 | PASS |
| `a11y.kbd.outcome.release.REJECT` | `/release` | STATUS | 1 | FENCED | `#rel-run` | 0 | PASS |
| `a11y.kbd.outcome.release.UNKNOWN` | `/release` | TRIGGER | 1 | FENCED | `#rel-run` | 0 | PASS |
| `a11y.kbd.outcome.marketing-m01.SUCCESS` | `/marketing/m01` | TRIGGER | 1 | NONE | `—` | 1 | PASS |
| `a11y.kbd.outcome.marketing-m01.REJECT` | `/marketing/m01` | STATUS | 1 | FENCED | `main button:text-is("Clear demo card")` | 0 | PASS |
| `a11y.kbd.outcome.marketing-m02.SUCCESS` | `/marketing/m01` | STATUS | 1 | NONE | `—` | 1 | PASS |
| `a11y.kbd.outcome.marketing-m02.REJECT` | `/marketing` | STATUS | 1 | FENCED | `.program li button` | 0 | PASS |
| `a11y.kbd.outcome.marketing-m03.SUCCESS` | `/marketing/m03` | TRIGGER | 1 | NONE | `—` | 1 | PASS |
| `a11y.kbd.outcome.marketing-m03.REJECT` | `/marketing/m03` | TRIGGER | 1 | FENCED | `#coupon-form button[type="submit"]` | 1 | PASS |
| `a11y.kbd.outcome.marketing-m04.SUCCESS` | `/marketing/m04` | TRIGGER | 1 | NONE | `—` | 1 | PASS |
| `a11y.kbd.outcome.marketing-m04.REJECT` | `/marketing/m04` | TRIGGER | 1 | FENCED | `#referral-form button[type="submit"]` | 1 | PASS |
| `a11y.kbd.outcome.marketing-m05.SUCCESS` | `/marketing/m05` | STATUS | 1 | NONE | `—` | 6 | PASS |
| `a11y.kbd.outcome.marketing-m05.REJECT` | `/marketing/m05` | STATUS | 1 | FENCED | `main li.journey-step button:text-is("Send set_consent")` | 1 | PASS |

## NO_WRITE cells (owner ruling 2026-10-26 13:06 KST)

The outcome view has no next-write control. Existing scenario, scope, inspection and local selection controls remain usable. Each check probes for send controls and its explicit absent selectors.

| Cell | Justification |
| --- | --- |
| `receipts.REJECT` | Receipt explorer is a read-only page-load reader; it sends nothing and has no write control. |
| `buyer.REJECT` | Buyer workspace says 'No write sent by this page.'; show and order choices are local reads. |
| `discovery.REJECT` | Discovery is a read-only search; a refused filter has no write to fence. |
| `inventory.REJECT` | Seat selection is local and the lapsed queue has no published command to join; nothing is written. |
| `merchant.REJECT` | Merchant operations is a read and export screen; a denied read has no write to fence. |
| `journeys.REJECT` | The Journeys table is one read made once and sends no command (README); a refused table read has no write to fence. |
| `journeys.UNKNOWN` | The Journeys table sends no command (README); Unknown rows belong to other surfaces and are listed, never closed. |
| `marketplace-performance.REJECT` | Marketplace bench is a bounded read; a refused page has no write to fence. |
| `permissions.REJECT` | The denied read returns no membership row. The only writes on this desk act on a row (account changes), so the outcome screen has none; what remains are scenario, scope and read controls and the sensitive export, an inspection read that stays fenced. |
| `notifications.REJECT` | The denied read returns no notification row. The only writes on this desk act on a row (mark and resolve), so the outcome screen has none; what remains are scenario, scope and read controls and Simulate stand-ins for source events. |

## NOT_APPLICABLE cells

| Cell | Kind | Reason |
| --- | --- | --- |
| `box-office.UNKNOWN` | NOT_REACHABLE | NOT_REACHABLE: pointer kept (c-fault-injection-stub); no user action on this desk produces this outcome. |
| `box-office.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `booking.UNKNOWN` | REFERENCE | REFERENCE: pointer kept (c-cross-surface-journeys-stub); no user action on this desk produces this outcome. |
| `booking.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `admission.UNKNOWN` | NOT_REACHABLE | NOT_REACHABLE: pointer kept (c-fault-injection-stub); no user action on this desk produces this outcome. |
| `admission.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `resale.UNKNOWN` | REFERENCE | REFERENCE: pointer kept (c-cross-surface-journeys-stub); no user action on this desk produces this outcome. |
| `resale.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `credit.UNKNOWN` | NOT_REACHABLE | NOT_REACHABLE: pointer kept (c-fault-injection-stub); no user action on this desk produces this outcome. |
| `credit.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `gift.UNKNOWN` | REFERENCE | REFERENCE: pointer kept (c-cross-surface-journeys-stub); no user action on this desk produces this outcome. |
| `gift.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `organizer.UNKNOWN` | REFERENCE | REFERENCE: pointer kept (c-cross-surface-journeys-stub); no user action on this desk produces this outcome. |
| `organizer.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `receipts.UNKNOWN` | REFERENCE | REFERENCE: pointer kept (c-receipt-explorer); no user action on this desk produces this outcome. |
| `receipts.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `buyer.UNKNOWN` | REFERENCE | REFERENCE: pointer kept (c-receipt-explorer); no user action on this desk produces this outcome. |
| `buyer.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `discovery.UNKNOWN` | REFERENCE | REFERENCE: pointer kept (c-cross-surface-journeys-stub); no user action on this desk produces this outcome. |
| `discovery.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `inventory.UNKNOWN` | REFERENCE | REFERENCE: pointer kept (c-inventory-venue-stub); no user action on this desk produces this outcome. |
| `inventory.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `mobile.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `assistant.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `organizer-workspace.UNKNOWN` | REFERENCE | REFERENCE: pointer kept (c-cross-surface-journeys-stub); no user action on this desk produces this outcome. |
| `organizer-workspace.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `merchant.UNKNOWN` | REFERENCE | REFERENCE: pointer kept (c-merchant-operations-stub); no user action on this desk produces this outcome. |
| `merchant.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `finance.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `provider.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `credit-origination.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `credit-servicing.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `marketing.UNKNOWN` | NOT_REACHABLE | NOT_REACHABLE: pointer kept (c-fault-injection-stub); no user action on this desk produces this outcome. |
| `marketing.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `marketing-journey.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `platform.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `marketplace-performance.UNKNOWN` | REFERENCE | REFERENCE: pointer kept (c-marketplace-performance-stub); no user action on this desk produces this outcome. |
| `marketplace-performance.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `permissions.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `notifications.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `identity.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `session.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `journeys.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `qualification.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `release.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `marketing-m01.UNKNOWN` | NOT_REACHABLE | NOT_REACHABLE: pointer kept (c-fault-injection-stub); no user action on this desk produces this outcome. |
| `marketing-m01.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `marketing-m02.UNKNOWN` | NOT_REACHABLE | NOT_REACHABLE: pointer kept (c-fault-injection-stub); no user action on this desk produces this outcome. |
| `marketing-m02.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `marketing-m03.UNKNOWN` | NOT_REACHABLE | NOT_REACHABLE: pointer kept (c-fault-injection-stub); no user action on this desk produces this outcome. |
| `marketing-m03.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `marketing-m04.UNKNOWN` | NOT_REACHABLE | NOT_REACHABLE: pointer kept (c-fault-injection-stub); no user action on this desk produces this outcome. |
| `marketing-m04.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |
| `marketing-m05.UNKNOWN` | REFERENCE | REFERENCE: pointer kept (w7-m05-consent-bind); no user action on this desk produces this outcome. |
| `marketing-m05.NOT_BOUND` | BROWSER | NOT_BOUND is a standing not-bound notice, not the result of a keyboard-driven write. |

## Web fixes

Every fix is in `apps/web/src`. The SSR test is `apps/web/test/keyboard-outcome-focus.test.tsx` (31 tests); focus effects are checked by the browser checks above.

- **Synthetic status sections.** These desks: mobile, assistant, credit origination, credit servicing, benefit journey, merchant, notifications, platform, provider, permissions, finance, journeys, qualification, release and marketplace bench. Each status section is now the single polite region (`aria-live="polite"`, busy while loading, in progress or in flight). The inner `role="status"` lines are gone. Freshness, scope, watermark, counter, behind and fence lines are `aria-live="off"`. Each section keeps `tabIndex=-1` as the status focus target.
- **Identity and session.** The status regions mark freshness, counter, load and budget lines `aria-live="off"`. Each region is busy while a scenario change waits for its read (identity) or an attach waits for its answer (session). Applying a scenario moves focus to the status, because the apply button locks (`useSettledFocus`).
- **One status update per action.**
  - Assistant: busy until a session's first read settles.
  - Journeys: a new session starts busy.
  - Qualification and release: busy while a run waits for its result.
  - Refund status: busy while reading.
- **Refused sends and submits.** `RefusalScope` records the last pressed send and links its refusal reason through `aria-describedby`; an edit or another send clears that local fence. Fields stay editable. Activating a fenced invalid submit returns focus to its existing summary without sending or changing the spoken text. `ValidatedForm` renders one always-present, visually clipped `role="status"` line, filled with the existing ko/en `validation.notSent` copy only after a refused submit. Blur checks still fill the summary silently. Focus still moves to the summary and on to the field.
- **Journey step panels** (booking, gift, organizer, M05 consent), through `useStepOutcome` in `apps/web/src/a11y/focus.ts`:
  - Only the step just sent is live, and it is busy while in flight.
  - Its status takes focus (`tabIndex=-1`) when its send control locks.
  - Each locked send names its existing row note through `aria-describedby`. On gift this fixes `status.disabled-no-reason`, so that KNOWN_FINDING is marked FIXED. Booking keeps its OPEN row because the reservation panel controls still have no reason.
- **Mock panels.** The phase line (settlement, credit, resale, admission), the settlement reconcile line and the credit repaid line are polite.
- **Route changes.** Static receipt empty/binding notes, initial detail and copy guidance do not announce on insertion. Detail selection and copy results still announce. The Buyer loading notice is busy; its unselected refund guidance is ordinary text. The shell has one always-present, clipped `role="status"` line. It speaks the new page title when the path changes, never on first paint or on a locale switch. The Receipts and Buyer headings, the marketing hub heading and the M02 heading name their outcome section through `aria-describedby`.
- **Discovery.**
  - The filter-conflict line is `role="alert"`.
  - A detail opened from the list takes focus (`tabIndex=-1`); it is never focused on first paint.
  - The form keeps a typed draft until the URL state catches up. Without it, React Router's transition reverted fast keys: typing "Lanterns" left "t".
- **Marketing desks.**
  - M01: the card area is one polite region, and Clear demo card names the empty-card line.
  - M02: the recorded line is polite and takes focus when the button locks, and disabled presale buttons name the window note or the recorded line.
  - M03: the marker lines are polite.
  - M04: the marker count is polite.
  - Hub: the session facts become polite after Reset. Static marketing boundary notices have no live role.
- **Organizer workspace.** One polite status wrapper replaces the swapped status elements. Prepare preview and Submit name "No commands in the change list." while it is empty.
- **Inventory.** The queue state line is polite.
- **Reflow at 360 px.**
  - The qualification and release run tables scroll in their own focusable region.
  - Long ids and digests wrap through inline `overflow-wrap: anywhere`: receipt detail, workspace fieldset and results, qualification packet list, release candidate list, and the M05 consent panel. The same idiom as Diagnostics, so the initial CSS stays at 4,974 bytes.

No new copy key, network call, storage key or protocol command. The new web source holds none of the banned tokens (`fetch(`, `capture`, `placeHold`, `fallback`, `retry`, `Date.now(`, `Math.random(`, `127.0.0.1`, `/health`).

## Bundle numbers

Measured with Node 22.20.0, gzip level 9. All existing limits, including the tighter 282,000 initial JS and 785,000 total assertions, remain unchanged. Shared lazy desk helpers are emitted once in `desk-ui` to recover headroom.

| Build | Initial JS gzip | CSS gzip | Total gzip | Files |
| --- | --- | --- | --- | --- |
| main `0990caf`, independently rebuilt from `git archive HEAD` | 161,679 | 4,974 | 784,542 | 103 |
| final worktree | 161,448 | 4,974 | 781,778 | 94 |

The final total is 2,764 bytes smaller than main. Baseline reproduction used a temporary archive at `/tmp/kixc-keyboard-main-bzbyc4qa`, symlinked the existing installed dependencies, then ran `npm run build` and `npm run budget` there. Both passed; logs: `/tmp/kixc-ready-baseline-build.log`, `/tmp/kixc-ready-baseline-budget.log`. No baseline repository source was edited. Current final logs: `/tmp/kixc-resume-build.log`, `/tmp/kixc-resume-budget.log`.

## Visual baselines

PASS: all 109 visual tests (92 baseline comparisons plus harness/display checks), no baseline edits or pixel diffs. Chrome 156.0.8078.47, Node 22.20.0. Current log: `/tmp/kixc-resume-visual.log`; record: `/tmp/kixc-resume-visual.json`, ledger 0/0/0.

## Merge resolution verification — 2026-10-28 KST

This verification combines branch HEAD `aa7a2642a3e1de38ad7c399e7e1e9292581bd7cf` with merge target `af5659d6b5ad9a6a69892dcbae5c398a8da21223` (`origin/main` and `MERGE_HEAD`). The only textual conflict was `apps/e2e/src/a11y-global-setup.ts`. The combined teardown preserves main's timing and lifecycle diagnostics, diagnostic failures, setup-failure handling and unconditional cleanup, and this node's keyboard denominator console output and `a11y.kbd.outcome.facet` record observation. Main's `finally` cleanup supersedes the earlier success-only cleanup sequence so every server and build cleanup is attempted after a failure too. No node content is discarded. The auto-merged journey matrix keeps both the new harness checks and all 85 keyboard outcome checks.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce. The locked bindings, CI, bundle limits, `.aiops/`, `docs/aiops/` and visual baselines remain identical to the merge target. No protocol pin is moved. Main's already-merged invoker conformance work remains intact; this resolution adds no adapter change. Human acceptance: PENDING. Hosted CI and the conditional live gate are not claimed as passing. The merge remains unstaged and uncommitted for the supervisor.

The first full combined journey run exposed an integration defect in main's new config-pin test: its line-based numeric-timeout regex treated this node's legitimate `setTimeout(..., 200)` probe delay as a Vitest timeout override. The run failed 1/194 (193 passed), with ledger 0/0/0 and clean lifecycle accounting; `e2e.log` and `e2e.json` retain that failure. `apps/e2e/tests/config-pin.e2e.test.ts` now parses numeric overrides on actual Vitest calls using the already-installed TypeScript parser. A regression covers the multiline timer and numeric overrides on plain, modified, parameterized and bracket-access test calls. All pinned timeouts, retries and other guard checks remain unchanged.

Logs and browser records for this combined worktree are under `/tmp/kixc-keyboard-merge-MubOFh`. Node 20.19.2; the repository's retry and timeout settings are unchanged. Browser suites run sequentially with `KIX_REQUIRE_GATE=0 KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1`.

| Command / check | Combined-worktree evidence |
| --- | --- |
| `npm run typecheck` | PASS: adapter and web; `typecheck.log`. |
| `npm run typecheck:e2e` | PASS; `typecheck-e2e-final.log`. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 1,466 passed / 23 conditional tests skipped; web 1,268 passed and cold-entry 6 passed; `stub-tests.log`. |
| `npm run build` | PASS; `build.log`. |
| `npm run budget` | PASS: initial JS 160,713, CSS 4,984 and total 778,647 gzip bytes, with unchanged limits; `budget.log`. |
| `npm run lint` | PASS; `lint-final.log`. |
| `KIX_E2E_RECORD_OUT=/tmp/kixc-keyboard-merge-MubOFh/e2e-final.json npm run test:e2e` | PASS: 47 files / 195 tests; keyboard facet 85/85; ledger 0/0/0, zero lifecycle leaks, pending calls/routes or cleanup errors; `e2e-final.log`, `e2e-final.json`. |
| `KIX_A11Y_RECORD_OUT=/tmp/kixc-keyboard-merge-MubOFh/a11y.json npm run test:a11y` | PASS: 17 files / 363 tests in 579.75 seconds; all 85 keyboard outcomes and both helper tests; ledger 0/0/0 and clean lifecycle accounting; `a11y.log`, `a11y.json`. |
| Record inspection | PASS: both records contain timing/lifecycle blocks, no diagnostic failures and all claims false. Accessibility contains exactly 85 outcome observations with one announcement and zero pointer events each, both helper check ids, and the 85/85 facet observation. |
| Marker, whitespace and protected-path checks | PASS: no conflict markers; `git diff --check` clean; locked binding, CI, limits, protected directories and visual baselines identical to `origin/main`; `final-checks.log`. |

Combined-worktree verification status: READY. The complete passing commands above supersede the retained first journey-run failure; no partial run is presented as a pass. Visual baselines are unchanged; this merge repair does not rerun the visual or browser-budget suites whose earlier branch evidence follows. No hosted CI is triggered. Human acceptance: PENDING.

## Run records — resumed verification, 2026-10-28 KST

Node 22.20.0, npm 11.21.1, Chrome 156.0.8078.47. Commands use `PATH=/tmp/kix-node22/node_modules/node/bin:$PATH`. All final full commands below exited 0. Browser commands run serially, in the foreground, with unchanged repository settings and limits. The full accessibility command took 569.09 seconds, within its existing 20-minute CI job limit.

| Command actually run | Result | Log / record |
| --- | --- | --- |
| `npm ci` | PASS: 535 packages; lockfile unchanged. Five development-inclusive audit findings were reported; production audit is below. | `/tmp/kixc-resume-ci.log` |
| `npm exec -w @kix/web -- vitest run test/keyboard-outcome-focus.test.tsx test/entry-import-graph.test.ts` | PASS: 33 tests, including all 31 SSR tests and both tighter import-graph assertions. | `/tmp/kixc-resume-narrow-web.log` |
| `npm run typecheck` | PASS: adapter and web. | `/tmp/kixc-resume-typecheck.log` |
| `npm run typecheck:e2e` | PASS, rerun after the final guard changes. | `/tmp/kixc-resume-typecheck-e2e-final.log` |
| `npm run build` | PASS. | `/tmp/kixc-resume-build.log` |
| `npm run budget` | PASS: initial JS 161,448 / CSS 4,974 / total 781,778 gzip bytes; all limits unchanged. | `/tmp/kixc-resume-budget.log` |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 1,421 passed / 23 conditional tests skipped; web 1,268 passed; cold-entry 6 passed. | `/tmp/kixc-resume-stub2.log` |
| `npm run lint` | PASS, rerun after the final guard changes. | `/tmp/kixc-resume-lint-final.log` |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: adapter lines 91.18%, functions 97.40%, branches 84.77%; web lines 92.91%, functions 81.10%, branches 89.27%. Every unchanged floor met. | `/tmp/kixc-resume-coverage.log` |
| `npm run deps:check` | PASS: four manifests / 630 lockfile entries. | `/tmp/kixc-resume-deps.log` |
| `npm run cycle-check` | PASS: adapter, web and e2e have no cycles. | `/tmp/kixc-resume-cycle.log` |
| `npm run audit:warn` | PASS: zero production vulnerabilities. | `/tmp/kixc-resume-audit.log` |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kixc-resume-e2e.json npm run test:e2e` | PASS: 44 files / 181 tests; facet 85/85; ledger 0/0/0. | `/tmp/kixc-resume-e2e.log`, `/tmp/kixc-resume-e2e.json` |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kixc-resume-a11y3.json npm run test:a11y` | PASS: 17 files / 363 tests, including all 85 outcomes and both helper checks; ledger 0/0/0. | `/tmp/kixc-resume-a11y3.log`, `/tmp/kixc-resume-a11y3.json` |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_BUDGET_RECORD_OUT=/tmp/kixc-resume-browser-budget.json npm run test:budget` | PASS: three files / nine tests; unchanged timing and size caps; ledger 0/0/0. | `/tmp/kixc-resume-browser-budget.log`, `/tmp/kixc-resume-browser-budget.json` |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_RECORD_OUT=/tmp/kixc-resume-visual.json KIX_VISUAL_OUT=/tmp/kixc-resume-visual npm run test:visual` | PASS: three files / 109 tests; zero baseline changes; ledger 0/0/0. | `/tmp/kixc-resume-visual.log`, `/tmp/kixc-resume-visual.json` |
| `git diff --check` | PASS. | Final worktree check. |
| `git diff --exit-code HEAD -- packages/protocol-adapter/src/commerce-bindings.ts .aiops docs/aiops .github/workflows/ci.yml apps/web/bundle-budget.json apps/e2e/visual-baselines` | PASS: protected source, CI, limits and baselines unchanged. | Locked binding blob remains `47ab5e10cbf5f8f10bed718b4dd5190fe5dfe76f`. |

Filtered checks intentionally retain the full-suite teardown: omitted checks make the command exit 1 even when every selected assertion passes. They are not counted as passing full commands.

| Narrow command actually run | Selected assertions / command result |
| --- | --- |
| `npm exec -w @kix/e2e -- vitest run tests/matrix.e2e.test.ts` | Nine assertions PASS, including doc coverage and 85 CHECK / 55 NOT_APPLICABLE. Exit 1 only for omitted journey checks. Repeated after the final evidence edit: all nine assertions PASS. Logs: `/tmp/kixc-resume-narrow-matrix.log`, `/tmp/kixc-resume-narrow-matrix-final.log`. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm exec -w @kix/e2e -- vitest run -c vitest.a11y.config.ts tests/a11y/keyboard-outcomes.a11y.test.ts -t 'discovery.REJECT\|live probe'` | Two assertions PASS / 85 skipped. Exit 1 for omitted accessibility checks. Log: `/tmp/kixc-resume-narrow-probes.log`. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm exec -w @kix/e2e -- vitest run -c vitest.a11y.config.ts tests/a11y/keyboard-outcomes.a11y.test.ts -t 'pointer guard'` | Guard regression PASS / 86 skipped, including FrameLocator chained click refusal. Exit 1 for omitted accessibility checks. Log: `/tmp/kixc-resume-narrow-guard.log`. |

Failures retained from this resumed verification (never counted as passes):

- First `KIX_REQUIRE_GATE=0 npm test`: the production-gallery exclusion test timed out; 1,267/1,268 web tests passed. The complete repeated command above passes without changing its timeout. Log: `/tmp/kixc-resume-stub.log`.
- First filtered keyboard file: 86/87 tests passed; `mobile.REJECT` timed out. Command: `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kixc-resume-narrow-a11y.json npm exec -w @kix/e2e -- vitest run -c vitest.a11y.config.ts tests/a11y/keyboard-outcomes.a11y.test.ts`. Log: `/tmp/kixc-resume-narrow-a11y.log`.
- First full accessibility command, using `KIX_A11Y_RECORD_OUT=/tmp/kixc-resume-a11y.json` with the same Chrome flags: 361/363 passed. The gallery load timed out, and `discovery.REJECT` correctly detected two announcements: the preceding valid-range empty result and then the conflict. The drive now waits for that valid setup result before installing the observer and pressing ArrowUp. No announcement is excluded from the probe. Log: `/tmp/kixc-resume-a11y.log`.
- Second full accessibility command, using `KIX_A11Y_RECORD_OUT=/tmp/kixc-resume-a11y2.json` with the same Chrome flags: all 87 keyboard outcome/helper tests passed, but the existing all-screen dialog probe timed out, so the full result was 362/363. Log: `/tmp/kixc-resume-a11y2.log`.
- Third full accessibility command above passes all 363 tests. No timeout, timing cap, coverage floor, size limit, baseline or CI setting was relaxed. No partial records were aggregated into a pass.

The stale runner-selection `DECISION_REQUIRED.md` from the earlier attempt is removed because complete verification now passes on this runner. No new hardware, credentials, paid service or production runtime was needed. The conditional live-gate suite remains skipped, never claimed passed; the repository-backed recipe is in Not verified below. Human acceptance remains PENDING. Current verification status: READY.

## Earlier attempt records (superseded)

All verification uses Node 22.20.0 (`PATH=/tmp/kix-node22/node_modules/node/bin:$PATH`), npm 11.21.1 and Chrome 156.0.8078.47. Logs and JSON records are local artifacts under `/tmp/kixc-final-*` and `/tmp/kixc-ready-*`.

| Command actually run | Result |
| --- | --- |
| `npm ci` | PASS: 535 packages; dependency tree unchanged. npm reported 5 development-inclusive audit findings. Log: `/tmp/kixc-final-ci.log`. |
| `npm exec -w @kix/web -- vitest run test/keyboard-outcome-focus.test.tsx test/entry-import-graph.test.ts` | PASS: 32 tests before the additional route regression assertion. |
| `npm exec -w @kix/web -- vitest run test/keyboard-outcome-focus.test.tsx` | Final narrow run PASS: 31 tests. The first version of the added assertion mistakenly included Shell's persistent banner; scoped it to main and reran. Log: `/tmp/kixc-final-narrow-web3.log`. |
| `npm exec -w @kix/e2e -- vitest run tests/matrix.e2e.test.ts` | All 9 matrix assertions PASS, facet 85/85. Filtered command exits 1 because the full journey teardown correctly requires omitted checks; final full run is listed below. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm exec -w @kix/e2e -- vitest run -c vitest.a11y.config.ts tests/a11y/keyboard-outcomes.a11y.test.ts` | Initial probe found five navigation duplicates; fixed their live owners. Next run: all 87 tests PASS. Filtered teardown exits 1 for omitted accessibility checks, as expected. Logs: `/tmp/kixc-final-narrow-a11y.log`, `/tmp/kixc-final-narrow-a11y2.log`. |

The first broad accessibility run found repeated invalid submission did not return to its summary after the new fence. The button now reopens the summary without sending or changing the announcement. Its form regression tests pass in the corrected narrow run. The first broad journey, visual and accessibility runs also had coincident isolated timeouts lasting about 388 seconds; those are failures, not passing evidence. A later shared-host stall caused roughly 55-minute timeouts in unchanged static tests too; load average reached 128.56 and available memory fell to 1.9 GiB. Three overlapping accessibility test trees were stopped (exit 143); their partial records are not passes. Remaining suites are rerun with unchanged timeout settings and no retries. Initial logs: `/tmp/kixc-final-e2e.log`, `/tmp/kixc-final-visual.log`, `/tmp/kixc-final-a11y.log`.

| Final command | Result / log |
| --- | --- |
| `npm run typecheck` | PASS: adapter and web. `/tmp/kixc-ready-typecheck.log` |
| `npm run typecheck:e2e` | PASS. `/tmp/kixc-ready-typecheck-e2e.log` |
| `npm run build` | PASS. `/tmp/kixc-ready-build.log` |
| `npm run budget` | PASS: 161,448 initial JS, 4,974 CSS, 781,778 total gzip bytes. `/tmp/kixc-ready-budget.log` |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 1,421 passed / 23 skipped; web 1,268 passed; cold-entry 6 passed. `/tmp/kixc-pass-stub.log` |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: adapter lines 91.18%, functions 97.40%, branches 84.77%; web lines 92.91%, functions 81.10%, branches 89.28%. All floors unchanged and met. `/tmp/kixc-ready-coverage.log` |
| `npm run lint` | PASS. `/tmp/kixc-ready-lint.log` |
| `npm run deps:check` | PASS: four manifests / 630 lock entries. `/tmp/kixc-ready-deps.log` |
| `npm run cycle-check` | PASS: adapter, web and e2e have no cycles. `/tmp/kixc-ready-cycle.log` |
| `npm run audit:warn` | PASS: zero production vulnerabilities. `/tmp/kixc-ready-audit.log` |
| `git diff --check` | PASS |
| `git diff --exit-code HEAD -- packages/protocol-adapter/src/commerce-bindings.ts .aiops docs/aiops .github/workflows/ci.yml apps/web/bundle-budget.json apps/e2e/visual-baselines` | PASS: protected files, limits and visual baselines unchanged |

| Browser command | Final result |
| --- | --- |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_RECORD_OUT=/tmp/kixc-final-acceptance-visual.json KIX_VISUAL_OUT=/tmp/kixc-final-acceptance-visual npm run test:visual` | PASS: 3 files, 109 tests, unchanged baselines; ledger nonLoopback=0 / nonGet=0 / appNetworkCalls=0. |

| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kixc-final-acceptance-a11y.json npm run test:a11y` | FAIL: 361/363; marketing-journey.REJECT and release reflow timed out during long host stalls. All 85 outcome probe sets and both helper checks were recorded; ledger 0/0/0. Log: `/tmp/kixc-final-acceptance-a11y.log`. This is not a passing accessibility suite. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kixc-final-acceptance-e2e.json npm run test:e2e` | FAIL: 180/181, permissions.UNKNOWN timeout during a roughly 42-minute stall; ledger 0/0/0. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kixc-complete-e2e.json npm run test:e2e` | FAIL: 179/181; marketplace rejection and receipts standing-notice tests timed out. A wait returned a stale code-mode host generation after a restart. The chained accessibility and budget commands were not reached. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_BUDGET_RECORD_OUT=/tmp/kixc-close-budget.json npm run test:budget` | FAIL: 8/9; discovery cold-load timing exceeded the unchanged runner cap. Earlier `/tmp/kixc-final-browser-budget.log` passed 9/9 before the final summary-focus correction; that is historical evidence, not a final-source passing budget run. |

These earlier failed/aborted exploratory runs are historical evidence, superseded by the complete passing resumed commands above. No timeout, timing cap, coverage floor, bundle limit, baseline or CI setting was relaxed. No hosted CI was triggered, and partial runs were never aggregated into a pass.

## Deviations

- Applied the 2026-10-26 owner amendment: ten explicitly justified NO_WRITE cells; all forty remaining REJECT/UNKNOWN cells require fences. No ABSENT or UNFENCED exemption.
- Trigger focus is compared with a read-only element handle; no test-side DOM stamp, value change, focus call or dispatched action is used.
- The shared lazy UI chunk deduplicates helper code to meet unchanged total and route budgets.
- Reused existing ko/en catalogue copy; no new display strings, network, storage, commands or protocol pins.
- The live probe counts inserted polite regions and independently updating nested/sibling regions, with no navigation exception. Every outcome is absent before the final key. Its fixtures use the same verdict as the journeys, proving that zero, duplicate, delayed duplicate and unsettled observations fail.
- Discovery waits for the preceding valid date range to finish rendering before the final conflicting ArrowUp key. This prevents an unfinished setup announcement from entering the outcome window; the observer still counts every announcement during that window.
- FrameLocator chains stay guarded; no actual iframe or new product surface is added.

Earlier attempt verification status: INCOMPLETE; superseded by the resumed READY verification above.

## Not verified

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack): `assistiveTech` stays NOT_RUN. The MutationObserver models announcements; no assistive technology was run.
- Real devices and touch, browsers other than Chrome, HTTP mode in a browser and production runtime.
- The conditional live-gate adapter suite is skipped locally, never claimed passed. Repository-backed recipe: `.github/workflows/ci.yml` checks for `KIX_PROTOCOL_READ_TOKEN`, checks out `BeautifulMind-JT/kix-protocol` at `KIX_PROTOCOL_GATE_SHA`, then runs `KIX_PROTOCOL_ROOT=<checkout> KIX_REQUIRE_GATE=1 npm test -w @kix/protocol-adapter`. This build does not acquire credentials or alter the pinned checkout.
- No target standard is named. Release stays NOT_AUTHORIZED. No hosted CI was triggered; verification below uses local equivalents.

Human acceptance: PENDING.

## Files changed

70 files relative to the merge target, all within the node’s allowed app/doc paths (including the config-pin integration fix). Visual baselines, bundle limits, protocol bindings, pins, CI and protected program/delegation files are unchanged. The obsolete untracked decision handoff was removed.

- `apps/e2e/src/a11y-global-setup.ts`
- `apps/e2e/src/a11y-matrix.ts`
- `apps/e2e/src/journey-matrix.ts`
- `apps/e2e/src/keyboard-guard.ts`
- `apps/e2e/src/keyboard-outcomes.ts`
- `apps/e2e/src/keyboard-probes.ts`
- `apps/e2e/src/keyboard-runner.ts`
- `apps/e2e/tests/a11y/keyboard-outcomes.a11y.test.ts`
- `apps/e2e/tests/config-pin.e2e.test.ts`
- `apps/e2e/tests/matrix.e2e.test.ts`
- `apps/web/src/a11y/focus.ts`
- `apps/web/src/components/ConnectivityWriteButton.tsx`
- `apps/web/src/components/Shell.tsx`
- `apps/web/src/connectivity/refusal.tsx`
- `apps/web/src/cross-surface-journeys.ts`
- `apps/web/src/delegated-assistant.ts`
- `apps/web/src/forms/ValidatedForm.tsx`
- `apps/web/src/forms/useFormValidation.ts`
- `apps/web/src/journey-identity.ts`
- `apps/web/src/operational-qualification.ts`
- `apps/web/src/pages/AdmissionCredentialPanel.tsx`
- `apps/web/src/pages/Assistant.tsx`
- `apps/web/src/pages/AssistantPanels.tsx`
- `apps/web/src/pages/Buyer.tsx`
- `apps/web/src/pages/BuyerPanels.tsx`
- `apps/web/src/pages/CreditOriginationPanels.tsx`
- `apps/web/src/pages/CreditPanel.tsx`
- `apps/web/src/pages/CreditServicingPanels.tsx`
- `apps/web/src/pages/CrossSurfaceJourneysPanels.tsx`
- `apps/web/src/pages/Discovery.tsx`
- `apps/web/src/pages/DiscoveryPanels.tsx`
- `apps/web/src/pages/FinancePanels.tsx`
- `apps/web/src/pages/GiftPanel.tsx`
- `apps/web/src/pages/InstallableMobilePanels.tsx`
- `apps/web/src/pages/InventoryPanels.tsx`
- `apps/web/src/pages/JourneyIdentityPanels.tsx`
- `apps/web/src/pages/JourneyPanel.tsx`
- `apps/web/src/pages/MarketingJourneyPanels.tsx`
- `apps/web/src/pages/MarketplacePerformancePanels.tsx`
- `apps/web/src/pages/MerchantPanels.tsx`
- `apps/web/src/pages/NotificationsPanels.tsx`
- `apps/web/src/pages/OperationalQualification.tsx`
- `apps/web/src/pages/OperationalQualificationPanels.tsx`
- `apps/web/src/pages/Organizer.tsx`
- `apps/web/src/pages/OrganizerPanel.tsx`
- `apps/web/src/pages/OrganizerWorkspace.tsx`
- `apps/web/src/pages/PlatformPanels.tsx`
- `apps/web/src/pages/PlatformRelease.tsx`
- `apps/web/src/pages/PlatformReleasePanels.tsx`
- `apps/web/src/pages/ProviderJourneyPanels.tsx`
- `apps/web/src/pages/Receipts.tsx`
- `apps/web/src/pages/RefundReturnPanel.tsx`
- `apps/web/src/pages/Resale.tsx`
- `apps/web/src/pages/ResalePanel.tsx`
- `apps/web/src/pages/SessionRecoveryPanels.tsx`
- `apps/web/src/pages/SettlementPanel.tsx`
- `apps/web/src/pages/TenantPermissionsPanels.tsx`
- `apps/web/src/pages/marketing/Hub.tsx`
- `apps/web/src/pages/marketing/M01Membership.tsx`
- `apps/web/src/pages/marketing/M02Presale.tsx`
- `apps/web/src/pages/marketing/M03Coupons.tsx`
- `apps/web/src/pages/marketing/M04Rewards.tsx`
- `apps/web/src/pages/marketing/M05Consent.tsx`
- `apps/web/src/pages/marketing/MarketingChrome.tsx`
- `apps/web/src/platform-release.ts`
- `apps/web/src/session-recovery.ts`
- `apps/web/test/__snapshots__/component-gallery.test.tsx.snap`
- `apps/web/test/keyboard-outcome-focus.test.tsx`
- `apps/web/vite.config.ts`
- `docs/c-plan-d-keyboard-outcome-journeys-stub-apps-bind.md`
