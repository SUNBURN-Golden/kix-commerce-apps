# App shell resilience (stub) apps bind

This bind records how the app shell now behaves when a screen throws while drawing, when the address matches no screen, and when the script has not started. It adds an error boundary, a real not-found screen, a per-page document title with a heading focus move, and a loading note and a `<noscript>` note in `index.html`. It is local, stub-scope product quality work. It does not claim integration, qualification, acceptance or release.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

M2: the adapter composes nothing past `accept_trade`. `capture` and `settle_capture` stay out of every journey and are never sent. `commit_trade`, `open_admission` and `admit` stay uncomposed with their not-bound reasons recorded. H1: `placeHold` stays not-bound with `consideredAction` `reserve_listing`, and `prepare_trade` is never given a `placeHold` body. This node composes no write, sends no request and maps no desk method onto a different body.

`contract_change=NO`. The panel fields, the page keys and the reference format here are app-internal. They are not a public schema, operation, capability or identifier.

## What did not change

- `packages/protocol-adapter/src/commerce-bindings.ts` is byte-identical. Its sha256 is `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`.
- Both vendored OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA` and `protocolMergeSha` do not move. `packages/`, `.github/`, `.aiops/` and `docs/aiops/` are untouched. Nothing changes in kix-protocol. No dependency is added.
- No desk, controller or adapter file changed. The session record keeps the existing per-tab behaviour; its retention stays `UNDETERMINED` and this node sets no TTL.
- The routes and screens are unchanged: 36 screens in the accessibility matrix and the same journeys in the e2e matrix. The not-found screen and the error panel are states of the shell, not registered surfaces, so the evidence matrix document needs no new row.

## Behaviour

**Error boundaries.** `apps/web/src/shell/RenderBoundary.tsx` holds one class boundary used at two scopes. The route scope wraps the routed screens inside the shell, so the header, the nav and the banners stay. The app scope wraps the whole app in `main.tsx`, for a throw inside the shell itself. A move to another screen clears the route fault.

**Panel.** The panel shows only: the cause (`Render error`), the screen label, a local reference (`shell-fault-NNNN`, a counter, not a trace id and sent nowhere), the request reference (a request or correlation id the thrown value carried, if it matched a safe shape, else `none (no request was involved)`), an optional upper-case code, and two actions. `render-fault.ts` copies no message, no stack and no body; it keeps a code only if it matches `^[A-Z][A-Z0-9_]{1,47}$` and ids only if they match `^[A-Za-z0-9._:-]{8,64}$`. Thrown strings, `null` and bare objects are handled the same way.

**No resend, no clear.** The shell files import no adapter, desk, protocol or storage module (a test reads their imports). The boundary only sets its own state. The panel says so: it sent nothing and cleared nothing, and an UNKNOWN result is not resolved by it. In the browser pass an attach whose answer was lost stayed UNKNOWN with `Sent 1` after a fault, a recovery and a return to `/session`.

**Actions.** "Show this screen again" remounts the failed screen. The remount can run that screen's own mount-time reads, exactly as a visit does; the boundary adds no call and issues no write. It is not a resend and is not named that way. "Go to Box office" is a router link at route scope (keeps this page load's desk state) and a plain `<a href="/">` at app scope, where the shell is suspect. The panel has `role="alert"`, and focus moves to its heading when it appears.

**Not found.** `path="*"` now draws `pages/NotFound.tsx`: an `h2` "Page not found", a line that no screen exists at this address, a Home link and a short list of main screens. It does not echo the address and does not redirect. The document title is `Page not found · KIX Box Office`.

**Title and focus.** `shell/page-identity.ts` maps a path to a stable key and a title (`<label> · KIX Box Office`; `KIX Box Office` for `/`; the marketing title where one exists). The pages use an `h2` for their title under the constant shell `h1`, so the focus target is the first `h1` or `h2` inside `#desk-main`, not the shell `h1`: that is a deliberate reading of the node text's "h1". Focus moves when the page key changes after the first render. It does not move on first paint (the skip link must stay first in Tab order), on a search-parameter edit, on the `/discovery` to `/discovery/:rowId` alias (they share one key), or when the new page already placed focus inside the main region. The heading gets a temporary `tabindex="-1"` that is removed on blur. A test reads the `<Route path>` list in `App.tsx` so the title table cannot drift from the router.

**Boot and noscript.** `index.html` holds a static loading note inside `#root` (React replaces it) and a `<noscript>` note, plus a `<noscript>` style block that hides the loading note when script is off. No external resource, link, inline `style=` attribute or extra script is used.

## Limits

- React boundaries do not catch errors in event handlers or async work, and they do not catch a throw while the module graph loads. In that last case `#root` keeps the loading note, which says the script did not start; there is no panel.
- A remount loses component-local state. Module-level desk state survives.
- React still logs a caught error to the console.
- A static host answers 200 for an unknown path; the not-found screen is drawn client-side and no HTTP 404 is produced. That is a deploy concern and not decided here.
- The page-title table duplicates the Shell link list and the route list until a route registry unifies them.
- The error panel does not set its own document title (the route title stays) so the shell title effect and the boundary do not compete. The app panel keeps whatever title the document had.
- Retention (TTL) of the session record is `UNDETERMINED` (legal or the responsible user) and is not set here.

## Local runs observed

The commands and results are in the PR body. The browser pass used headless Chrome on loopback with a second, fixture-only build (`buildShellFaultApp` in `apps/e2e/src/build.ts`) in which two aliases swap the receipts screen and the protocol port for test fixtures that throw on purpose while a window flag is set. The product bundle used by every other test is unchanged. Both origins are loopback, the ledger saw zero non-loopback requests, zero non-GET requests and zero application network calls.

Browser checks: keyboard route change sets the title and focuses the heading; an unknown address shows the screen with no redirect, and an in-app jump to one moves focus to its heading, then Tab reaches the Home link; focus stays in the discovery search box while typing; JavaScript off shows the noscript note and hides the loading note; a held script shows the loading note until the desk draws; a route fault shows the panel with no stack, secret, email or body text, "Show this screen again" keeps the panel while the fault remains and recovers once it is cleared; a shell fault shows the app panel.

## Not verified

A screen reader, a real device, HTTP mode in a browser, the hosted-runner pass, and any production host behaviour. No assistive-technology run, user acceptance or release is claimed.

## Acceptance mapping

| Item | Where it is pinned |
| --- | --- |
| No stack, secret or body on the error screen | `apps/web/test/app-shell-resilience.test.tsx` (hostile samples), `a11y.shell.route-fault`, `a11y.shell.app-fault` |
| No automatic resend inside the boundary | the import test above, the zero application network calls in the browser ledger, `a11y.shell.route-fault` |
| Existing e2e and accessibility tests unchanged | the full e2e and a11y runs; edits to them are additive only (one alternate state, one driver, new checks) |
| Not-found screen | the SSR test, `not-found:unknown-path`, `a11y.shell.not-found-keys` |
| Title and heading focus | `a11y.shell.title-focus`, `a11y.shell.no-focus-steal` |
| Boot and noscript notes | the `index.html` test, `a11y.shell.noscript`, `a11y.shell.boot-note` |

## Hold

Nothing here is a qualification, an acceptance or a release. A real producer, SDK or provider connection, a real payment, a public deployment and a retention value each need their own authority.
