# Commerce PR26 independent source architecture audit

- VERDICT=FAIL
- VERIFIED_AUDIT_DEPTH=A3
- ASTRA_GATE=ARCHITECTURE (PR26 source audit only)
- VERIFIED_HEAD=a92dec19efbcfd000f763aaa04fcb41b21e1e982
- VERIFIED_BASE=7c2452645c50b8ede17bdd762794adeabe42319e
- Locally observed origin/main=7c2452645c50b8ede17bdd762794adeabe42319e; no fetch performed.
- VERIFIED_PROTOCOL_HEAD=52a9b5cbf7777df55d2d2062cb8d99d862b423bb
- VERIFIED_TOUCHED_AREAS=synthetic catalogue orchestration; causal receipt validation; UNKNOWN/rejection/invalid-response fencing; payment/issuance/admission boundary; fixture UI and event isolation; loopback/browser tests; CI/dev dependencies; bounded approval/audit documentation.
- VERIFIED_CONTRACT_CHANGE_REQUIRED=NO
- Reason: the approved M1/H1 composition consumes the existing pinned commands, actors and bodies. It adds no Protocol command/schema/pin, real payment authority, desk binding, public transport or recovery API. The blocking finding can be fixed by enforcing the existing fresh-primary receipt invariant; it needs no contract change or expansion of the User decision.

## Auditor identity and authority

Independent non-author internal auditor identity: `INTERNAL_ASTRA_PR26_SOURCE_A3`, session/task `/root/pr26_source_a3`.
The collaboration.list_agents tool directly returned this task as running. The parent relayed its exact creation arguments: task_name=pr26_source_a3, fork_turns=none, model=gpt-6-astra, reasoning_effort=high, with the spawn response containing only task_name=/root/pr26_source_a3. Thus gpt-6-astra is the configured/requested model, not independently verified provider execution telemetry. No modelUsage/provider telemetry or protected host receipt was exposed to this reviewer. No claim of protected producer identity is made.

This session did not author or modify the reviewed source, did not spawn subagents, and made no commit, push, PR comment, external provider call, ledger edit or credential change. Only this out-of-repository report is authored. Tests produced transient/ignored artifacts; both reviewed repositories remain clean at the pinned HEADs.

Authority inspected: central AGENTS copy supplied at commerce-evidence/AGENTS.md (parent pins source f1b7c0537be4ed329e0c62ceacd2a2738d525fce); .aiops/program.json; docs/aiops/PROGRAM_ASTRA_DELEGATION.md; original PR23 map at 0a940df885b70edce0db577d9783921609f71dfe; docs/decisions/2026-10-07-commerce-journey-and-a3.md. The decision preserves original thread 01a0f57c-0df9-72ce-bb48-d1aaf753d004, question Sentinel_a0929fd81dd48191b96994ee6174aa96 and approval Sentinel_a8ef1e17bbe481918c073a7998b17bb0. This is a relayed decision record, not independent host-signed provenance. Its narrow exception accepts fresh non-author internal source A3 for PR26 only; it does not authorize merge, a machine gate bypass, credential repair, deployment or another product.

## Blocking finding F1 — P2: impossible primary issuance versions permit downstream writes

Location: packages/protocol-adapter/src/journey-adapter.ts:257-267, especially 258-260 and positiveVersion at 286-287.

The helper creates a fresh inventory/right, prepares with expectedInventoryVersion=0 and expectedVersion=0, and performs the first primary commit. At the exact Protocol pin, lifecycle.py:35-45 initializes rightsVersion=0/admissionEpoch=0. core.py:149-168 checks the prepared expected version and increments both by one. This pinned fresh-primary path therefore returns rightsVersion=1/admissionEpoch=1. The composer instead accepts any positive safe integer. A commit receipt whose version/epoch is 2 is impossible evidence for this operation, but is recorded as confirmed and permits open_admission and admit.

Independent reproduction used the real clean pinned Python loopback gate, the unmodified HttpProtocolAdapter and the unmodified composer. A caller wrapper awaited each real HTTP response; only for commit_trade it copied the actual result then replaced rightsVersion and admissionEpoch with 2 before returning that receipt. OperationId, action, domain, ticketId and owner remained intact. Observed actual commit: rightsVersion=1, admissionEpoch=1. Observed dispatched actions:

`create_event, prepare_trade, accept_trade, capture, commit_trade, open_admission, admit`

Observed confirmed actions: the first six including commit_trade and open_admission. Final fence was REJECTED at admit, code STALE_OR_WRONG_PRESENTATION. Thus the authoritative gate prevented consumption, but the composer still performed the prohibited downstream open_admission write after invalid evidence. A scripted caller accepting the forwarded 2/2 presentation additionally returned fence=null and all seven actions confirmed. No production admission or real funds were involved.

Expected: INVALID_RECEIPT at commit_trade, last confirmed step capture, with neither open_admission nor admit invoked. This follows the approved decision's requirement that invalid/stale evidence stops later writes and .aiops/program.json journey-adapter acceptance. Validate the exact fresh-primary issuance version/epoch invariant (or an equally strict pin-derived predicate), retaining returned identity copying. Add focused negative cases for a positive unexpected rightsVersion and a positive unexpected admissionEpoch, independently and together, in direct and reviewed-gate response-injection tests. Re-audit the resulting exact HEAD. This is an implementation correctness repair, not a new protocol or financial contract.

