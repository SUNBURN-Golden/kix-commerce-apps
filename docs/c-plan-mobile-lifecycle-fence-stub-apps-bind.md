# Synthetic mobile browser lifecycle fence

## Scope and ruling

Node `c-plan-mobile-lifecycle-fence-stub` on branch
`agent/kixc-c-plan-mobile-lifecycle-fence-stub`, based on
`ef992d1cbf4908e7f6b87779f981552ca4ecad24`.

This node is a web integration over the existing synthetic
`MobileShellController`. It connects the controller's resume barrier to the
document visibility, persisted `pageshow` and `pagehide` events that a real
browser can deliver. It adds no storage, service worker, device capability,
timer, restoration inference, protocol command, route, dependency, fixture or
pin. The controller, adapter, protocol pin and CI are unchanged.

> M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce

The booking journey still ends at `accept_trade`; `capture`,
`settle_capture`, `commit_trade`, `open_admission` and `admit` remain
uncomposed. `placeHold` stays not-bound with considered action
`reserve_listing`. No desk method is remapped. `confirmBooking` sends no
`capture` operation and settlement sends no `settle_capture`; no
capture/settle sequence is composed.

The locked `packages/protocol-adapter/src/commerce-bindings.ts` SHA-256 is
unchanged at
`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`.
No file under `.aiops/**`, `docs/aiops/**`, `.github/**` or
`packages/protocol-adapter/**` is modified.

### Unchanged authority tuple

| Item | Value |
| --- | --- |
| Contract-only OpenAPI file SHA-256 | `fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e` |
| Integration-gate OpenAPI file SHA-256 | `2a2af554cb1a8b128f2cf1b1d5b8cf6b1c8fa90adf30865dbc3e64932b3bd13f` |
| CI `KIX_PROTOCOL_GATE_SHA` / gate `protocolMergeSha` | `52a9b5cbf7777df55d2d2062cb8d99d862b423bb` |
| `openapi-contract-pin.ts` SHA-256 | `ead21d8fca96544996f5900c3edfdb64782190db2669cef4c30950ba0a36fdfc` |
| `integration-gate-pin.ts` SHA-256 | `1d0810c18d1fc06f971550c2ea02067500bb7ef7bc8e6c3f9c43845c9347f27e` |

## Event transitions

The `[epoch, invalidate, read]` effect in
`apps/web/src/installable-mobile.ts` owns the controller subscription, the
three browser listeners and a distinct effect-lifetime identity. Visibility
is read from `document.visibilityState` and `document.hidden`, never from a
clock or a stored value.

| Event | Behavior |
| --- | --- |
| `visibilitychange`, state unchanged | Ignored. No invalidation, no read, no write. |
| `visibilitychange` to hidden | Pair state reset, invalidation. Fences before in-flight work can finish while hidden. |
| `visibilitychange` to visible | Marks one restoration awaiting its persisted `pageshow`, invalidation. |
| `pageshow` with `persisted !== true` | Ignored. Ordinary loads are not restoration evidence. |
| `pageshow` with `persisted === true`, paired | Consumes the foreground pairing; does not invalidate a second time. |
| `pageshow` with `persisted === true`, unpaired | Invalidates. A restoration without an observed hidden edge still fences. |
| `pagehide` | Pair state reset, hidden set true, invalidation. Covers navigation where no hidden notification was observed. |
| Initial mount while hidden | Invalidates immediately. |

An invalidation:

1. advances a monotonic in-memory `generation`;
2. sets `explicitReadRequired`;
3. calls the existing `controller.resume()`;
4. re-renders if the effect lifetime is still mounted.

It never calls `refresh` or `run`. Repeated persisted notifications are
handled conservatively: each unmatched restoration fences again, and none of
them dispatches network work. No timer, clock threshold, storage or bfcache
inference is introduced.

The pairing rule exists so that a foreground return followed by a user's
explicit read is not fenced a second time by the persisted `pageshow` that
belongs to the same restoration. `pagehide` resets the pair, so a much later
independent restoration cannot consume an older foreground notification.
Both behaviors are covered by mounted and browser tests.

## Async ordering

Reads carry a local origin: `initial`, `post-write` or `explicit`.

Only `actions.refresh()` produces an `explicit` read, and only that read can
clear the web lifecycle fence. It clears it only when all of the following
still hold after the source answers:

