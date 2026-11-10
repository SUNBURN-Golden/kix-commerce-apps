# Delegated assistant evidence isolation (stub)

## Scope and ruling

Standalone node `c-plan-c-assistant-evidence-isolation-stub`, implemented against actual worktree HEAD `0baf65430132b6f7d1d216e0438b2c1cb154ba9f`. The supplied node specification authorizes this implementation. It changes ownership of synthetic evidence only; no protocol command, policy, binding, or authority is added.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The journey still stops at `accept_trade`. `capture` and `settle_capture` are never composed or sent. `commit_trade`, `open_admission`, and `admit` stay uncomposed. `placeHold` stays not-bound with considered action `reserve_listing`; `prepare_trade` remains only an `invokeLocalCall` body.

Source discrepancy: this checkout's `.aiops/program.json` has **60** nodes and omits this node, whereas the supplied task refers to 18 nodes. This standalone implementation proceeds from the explicitly supplied node spec only. The pending/draft catalogues are NON_EXECUTABLE and authorize nothing. No program metadata or pending/draft node is implemented or edited. The document path follows the spec's Constraints section.

## Ownership boundaries

Accepted `ready` snapshots are copied completely before assignment, after the existing context/read-order checks. The watermark floor comes from that owned copy. Grants, their allowed-action arrays, listings, drafts, array containers, and all seven non-claims are detached. Values are copied exactly, without normalization, recalculation, authority inference, or freezing the port's data.

`state()` copies the snapshot, proposal rows, intent/receipt/non-claim history, nested turn records (including clarification `missing` arrays), context, quarantine, and counters. `interpret()` records its private turn and returns a detached copy. `projectDelegation()` copies grants/actions, proposals, and nested turns as well as its existing listing/draft projections, rejection rows, and unlinked intents. Projections are independent of their supplied state and of other projections. Existing confirmed receipt and returned-intent copying in `settle()` is retained and tested.

Public copies remain mutable. Every non-claim stays false in accepted controller evidence: `assistantTextIsAuthority`, `proposalIsApproval`, `approvalIsResult`, `fundsMoved`, `rightsTransferred`, `executionDelegationBound`, and `grantInferredFromText`.

## Preserved interfaces and behavior

Signatures remain unchanged: `state(): DelegationControllerState`, `interpret(text): DelegationTurn`, `projectDelegation(state): DelegationProjection`, `refresh(): Promise<DelegationRefreshResult>`, `gateFor(input): DelegationFence | null`, and `approve(input): Promise<DelegationStepResult>`. Notification timing, read ordering/context quarantine, approval gate precedence, single-flight and duplicate-intent fencing, and UNKNOWN fencing are preserved. Interpretation still sends nothing, and every send still requires explicit approval of an open recorded proposal. Integration-http remains NOT_BOUND with zero submits.

Risk: `state()` now returns a fresh snapshot object on each call. Inspection found no consumer relying on its reference identity. `apps/web/src/delegated-assistant.ts` builds its model from a new `controller.state()` read on each render and passes it to `projectDelegation()`. The full web and browser checks below exercise this consumer. Structural copying covers the declared synthetic schema; it does not establish the truth of arbitrary new observations supplied by a producer.

## Acceptance matrix

| Requirement | Regression evidence in `delegated-assistant.test.ts` |
| --- | --- |
| Port-owned evidence cannot rewrite history or gates | Stage a real synthetic draft, refresh, retain the exact snapshot returned by the port, then mutate metadata, grants/actions/budgets/modes, listing and draft rows, non-claims, array entries and shapes. State remains equal to an independent baseline; explicit cancellation dispatches original draft/grant/version. |
| State results are detached in both directions | Repeat snapshot attacks through `state().snapshot`. Subsequent state and gates remain original; older snapshots retain their values after legitimate writes and reads. |
| Interpreter turns cannot rewrite recorded requests | Attack returned answer, proposal, clarify (including `missing`), and refused variants, then repeat through state and projection histories. Turn history, refusal count, proposal reference/target, and successful approval remain original. |
| Projections are independent | Mutate grants/actions/budget/mode, proposal rows and arrays, turn records, top-level drafts and nested listing drafts, and collection shapes. Supplied state, prior and subsequent projections, controller state, and valid approval remain unchanged. |
| Escalation produces zero additional submits | Nine cases: retained port/state/projection copies crossed with grt-0002 mode elevation, adding `draft-order` to an accepted valid command grant narrowed to `cancel-draft`, and enlarging/resetting a spent budget. Both `gateFor` and `approve` retain `mode-capped`, `action-not-granted`, or `budget-exhausted`, with zero actual submit calls and no intervening refresh. |
| Receipts remain historical evidence | Mutate retained confirmed port receipts, approval results, and state receipts including every non-claim. History and receipt-based draft linking remain original, and subsequent explicit cancellation still succeeds. |
| Single-flight and UNKNOWN survive public mutation | Hold a response, alter public intents/proposals/context/counters and unlinked projection rows, and attempt duplicate and concurrent approval: actual submits remain one. Mutate UNKNOWN results/state/projections and read again: UNKNOWN still fences, with one submit total. |
| Existing synthetic and fail-closed rules survive | Existing explicit approval, duplicate intent, context quarantine, UNKNOWN, grant/source validation, and HTTP NOT_BOUND regressions remain. The HTTP controller test counts actual submit calls and asserts zero. |

## Actual verification

