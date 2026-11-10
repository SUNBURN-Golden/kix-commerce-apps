# Tenant evidence isolation (stub)

## Scope and ruling

Standalone node `c-plan-tenant-evidence-isolation-stub`, against baseline `20138ca5b5b419fe0f52427630915ff75b0499bd`. The controller owns accepted synthetic tenant evidence and publishes defensive copies. This is app-local ownership protection, not authorization or validation of an arbitrary malicious producer. `/permissions` remains synthetic and `integration-http` remains NOT_BOUND.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The journey ends at `accept_trade`; `capture` and `settle_capture` are never composed or sent. `commit_trade`, `open_admission`, and `admit` remain uncomposed. `placeHold` remains not-bound with considered action `reserve_listing`. `confirmBooking` sends no `capture`; settlement sends no `settle_capture`. No desk method is remapped. The locked `commerce-bindings.ts` stays byte-identical.

Source discrepancy: this baseline's `.aiops/program.json` contains **60** nodes and does not contain this node, whereas the supplied task describes an 18-node executable program. The explicitly supplied standalone node specification governs this implementation. `docs/aiops/PENDING_NODES.json` and `docs/aiops/KIX_COMMERCE_PROGRAM_DRAFT.json` are non-executable and untouched. No `.aiops/**` or `docs/aiops/**` file is edited and no pending/draft node is implemented. The bind document path follows the spec's explicit Constraints section.

## Ownership boundaries

- Read, export, and action responses are detached with `structuredClone` inside their existing port-call try/catch, before any successful evidence is retained. Assessment, watermark floor, and assignment generation derive from that same accepted snapshot. Port-owned objects are never frozen or modified.
- Read/export requests retain their existing fresh object literals and fresh scopes. The complete action envelope, assignment generation, and separate scalar-only action copy are captured before sequence/counter changes and in-flight notification. A mutating port cannot rewrite the private original action recorded for that dispatch. Reentrant subscribers still encounter the in-flight fence.
- `state()` judges exports against private evidence and returns a deep copy of the assembled state: snapshot rows, focus rows, non-claims, assessment rows, export rows/declaration/verdict, context/scope, counters, records, receipts, and fences. Every call returns fresh identities; consumers must not rely on referential stability. `buildTenantModel` already reads state once.
- Returned APPLIED, REJECTED, and UNKNOWN records have separate action and receipt copies. These shapes contain only scalars. FENCED results receive a fresh fence. The private snapshot/assessment may share rows internally because that graph never escapes.
- A response copy failure follows existing unknown handling: reads become unavailable and clear the view/export, exports become unavailable without a retained value, and dispatched actions become UNKNOWN with no success receipt and an unknown-outcome write fence. There is no fallback to the original port object.
- If the synchronous `state()` copy fails, it returns an unavailable view with null snapshot/assessment/export value/verdict, retaining detached context, counters, last record, and fence. Its record/action/receipt and fence copies use scalar spreads and do not depend on `structuredClone`. This accessor failure does not change the privately retained evidence or resolve an UNKNOWN.

## Preserved interfaces and source authority

No method signature, discriminated union, public shape in `tenant-permissions.ts`, source policy, binding, transport, or UI production module changes. Existing `assessTenantSnapshot`, `tenantEligibility`, `tenantApprovableProposals`, `tenantCapabilities`, and `judgeTenantExport` remain unchanged. Maker/checker separation still uses actor identity across roles; the source checks assignments and capabilities on direct port calls. A proposal and an approval remain records that change no resource.

Context changes and read/export sequence drops, role generations and watermark floors, `actsDone`, `behind`, counters, and notifications retain their existing transitions. A ready read can clear `behind`; neither reads nor exports clear an UNKNOWN write fence. Reads/exports remain observations, not write recovery. Explicit tenant/actor/role switches retain existing clearing behavior and increment `earlierUnknown`. There is no cross-session recovery or authoritative UNKNOWN resolution.

## Acceptance/evidence matrix

