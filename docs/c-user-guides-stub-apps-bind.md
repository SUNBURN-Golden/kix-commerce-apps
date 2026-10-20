# User and operator guides (stub) apps bind

This bind records the reading layer the second gap analysis named: Korean-first guide documents under `docs/guide/` (a status glossary, a per-screen reading guide, and a local-run/troubleshooting guide), an in-app `/help` glossary page, a help link and one locale-aware hint line on every screen, and a completeness test that holds the documents equal to the route registry and to the status words the code actually prints. It is local, stub-scope product quality work. It does not claim integration, qualification, acceptance or release.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

M2: the adapter composes nothing past `accept_trade`. `capture` and `settle_capture` stay out of every journey and are never sent. `commit_trade`, `open_admission` and `admit` stay uncomposed with their not-bound reasons recorded. H1: `placeHold` stays not-bound with `consideredAction` `reserve_listing`, and `prepare_trade` is never given a `placeHold` body. This node composes no write, sends no request and maps no desk method onto a different body.

`contract_change=NO`. The guide word list, the help page and the `docs/guide/` documents are app-internal reading material. They are not a public schema, operation, capability or identifier.

## What did not change

- `packages/protocol-adapter/src/commerce-bindings.ts` is byte-identical. Its sha256 is `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`, and an existing test checks it.
- Both vendored OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA` and `protocolMergeSha` do not move. `.github/`, `.aiops/`, `docs/aiops/` and `packages/` are untouched. Nothing changes in kix-protocol. No dependency was added and `package-lock.json` is unchanged.
- No retry, no Idempotency-Key, no redirect following, no stub fallback, no proxy around the gate, and no fetch from any UI component. The stub stays the default; loopback stays `http://127.0.0.1` only, one attempt.
- The session record retention stays `UNDETERMINED`. This node documents the existing sessionStorage behaviour and sets no TTL.
- No protocol math is duplicated in the UI. The glossary explains words; it computes nothing.

## Behaviour

**Guide documents.** `docs/guide/status-glossary-ko.md` lists every word a reader can meet — outcome words, fixture classes, status marks, transport banner states, binding words, feature statuses, evidence facet cells, journey leg and compensation words, diagnosis codes, policy/provenance words, and the two environments — with meaning, what to do, and the reading it never carries. `docs/guide/screens-ko.md` has one entry per registry route: what the screen lets you conclude, what it never concludes, and which words it shows. `docs/guide/local-run-ko.md` covers first run, port 5173, the CI job-to-command mapping, browser tests, port conflicts, the loopback gate, and what to do about UNKNOWN. Each document carries an English summary. UNKNOWN is written as "not a failure and not a success; the request may have applied" and never otherwise.

**Help page.** `/help` (registry id `help`, Verification group, binding `stub-only`, no workspace surface — like `/handoff`, it has no evidence-matrix row) renders `STATUS_WORD_GUIDE` grouped by kind in labelled tables. It states it is a glossary, not a status surface. Its body is English like the other unmigrated screens; the Korean-first copy is the glossary document.

**Help line.** One `<p class="help-line">` inside the main landmark, on every screen including the not-found screen: a hint (`guide.hint`) and a link (`guide.link`) to `/help`. Both strings are in the catalogue in English and Korean; the Korean hint keeps `UNKNOWN(결과 미확인)` verbatim and claims nothing.

## Drift checks

- `apps/web/test/user-guides.test.tsx` compares the glossary's word column with `STATUS_WORD_GUIDE` in order, both directions; derives the outcome/status-mark/binding/feature subsets from the live lists (`OUTCOME_WORDS`, `STATUS_MARKS`, `ROUTE_BINDINGS`, `FEATURE_STATUSES`); keeps every facet word inside the evidence matrix's own cell vocabularies; requires one `## \`<path>\`` heading per registry route in `screens-ko.md`; scans the guide documents for secret shapes, private paths, personal data and claim words; and checks the help line appears on every registry sample and the not-found screen in both locales, and that `/help` renders every guide word verbatim.
- The registry's own drift checks now cover `/help`: the legacy-pattern list gained `"/help"` (additions allowed, removals never), `SCREENS` gained a `help` row so the a11y suite probes it, the route-registry bind doc's generated route table gained the `/help` row, the a11y acceptance doc gained `help` in both matrices (36 screens became 37), the locale bind doc's migration table gained `/help` (chrome only), and the evidence matrix doc's D11 denominator moved from 36 to 37. All in this PR, per the common boundary.

## Limits

- The Korean-first text lives in `docs/guide/`; the in-app page stays English (a screen-body migration is a separate step of the locale track).
- The glossary covers words users can see. Internal identifiers that never reach a screen or a document are not listed.
- The help line's wording is one sentence; per-screen contextual help beyond the glossary is out of scope.

## Local runs observed

The commands and exact source SHA are in the PR body. `npm ci`, `npm run typecheck`, `npm run build`, `KIX_REQUIRE_GATE=0 npm test`, `npm run typecheck:e2e`, `npm run test:e2e`, `npm run test:a11y` (now 37 screens), `npm run budget` and `npm run test:budget` passed locally; the browser runs used headless Chrome on loopback.

Browser checks: `/help` renders every guide word at 1280px and 320px with no axe violation outside `KNOWN_FINDINGS`, Tab reaches the help link and the page heading takes focus after a route change, the Menu fold is unchanged, and the help line shows on a normal screen, an error panel and the not-found screen in both locales.

## Not verified

A screen reader, a real device, HTTP mode in a browser, the hosted-runner pass, and the live-gate suites (skipped with `KIX_REQUIRE_GATE=0`). No assistive-technology run, user acceptance or release is claimed. The translation quality of the Korean documents is author-reviewed only.

## Hold

Nothing here is a qualification, an acceptance or a release. A real producer, SDK or provider connection, a real payment, a public deployment and a retention value each need their own authority.
