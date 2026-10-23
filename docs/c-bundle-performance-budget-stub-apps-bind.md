# Route code splitting and bundle budget (stub) apps bind

This bind records how every registry route now loads its screen on demand, which size and render budgets the repository checks, and what those budgets are and are not. `apps/web/src/screens.ts` holds one dynamic import per registry route. `App.tsx` draws each route inside a `Suspense` boundary. `scripts/check-bundle-budget.mjs` reads a `vite build` output and compares it with `apps/web/bundle-budget.json`. A separate CI job, `Bundle budget`, runs the check and a headless-Chrome suite (`npm run test:budget`).

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

M2: the adapter composes nothing past `accept_trade`. `capture` and `settle_capture` stay out of every journey and are never sent. `commit_trade`, `open_admission` and `admit` stay uncomposed with their not-bound reasons recorded. H1: `placeHold` stays not-bound with `consideredAction` `reserve_listing`, and `prepare_trade` is never mapped from it. Nothing in this node touches those rules.

`contract_change=NO`. The screen loader, the budget file, the load-failure panel kind and the measurement record are app-internal. They are not a public schema, operation, capability or identifier.

## What did not change

- `packages/protocol-adapter/src/commerce-bindings.ts` is byte-identical. Nothing under `packages/` changed, so the adapter and both vendored pin files stay in the entry chunk (a known floor on the initial size, listed under Limits of the numbers).
- Both vendored OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA` and `protocolMergeSha` do not move. `.aiops/` and `docs/aiops/` are untouched. Nothing changes in kix-protocol. No dependency was added and `package-lock.json` is unchanged.
- No route, screen, surface or fixture was added or removed, so the registry, the a11y matrix, the journeys matrix and the evidence tables are unchanged. The registry holds 36 routes; the node text says 38, and this node does not change the count (the test uses the registry length, not a number).
- Existing CI jobs are byte-identical and no existing test was weakened, skipped or deleted. Two wait selectors in the a11y suite were made stricter (see Behaviour).
- The session record retention stays `UNDETERMINED`. This node sets no retention value and does not touch storage code.
- The default stays the stub. Loopback `http://127.0.0.1` only, one attempt, no stub fallback, no retry, no `Idempotency-Key`, no redirect following, no fetch from a UI component. Loading a screen's code is a script request for a static file, not a desk request.

## Behaviour

**Per-route loading.** `screens.ts` maps each registry route id to `() => import("./pages/X")`. The type is `Record<RouteId, ScreenImport>`, so a route added to the registry without an import fails typecheck. `App.tsx` builds every `<Route>` from `ROUTES` (and the alias list) and wraps the screen in `<Suspense key={entry.id} fallback={<ScreenLoading label={entry.label} />}>`. The not-found screen stays in the entry chunk so an unknown path never waits on a file.

**Loader, not literal `React.lazy`.** `shell/screen-loader.ts` keeps one cached import per screen and a read function that throws the pending promise (which Suspense waits on), returns the settled component, or throws the stored `ScreenLoadError`. This gives the same Suspense behaviour as `React.lazy`, and it lets the test setup settle every screen before a synchronous server render. A failed load is kept as the outcome, so React drawing the slot again does not import again. The failure is tried a second time only when `forgetFailedScreens()` runs: the "Load this screen again" button, or a move to another screen.

**Loading note.** While a screen's code loads, the main region shows `<p role="status" data-screen-loading>Loading {label}…</p>`. It has no heading, no spinner and no animation. When the screen is drawn, the slot finishes the route-change focus move to the page heading (`onScreenReady`), so focus lands on the heading as it did before the split. If the user already moved focus inside the main region, it is left alone.

**Load failure.** A rejected import (a missing file, or a stale hash answered with the app shell page as text/html) throws a `ScreenLoadError` while the slot draws. The route boundary classifies it as its own kind, `screen-load-error`, never as `render-error` and never as UNKNOWN. The panel says: this screen could not be loaded; the cause is a screen load error (the app may have been updated while the page was open); the code is `SCREEN_LOAD_FAILED`; the request reference is "none (a screen file was requested; no desk request was sent)"; this is a load failure, not an UNKNOWN outcome; the panel sent nothing and cleared nothing. It offers "Load this screen again" and the Home link, and advises a page reload when loading again fails. The error message, the file URL and the hash are never copied to the screen: the message is a constant and the original error is held only as `cause`. Focus moves to the panel heading, and the Surfaces nav keeps working.

