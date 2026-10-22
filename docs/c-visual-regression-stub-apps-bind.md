# Visual regression baselines (stub) apps bind

This bind records the local, stub-scope visual-baseline work: a fourth `apps/e2e` browser suite (`npm run test:visual`) that screenshots the key screens at 390px and 1280px in English and Korean plus four dark-scheme and forced-colours variants, and compares each picture pixel-wise with a committed PNG baseline. It is product-quality work only. A matching picture means the layout did not move on one render profile. It does not claim integration, qualification, design review, acceptance or release.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

M2: the adapter composes nothing past `accept_trade`. `capture` and `settle_capture` stay out of every journey and are never sent. `commit_trade`, `open_admission` and `admit` stay uncomposed with their not-bound reasons recorded. H1: `placeHold` stays not-bound with `consideredAction` `reserve_listing`, and `prepare_trade` is never given a `placeHold` body. This node composes no write, sends no request and maps no desk method onto a different body.

`contract_change=NO`. The shot ids, the render-profile key and the record wording here are app-internal. They are not a public schema, operation, capability or identifier.

## What did not change

- `packages/protocol-adapter/src/commerce-bindings.ts` is byte-identical. Its sha256 is `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`, and an existing test checks it.
- Both vendored OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA` and `protocolMergeSha` do not move. `.aiops/`, `docs/aiops/` and `packages/` are untouched. Nothing changes in kix-protocol.
- No dependency was added and `package-lock.json` is unchanged. The comparator decodes both PNGs inside the already-open Chrome (`createImageBitmap` plus a canvas `getImageData`), so no image library, no external service and no secret exists anywhere in the path. Four OFL font files and their `OFL.txt` are vendored as plain files in `apps/e2e/fonts/` (Nanum Gothic and Nanum Myeongjo via Google Fonts) — they are test assets, not packages.
- No route, screen, surface, fixture or workspace-registry row was added, so the journey, a11y and evidence-matrix tables are unchanged; this node still shows `NOT_STARTED` in the evidence matrix until the matrix is re-typed at a newer base.
- No fetch, retry, `Idempotency-Key`, proxy, stub fallback or UI-side request was added. Stub stays the default. The session record retention stays `UNDETERMINED`; this node decides no TTL and writes nothing to sessionStorage (the locale comes only from `?lang=`, the start-up parameter a user can use).
- The existing CI job names and the e2e, a11y, fault and evidence-matrix checks are unchanged. Nothing was skipped or weakened. The new `visual-regression` job is additive.
- One product line did change, and it is a fix, not a determinism aid: at 390px the `dt` label `registerReservationShow` on `/organizer/workspace` overflowed its grid track and pushed the document sideways, which is exactly the defect class this suite exists to catch. `.facts dt` gained `overflow-wrap: anywhere`, the same rule `.facts dd` already had. Nothing else in `apps/web/src` moved.

## What it runs

`vitest run -c vitest.visual.config.ts` (`retry: 0`, one file at a time). The global setup builds the same clean production stub bundle the journey suite builds — every `VITE_*` variable removed — serves it on `127.0.0.1` only, and hands the tests one headless Chrome. The shared ledger still applies: any request to a non-loopback origin, any non-GET request, or any application call the page makes fails the suite. The teardown also fails on a check id that did not pass, a shot that was not taken, a non-loopback bind, or a baseline set that does not match the matrix exactly (a stray PNG, a missing one, a non-PNG file, or a manifest whose tolerance differs from the matrix).

Determinism is pinned in the harness, never in product code:

- Fonts: the suite launches Chrome with `FONTCONFIG_FILE` pointing at `apps/e2e/fonts/fonts.conf`, a fontconfig file that lists exactly one font directory — `apps/e2e/fonts/` — holding four vendored OFL files: Nanum Gothic Regular and Bold (the sans stack, Latin and Hangul) and Nanum Myeongjo Regular and Bold (the serif stack, Latin and Hangul). Generic and named aliases in the same file map `sans-serif`, `serif`, `monospace` and the families `styles.css` names (`Avenir Next`, `Segoe UI`, `Palatino`, `Iowan Old Style`, `Georgia`) onto the vendored set. The machine's installed fonts are invisible to the browser, so one committed profile matches every Linux runner; this replaced the per-machine baseline profile that missed on the CI runner. A harness check proves uninstalled names (`Arial`, `DejaVu Sans`) resolve to the vendored files by `measureText` width. The browser environment is pinned through a new `SessionOptions.env` channel that refuses `*_PROXY` and `LD_*`/`DYLD_*` names the way reserved launch flags are refused.
- Launch flags: `--font-render-hinting=none --disable-font-subpixel-positioning --disable-lcd-text --force-color-profile=srgb --force-device-scale-factor=1`. The loopback flags (`--host-resolver-rules`, `--no-proxy-server`, the sandbox handling) cannot be removed or overridden by a caller; a reserved flag is refused, not merged.
- Context: `timezoneId: UTC`, `deviceScaleFactor: 1`, `reducedMotion: reduce`. The context `locale` is `en-US` but decides nothing on screen: the app reads only `?lang=` and the tab's saved choice, never the browser language.
- Per page: `page.clock.setFixedTime(2026-10-21T00:00:00.000Z)` before `goto` (freezes `Date.now`, covers `preparedAt` and any `<time>`), and `page.emulateMedia` sets the colour scheme and forced colours for that shot only, so dark and forced-colours shots live in the same file as light ones.
- Per shot: the same settled-page wait as the a11y suite, `document.fonts.ready`, `networkidle`, two animation frames, then a full-page screenshot with animations disabled, the caret hidden and CSS scale, cut at 2000 CSS px tall.

## The matrix

Seven screens, each at 390x844 (`phone`) and 1280x800 (`desktop`), in `en` and `ko`: box office `/`, buyer `/buyer`, discovery `/discovery`, booking `/booking/evt_lanterns`, organizer workspace `/organizer/workspace`, handoff `/handoff`, help `/help`. That is 28 light shots. Four display shots add the non-default media features: `box-office.desktop.en.dark`, `discovery.phone.ko.dark`, `handoff.desktop.en.forced-colors`, `booking.phone.ko.forced-colors`. 32 shots in total.

The receipts screen `/receipts` is not in the matrix: `receipt-explorer.ts` mints a page session id with `crypto.getRandomValues` on every page load and prints it, so no two pictures of that screen can ever match. The exclusion is recorded in the run record's `notRun`.

**Tolerance** (`TOLERANCE` in `apps/e2e/src/visual-matrix.ts`, mirrored in each manifest): a pixel differs when any of its R, G or B channels differs by more than 8 of 255; a shot passes when the differing pixels are at most 200 parts per million of the picture; a size mismatch always fails. Same profile and same build give 0 differing pixels, so the allowance covers only small anti-aliasing noise.

**Per-shot assertions** besides the pixel compare: the page made zero application network calls (the shared ledger), the document does not scroll sideways, and no visible element pokes out of the window outside a scroll or clip container (the same overflow rules the a11y reflow probe uses).

**Render profile.** Baselines are bound to what this browser resolves, not to a machine name: `renderProfile` measures `measureText` widths for one Latin and one Korean string in the three font stacks `styles.css` declares, hashes them to 8 hex, and the profile directory is `<platform>-<hash>` (`linux-d29b2e9b` here). Because the fontconfig pin leaves only the vendored files, every Linux machine measures the same widths and lands on the same profile; a non-Linux runner ignores `FONTCONFIG_FILE` and would need its own recorded profile. The Chrome major version is deliberately not in the key — the `ubuntu-24.04` image updates Chrome often and a routine update must not turn `main` red; a rendering change beyond the tolerance instead fails with diff pictures, which is a known limit. `cjkGlyphs` records whether three Hangul syllables drew three different pictures (`present` on this profile — Nanum Gothic draws Hangul) or placeholder boxes (`missing` — in which case Korean layout is not verified on that profile).

**Update mode.** `KIX_VISUAL_UPDATE=1` writes baselines and a manifest instead of comparing; it throws when `CI` is set, and it only writes the manifest on a complete run, so a partial recording cannot be committed as a set. A recording run proves nothing — the pass evidence is always a `compare` record. On a missing profile or a mismatch, the actual PNG (and the diff) goes to `KIX_VISUAL_OUT`, which is what the CI artifact step uploads so a new profile can be recorded from it. Every committed PNG was opened and looked at before this bind was written.

## Run it

```bash
npm ci
npm run typecheck:e2e
# record baselines once, on this machine's profile (never in CI)
KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_UPDATE=1 npm run test:visual
# compare — the pass evidence
KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 \
  KIX_VISUAL_RECORD_OUT=/tmp/visual-record.json KIX_VISUAL_OUT=/tmp/visual-out npm run test:visual
