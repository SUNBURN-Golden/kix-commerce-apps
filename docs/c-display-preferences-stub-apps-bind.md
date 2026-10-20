# Display preferences (stub) apps bind

This bind records the local, stub-scope display-preferences work: colour moved onto CSS tokens, a dark scheme, forced-colours (high contrast) support, a reduced-motion stop for the one timed update, a 320px reflow fix on the handoff packet, and print styles for the receipt explorer and the handoff packet. It is product-quality work only. It does not claim integration, qualification, acceptance or release.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

M2: the adapter composes nothing past `accept_trade`. `capture` and `settle_capture` stay out of every journey and are never sent. `commit_trade`, `open_admission` and `admit` stay uncomposed with their not-bound reasons recorded. H1: `placeHold` stays not-bound with `consideredAction` `reserve_listing`, and `prepare_trade` is never given a `placeHold` body. This node composes no write, sends no request and maps no desk method onto a different body.

`contract_change=NO`. The token names, the check ids and the record wording here are app-internal. They are not a public schema, operation, capability or identifier.

## What did not change

- `packages/protocol-adapter/src/commerce-bindings.ts` is byte-identical. Its sha256 is `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`, and an existing test checks it.
- Both vendored OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA` and `protocolMergeSha` do not move. `.aiops/`, `docs/aiops/` and `packages/` are untouched. Nothing changes in kix-protocol.
- No dependency was added and `package-lock.json` is unchanged. No route, screen, surface, fixture or workspace-registry row was added, so the evidence-matrix tables are unchanged; this node still shows `NOT_STARTED` there until the matrix is re-typed at a newer base.
- No fetch, retry, `Idempotency-Key`, proxy or stub fallback was added. Stub stays the default and the only timed read is the existing integration-http loopback re-probe. The session record retention stays `UNDETERMINED`; this node decides no TTL and keeps the existing sessionStorage behaviour.
- The existing CI job names and the e2e, a11y, fault and evidence-matrix checks are unchanged. Nothing was skipped or weakened.

## Behaviour

**Tokens.** Every colour decision reads a custom property on `:root` (`--paper`, `--card`, `--field`, `--ink`, `--muted`, `--line`, `--stamp`, `--ok`, `--wash`, `--shadow`). Two were added: `--field` replaces the last literal `background: white` on form controls, and `--wash` names the body gradient colour. `color-scheme: light dark` tells the browser both schemes are supported.

**Dark scheme.** `prefers-color-scheme: dark` remaps the same tokens to dark values; every rule already reads the tokens, so the whole desk follows. `apps/web/test/display-preferences.test.tsx` computes the WCAG 2.x relative-luminance contrast of each text-and-icon token pair in both schemes and compares it with the named criterion `WCAG 2.2 SC 1.4.3` (4.5:1). That is a computation against a named criterion, not a conformance or acceptance claim; the target standard stays `UNDETERMINED`.

**Forced colours.** `forced-colors: active` repoints the tokens at the platform system colours (`Canvas`, `Field`, `CanvasText`), drops the shadow and the wash, and keeps the underline on the current nav link as a second, non-colour mark. Status marks keep their word and their differing border styles (dashed, double, solid, dotted), so a state is never carried by colour alone — that was already true and the browser checks below keep it true under each preference.

**Reduced motion.** The desk owns no animation and no transition; a `prefers-reduced-motion: reduce` block caps every duration and iteration anyway and pins `scroll-behavior: auto`. The one timed update on the desk is the integration-http transport re-probe (15 s interval in `Shell.tsx`; the stub is never polled). A reduced-motion preference is the user's stop control for it: the load probe still runs once, and no interval starts while the preference is set or while it is switched on during the session (`matchMedia` change listener in `Shell.tsx`, `apps/web/src/a11y/motion.ts`). While stopped, the transport banner says so in text (`transport.paused`, in the English and Korean catalogue entries).

**Narrow reflow.** At 320px (what 200% zoom at a small window amounts to) the handoff packet overflowed: an unbreakable env token (`VITE_KIX_PROTOCOL_API_BASE`) in the Startup faults list pushed a grid track past the window. `.handoff li, .handoff p { overflow-wrap: anywhere }` lets it wrap, and the three scrollable table wrappers became named focusable regions (`role="region"`, `aria-label`, `tabIndex={0}`) so a keyboard user can reach and scroll them. The a11y matrix records the finding as `FIXED` and the narrow reflow probe checks it again. Tables on narrow screens keep their own layout plus the region label and the focusability above; no table was removed.

**Print.** `@media print` hides the shell nav, the breadcrumb row, the locale switch, the skip link and the in-page receipt nav; drops the box shadows; prints each link's `href` after its text on `.receipt` and `.handoff`; and draws a `::before` line on both so a printed copy still carries the synthetic wording: "Synthetic stub display. A printed copy is not a receipt, not a confirmation, and not a qualification." A printed copy is still not a receipt.

## Checks

- `apps/web/test/display-preferences.test.tsx` (node): token sets in all three schemes, the computed contrast pairs, the forced-colour mapping and non-colour nav mark, the reduced-motion guard plus a proof the stylesheet owns no `transition`, `animation`, `@keyframes` or smooth scroll, the stop control (`motionPaused` in `Shell.tsx`, `REDUCED_MOTION_QUERY`, `transport.paused` on and off, stub unaffected), the print block, and the handoff wrap fix with its three labelled regions.
- `apps/e2e/tests/a11y/display.a11y.test.ts` (headless Chrome, loopback): `a11y.display.dark` (tokens invert on `/receipts`, every status mark keeps a word and a non-`none` border), `a11y.display.forced-colors` (on `/handoff`, `forced-colors: active` matches, `forcedColorAdjust` stays `auto`, the current nav link keeps its underline, every status mark keeps its word and the set still shows a differing style such as `dotted`), `a11y.display.reduced-motion` (on `/`, no sampled element runs a transition or an animation and `scroll-behavior` is `auto`), and `a11y.display.print` (on `/receipts` and `/handoff`, nav, skip link and receipt nav are `display: none`, the synthetic `::before` line is present and link targets print).
- The four ids are registered in `STATIC_CHECK_IDS`, so a skipped run fails the suite teardown.

## Limits

- Contrast figures are computed for the token pairs this stylesheet declares. Installed-font and platform rendering differences, and the `color-contrast` axe rule, stay `ENV_SENSITIVE` as before.
- Forced-colours coverage means the platform forced-colours mode (Windows high contrast and friends). `prefers-contrast` alone is not mapped to a separate palette.
- The stop control covers the one timed update this desk has (the transport re-probe). Nothing else auto-refreshes.
- The 200% figure is verified as the 320px narrow viewport, not by a browser zoom setting.

## Local runs observed

The commands and exact source SHA are in the PR body. `npm ci`, `npm run typecheck`, `npm run typecheck:e2e`, `npm run build`, `KIX_REQUIRE_GATE=0 npm test` and `npm run budget` passed locally; `npm run test:e2e` and `npm run test:a11y` (including the four new `a11y.display.*` checks) passed in headless Chrome on loopback. The handoff `reflow.narrow-overflow` finding changed to `FIXED` after the wrap fix and is checked by the existing narrow probe.

## Not verified

A screen reader, a real device, a real printer or paper preview, browsers other than Chrome, HTTP mode in a browser, and the hosted-runner runs. The live-gate job is skipped under `KIX_REQUIRE_GATE=0`. No assistive-technology run, user acceptance, conformance level or release is claimed.

## Hold

Nothing here is a qualification, an acceptance or a release. A real producer, SDK or provider connection, a real payment, a public deployment and a retention value each need their own authority.
