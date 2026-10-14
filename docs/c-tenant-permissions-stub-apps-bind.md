# Tenant permissions stub apps bind

This bind is the stub-scoped tenant permissions desk at `/permissions`. It is the synthetic reduction of pending node `c-tenant-permissions`: the real connection stays pending on `kix-protocol:k-operator-contract`. This node wires the organization seam — four role workspaces (buyer, organizer, settler, support) over one tenant, tenant/actor/role/resource scope decided at the adapter boundary, a maker/checker pair for account changes and role revokes, role-assignment generations that make a stale write a role-stale rejection, a same-person role switch that is a new session and never a mixing of the two, a source-side audit record, and a judged sensitive export — onto a deterministic synthetic source. It is not a producer connection and does not claim one, and a hidden control is never enforcement: the source checks every read, export, and request on its own, and the tests send calls straight to the port to prove the screen is not the boundary. A recorded proposal is not an applied change, a recorded approval changes no resource, and nothing on this desk grants a real permission.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical (`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). The branch base is `7c2452645c50b8ede17bdd762794adeabe42319e`. This delivery is the uncommitted diff on `agent/kixc-c-tenant-permissions-stub`. The supervisor commits.

## What this page sends

Nothing goes to a protocol. The page sends no local call, no `create_event`, `prepare_trade`, or `accept_trade`, and no permission grant. Its read, its one export call, and its three request kinds — propose-account-change, propose-role-revoke, and approve-proposal — land on an in-process synthetic source, which is a stand-in for the producer. `capture` and `settle_capture` are never composed or sent, `commit_trade`, `open_admission`, `admit`, and `refund_ticket` are recorded and not sent (`TENANT_NOT_COMPOSED` reuses the platform record), and `placeHold` stays not-bound with `consideredAction` `reserve_listing` (`TENANT_HOLD_NOT_BOUND` quotes the locked binding and the page prints its reason). `prepare_trade` is not mapped onto it.

On `integration-http` the read, the export, and the requests are `not-bound`: "No current producer tuple exists for tenant permissions: kix-protocol:k-operator-contract is not merged and pending node c-tenant-permissions is not promoted. The contract-only catalogue has no read command for an organization, a role assignment, an account, a support case, an audit entry, or a sensitive export, and no command that grants or revokes a permission. The permissions desk stays NOT_BOUND on integration-http." There is no stub fallback, no third adapter, and no request.

## Scope and acceptance

| Spec item | Where it lives | Test |
| --- | --- | --- |
| tenant/actor/role/resource scope is decided at the adapter boundary | `TENANT_ROLE_RESOURCES`, `tenantCapabilities`, the gate and `focusFor` in `tenant-permissions.ts`; `read-own` returns a buyer's own rows only | `packages/protocol-adapter/test/tenant-permissions.test.ts` |
| maker/checker, revocation, and account change are connected | `TENANT_MAKER_CAPABILITY`, `TENANT_CHECKER_CAPABILITY`, the proposal lifecycle and the `revoke-role`, `rotate-role`, and `apply-approved-change` synthetic controls | both adapter suites and the web suite |
| UI hiding is tested apart from the port's own checks | the page's `ControlModel` reasons are display; `tenant-permissions.test.ts` calls `port.act` and `port.readExport` directly with no screen | `tenant-permissions.test.ts` (privilege escalation, self-approval, export denied), `tenant-permissions.test.tsx` |
| A direct URL reaches no foreign row | `focusFor` denies a kind outside the role, a resource of another tenant, another subject's order, and another person's membership — denied, never a substitute row | `tenant-permissions.test.ts`, `tenant-permissions.test.tsx` (direct open) |
| Another tenant's material does not leak through a read, a cached view, or an export | the whole payload is refused on any foreign row (`SCOPE_LEAK`), a context switch clears rows and the export, and a withheld export shows no row at all | `tenant-permissions.test.ts` (tenant-mix, export-leak), the controller suite, `tenant-permissions.test.tsx` |
| A same-user role switch mixes no old session results | `switchRole` opens a new context at the next incarnation, clears rows and the export, and drops a late answer | `tenant-permissions-controller.test.ts`, `tenant-permissions.test.tsx` (self-approval on the dual-role person) |
| A stale role assignment is caught | every write carries the read's `roleGeneration`; the source answers `ROLE_STALE`; a `role-stale` read clears the view | `tenant-permissions.test.ts` (role-rotated, revoke-role), the controller suite |
| UNKNOWN, NOT_BOUND, STALE, REFUSED, DENIED, and INVALID stay separate | the read and act outcome unions; a lost answer fences the session and a read does not lift the fence | all three suites |

The spec asks for a producer permission model. No permission read model or operator contract exists in this repository (`c-tenant-permissions` is pending on `kix-protocol:k-operator-contract`), so the adapter is the synthetic port. That is the one deviation from the spec text, and it is the stub scope this node was reduced to.

## The synthetic source

`packages/protocol-adapter/src/tenant-permissions.ts`. State lives in the object, so a new port is a new session. Two tenants exist: `ten-0001` the desk's own and `ten-0002` a foreign one whose rows must never be served to this desk. An actor string is a context label, not an authentication result; an assignment row is the source's own record that a person holds a role in a tenant at a generation, and the source decides scope and capability.

Seven capabilities stay separate: `read-own`, `read-tenant`, `read-audit`, `propose-account-change`, `propose-role-revoke`, `approve-change`, and `export-sensitive`. The buyer holds `read-own` only and sees its own membership and its own orders. The organizer reads the tenant's members, events, and proposals and holds `approve-change` — a checker, never a maker. The settler proposes account changes and holds `export-sensitive`. The support proposes role revokes and holds `read-audit`. No role holds them all, and the page says so in the authority table.

Every read returns a snapshot with the role's visible kinds, the rows in those kinds for the scoped tenant, the proposals, the audit entries the role may read, six non-claim fields, the assignment generation the read was taken under, and a watermark. Validation happens before a row is returned: a malformed reference, an unknown kind, state, role, or capability, a row of another tenant, an order of another subject, or any non-claim field that is not the literal `false` refuses the whole payload (`CLAIM`, `KIND`, `STATE`, `REF`, `SCOPE_LEAK`, `SUBJECT_LEAK`). The six non-claims are `uiHidingIsEnforcement`, `actorIsAuthenticated`, `exportHasRealPersonalData`, `approvalChangesResource`, `crossTenantAccess`, and `auditIsCompleteRecord`.

The audit record is the source's own log of the decisions it made on calls in the tenant — allowed, denied, rejected, refused — and only a role that holds `read-audit` receives it. It is not a complete record and the page says so.

| Scenario | What the source does |
| --- | --- |
| `clean` | Answers every read, export, and request. |
| `empty` | Lists no row for the scope. The read is `empty`. |
| `stale` | Serves a watermark older than the floor the page holds. The read is `stale`. |
| `denied` | Every assignment is revoked at the source. The read is `denied` (`ROLE_REVOKED`). |
| `tenant-mix` | Sends a member row of `ten-0002` inside this tenant's read. The whole payload is refused (`SCOPE_LEAK`). |
| `subject-mix` | Sends an order of another subject inside a buyer's own read. Refused (`SUBJECT_LEAK`). |
| `role-rotated` | The settler assignment moved a generation before the desk's first read under the older one. The read is `role-stale`. |
| `proposal-pending` | A settler's account-change proposal waits for a checker. |
| `self-approval` | A role-revoke proposal from the dual-role person waits; the same person's second role is not a different actor (`SELF_APPROVAL`). |
| `claims-enforced` | The payload claims `uiHidingIsEnforcement`. Refused whole (`CLAIM`). |
| `audit-leak` | Sends an audit entry of another tenant to a read-audit role. Refused (`SCOPE_LEAK`). |
| `read-lost` | The answer to a read never arrives. The read is `unavailable`. |
| `act-lost` | A request reaches the source and is recorded. Its answer never arrives. |
| `export-denied` | The source grants the read and no export (`EXPORT_DENIED`). |
| `export-leak` | The export carries a row of another tenant. Judged and withheld. |
| `export-claims-real` | The export declares real personal data. Refused (`CLAIM`). |
| `approve-claims-applied` | The source records an approval, then answers that the resource changed. The answer is not trusted. |

Three synthetic controls stand in for source events a real producer would cause: `revoke-role` marks an assignment revoked and bumps its generation, `rotate-role` bumps only the generation, and `apply-approved-change` lets the source apply its oldest recorded approval — the proposal becomes `applied-by-source` and the member or account row changes at the source, never at the page. The page labels each one "Simulate:".

## A proposal is a record; an approval is a record

`propose-account-change` and `propose-role-revoke` are the maker calls; `approve-proposal` is the checker call. Each maker kind needs its own capability (`propose-account-change`, `propose-role-revoke`), and every approval needs `approve-change`. The source records a proposal `pending` with the proposing actor and the role it acted as. A checker whose actor string differs records `approval-recorded`. The same person's second role is not a different actor: `person-dual` holds both the organizer and the support assignments, a proposal `person-dual` made as support is rejected when `person-dual` approves it as organizer (`SELF_APPROVAL`).

Neither record changes a resource. Every receipt states `resourceChanged` and `approvalChangesResource` as `false`; an answer that says otherwise is refused as untrusted and the request is then unknown and fences the session. The target row moves only when the source applies the change, and this page offers no apply request.

## The export

`judgeTenantExport` compares the export against the last read and nothing else. The export carries a scope declaration: provenance `synthetic`, `realPersonalData` false, `sharedOutsideTenant` false, `authorityRecord` false, and target `none`. A payload that declares anything else is refused before a row is returned, and the page prints the declaration beside every loaded export.

The export is withheld with every reason that applies: no read to judge against (`NO_SNAPSHOT`), another scope (`SCOPE`), a watermark behind the read's (`WATERMARK`), a producer-declared partial (`PARTIAL`), a row count that differs (`COUNT`), and rows that differ from the rows the read yields (`ROWS_DIFFER`) — a row of another tenant lands here too. Only a `current` verdict shows rows; a withheld export shows no row at all, because one of those rows may be the foreign row it was withheld for. The verdict is recomputed on every state read, so an export that was current turns withheld the moment the read moves on.

## The controller

`packages/protocol-adapter/src/tenant-permissions-controller.ts`. The context key is the mode, the domain, the actor string, the tenant, the role, and a session incarnation.

| Event | What the controller does |
| --- | --- |
| A read or an export that arrives for an older context | Dropped. It never touches the current view. |
| A read or an export older than a newer applied one | Dropped. |
| A read that stops being ready (stale, role-stale, denied, refused, invalid, tuple-changed, unavailable) | Rows, the assessment, the focus, and the export are cleared. Nothing stale stays on screen. |
| `switchTenant`, `switchActor`, `switchRole` | A new context at the next incarnation. The earlier role's rows and export are cleared, an answer in flight for it is dropped, and its earlier unknown outcomes are counted, not forgotten. |
| A request the read cannot support | `NOT_SENT` with the reason (`no-snapshot`, `stale-read`, `blocked`, `no-capability`, `unknown-ref`, `bad-note`). The port is never called. |
| A write under an older assignment generation | `ROLE_STALE` at the source. The write carried the generation its read saw. |
| A recorded or rejected request | The view is marked behind. The rows on screen stay the last read's until the next read. |
| A request whose answer never arrived or arrived untrusted | `UNKNOWN`. It may have been recorded, every later request in that context is fenced, and a read does not lift the fence. |
| An export that lands after the read stopped being ready | Dropped (`read-not-ready`). It has nothing to be judged against, and the view holds no row. |
| A thrown or cut-off read or export | `unavailable`. It is not sent again. |

There is no retry, no `Idempotency-Key`, no polling, and no stub fallback. A started synthetic session is the page-load equivalent of a reload.

## Screen

`apps/web/src/tenant-permissions.ts` holds the hook and the pure view builders. `apps/web/src/pages/TenantPermissionsPanels.tsx` renders them, and `apps/web/src/pages/TenantPermissions.tsx` composes the page. The sections are the banner and controls, status, who may do what, the deep-opened resource, the role workspace, proposals, the audit record, the sensitive export, requests, and the session record. The workspace lists only the kinds the role may see — a buyer sees member and order, an organizer member, event, and proposal, a settler member, account, and proposal, and support member, case, proposal, and audit. Anything else stays absent, not hidden.

Controls that are off use `aria-disabled` rather than a native `disabled`, so they stay in the keyboard order and name their reason through `aria-describedby`. When many controls share one reason — the account-change, role-revoke, and approval blocks — the page prints it once and each control points at it. A role's own membership is not a revoke target on the read, and the control says why. A note that needs attention, a read the source refused, denied, found stale or role-stale, or did not answer, and an export it refused or denied move focus to the status region through the model's `focusToken`. The scenario, actor, and role pickers apply only on their own buttons, so moving through the list with the arrow keys resets nothing. A typed reference is a direct open — the page's stand-in for a typed URL — and the source answers it on its own check. The banner prints `data-source="synthetic-tenant-permissions"` and `SYNTHETIC`. The page posts nothing and calls no `fetch`.

The hook starts a read when the page opens, one read after a tenant, actor, or role switch, and again only when the person asks. Nothing polls and nothing sets a timer.

## Contract fixture rows

The screen is registered as `tenant-permissions` in `contract-fixtures.ts` with ten synthetic rows: `stale-read` and `role-stale` as `STALE`; `tenant-mix`, `direct-open-denied`, `self-approval`, `privilege-escalation`, `export-denied`, and `export-withheld` as `REJECT` with their codes; and `write-lost` and `read-lost` as `UNKNOWN`. None owns a pass and none substitutes a stub for a failed live call. The mapping table is `docs/c-contract-fixture-library-apps-bind.md`.

## Hold

The real connection is `c-tenant-permissions`, which waits on `kix-protocol:k-operator-contract`. This node consumes no SDK, manifest, or vector and serves no producer. No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, no live marketplace, and no refund. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. Nothing on this desk grants a real permission, authenticates a person, or completes an audit.

## Browser run

Not separately recorded for this node: the page is a static React tree over the same in-process port the tests drive, the web suite renders every read state, every role workspace, the denied and refused deep-opens, the maker/checker split including the dual-role self-approval, the guarded controls and their shared reasons, the current and withheld export, and the not-bound port, and it mounts the `/permissions` route. The browser checks the spec asks for — keyboard reach of the guarded controls, the pickers that apply only on their own buttons, and the focus moves — are covered by the same `aria-disabled`/`aria-describedby`/`focusToken` mechanics the finance and delegated-assistant runs recorded; a real producer stays unverified by design for this stub scope.

## Tests

`packages/protocol-adapter/test/tenant-permissions.test.ts` covers the reference shapes, the role capability and resource tables, the gate's assignment, revocation, and scope checks, every role workspace including the buyer's own rows, every deep-open denial, the tenant and subject leaks, the refusal of every malformed or claiming payload, the export judge's reasons and scope declaration, proposals and approvals including self-approval under the second role, the role-stale write, the synthetic controls, the not-bound port, a changed tuple, every scenario, and a source scan. `packages/protocol-adapter/test/tenant-permissions-controller.test.ts` covers the context key, dropped reads and exports, a tenant, actor, and same-actor role switch that clears the view, the not-sent and not-bound refusals, the capability split, the export judged against the last read, the unknown fence that a read does not lift, and the serialisation of requests. `apps/web/test/tenant-permissions.test.tsx` covers the screen for each state, each role workspace, the authority table, the direct-open denials with no substitute row, the withheld export that shows no foreign row, the guarded controls and their shared reasons, the recorded proposal and approval with both claims false, the registry surface, the pending producer row, the fixture rows, the mounted route, and a source scan of the new web modules.
