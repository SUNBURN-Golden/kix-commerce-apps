# Route registry and grouped navigation (stub) apps bind

This bind records how the route list is kept in one place and what the shell navigation now does with it. `apps/web/src/shell/route-registry.ts` holds path, label, group, binding word, breadcrumb parent, and the a11y and e2e targets for every route. `App.tsx` draws its routes from it, the Surfaces nav and the breadcrumb are built from it, and the page titles and focus keys are read from it. It is local, stub-scope product quality work. It does not claim integration, qualification, acceptance or release.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

M2: the adapter composes nothing past `accept_trade`. `capture` and `settle_capture` stay out of every journey and are never sent. `commit_trade`, `open_admission` and `admit` stay uncomposed with their not-bound reasons recorded. H1: `placeHold` stays not-bound with `consideredAction` `reserve_listing`, and `prepare_trade` is never given a `placeHold` body. This node composes no write, sends no request and maps no desk method onto a different body.

`contract_change=NO`. The registry, its group names and the route table below are app-internal. They are not a public schema, operation, capability or identifier.

## What did not change

- No path changed. Every URL the app answered before still answers (a test holds the earlier list and compares it with the registry plus its one alias).
- `packages/protocol-adapter/src/commerce-bindings.ts` is byte-identical. Its sha256 is `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`, and an existing test checks it.
- Both vendored OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA` and `protocolMergeSha` do not move. `.github/`, `.aiops/`, `docs/aiops/` and `packages/` are untouched. Nothing changes in kix-protocol. No dependency was added and `package-lock.json` is unchanged.
- No screen, surface, fixture or workspace-registry row was added, so the handoff packet and the evidence tables are unchanged. The session record retention stays `UNDETERMINED`.

## Behaviour

**Registry.** One entry per route: `id`, `path` (the react-router pattern), `label`, `group`, `binding`, primary `surface`, breadcrumb `parent`, `nav` (`link`, `section` or `hidden`), a concrete `sample` path, the `a11y` screen id, the `e2e` journey id, and whether the evidence matrix has a surface row. `/discovery/:rowId` is an alias of `/discovery` with no label of its own. `App.tsx` maps each registry id to its component in a `Record<RouteId, ComponentType>`, so a registry route without a component fails typecheck, and it writes no `<Route path>` literal except the catch-all.

**Groups.** Buyer, Organizer, Finance, Credit, Marketing, Platform, Verification. The grouping is a presentation choice and carries no policy meaning. Every route is in exactly one group.

**Grouped nav.** `<nav aria-label="Surfaces">` holds a Menu button and one list; each group is a list item with a text label and its own labelled list of links. All links are in the markup. Above 720px the button is hidden and every group shows, so the desktop Tab order is the link order. At 720px and below the groups fold behind the button (`aria-expanded`, `aria-controls`). Escape closes an open menu and returns focus to the button; Escape with the menu closed does nothing. A route change closes the menu and the page heading takes focus (existing behaviour). Choosing the link for the page already shown closes the menu and returns focus to the button.

**Current page.** `aria-current="page"` is set on at most one nav link, from `currentNavPath`. The marketing stubs M01 to M05 have no link of their own, so the Marketing link is current there (as before). `/booking/:eventId` has no link and no current mark (as before). The mark is bold, underlined and has a thicker rule, so it does not rest on colour. Behaviour change: the old prefix match is gone, so an unknown path such as `/gift/x` (a not-found page) no longer marks Gift current.

**Breadcrumb.** A second landmark, `<nav aria-label="Breadcrumb">`, beside the Surfaces nav (never inside it): group text, the parent link where there is one, then the current page with `aria-current="page"`. A group crumb that repeats the next label is left out. The registry binding word is printed as text beside it. Nothing is drawn on the not-found screen. No breadcrumb link points at a booking page.

**Skip link and landmarks.** The skip link stays first and targets `#desk-main`. One banner (`header`), one main, and navigation landmarks with distinct names (Surfaces, Breadcrumb, and Main screens on the not-found screen). The existing landmark and heading expectations in the a11y suite did not change: the nav adds no heading.

