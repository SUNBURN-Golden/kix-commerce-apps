# c-a11y-acceptance-stub: keyboard and assistive-technology observation, user acceptance PENDING

Node `c-a11y-acceptance-stub` (stub scope). M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

This is an observation of the stub desk in headless Chrome. It is **not** user acceptance, **not** a conformance claim, **not** an assistive-technology session, and **not** a release permission. CI status, accessibility observation, user acceptance and release permission are four separate facets and are never merged into one state. `contract_change=NO`: the observation record and matrix are app-internal and are not a public schema, operation, capability or ID.

## Scope and what did not change

- Mode `stub`, source `stub-shape`, server bound to `127.0.0.1`, one browser, no proxy. The suite adds no request path: axe-core is read from `node_modules` and injected from disk. The ledger must show zero non-loopback, zero non-GET and zero page-script network calls.
- Locked and unchanged: `packages/protocol-adapter/src/commerce-bindings.ts`, both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, `.aiops/`, `docs/aiops/`, `apps/web/src`, and the journey suite (`test:e2e`). `placeHold` stays not bound, nothing is composed past `accept_trade`, and there is no `capture` or `settle_capture`.
- No screen was edited. Every defect found is recorded below as OPEN. Fixing them is a separate change.
- The decider for acceptance and the target standard are not assigned, and no earlier baseline (including the 2026-10-13 `c-accessibility-baseline` run) or any other product's approval is reused (`inheritedFrom: null` on every row).

## Tool and baseline

| Item | Value |
| --- | --- |
| Tool | axe-core 4.14.0 (exact pin in `apps/e2e/package.json` and `package-lock.json`; MPL-2.0, dev-only, not bundled into the app) |
| Tags | `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice` |
| Target standard | UNDETERMINED. The tags configure the tool. They do not state a level that is met. |
| Browser | Chrome 154.0.8037.97 via playwright-core 1.58.2 |
| Viewports | desktop 1280x800, narrow 320x568 |

Automated results are `violations` only. axe `incomplete` results (here `color-contrast` on every screen, and `aria-prohibited-attr` on `marketplace-performance`) need manual review and are never counted as passes. Node counts are not asserted, and `color-contrast` is exempt from the "no longer shows" check because it depends on installed fonts.

### Baseline change log

Changing the version or the tags needs a new dated row here, with a check of the source (release notes and the installed package), and the same change in `A11Y_BASELINE`. `baseline.a11y.test.ts` compares the version in code, `package.json`, the lockfile, the injected axe and this table.

| Date | axe-core | Tags | Source check |
| --- | --- | --- | --- |
| 2026-10-17 | 4.14.0 | wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice | First baseline for this node. The installed package reports this version and has rules for every tag (checked in the browser by the baseline test). |

## Screen matrix

One row per screen (37 screens; `/discovery/:rowId` is the same page as `/discovery`). Facets stay separate. `NOT_RUN` means no run of that kind exists. Violation columns list axe rule ids from this run. CI status is not recorded here, because a record cannot attest the run that produces it.

| Screen | Path | axe desktop | axe 320px | Keyboard | Structure | Reflow | Assistive tech | User acceptance | Release |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `box-office` | `/` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `buyer` | `/buyer` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `discovery` | `/discovery` | nested-interactive | nested-interactive | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `inventory` | `/inventory` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `platform` | `/platform` | landmark-unique | landmark-unique | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `merchant` | `/merchant` | heading-order, landmark-unique | heading-order, landmark-unique | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `booking` | `/booking/evt_lanterns` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `admission` | `/admission` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `resale` | `/resale` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `gift` | `/gift` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `organizer-workspace` | `/organizer/workspace` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `organizer` | `/organizer` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `receipts` | `/receipts` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `handoff` | `/handoff` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `credit-origination` | `/credit/origination` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `credit-servicing` | `/credit/servicing` | heading-order | heading-order | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `credit` | `/credit` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `finance` | `/finance` | landmark-unique | landmark-unique | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `marketing` | `/marketing` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `marketing-journey` | `/marketing/journey` | landmark-unique | landmark-unique | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `marketing-m01` | `/marketing/m01` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `marketing-m02` | `/marketing/m02` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `marketing-m03` | `/marketing/m03` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `marketing-m04` | `/marketing/m04` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `marketing-m05` | `/marketing/m05` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `assistant` | `/assistant` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `permissions` | `/permissions` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `notifications` | `/notifications` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `provider` | `/provider` | landmark-unique | landmark-unique | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `marketplace-performance` | `/marketplace-performance` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `mobile` | `/mobile` | landmark-unique | landmark-unique | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `qualification` | `/qualification` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `release` | `/release` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `identity` | `/identity` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `session` | `/session` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `journeys` | `/journeys` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |
| `help` | `/help` | none | none | OBSERVED | OBSERVED | OBSERVED | NOT_RUN | PENDING | NOT_AUTHORIZED |