| Acceptance | Regression evidence |
| --- | --- |
| Retained read responses and nested public state cannot alter evidence | Parameterized buyer, organizer, settler, support cases mutate every nested scalar across snapshot collections/focus/non-claims and assessments, context, counters; next state and eligibility remain equal to independently captured values. Subsequent reads retain floors and scope. Test ports detach fixture results before retaining them to avoid modifying the stub's shared catalogue constants. |
| Self-approval stays blocked | Retained and public proposal `proposedBy`, state, pending and approvable attacks leave approval NOT_SENT, zero action calls. Existing direct-port SELF_APPROVAL and same-person second-role tests stay unchanged. Fresh web models render the approval disabled. |
| Withheld exports stay withheld | Retained/public exports and verdicts are mutated at depth. A separate repair attack constructs rows proven current by `judgeTenantExport`, then applies them to both escaped export graphs; the private verdict remains withheld. Fresh web rendering contains no export row, foreign account text, or attacker text. |
| Action identity and request scope survive mutation | All three action kinds use a dedicated deferred fake retaining the exact received request, mutating synchronously and while pending. Private action, sequence, receipt, and subsequent context/generation remain original. Exact read/export request mutations cannot change the next write scope. |
| Public records and receipts stay isolated | Mutations to retained outcome receipts, returned APPLIED/REJECTED/UNKNOWN records and actions/receipts, and state.last leave private history unchanged. Returned records have distinct identities. |
| UNKNOWN cannot enable another write | Lost and refused outcomes, UNKNOWN record/state/fence attacks, mutated FENCED results, and refresh/export observations still fence all three write kinds with one original dispatch. Fresh web models retain UNKNOWN and fenced controls after a refresh. |
| Subscriber mutation and reentrancy cannot dispatch twice | In-flight subscriber corrupts its state and attempts a context switch/reentrant submission. Context switch is refused, submission is FENCED, exact original request dispatches once. |
| Copy failures stay closed | One-shot structuredClone failures cover read, replacement export, dispatched success, and synchronous state with both applied and unknown history. No port-owned fallback, success receipt, exposed retained record, or cleared UNKNOWN fence. |
| Existing synthetic authority and tenant UI remain correct | Existing tenant source/controller tests and tenant web/mounted operations suites pass unchanged alongside the new regressions. |
| Protected paths and budgets remain intact | Verification below includes byte/hash comparison and unchanged stricter entry caps (282,000 initial JS gzip / 785,000 total JS/CSS gzip). |

## Actual verification

Verification uses Node **22.23.4** (resolved via `npm exec --yes --package=node@22 -- node -p 'process.execPath'`) and npm **11.21.1**; the environment default was Node 24.22.1. Every npm verification command prepends the discovered Node 22 binary directory to `PATH`, matching CI's `node-version: '22'`. Browser checks use Chrome **156.0.8078.47**, `KIX_E2E_CHROME=/usr/bin/google-chrome`, and `KIX_E2E_NO_SANDBOX=1`. Long checks ran sequentially in the foreground.

`npm ci` passed, installing 535 packages from the unchanged lockfile. npm reported existing deprecation/install-script warnings and 14 development-tree audit findings (11 moderate, 1 high, 2 critical); the production-only `npm run audit:warn` reports 0 vulnerabilities. Dependency manifests and lockfiles were not changed. This worktree's planning baseline is `20138ca5b5b419fe0f52427630915ff75b0499bd`; `origin/main` has since advanced through other program nodes, including an audit-10 hardening of this same controller. No upstream merge, rebase, pin, or budget change was made here; the supervisor handles branch integration.

The focused adapter run is **95 tests** (49 controller + 46 source); the focused web run is **34 tests**. Every command below exited 0. Browser journeys, accessibility observation, and visual baselines were run on this worktree before the final clean install; the clean install then reproduced the identical lockfile dependency set and the desk, budget, lint, and coverage checks were re-run after it. No browser suite result was changed, retried, or re-baselined.

