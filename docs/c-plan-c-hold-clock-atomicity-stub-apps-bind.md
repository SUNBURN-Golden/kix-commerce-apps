# c-plan-c-hold-clock-atomicity-stub — app binding and evidence

## Authority and boundaries

Authority is the explicit builder task and owner record supplied for this node. The executable `.aiops/program.json` has no `c-plan-c-hold-clock-atomicity-stub` entry. Nothing is promoted or implemented from `PENDING_NODES.json` or `KIX_COMMERCE_PROGRAM_DRAFT.json`. This is not an ASTRA program-mode session; no signer, marker, commit, push, PR, issue, or external comment is involved.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce

`contract_change=NO`. `.aiops/`, `docs/aiops/`, `.github/`, and `packages/protocol-adapter/src/commerce-bindings.ts` are untouched. The locked binding SHA-256 remains `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`. No catalogue, SDK, gate, public type, pin, CI, budget, or baseline changes are consumed. `placeHold` stays not-bound to `reserve_listing`; no journey or desk binding is added. No `capture`, `settle_capture`, retry, transport, or real reservation is introduced.

## Scope

Changes are confined to:

| File | Change |
| --- | --- |
| `packages/protocol-adapter/src/stub-adapter.ts` | Validate one clock observation per hold operation and derived expiry before mutation. |
| `packages/protocol-adapter/test/hold-clock-atomicity.test.ts` | 129 deterministic fault, recovery, observation-count, and boundary tests. |
| `docs/c-plan-c-hold-clock-atomicity-stub-apps-bind.md` | Authority, operation ordering, acceptance and actual verification evidence. |

The existing synthetic ten-minute `HOLD_MS` policy, `expiresAt <= now` expiry boundary, `HOLD_EXPIRED` / `HOLD_NOT_ACTIVE`, ID prefixes, and `payment: "simulated-no-funds"` are preserved. This capacity counter is separate from `ReservationCaseStore`; that FSM is unchanged.

## Operation ordering

- `placeHold`: validate event then quantity → observe/validate clock once → construct and validate derived ISO expiry → sweep with the same observation → check capacity → decrement capacity → allocate hold ID → store record. No internal `await` separates these steps.
- `listPerformances`: observe/validate once → sweep with that observation → return copies.
- `releaseHold` / `confirmBooking`: observe/validate once → validate active hold using that observation → transition. Booking ID allocation occurs only after active-hold validation succeeds.
- Nested helpers never read the clock. Thrown clock errors are wrapped in a fixed message-only `ProtocolError`; the original exception text is not exposed. Non-finite and Date-unrepresentable observations also return that error. Derived expiry range failure uses a separate fixed message-only `ProtocolError`, without a new error-code contract.
- Input refusal precedes clock refusal for creation. Invalid input no longer sweeps, including when the clock is valid. For reads/transitions, clock refusal precedes unknown or terminal hold errors. All clock/expiry refusals leave performances, holds (including terminal flags), bookings and the shared sequence unchanged.
- Valid-clock expiry handling intentionally releases capacity even when direct confirmation/release then returns `HOLD_EXPIRED`; subsequent attempts never credit capacity again. Confirmed/released holds remain `HOLD_NOT_ACTIVE`.

## Acceptance matrix

All test titles below are in `hold-clock-atomicity.test.ts`; private state inspection is confined to the named test-only `snapshot` helper and deep-copies the four affected stores/counter before any public sweep.

| Acceptance | Evidence / test titles |
| --- | --- |
| Throw, NaN, ±Infinity, ±(Date maximum + 1), empty/populated stores | `<operation>: <fault> preserves empty/populated state and recovers` across all four operations. Complete immediate snapshots, one read, preserved booking contents, capacity recovery, gap-free hold/booking IDs and simulated payment. |
| Unknown/confirmed/released/expired precedence | `<releaseHold/confirmBooking>: <fault> precedes <terminal> hold refusal without mutation`. |
| Invalid clock cannot confirm/release a due hold | `<operation>: <fault> cannot transition a due hold; recovery releases exactly once`; restored valid clock returns `HOLD_EXPIRED`, capacity restores once, next ID is `hold_2`. |
| Derived expiry overflow | `refuses unrepresentable derived expiry before sweeping a due hold or allocating an ID`: Date maximum minus ten minutes plus 1 rejects atomically; exact maximum minus ten minutes succeeds with `hold_2`. Reads and confirmation near Date maximum do not require a representable future expiry. |
| Date boundaries / controls | `creates the ten-minute expiry at valid epoch %s`: minimum Date, zero, ordinary epoch, maximum minus ten minutes; release recovers capacity. |
| One clock observation | `<operation> observes the clock once, including a multi-hold sweep`, with a second observation configured to throw; `uses the first observation when a second read would cross expiry`. |
| Exact expiry / no double release | `<operation> at expiry -1/0/1ms releases capacity at most once`: read/confirm/release, repeated sweeps and transitions, stable terminal codes, ID continuity, confirmed capacity never restored. |
| Input precedence / no sweep | `input refusal ($message) precedes the clock and never sweeps` for missing event and invalid quantity, both invalid and due valid clocks. |
| No real binding / bypass | Existing `critical-flows.test.ts`, `no-bypass.test.ts`, full stub tests, protected-path diff and locked binding hash. |