Keyboard = skip link first and working, a Tab walk with no trap, an accessible name and a visible focus mark at every stop (keys only, no click). Native date-input sub-fields are not judged for the focus mark. Structure = table names and header cells, focusable scroll regions, a visible word in each status mark, control labels, and an error message linked to each invalid control. Reflow = no sideways document scroll at 320px, and at a 200% root font size in a 640px window, which is an approximation and not browser zoom.

## User acceptance matrix

Every row is PENDING. This node cannot write ACCEPTED, and the record type has no accepted or rejected value. A decider would need: a named standard and level, the exact branch HEAD recorded in `evidenceHead`, a keyboard and screen-reader pass on a real device, and review of the OPEN findings. None of that exists yet.

| Screen | Label | State | Decider | Baseline | Inherited |
| --- | --- | --- | --- | --- | --- |
| `box-office` | Box office | PENDING | user (not assigned) | none | no |
| `buyer` | Buyer | PENDING | user (not assigned) | none | no |
| `discovery` | Discover | PENDING | user (not assigned) | none | no |
| `inventory` | Seats and GA | PENDING | user (not assigned) | none | no |
| `platform` | Trading platform | PENDING | user (not assigned) | none | no |
| `merchant` | Merchant | PENDING | user (not assigned) | none | no |
| `booking` | Booking | PENDING | user (not assigned) | none | no |
| `admission` | Admission | PENDING | user (not assigned) | none | no |
| `resale` | Resale | PENDING | user (not assigned) | none | no |
| `gift` | Gift | PENDING | user (not assigned) | none | no |
| `organizer-workspace` | Organizer workspace | PENDING | user (not assigned) | none | no |
| `organizer` | Organizer | PENDING | user (not assigned) | none | no |
| `receipts` | Receipts | PENDING | user (not assigned) | none | no |
| `handoff` | Local handoff | PENDING | user (not assigned) | none | no |
| `credit-origination` | Credit origination | PENDING | user (not assigned) | none | no |
| `credit-servicing` | Credit servicing | PENDING | user (not assigned) | none | no |
| `credit` | Credit | PENDING | user (not assigned) | none | no |
| `finance` | Finance | PENDING | user (not assigned) | none | no |
| `marketing` | Marketing | PENDING | user (not assigned) | none | no |
| `marketing-journey` | Benefit journey | PENDING | user (not assigned) | none | no |
| `marketing-m01` | Marketing M01 | PENDING | user (not assigned) | none | no |
| `marketing-m02` | Marketing M02 | PENDING | user (not assigned) | none | no |
| `marketing-m03` | Marketing M03 | PENDING | user (not assigned) | none | no |
| `marketing-m04` | Marketing M04 | PENDING | user (not assigned) | none | no |
| `marketing-m05` | Marketing M05 | PENDING | user (not assigned) | none | no |
| `assistant` | Assistant | PENDING | user (not assigned) | none | no |
| `permissions` | Permissions | PENDING | user (not assigned) | none | no |
| `notifications` | Notifications | PENDING | user (not assigned) | none | no |
| `provider` | Provider journey | PENDING | user (not assigned) | none | no |
| `marketplace-performance` | Marketplace bench | PENDING | user (not assigned) | none | no |
| `mobile` | Mobile shell | PENDING | user (not assigned) | none | no |
| `qualification` | Qualification | PENDING | user (not assigned) | none | no |
| `release` | Release | PENDING | user (not assigned) | none | no |
| `identity` | Journey context | PENDING | user (not assigned) | none | no |
| `session` | Session recovery | PENDING | user (not assigned) | none | no |
| `journeys` | Journeys | PENDING | user (not assigned) | none | no |
| `help` | Help | PENDING | user (not assigned) | none | no |

## Alternate states observed

Driven by keys where a key path exists (a few values are set with `fill`), then probed with axe (desktop), the structure probe and, for forms, a focus and error-link probe.

| State | What it is |
| --- | --- |
| `booking:invalid` | booking quantity 1.5 (invalid) (`/booking/evt_lanterns`) |
| `booking:missing` | booking for an unknown event (`/booking/evt_missing`) |
| `discovery:empty` | discovery with no matching row (`/discovery`) |
| `discovery:conflict` | discovery from-after-to filter conflict (`/discovery`) |
| `organizer-workspace:empty-id` | organizer workspace with an empty event id (`/organizer/workspace`) |
| `gift:not-sent` | gift offer not sent (empty body) (`/gift`) |
| `inventory:section-page` | inventory section page opened by keys (`/inventory`) |
| `receipts:empty` | receipts with no receipt on this load (`/receipts`) |
| `journeys:unknown-filter` | journeys table filtered to Unknown (`/journeys`) |
| `session:attach-lost` | session attach whose answer is lost (`/session`) |
| `not-found:unknown-path` | not-found screen at an unknown address (`/no-such-screen`) |

Forms: booking `1.5` keeps the typed value, marks the field invalid, returns focus to it and links the alert. The discovery conflict and the organizer-workspace empty id do the same. The gift refusal returns focus and marks the field invalid but links no message (finding below).

