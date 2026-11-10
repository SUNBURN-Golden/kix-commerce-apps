# Journal counter integrity (app-local stub)

## Provenance and ruling

The supplied standalone `c-plan-journal-counter-integrity-stub` node spec authorizes this work. The inspected live `.aiops/program.json` contains 60 node ids and does not list `c-plan-journal-counter-integrity-stub`. This work implements only the supplied standalone spec; it implements nothing from `docs/aiops/PENDING_NODES.json` or `KIX_COMMERCE_PROGRAM_DRAFT.json`. No program-mode action, ASTRA marker, external posting, commit or PR was performed by the builder; git/GitHub is the supervisor's step.

**M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.** The journey adapter and locked bindings remain unchanged. `packages/protocol-adapter/src/commerce-bindings.ts` is byte-identical to `HEAD`, SHA-256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`.

The owner decision recorded 2026-11-09 14:10 KST selects exact-head GitHub Actions CI as the stable runner for browser e2e/a11y/visual acceptance. Nothing in timeouts, assertions, retries, baselines, budgets or CI configuration was changed; no local browser result below is claimed as green.

Baseline: branch fast-forwarded to latest `origin/main` `3b3466d` before implementation (the earlier draft baseline was `20138ca`).

## Unchanged format and boundaries

Schema v1, the exact storage keys `kix-session-journal` and `kix-session-journal-quarantine`, the envelope `{ v, loads, nextSeq, records, digest }`, each record `{ seq, intentRef, scope, contextTag, outcome, code, loadNo }`, and quarantine `{ v, cause, raw }` are unchanged. The digest is still `sha256Hex(JSON.stringify([env.v, env.loads, env.nextSeq, env.records.map(copyRecord)]))`. The 32-record / 12288-byte budgets and the reserved settlement space are unchanged. `SESSION_RETENTION_POLICY` stays `UNDETERMINED`: there is no expiry, eviction, clear, reset, migration, identifier reuse or authority resolution.

| Counter | Invariant |
| --- | --- |
| `loads` | number, positive safe integer |
| `nextSeq` | number, positive safe integer |
| record `seq` | number, positive safe integer; strictly increasing and below `nextSeq` |
| record `loadNo` | number, positive safe integer; at most `loads` |

`isPositiveSafeInteger` requires `typeof === "number"`, `Number.isSafeInteger` and `> 0`; there is no coercion, rounding or clamping. All stored numeric evidence is checked by one shared predicate in `parseEnvelope`/`parseRecord`, so open, reopen, `begin`, `settle`, `verify` and `peekSessionJournal` agree. The record-level checks are defense in depth: a valid envelope's `seq < nextSeq` and `loadNo <= loads` bounds already exclude unsafe record counters, so the tests prove end-to-end rejection rather than isolating one predicate.

`COUNTER_EXHAUSTED` is an app-local refusal/cause. It is not a protocol command and is never persisted as a schema field; it is not added to `SettleResult`.

## Counter and surface matrix

Let `M = Number.MAX_SAFE_INTEGER` (`9007199254740991`). `loads` is the acquired-load counter; `nextSeq` is the next sequence allocation. Their exhaustion behavior differs.

| Stored/active boundary | Open / verify | Begin / controller `run` | Settle / `markUnknown` / `recoverInFlight` | Read-only peek |
| --- | --- | --- | --- | --- |
| Any invalid numeric counter with a valid digest | quarantine `evidence-lost/CORRUPT`; repeated open stays quarantined; changed invalid bytes while dirty also quarantine | `EVIDENCE_LOST`; controller `FENCED/evidence-lost`; zero sends | `settle` `EVIDENCE_LOST`; `markUnknown` false; `recoverInFlight` 0 | `evidence-lost/CORRUPT`; no write or removal |
| `loads = M - 1` | open persists `loads = M` and stays ready; this page acquired the final load | normal while sequences/budget allow | normal; neither operation increments `loads` | ready for the un-opened blob; `unavailable/COUNTER_EXHAUSTED` once storage holds `M` |
| `loads = M` | open does not increment, persist or quarantine; retains parsed envelope and `lastWritten`; becomes `unavailable/COUNTER_EXHAUSTED`; stored IN_FLIGHT projected to UNKNOWN in memory only | controller `FENCED { reason: unavailable, cause: COUNTER_EXHAUSTED }`; begin `UNAVAILABLE`; zero sends, zero writes | `settle` `UNAVAILABLE`; `markUnknown` false; `recoverInFlight` 0; no writes | `unavailable/COUNTER_EXHAUSTED` |
| `nextSeq = M - 1` | open increments only `loads`; stays ready | one begin allocates `seq = M - 1` and persists `nextSeq = M` | the final allocated intent can still settle | ready, unless `loads` is independently exhausted |
| `nextSeq = M` | ready; open/verify do not increment the sequence | healthy load: `COUNTER_EXHAUSTED`; controller `NOT_SENT { reason: counter-exhausted }`; stored bytes, write count and sends unchanged | settlement of a current in-flight record remains allowed and writes without incrementing either counter | ready (or existing quota state), never unavailable for sequence exhaustion alone |

A valid exhausted envelope is never quarantined. Under load exhaustion the mutated in-memory projection is not written; stored bytes, records, references, sequence numbers, scopes and load numbers are retained. Confirmed records are history even when `loadNo = M`; the unacquired load is not announced as this page's current load.

Controller result kinds: `loads = M` fences before `begin` through `gateFor` (`FENCED/unavailable/COUNTER_EXHAUSTED`); `nextSeq = M` on a healthy load returns `NOT_SENT/counter-exhausted` before `sender.send`; the final allocated intent still settles and persists.

### `verify()` ordering

1. Return when the journal is not `ready`.
2. Read the store; a `null` blob quarantines `LOST_DURING_SESSION`.
3. `raw === lastWritten` returns the current status; that text was already validated.
4. Otherwise parse. Invalid bytes quarantine with the parse cause even while `dirty`.
5. Parsed and not dirty: adopt the envelope and update `lastWritten`.
6. Parsed and dirty: retain the in-memory ahead-of-store UNKNOWN evidence and keep `lastWritten` as the restore target; do not replace either merely to reconcile storage.

`markUnknown` uses the same verification gate before writing, so changed storage cannot be silently overwritten.

## App presentation

`apps/web/src/session-recovery.ts` derives a nullable acquired-load value locally: `load` is `null` when `snapshot` is absent, `load === 0`, or the status is `unavailable/COUNTER_EXHAUSTED`. The controller snapshot shape is not extended. With load exhaustion:

- `screenFor` selects `unavailable` before other states.
- `recordKind`/`recordLine` classify confirmed records as history and never as `this-load`; stored IN_FLIGHT records arrive as `RECOVERED_AFTER_RELOAD` UNKNOWN.
- `loadLine` uses the existing "No journal load" sentence instead of announcing the retained counter as the current load.
- Attach controls are disabled and the existing panel keeps original `data-load` evidence.
- The status/detail sentence branches to new localized copy; diagnostics projects `state: "UNAVAILABLE", cause: "COUNTER_EXHAUSTED"` through the unchanged diagnostics model.

Sequence exhaustion on a healthy load leaves the journal ready and the screen empty/ready; the controller's `counter-exhausted` refusal is localized through a catalogue key instead of showing the raw detail. New en/ko keys `sj.load` and `sj.seq` have identical key sets, placeholder multisets and verbatim `COUNTER_EXHAUSTED` tokens; all other session-recovery copy is unchanged.

## Acceptance evidence

| Acceptance item | Implementation and verification |
| --- | --- |
| Digest-valid unsafe integers, fractions, invalid signs, safe boundaries | Shared test-only builder hashes the final envelope values (including overrides) in production field order, then serializes; a raw-text mode preserves `-0` because `JSON.stringify(-0)` is `0`. All four counters exercise `M + 1`, exactly representable `2 ** 54`, `1.5`, `0`, `-1`, raw `-0`, string and null. An independent digest assertion covers every fixture; a wrong-digest canary is rejected and a valid-envelope canary opens. `Number.isInteger(M + 1)` is true while `Number.isSafeInteger(M + 1)` is false. |
| Open/reopen, begin, settle and diagnostic peek agree | Each invalid fixture is peeked through a get-only port, opened, quarantined, reopened, and injected before begin/settle/markUnknown/resume. Controller tests cover invalid evidence at open and before dispatch; a late answer after numeric corruption stays an observation. |
| Exhaustion cannot persist unsafe values or dispatch attach | `loads = M - 1 -> M` and `nextSeq = M - 1 -> M` transitions are exercised; every observed journal write is checked for positive safe counters. Refused begins and exhausted opens preserve stored bytes and write counts; the allowed settlement at `nextSeq = M` is explicitly exempt. Controller/mounted tests assert `spy.submits === 0`, no added store writes and `stub.effects().attaches === 0`. |
| UNKNOWN fenced across reload; no eviction/reset | Repeated opens, context rebind and resume preserve UNKNOWN records and references, including on other scopes. Existing thousand-reload, budget, failed-settle and no-reset tests remain unchanged. |
| Dirty verification | Failed persistence with successful restore keeps UNKNOWN on identical bytes; older valid storage keeps UNKNOWN without a write; a later failed write restores the original `lastWritten`; changed digest-valid unsafe storage quarantines. |
| Commerce CI green; budgets/checks unchanged | Typecheck, build, full stub test, budget, lint, coverage, deps, cycle, audit and e2e typecheck all pass locally; browser suites are deferred to exact-head GitHub Actions by the 2026-11-09 owner ruling. No budget, pin, CI or dependency file changed. |

## Verification ledger

All commands ran from the repository root under Node `v22.23.4` (CI's Node 22), selected with `PATH=/home/box/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH`. Logs were redirected to `/tmp` outside the repository. No long job was run in the background.

| Command | Actual result |
| --- | --- |
| `npm ci` | PASS: 535 packages installed; 14 advisories reported (11 moderate, 1 high, 2 critical); no dependency version changed. |
| `KIX_REQUIRE_GATE=0 npm test -w @kix/protocol-adapter -- test/session-journal.test.ts test/session-recovery-controller.test.ts` | PASS: 2 files, 124 tests. |
| `npm exec -w @kix/web -- vitest run test/session-recovery.test.tsx test/session-recovery-interactions.test.tsx test/i18n-coverage.test.ts test/i18n.test.tsx` | PASS: 4 files, 65 tests. The workspace `test` script appends filters to its separate cold-entry config too, so the direct Vitest equivalent is recorded. |
| `npm run typecheck` | PASS (protocol-adapter and web). |
| `npm run build` | PASS: Vite clean stub build completed; existing chunk warnings only. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 3070 passed / 23 skipped (76 files passed / 5 skipped); web 1687 passed (112 files); cold entry 6 passed. |
| `npm run budget` | PASS: `initialJsGzip=160179`, `initialCssGzip=4997`, `totalGzip=786695`, files 86, largest route chunk 27512. Limits unchanged: initial JS 290000, CSS 5000, chunk 30000, total growth 790000. |
| `npm run lint` | PASS. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS, all unchanged floors met. Adapter lines/statements 91.89%, functions 98.13%, branches 86.05%; web lines/statements 94.53%, functions 86.93%, branches 90.81%. |
| `npm run deps:check` | PASS: 4 manifests, 630 lockfile entries. |
| `npm run cycle-check` | PASS: no circular imports. |
| `npm run audit:warn` | PASS: 0 production-dependency vulnerabilities. |
| `npm run typecheck:e2e` | PASS. |
| `git diff --check` | PASS: no whitespace errors. |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` and `git diff --exit-code HEAD -- packages/protocol-adapter/src/commerce-bindings.ts` | PASS: required SHA-256 matched and no diff from `HEAD`. |
| Browser `test:e2e`, `test:a11y`, `test:budget`, `test:visual` | NOT RUN in this build session. Per the 2026-11-09 owner ruling, exact-head GitHub Actions CI is the stable runner and acceptance gate; no local browser result is claimed. |