## Route table

The rows below are generated from the registry by a test and compared with this file. Columns: path, label, group, binding, nav, a11y screen, e2e journey, evidence row.

| Path | Label | Group | Binding | Nav | A11y | E2E | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | Box office | Buyer | stub-only | link | box-office | box-office | surface-row |
| `/buyer` | Buyer | Buyer | stub-only | link | buyer | buyer | surface-row |
| `/discovery` | Discover | Buyer | stub-only | link | discovery | discovery | surface-row |
| `/inventory` | Seats and GA | Buyer | stub-only | link | inventory | inventory | surface-row |
| `/booking/:eventId` | Booking | Buyer | published-bound | hidden | booking | booking | surface-row |
| `/admission` | Admission | Buyer | stub-only | link | admission | admission | surface-row |
| `/resale` | Resale | Buyer | stub-only | link | resale | resale | surface-row |
| `/gift` | Gift | Buyer | published-bound | link | gift | gift | surface-row |
| `/mobile` | Mobile shell | Buyer | stub-only | link | mobile | mobile | surface-row |
| `/assistant` | Assistant | Buyer | stub-only | link | assistant | assistant | surface-row |
| `/organizer` | Organizer | Organizer | published-bound | link | organizer | organizer | surface-row |
| `/organizer/workspace` | Organizer workspace | Organizer | published-bound | link | organizer-workspace | organizer-workspace | surface-row |
| `/merchant` | Merchant | Organizer | stub-only | link | merchant | merchant | surface-row |
| `/finance` | Finance | Finance | stub-only | link | finance | finance | surface-row |
| `/provider` | Provider journey | Finance | stub-only | link | provider | provider | surface-row |
| `/credit` | Credit | Credit | stub-only | link | credit | credit | surface-row |
| `/credit/origination` | Credit origination | Credit | stub-only | link | credit-origination | credit-origination | surface-row |
| `/credit/servicing` | Credit servicing | Credit | stub-only | link | credit-servicing | credit-servicing | surface-row |
| `/marketing` | Marketing | Marketing | no-published-command | link | marketing | marketing | surface-row |
| `/marketing/journey` | Benefit journey | Marketing | stub-only | link | marketing-journey | marketing-journey | surface-row |
| `/marketing/m01` | Marketing M01 | Marketing | no-published-command | section | marketing-m01 | marketing-m01 | surface-row |
| `/marketing/m02` | Marketing M02 | Marketing | no-published-command | section | marketing-m02 | marketing-m02 | surface-row |
| `/marketing/m03` | Marketing M03 | Marketing | no-published-command | section | marketing-m03 | marketing-m03 | surface-row |
| `/marketing/m04` | Marketing M04 | Marketing | no-published-command | section | marketing-m04 | marketing-m04 | surface-row |
| `/marketing/m05` | Marketing M05 | Marketing | published-bound | section | marketing-m05 | marketing-m05 | surface-row |
| `/platform` | Trading platform | Platform | stub-only | link | platform | platform | surface-row |
| `/marketplace-performance` | Marketplace bench | Platform | stub-only | link | marketplace-performance | marketplace-performance | surface-row |
| `/permissions` | Permissions | Platform | stub-only | link | permissions | permissions | surface-row |
| `/notifications` | Notifications | Platform | stub-only | link | notifications | notifications | surface-row |
| `/identity` | Journey context | Platform | stub-only | link | identity | identity | surface-row |
| `/session` | Session recovery | Platform | stub-only | link | session | session | surface-row |
| `/receipts` | Receipts | Verification | stub-only | link | receipts | receipts | surface-row |
| `/handoff` | Local handoff | Verification | stub-only | link | handoff | - | none |
| `/journeys` | Journeys | Verification | stub-only | link | journeys | journeys | surface-row |
| `/qualification` | Qualification | Verification | stub-only | link | qualification | qualification | surface-row |
| `/release` | Release | Verification | stub-only | link | release | release | surface-row |
| `/help` | Help | Verification | stub-only | link | help | - | none |