There is deliberately no reload button in the panel. A reload clears what the page holds in memory, so a button could drop an UNKNOWN fence without the user having read it. The advice names the reload; the user does it.

**Observed browser behaviour.** In the headless Chrome used here, a dynamic import that failed once is remembered by the browser for that file until the page is reloaded. "Load this screen again" then fails again at once and the panel stays; a page reload recovers once the file is served. The test records this as an observation and does not assert it, so a browser that fetches again passes too. Do not read the button as a guaranteed recovery. For a stale hash after a deploy, the reload is the way out.

**UNKNOWN is kept.** A failed screen load touches no desk state. The browser test creates the `attach-lost` UNKNOWN on `/session`, fails the gift screen's file, shows the panel, goes back to the session screen and sees the same "Sent 1" and unknown status.

**Stricter a11y waits.** `apps/e2e/tests/a11y/helpers.ts` and `keyboard.a11y.test.ts` waited for `#desk-main > *`. The loading note would satisfy that wait and axe would scan the note instead of the screen. They now wait for `#desk-main > :not([data-screen-loading])`. This only adds a condition.

**Test setup.** 27 existing test files call `renderToStaticMarkup(<App />)`. `apps/web/vitest.config.ts` now lists `test/support/preload-screens.ts` as a setup file; it settles every screen import one at a time, in registry order, before a test file runs. The order matters: importing all screens at once changed module evaluation order and exposed an intermittent circular-import failure. No existing test file was edited.

## Numbers

Measured by `scripts/check-bundle-budget.mjs` on a clean stub build (`npm run build`, no `VITE_*` variable). Sizes are gzip level 9 bytes of each emitted file. "Initial" means the files `dist/index.html` references. Source: `f5707862624cc34c249a1b4602da2e3e9c9d0764` (main, before this node) for the first row, and that commit plus this node's working tree for the others.

| Build | Initial JS gzip | Initial JS raw | Initial CSS gzip | Total gzip | Files |
| --- | --- | --- | --- | --- | --- |
| Before the split (main) | 523334 | 2164077 | 4192 | 527526 | 2 |
| After the split | 258936 | 1080512 | 4222 | 585286 | 61 |

The initial JS is smaller by 264398 gzip bytes: it is about half of what it was. The total is larger by 57760 gzip bytes, because 59 route and shared chunks are compressed one by one and each carries its own module wrapper. That growth is the price of loading only what a route needs, and the total-growth limit exists to keep it from growing without notice.

What a browser requests on a first load of `/`: 9 script files, 338270 gzip bytes in one local run (the landing set: the entry chunk, the box office screen and the chunks they share). Before the split the same load requested the single 523334 byte file. A first load of `/gift` requests the gift chunk and none of the unrelated screens' chunks (the test checks the admission, assistant, credit, finance, notifications, permissions, release, qualification and merchant chunks by name).

The largest route chunk is `CreditOrigination`, 21649 gzip bytes.

### Limits of the numbers

- The adapter, its vendored pin files and the desk modules that `protocol.ts` imports stay in the entry chunk, because `createProtocol` is created at module load. Trimming that means changing `packages/` or the way the protocol is created, which this node does not do. It is the floor under the initial size.
- Sizes are gzip bytes of files, not parse or execution time, and not a user-perceived load time. gzip output can differ by a few bytes between zlib builds, which is why the limits keep headroom.
- All figures come from one runner and one Chrome build (version 155 in the local record). They are regression tripwires. They are not an SLO, not a qualification, not a production performance claim and not a release.

## Limits

`apps/web/bundle-budget.json` is the single source. The numbers below are the current limits. A test reads the file and fails if this doc does not name each one.

| Limit | Value | Meaning |
| --- | --- | --- |
| `initialJsGzip` | 290000 | gzip bytes of the scripts and modulepreload links in `index.html` |
| `initialCssGzip` | 5000 | gzip bytes of the stylesheets in `index.html` |
| `chunkJsGzip` | 30000 | gzip bytes of any one JS file that is not initial |
| `landingJsGzip` | 400000 | gzip bytes of the JS a browser requests on a first load of `/` (the browser suite checks it) |
| `totalGrowth` | base 527526, ratio 1.2 | all emitted JS and CSS together may not exceed base times ratio (the pre-split total) |
| `render.discoveryReadyMs` | 5000 | `/discovery`, 20 rows, cold load until all rows exist |
| `render.discoveryPage50Ms` | 5000 | `/discovery?pageSize=50`, 50 rows |
| `render.inventorySectionMs` | 5000 | `/inventory` section page, 25 seats |