- the read started while the document was visible;
- the session and effect lifetime are unchanged;
- the generation matches the one captured before the read;
- the context key (including incarnation) is unchanged;
- the outcome is `APPLIED` with `ready` or `empty` evidence;
- controller freshness is `CURRENT`.

Initial and post-write reads never clear the fence. Hidden, superseded,
old-context, unavailable, refused, offline, stale and not-bound reads cannot
clear it either. A held read that spans a suspension therefore cannot unlock
dependent actions by arriving late.

All six write entry points (`install`, `update`, `reconnect`, `present`,
`confirm`, `withdraw`) go through one typed runner. The runner checks
`explicitReadRequired` before `nextIntent()`, so a blocked press does not
consume `intent-1`. Existing connectivity and controller guards remain
composed around that check. A blocked programmatic action records the
localized lifecycle note in the existing status region.

A write completion keeps the controller's adjudication. An automatic
post-write read runs only when the completion is `CONFIRMED`, `REJECTED` or
`UNKNOWN`, the generation is unchanged, and the fence was not raised while
the write was in flight. A result that spans a suspension therefore never
refreshes away the resume barrier; a valid explicit read is still required.
Existing UNKNOWN fences, late-result quarantine, own-write freshness and
context-switch rules remain authoritative.

Presentation uses one synthesized effective state: a held ready or empty
observation becomes stale and cached, and `refreshRequired` defaults to
`resumed` while fenced. Controller state is not mutated. Reasons
`in-flight`, `unknown-outcome`, `not-bound` and `environment` retain
precedence over the lifecycle sentence so that an UNKNOWN or refusal is never
masked. The lifecycle explanation renders inside the existing status region
with `aria-live="off"`; no second live region is added. Controls stay
focusable and disabled through their existing control model and
`aria-describedby` reasons.

## Acceptance matrix

| Acceptance | Evidence |
| --- | --- |
| Foreground return and persisted `pageshow` mark observations stale, retain rows and block writes without sending reads or writes | `apps/web/test/installable-mobile-lifecycle.test.tsx`: hidden/visible and paired/standalone cases; `StubMobileShell.prototype.read/submit` spies installed before render |
| Repeated events, ordinary `pageshow`, pairing and listener cleanup | Mounted tests cover redundant visibility, duplicate events, paired read, `pagehide`, unpaired restoration; session replacement and unmount assert subscriptions/listeners cannot update or read |
| All six writes blocked before intent allocation | Mounted harness calls all six while fenced, observes zero submits and zero intents, then verifies the first allowed send is `intent-1` |
| Held initial, empty, explicit and post-write reads spanning suspension | Parameterized held-read cases (`clean`, `empty`), hidden/second-invalidation/older-read/context-changed orderings, five negative outcomes, and a held post-write read |
| Held write completions spanning suspension | `CONFIRMED`, `REJECTED` and `UNKNOWN`, each delivered hidden, visible, or after an explicit read; no completion read, one submit |
| UNKNOWN fences survive resume, explicit reads and late delivery | `confirm-lost` and `withdraw-lost` mounted cases plus the browser UNKNOWN case; one send retained |
| Session replacement, context switch, unmount | Held read/write replacement, listener cleanup, context-switch quarantine, unmount before completion |
| Localized visible explanation and keyboard explicit refresh | Browser `mobile.lifecycle.simulated.en` / `.ko`: stale detail, reason via `aria-describedby`, Tab to `#mobile-refresh`, Enter and Space, rows retained, no app network |
| Simulated events distinguished from real restoration | Copy states synthetic events only and actual browser restoration unverified in both locales; browser tests dispatch synthetic events, never bfcache |
| Existing checks and ceilings unchanged | Commands below; shared checks preserved and three new IDs recorded through `suite.pass` |

The mounted tests use jsdom (`// @vitest-environment jsdom`), `renderDom` and
`dispatch`, configurable visibility getters, constructed events with a
defined `persisted` property, and deterministic deferred promises. They use
no fake or real timers. The lifecycle generation is an in-memory counter, not
a clock or random value.

## Executed verification

All commands ran in this worktree under Node 22.20.0 / npm 11.21.1, selected
with `PATH=/tmp/kix-m05-node22/node_modules/node/bin:$PATH` (the shell default
Node is 24.22.1). The browser suites used the repository harness and the
installed `/usr/bin/google-chrome`; they ran in the foreground, serially.
`KIX_REQUIRE_GATE=0` was used for the stub test run, as in CI. There is no
`kix-protocol` checkout here, so the live-gate suites were skipped, not
passed.