`/handoff` has no workspace surface row, so the evidence matrix has none for it (the registry carries that as a note). `/help` was added later by `c-user-guides-stub` and has no surface row for the same reason.

## Drift checks

- `apps/web/test/route-registry.test.tsx` fails on a repeated path, label or id, an unknown group or binding, an empty group, a dangling parent, a sample that does not resolve, an App route outside the registry, and a registry route that draws not-found. Negative cases feed mutated copies to the same checks.
- The registry is compared both ways with the a11y screen matrix (`SCREENS`), the browser journeys (`JOURNEYS` and the route each drives), and the Route column of the surface table in `docs/c-local-evidence-matrix-stub-apps-bind.md`. The matrices stay hand-written on purpose: a matrix derived from the registry could never disagree with it. No count is hardcoded.
- `apps/e2e/tests/a11y/acceptance.a11y.test.ts` now reads the registry instead of a regex over `App.tsx` and `Shell.tsx`.
- `apps/web/test/app-shell-resilience.test.tsx` lost its `links` import and its `length > 30` regex check; both are replaced by registry-driven checks (this resolves the limit "the page-title table duplicates the Shell link list" in `docs/c-app-shell-resilience-stub-apps-bind.md`).
- `apps/e2e/src/desk.ts` scopes `nav()` to the Surfaces landmark, because the breadcrumb is a second navigation that can hold a link with the same name.

## Limits

- The Menu fold, Escape and focus return are driven in headless Chrome only. A screen reader, a real device and a keyboard on a phone are not covered.
- The routes are still imported eagerly; splitting them is another node.
- Labels are English only.

## Local runs observed

The commands and exact source SHA are in the PR body. `npm ci`, `npm run typecheck`, `npm run build`, `KIX_REQUIRE_GATE=0 npm test` and `npm run typecheck:e2e` passed locally; `npm run test:e2e` (50 tests) and `npm run test:a11y` (218 tests, including the five new `a11y.nav.*` checks) passed in headless Chrome on loopback. One e2e run failed once in the box-office settlement journey and passed on the next two runs with no change; it was not investigated further.

The first a11y run found an axe `region` violation on every screen because the binding word sat outside a landmark. It moved inside the Breadcrumb navigation, and no `KNOWN_FINDINGS` entry was added or changed.

Browser checks: at 1280px the Menu button is hidden and Tab reaches every group and link in registry order, with one `aria-current` link that is bold with a thicker rule; at 320px the links are hidden until Enter or Space opens the menu, Tab reaches all of them, Escape returns focus to the button, choosing a link focuses the page heading, choosing the current page returns focus to the button, the open menu has no axe violation outside the known findings, no trap and no sideways scroll; the breadcrumb is its own landmark, and booking and not-found pages show no booking link and no current nav link or breadcrumb.

## Not verified

A screen reader, a real device, HTTP mode in a browser, the hosted-runner pass, and the live-gate suites (skipped with `KIX_REQUIRE_GATE=0`). No assistive-technology run, user acceptance or release is claimed.

## Hold

Nothing here is a qualification, an acceptance or a release. A real producer, SDK or provider connection, a real payment, a public deployment and a retention value each need their own authority.

## Development gallery extension

`c-component-gallery-stub` adds `/dev/gallery` only to the compile-time development extension `APP_ROUTES`. The route table above and `ROUTES` remain the production route set. The development entry is stub-only, has no workspace surface, and is covered separately in the [gallery bind](c-component-gallery-stub-apps-bind.md) and the local evidence matrix. Its metadata, screen import, fixtures and CSS are excluded from production artifacts; production answers not-found at this address. Both `/dev/gallery` and `/dev/gallery/` own one Shell/main in development. The original node's unchanged-screen statements above describe its historical scope.