The size limits sit above the post-split numbers with headroom. The render caps are about ten times the local median, because CI runners vary and a single value must not be read as a service level.

## Render measurement

`apps/e2e/tests/budget/render.budget.test.ts` loads each long-list screen from a cold page five times in headless Chrome against the loopback static server. An init script starts a `MutationObserver` before the page scripts run and records `performance.now()` when the expected number of rows exists. The time therefore includes fetching the route chunk. Nothing in the product source is hooked. The test also asserts the row count and that the main region's DOM node count stays under a bound tied to the page size, so a list that grows past its page is caught. The slowest of the five runs must be at or under the cap.

One local run (milliseconds, five cold loads each): discovery 20 rows, 468 to 551, median 495; discovery 50 rows, 424 to 480, median 443; inventory section 25 seats, 478 to 506, median 493. The run record carries `slo: false`, `qualification: false`, `productionPerformance: false` and `released: false`, and its not-run list names throttled CPU or network, a real device, a different runner, HTTP mode and a screen reader.

## How to raise a budget

A limit is raised only with a recorded reason. The script fails (exit 1) when the limits in `bundle-budget.json` differ from the `limits` of the last `history` entry, and when an entry has no date, reason or evidence.

1. Run `npm run build` and `node scripts/check-bundle-budget.mjs --dist apps/web/dist --report-only` and keep the per-file table.
2. Find out why the size grew and whether it can be avoided (a new import in the entry chunk is the usual cause; move it behind a route). A render cap is raised only after rerunning `npm run test:budget` and looking at the five values, not after one slow run.
3. Change the number in `limits`, add a new entry at the end of `history` with the new `limits` (a full copy), today's date, the reason and the evidence (the table, the PR, the record). Do not edit an earlier entry.
4. Update the numbers in this doc. A test compares them with the file.
5. A budget that is lowered after a size win follows the same steps.

Raising a limit to make a failing run pass, with no reason that names a cause, is not an accepted entry.

## Verification

- `scripts/check-bundle-budget.mjs`: `--dist <dir> --budget <file> [--report-only] [--json-out <file>]`. Node built-ins only. Exit 0 on pass, 1 on a missing `index.html` or asset, a malformed budget, a limit over its cap or limits changed without a history entry, 2 on a usage error. It prints a per-file table.
- `apps/web/test/bundle-budget.test.ts` runs the script on fixture dist directories: pass, initial JS over, initial CSS over, one chunk over, total growth over, missing `index.html`, missing script, malformed budget, a limit raised without a history entry, and an entry with no reason. It also checks the repo budget file against this doc.
- `apps/web/test/screen-loader.test.tsx` checks the loader (one import, a failure kept and not re-imported, one new import after `forgetFailedScreens`), the loading note, the fault classification, the load panel text and the boundary's again and route-change reset.
- `apps/web/test/lazy-routes.test.tsx` checks that the dynamic imports equal the registry routes, point at real files, and that `App.tsx` imports no screen statically except the not-found page.
- `apps/e2e/tests/budget/*.budget.test.ts` (run by `npm run test:budget`): the landing and gift loads request only their own chunks, the loading note is `role=status` and focus lands on the heading, a missing chunk file and a stale hash answered with text/html both reach the load panel (focus on its heading, again reachable by Tab and Enter, other routes still work, a reload recovers), an UNKNOWN fence survives a failed load, and the three long-list render scenarios stay under their caps.

## Not run

Screen reader, a real device, throttled CPU or network, HTTP mode in a browser, a runner other than the local one and the CI runner, and any production or public deployment. Nothing here is user acceptance, qualification, conformance or a release.


## Locale coverage review (2026-10-21)

The original total-growth base 527526 and ratio 1.2 remain in force, alongside all other limits above. The proposed bilingual rebaseline was rejected in PR fix round 1 and removed. `baseline.localized` is an observation, never the comparison base. Full-route bilingual coverage currently fails the original size gate; see [the locale bind](c-i18n-coverage-completion-stub-apps-bind.md) and [the pending decision](../DECISION_REQUIRED.md). No CI check or limit is weakened.