Widgets: the Handoff and Receipts tablists use roving tabindex and answer ArrowLeft, ArrowRight, Home and End; the discovery and inventory listboxes move `aria-activedescendant` with ArrowDown and ArrowUp; the `/journeys` disclosure opens with Enter and closes with Space.

Observations (not assertions): when this node was written, after a keyboard route change the document title was unchanged ("KIX Box Office") and focus stayed on the activated link. That was true at the time and is superseded by `c-app-shell-resilience-stub` (2026-10-18): the title is now per page and focus moves to the page heading; see `docs/c-app-shell-resilience-stub-apps-bind.md`. The observation test still only records what it sees. During exploration, typing into the discovery search box with no delay between keys dropped characters (the box is synced with the URL); it was not reproducible at a 60 ms delay, so it is noted here and not asserted.

## Findings (OPEN unless a row is marked FIXED)

| Where | Rule or probe | What |
| --- | --- | --- |
| discovery, inventory:section-page | `nested-interactive` | A control sits inside a listbox option, so the option is not a clean widget for assistive technology. |
| platform, merchant, finance, marketing-journey, provider, mobile | `landmark-unique` | Two landmarks of the same role have no distinct accessible name. |
| merchant, credit-servicing, booking:missing | `heading-order` | A heading level is skipped. |
| handoff (320px) | `reflow.narrow-overflow` | FIXED 2026-10-19 in `c-display-preferences-stub`: the unbreakable env token in the Startup faults list pushed a panel grid track past the window; handoff list text now wraps anywhere and the scrollable table regions are named focusable regions. The screen-matrix cell above is updated to OBSERVED. Was: the Role journey list is about 8px wider than a 320px window, so the document scrolls sideways. |
| gift:not-sent | `form.error-not-linked / struct.invalid-unlinked` | The ticket id is marked invalid after a refused send, and focus returns to it, but no message is linked to it with aria-describedby. |
| booking, gift | `status.disabled-no-reason` | Natively disabled buttons carry no reason that aria-describedby reaches. /journeys uses aria-disabled with a reason and passes. |

The list is a ratchet in `KNOWN_FINDINGS`: a new violation fails the run, and a listed OPEN one that stops showing also fails it until it is marked FIXED with a note.

## Dialog: NOT_APPLICABLE

No `dialog`, `role=dialog`, `role=alertdialog` or `aria-modal` exists on any of the screens, and none was added to test one. Focus trap, Escape close and focus return are therefore NOT_APPLICABLE. A test fails if a dialog appears, so the probes must then be written. Escape is checked as a no-op on a form field.

## Not verified

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack), real devices and touch, browser zoom, and browsers other than Chrome.
- HTTP mode and the integration-http not-bound state in a browser (the gate sends no CORS header).
- The `/journeys` held scenario and in-flight screens (the stub resolves at once).
- Any target standard or level. No conformance is claimed.
- User acceptance (PENDING) and release permission (NOT_AUTHORIZED).
- First run of the new CI job on `ubuntu-24.04`.

## How to run

```bash
npm ci
npm run typecheck:e2e
KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/a11y-record.json npm run test:a11y
```

`KIX_E2E_NO_SANDBOX=1` only where the Chrome sandbox cannot start. The record holds check ids, rule ids, counts and fixed words. It has no DOM text, typed values or credentials, and every `claims` entry is false. CI runs the suite as its own job, `a11y-observation`, so a green CI run and the accessibility facet stay separate.

## Acceptance mapping

| Item | Where |
| --- | --- |
| Keyboard flows, focus, labels and errors, table headers, non-colour state, narrow viewport | `screens`, `keyboard`, `alt-states` tests |
| Tool and version recorded, automation is not acceptance | `A11Y_BASELINE`, `baseline` test, record `claims` |
| Per-screen matrix is PENDING only, and holds references only | `acceptance` test, `assertNoAcceptance` |
| CI, observation, acceptance and release not merged | separate CI job, no CI field, `release: NOT_AUTHORIZED` |

## Development gallery observations

`c-component-gallery-stub` adds separate development-only coverage for `/dev/gallery`; it does not change the production SCREENS denominator or inherit any acceptance. The existing tool/version/tags and UNDETERMINED target standard are retained. Its index and 22 isolated specimens are scanned in en/ko at desktop/320px, with keyboard and display-preference probes; exact checks are in [the gallery bind](c-component-gallery-stub-apps-bind.md) and the development row of the local evidence matrix.

| Route | Mode | qualification_state | acceptance_state | release_state |
| --- | --- | --- | --- | --- |
| /dev/gallery | development stub only | UNQUALIFIED | PENDING | NOT_AUTHORIZED |

The gallery node also fixes an inherited nested-control defect in discovery's independent projection listbox, observed in the empty/conflict search states. Projection rows retain mouse and keyboard detail opening. The original discovery results list still has the recorded OPEN nested-interactive finding; no finding exemption or existing check was relaxed.