## Other audited boundaries

- Checked all seven request bodies directly against both pinned OpenAPI documents and core.py/lifecycle.py/finance.py. Independently recomputed contract-only SHA256=fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e and gate SHA256=2a2af554cb1a8b128f2cf1b1d5b8cf6b1c8fa90adf30865dbc3e64932b3bd13f.
- Capture copies prepare.externalOrderId, immutable buyer/amount/paymentId and the fixed synthetic scope. It requires captured=true and cashAvailable=false. Duplicate-only capture evidence stops. commit_trade does not require settle_capture in the reference; capture does not establish available cash, payout or refund completion.
- The invocation snapshots caller intent before awaiting. Operation IDs remain caller-owned, distinct, and single-attempt; failure paths contain no automatic retry, replacement ID, read-based completion or UNKNOWN recovery.
- Existing tests directly exercise effect-then-response-loss at all seven real gate steps; expiry before accept and after capture; old presentation after actual gift transfer; and second admission rejection. These passed independently. They do not cover F1's positive but impossible commit versions.
- The UI is an explicitly isolated scripted fixture, with no real ticket/funds/entry claim. Browser HTTP has no journey runner and sends no journey POST. Fixture reload/reset does not reconcile UNKNOWN. Event transition resets the booking subtree. Browser checks and mobile screenshot inspection confirmed these presentation boundaries.
- All existing desk methods remain not-bound. placeHold retains consideredAction=reserve_listing. No remap of hold/confirmation/settlement/admission methods occurs. No producer/schema/pin move or new browser transport appears in the cumulative diff.
- Source audit approval is scoped correctly in the decision/delegation changes. It cannot satisfy a protected receipt consumer or supersede exact-head CI, Wave7 predecessor completion, or User merge.

## Independent verification actually performed

1. Compared cumulative diff base..HEAD (29 changed files) and affected dependencies; checked clean source and exact HEAD before/after; git diff --check passed.
2. First `KIX_PROTOCOL_ROOT=/Users/hyeonjin/Documents/Codex/2026-10-07/task/kix-protocol-reviewed KIX_REQUIRE_GATE=1 npm test` was blocked by sandbox localhost bind EPERM/REFUSING_BIND (109 passed, 4 failed, 15 skipped; 3 environment errors). This was not a source pass. Approved loopback re-execution completed with adapter 128/128 and web 51/51 passed (tool session 15578, completion chunk c23382).
3. `npm run typecheck` passed for adapter and web (session 60108).
4. `npm run test:browser -- --output=/tmp/pr26-a3-browser-results` passed Chromium 6/6 (session 90078, completion chunk d5c826). Mobile fixture screenshot inspected at /tmp/pr26-a3-browser-results/journey-mobile-fixture-has-no-horizontal-page-overflow/mobile-journey.png.
5. F1 was independently reproduced against the actual loopback gate using an in-memory esbuild bundle (no source edit), output chunk d30727. Only the returned commit version pair was changed to 2/2, and the gate itself remained unmodified. A separate fixture reproduction also confirmed the all-success path with 2/2.
6. Directly inspected the original PR23 map; preserved fixture-only actor model, OpenAPI non-production scope, reference accounting and lifecycle checks. No author test log was substituted for independent execution.

Build and npm audit were not independently rerun; no new package install was performed. Earlier inline harness attempts with an incorrect raw-JSON loader failed before executing the composer; the corrected harness used esbuild loader .json=text, reproducing against the unchanged real sources. These harness setup failures are not product failures.

## Remaining blockers and non-claims

F1 blocks source approval at this HEAD even though existing suites pass. Required exact-HEAD GitHub CI is a separate gate: not independently queried in this source-only review; the parent reports reviewed-gate checkout 403 at current HEAD. No CI success, restored login, merge readiness or merge authorization is claimed. The User's login approval is not evidence of completed login. Wave7 still requires the separate w6a-evidence merge. No claim is made about real payment, authenticated actors, physical admission, production durability, release or external qualification.

## Cumulative changed paths

- .github/workflows/ci.yml
- .gitignore
- README.md
- apps/web/e2e/journey.spec.ts
- apps/web/package.json
- apps/web/src/pages/Booking.tsx
- apps/web/src/pages/BoxOffice.tsx
- apps/web/src/pages/JourneyPanel.tsx
- apps/web/src/pages/Resale.tsx
- apps/web/src/styles.css
- apps/web/test/journey-panel.test.tsx
- apps/web/tsconfig.json
- docs/aiops/PROGRAM_ASTRA_DELEGATION.md
- docs/ci-access-diagnosis.md
- docs/decisions/2026-10-07-commerce-journey-and-a3.md
- docs/journey-decision-check.md
- docs/product-journey-workspace.md
- docs/wave-6a-journey-adapter-apps-bind.md
- package-lock.json
- package.json
- packages/protocol-adapter/package.json
- packages/protocol-adapter/src/index.ts
- packages/protocol-adapter/src/journey-adapter.ts
- packages/protocol-adapter/src/journey-demo.ts
- packages/protocol-adapter/src/payload-guards.ts
- packages/protocol-adapter/test/gate-requirement.test.ts
- packages/protocol-adapter/test/journey-adapter-gate.test.ts
- packages/protocol-adapter/test/journey-adapter.test.ts
- playwright.config.ts