`KIX_REQUIRE_GATE=0` skips live-gate checks; it does not pass them. No readable `kix-protocol` checkout was available, so no live-gate or production claim is made.

## Deviations and unchanged boundaries

- The focused workspace web command form in the design notes cannot select these files cleanly because `@kix/web` runs a second cold-entry Vitest config with the appended filters; the direct `npm exec -w @kix/web -- vitest run <files>` equivalent is recorded above.
- Browser e2e/a11y/visual were not executed locally; the owner ruling makes exact-head GitHub Actions CI the acceptance runner, and no timeout, assertion, retry, baseline, budget or CI setting was changed.
- The acquired-load distinction is derived in the web model rather than added to `SessionControllerState`, avoiding an unrelated snapshot shape change.
- The controller detail text for the sequence refusal is a stable marker; the UI localizes by reason through `sj.seq`.

No external contract, new protocol command, money, paid service, hardware, secret, production runtime, retention/product-policy value, `kix-protocol` change, pin move, README change, budget change or locked-binding change is required or included. No `DECISION_REQUIRED.md` applies.

Final changed-file allowlist:

- `packages/protocol-adapter/src/session-journal.ts`
- `packages/protocol-adapter/src/session-recovery-controller.ts`
- `packages/protocol-adapter/test/session-journal.test.ts`
- `packages/protocol-adapter/test/session-recovery-controller.test.ts`
- `packages/protocol-adapter/test/support/session-journal-fixtures.ts`
- `apps/web/src/session-recovery.ts`
- `apps/web/src/i18n/messages/session-recovery.ts`
- `apps/web/test/session-recovery.test.tsx`
- `apps/web/test/session-recovery-interactions.test.tsx`
- `docs/c-plan-journal-counter-integrity-stub-apps-bind.md`