| Command | Actual result |
| --- | --- |
| `npm ci` | PASS: 535 packages installed; manifests/lockfile unchanged. |
| `KIX_REQUIRE_GATE=0 npm test -w @kix/protocol-adapter -- test/tenant-permissions-controller.test.ts test/tenant-permissions.test.ts` | PASS: 95 tests (49 controller + 46 source). |
| `npm exec -w @kix/web -- vitest run test/tenant-permissions.test.tsx test/operations-interactions.test.tsx` | PASS: 34 tests / 2 files. |
| `npm run typecheck` | PASS: adapter and web `tsc --noEmit`, before and after clean install. |
| `npm run build` | PASS: clean stub build, before and after clean install. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter **2,319 passed / 23 gate-dependent skipped**; web **1,518 passed**; cold-load **6 passed**. |
| `npm run budget` | PASS: initial JS **160,175**, initial CSS **4,974**, total **784,908** gzip bytes; route chunks and total growth within limits. |
| `npm run lint` | PASS. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: all floors. Adapter lines/statements 91.69%, functions 97.90%, branches 85.92%; web lines/statements 94.07%, functions 86.28%, branches 90.50%. |
| `npm run deps:check` | PASS: 4 manifests / 630 lockfile entries. |
| `npm run cycle-check` | PASS: no circular source imports. |
| `npm run audit:warn` | PASS (warning-only command): production audit reports 0 vulnerabilities. |
| `npm run typecheck:e2e` | PASS. |
| `npm run test:e2e` | PASS: 219 tests / 49 files (stub, headless Chrome, loopback). |
| `npm run test:a11y` | PASS: 396 tests / 22 files; keyboard facet 89/89 BROWSER SUCCESS/REJECT/UNKNOWN cells. |
| `npm run test:budget` | PASS: 9 tests / 3 files. |
| `KIX_VISUAL_UPDATE=0 npm run test:visual` | PASS: 123 tests / 3 files; no baseline update. |
| `git diff --check` | PASS. |
| `git diff --exit-code -- .aiops docs/aiops .github/workflows package.json package-lock.json apps/web/bundle-budget.json apps/web/test/entry-import-graph.test.ts packages/protocol-adapter/src/commerce-bindings.ts` | PASS: protected files and stricter 282,000 / 785,000 entry caps unchanged. |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` | PASS: `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`, unchanged. |
| `git diff --name-only` and `git ls-files --others --exclude-standard` | PASS: exactly the controller, adapter controller test, web tenant test, and this bind document. |

The live-gate job was not run: this is stub verification, with no protocol checkout or credentials. Its 23 skipped tests are not passes. Browser results are local synthetic observations, not accessibility acceptance or production qualification. Per the owner decision of 2026-11-09 14:10 KST (approved by JunTae), GitHub Actions exact-head CI is the stable acceptance runner; this node changed no timeout, assertion, retry, baseline, budget, or CI configuration.

## Deviations, UNDETERMINED and STOP conditions

The explicit Constraints bind path is used instead of the Objective's shorter path. The design review's corrections are applied: clone-failure tests for read/export/act/state, a non-throwing fail-closed synchronous `state()`, separate private dispatch and returned record/receipt/fence copies built before counters and notification, no added clone path on read/export requests, exact-received-request fakes, and a single deep-copy policy (clone on ingress and on `state()` egress). Repeated `state()` calls return fresh identities; consumers must read it once, as `buildTenantModel` does. Read/export refresh behavior after UNKNOWN is preserved: only later writes are fenced; observations are not newly prohibited. The implementation needs no external contract, dependency, or product policy decision; no STOP condition was triggered and no root `DECISION_REQUIRED.md` exists.

Real permissions, authoritative producer integration, persistence, retention/TTL, authoritative UNKNOWN resolution, and product policy values remain **UNDETERMINED** or outside scope. Defensive copies protect retained evidence against alias mutation; they do not establish the truth of an arbitrary new producer response.

No catalogue/gate change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay unchanged. Future authorized consumption must move all of them together. Stub remains default, HTTP remains explicit loopback `http://127.0.0.1` only, one attempt, no retry/Idempotency-Key/redirect following/stub fallback/gate proxy/UI fetch. Production and truth claims remain false. No real payment, public deployment, real KYC, credit disbursement, venue scanning, bank rail, live marketplace, SLO, secrets, copied Move/kernel/settlement math, or edits to `kix-protocol`.

An unmerged contract/dependency, new protocol command/schema, hardware/equipment, money/paid service, credentials, production runtime, product policy value, or crossing these boundaries would require root `DECISION_REQUIRED.md` naming the need, options, recommendation, and decider. No contract, financial, secret, production, or product policy boundary was crossed.