| Command actually run | Result |
| --- | --- |
| `npm ci` | PASS; added 535 packages, audited 539. npm reported 19 existing audit advisories (16 moderate, 1 high, 2 critical) from the unchanged lockfile; no dependency or lockfile change |
| `npm run typecheck` | PASS for `@kix/protocol-adapter` and `@kix/web` |
| `npm run typecheck:e2e` | PASS for `@kix/e2e` |
| `npm run build` | PASS; Vite built 86 files / 76 chunks. Asset hashes were identical when the build was repeated after the final `npm ci` |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 2,125 passed / 23 skipped; web 1,498 passed; cold-entry 6 passed. Rerun after the final `npm ci` and build |
| `npm exec -w @kix/web -- vitest run test/installable-mobile-lifecycle.test.tsx test/installable-mobile.test.tsx test/i18n-coverage.test.ts test/entry-import-graph.test.ts` | PASS: 4 files / 65 tests, including the stricter 785,000-byte total-gzip assertion in `entry-import-graph.test.ts`; rerun after the final `npm ci` |
| `npm run test:e2e` | PASS: 49 files / 218 tests, including the three new lifecycle check IDs |
| `npm run test:a11y` | PASS: 21 files / 395 tests, axe clean outside known findings; keyboard facet 89/89 |
| `npm run test:budget` | PASS: 3 files / 9 tests |
| `npm run budget` | PASS: initial JS 160,172 gzip; initial CSS 4,974; total 784,697; largest chunk 27,516; 86 files / 76 chunks. Under the 790,000 budget and under the 785,000 entry-graph test target |
| `npm run test:visual` | PASS: 3 files / 123 tests, after reviewing and recording the two intended mobile baselines |
| `npm run lint` | PASS |
| `npm run deps:check` | PASS: 4 manifests, 630 lockfile entries |
| `npm run cycle-check` | PASS: no circular imports in `@kix/web` or `@kix/e2e` |
| `git diff --check` | PASS (no whitespace errors) |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` | `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249` (unchanged) |

## Copy and visual baseline changes

The repository's `entry-import-graph.test.ts` enforces a total gzip ceiling
of 785,000 bytes whenever `apps/web/dist/index.html` exists, which CI always
creates by building before testing. The lifecycle UI and its two messages
pushed the build over that ceiling. The authorized Option 2 remedy was used:
concise copy and deduplication inside the existing mobile catalogue only.

- Two new keys were added: `mobile.lifecycle.refreshRequired` in English and
  Korean, preserving protocol tokens such as `STALE`, `UNKNOWN` verbatim.
- 66 existing English/Korean mobile catalogue entries were tightened. No
  other catalogue, test assertion fragment, placeholder, uniqueness rule or
  uppercase-token rule changed. `i18n-coverage` passed.
- No budget, cap, matrix, CI or dependency file was edited.

Because the default mobile screens are part of the visual matrix, exactly two
baselines changed:
`mobile.desktop.en.light.png` and `mobile.phone.ko.light.png`. They were
regenerated with `KIX_VISUAL_UPDATE=1`, reviewed, and the recorder's
unrelated rewrites of seven other images were restored to HEAD byte-for-byte.
The manifest was restored and patched only for `appHead`, `recordedOn`, and
the two mobile hashes. Final `npm run test:visual` passed 123/123.

## Evidence limitations

- Browser lifecycle evidence is produced by dispatched synthetic
  `visibilitychange`, `pageshow` and `pagehide` events. It demonstrates the
  web integration and its ordering rules. It is not evidence of real browser
  bfcache behavior, device suspension, iOS/Android lifecycle delivery, or
  production restoration. The visible copy says this explicitly in both
  locales.
- The test harness uses synthetic stub controllers. No real payment,
  deployment, KYC, credit, venue, bank, marketplace, secret or production
  runtime is contacted.
- `npm ci` reports the unchanged lockfile's existing audit advisories; this
  node did not add or upgrade dependencies.
- The e2e, a11y and visual suites were run before the final `npm ci`/build.
  The final `npm ci` used the same lockfile and the rebuild produced
  byte-identical asset hashes, so those results describe the same build.
- No commit, push, PR, issue or comment was created by the builder; git and
  GitHub actions belong to the supervisor.

## STOP check

No unmerged contract or dependency content, hardware, paid service, secret,
production runtime, product policy value or new protocol command was needed.
No locked decision was crossed. No `DECISION_REQUIRED.md` condition applies.