## Verification

Tested working-tree source is based on HEAD `c32f779bed52343ff0887be150190e880969cf9c`, branch `agent/kixc-c-plan-c-hold-clock-atomicity-stub`, in stub mode. No commit was created. All npm commands below use Node **22.23.4** through `PATH=/home/box/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH` (host default is Node 24.22.1). Logs are scratch files `/tmp/kix-hold-*.log`, not delivery artifacts. Commands run from the repository root.

| Command actually run | Result |
| --- | --- |
| `node --version` (selected PATH) | PASS: v22.23.4. |
| `npm ci` | PASS: 535 packages added, 539 audited. Existing lockfile audit reports 19 advisories (16 moderate, 1 high, 2 critical); no dependencies changed. |
| `KIX_REQUIRE_GATE=0 npm test -w @kix/protocol-adapter -- test/hold-clock-atomicity.test.ts test/critical-flows.test.ts test/no-bypass.test.ts` | PASS: 139 tests / 3 files; 129 new clock tests. |
| `npm run typecheck` | PASS, including adapter tests. The lint script does not lint `packages/*/test`. |
| `npm run build` | PASS: adapter typecheck, web typecheck and Vite build. |
| `npm run budget` (first attempt, before build completion) | FAILED: `missing index.html in apps/web/dist`. Command was issued too early; no source or threshold change. |
| `npm run budget` (after completed build) | PASS: initial JS gzip 160253, initial CSS 4974, total gzip 784177; all original route and growth limits met. |
| `npm run lint` | PASS: zero warnings. |
| `npm run deps:check` | PASS: 4 manifests / 630 lockfile entries. |
| `npm run cycle-check` | PASS: no circular imports. |
| `npm run typecheck:e2e` | PASS. |
| `npm run audit:warn` | PASS: 0 production vulnerabilities. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 2980 passed / 23 intentionally skipped (76 files passed / 5 skipped); web 1551 passed (108 files); cold-entry 6 passed (1 file). |
| `git diff --check` | PASS. |
| `git diff --exit-code HEAD -- .aiops docs/aiops .github packages/protocol-adapter/src/commerce-bindings.ts` | PASS: no protected-path difference. |
| `git diff --name-only`; `git ls-files --others --exclude-standard` | Only the three authorized delivery files (tracked source, untracked test and evidence doc). |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` | PASS: locked hash above is unchanged. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: adapter lines/statements 91.73%, functions 97.91%, branches 85.91%; web lines/statements 94.24%, functions 86.38%, branches 90.55%. All unchanged floors met. |

## Limitations and deviations

- Follow the design review's input-first creation ordering, rather than the original plan's clock-first creation ordering. Invalid-input calls no longer sweep. Transitions still validate their clock before hold lookup.
- Preserve the existing acceptance of finite Date-representable numeric observations, including fractional observations; the optional safe-integer restriction is not adopted. This change adds no monotonic-clock or production-clock policy.
- The task describes an 18-node executable manifest; read-only inspection of this checkout reports 60 `nodes`, with this node absent. No manifest is edited or dispatched. Implementation authority is the explicit builder task; no pending/draft node content is consumed.
- The first budget invocation ran before build completion and failed on missing output. The completed-build invocation passes without code or budget changes.
- Browser journey, accessibility, browser-budget and visual suites are skipped for this adapter-only change, as permitted by the design review. E2e typecheck passes. Live-gate checks are unverified; 23 adapter tests are intentionally skipped under `KIX_REQUIRE_GATE=0`. No credentials are acquired. Local verification does not establish remote CI success.
- No real reservation binding, payment, production deployment, KYC, credit disbursement, venue scanning, bank rail, marketplace, settlement math, external integration, SLO, or release is introduced or verified. Capacity atomicity here covers clock/expiry refusal. No changes to the separate reservation FSM are made.