Verification uses Node **22.23.4**, npm **11.21.1**, and Google Chrome **156.0.8078.47**. The environment default was Node 24.22.1. Node 22 was selected with `npm exec --yes --package=node@22 -- node -p 'process.execPath'`; its binary directory was prepended to PATH for all npm checks. Verification suites run sequentially in foreground processes. Raw logs use `/tmp/kix-assistant-*.log`, and the sequential check ledger is `/tmp/kix-assistant-checks.json`.

`npm ci` passed with 535 packages installed. It reported existing deprecation/install-script notices and 19 audit findings; dependencies and lockfile are unchanged. The initial focused suite and initial typecheck passed; final verification results are recorded below. Every verification command passed on its first run; no failed verification, timeout change, or baseline update was needed.

| Command | Actual result |
| --- | --- |
| `npm ci` | PASS: 535 packages installed; dependency/lock files unchanged. |
| `KIX_REQUIRE_GATE=0 npm test -w @kix/protocol-adapter -- test/delegated-assistant.test.ts` | PASS: 60 tests, including 18 new ownership regressions. Initial and final focused runs passed. |
| `npm run typecheck` | PASS: adapter and web. Initial and final runs passed. |
| `npm run build` | PASS: adapter typecheck and Vite web build. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 2,851 + web 1,551 + cold-load 6 tests; 23 gate-dependent tests intentionally skipped. |
| `npm run budget` | PASS: initial JS 160,134 gzip bytes, initial CSS 4,974, total 784,064. Initial JS ≤290,000, total ≤790,000, and every existing route and growth limit passes unchanged. |
| `npm run lint` | PASS. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: all floors. Adapter lines/statements 91.70%, functions 97.85%, branches 85.85%; web lines/statements 94.24%, functions 86.38%, branches 90.55%. |
| `npm run deps:check` | PASS: 4 manifests and 630 lockfile entries. |
| `npm run cycle-check` | PASS: no circular source imports across adapter, web, and E2E. |
| `npm run audit:warn` | PASS: warning-only command; production audit reports zero vulnerabilities. |
| `npm run typecheck:e2e` | PASS. |
| `npm run test:e2e` | PASS: 230 tests / 50 files. |
| `npm run test:a11y` | PASS: 396 tests / 22 files; 89 of 89 keyboard outcome facets. |
| `npm run test:budget` | PASS: 9 tests / 3 files. |
| `KIX_VISUAL_UPDATE=0 npm run test:visual` | PASS: 123 tests / 3 files, including 108 baseline screenshots; updates disabled. |
| `git diff --check` | PASS: no whitespace errors. |
| `git diff --exit-code HEAD -- .aiops docs/aiops .github/workflows package.json package-lock.json apps/web/bundle-budget.json packages/protocol-adapter/src/commerce-bindings.ts` | PASS: protected paths unchanged. |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` and byte comparison with `git show 0baf65430132b6f7d1d216e0438b2c1cb154ba9f:packages/protocol-adapter/src/commerce-bindings.ts` | PASS: required digest and byte identity. |
| Scope assertion over `git diff --name-only` and `git ls-files --others --exclude-standard` | PASS: exactly the three authorized paths listed in this node's design. |

Browser commands use `KIX_E2E_CHROME=/usr/bin/google-chrome` and `KIX_E2E_NO_SANDBOX=1`, with visual updates disabled. Records are `/tmp/kix-assistant-{e2e,a11y,budget,visual}-record.json` and the browser command/exit ledger is `/tmp/kix-assistant-browser-checks.json`. Visual failure artifacts, if any, go to `/tmp/kix-assistant-visual-out`; committed baselines are never updated.

The browser journey record reports zero non-loopback requests, zero non-GET requests, and zero app network calls; all 46 browsers and 201 pages opened and closed, with no surviving resources, pending calls/routes, unreleased gates, or cleanup errors.

The live-gate job was not run: verification is the requested stub scope, with no protocol checkout or credentials. The 23 intentional skips are not live-gate passes. Browser observations remain local synthetic evidence, not user accessibility acceptance, production qualification, or release permission.

## UNDETERMINED, deviations, and STOP conditions

Cancellation budget restoration, retention policy, real delegation execution, producer integration, durable recovery, and authoritative UNKNOWN resolution remain **UNDETERMINED** and outside this change. No contract or policy decision was needed.

The only blueprint discrepancy is documented above; implementation follows the supplied design and review corrections. No CI, dependency, bundle threshold, transport, shared validator, export, catalogue, or gate change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` remain unchanged. Any future authorized consumption must move them together.

`packages/protocol-adapter/src/commerce-bindings.ts` is unmodified and byte-identical to the recorded worktree base. Verified SHA-256: `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`.

README boundaries remain: stub by default, loopback `http://127.0.0.1` only, one attempt, no retry, Idempotency-Key, redirects, fallback, proxy around the gate, or fetch from UI components. Production/truth flags stay false. No real funds/payment/KYC/credit, bank rail, live marketplace, venue scan, public deployment, SLO, secrets, or copied Move/kernel/settlement math. `kix-protocol` remains read-only context.

An unmerged protocol/dependency contract, new protocol command, hardware, paid service, money, credentials, production runtime, new product policy value, or any crossed boundary requires root `DECISION_REQUIRED.md` describing the need, options, recommendation, and decider. No such STOP condition arose. No commit, push, PR, issue, or comment was created.