```

`KIX_VISUAL_RECORD_OUT` receives the observation record: kind `visual-baseline-observation`, `run: "compare"`, the profile, the Chrome version, `cjkGlyphs`, the tolerance, per-shot width/height/diffPixels/diffPpm (whole parts per million, so the redaction scan sees no long decimals), the ledger sums, and `claims` that stay `false` for qualification, acceptance, release, design approval and other runners. `KIX_VISUAL_OUT` receives `<shot>.actual.png` and `<shot>.diff.png` on failure, and a `manifest.draft.json` when the profile itself is missing.

## Browser run

Chrome 155.0.8059.84, profile `linux-d29b2e9b`, `cjkGlyphs: present`. The baselines were re-recorded under the vendored font set after merging `main` (which moved the `/handoff` screen — the audit-6 consumed-producer block now renders). A local `compare` run at the merged head passed with `diffPixels: 0` on all 32 shots and ledger sums of zero. On the earlier revision, a seeded failure (the receipts exclusion, before it was dropped) produced the expected `*.actual.png` and `*.diff.png` in `KIX_VISUAL_OUT` and a 1574 ppm report against the 200 ppm allowance, and the harness self-checks prove identical pictures give 0 diff, a 1px bar shift fails, a size change fails, update mode is refused under `CI`, the loopback flags cannot be overridden, non-vendored font names resolve to the vendored files, and a realistic record passes the redaction scan.

## Limits

- Baselines are bound to the render profile. On Linux the fontconfig pin makes every machine land on the same profile; a non-Linux runner ignores `FONTCONFIG_FILE` and would need its own recorded profile, and two committed profiles stay legitimate.
- A Chrome version change that renders differently beyond the tolerance fails with diff pictures. That is a tripwire, not a diagnosis.
- The comparator is a channel-delta count, not a perceptual model; a 200 ppm allowance can hide a few antialiasing pixels and a same-size layout swap with identical pixels passes unseen.
- The screenshots cover the top 2000 CSS px of each page. The sideways-overflow probe looks at the whole document; what renders below the cut is not compared.
- Only Chrome on the pinned flags is observed. `?lang=` is the only locale lever exercised; the tab's saved choice is not.
- The vendored set draws Hangul, so `cjkGlyphs: present` is expected on every Linux profile; `missing` would mean the fontconfig pin did not take effect there.

## Not verified

The receipts screen (per-load session id), any render profile other than `linux-d29b2e9b`, a Chrome version other than 155.0.8059.84, a non-Linux runner, Firefox, Safari, a real device, a printer, a screen reader, browser zoom, HTTP mode in a browser (needs a kix-protocol gate change), the hosted-runner run, and anything below the 2000px cut. No design review, user acceptance, conformance, qualification or release is claimed.

## Hold

Nothing here is a qualification, an acceptance, a design approval or a release. A real producer, SDK or provider connection, a real payment, a public deployment, an external screenshot service and a retention value each need their own authority.
