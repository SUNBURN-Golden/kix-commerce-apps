import { connectivityPort, connectivityController, connectedActions } from "./connectivity/write-guard";
/**
 * The tenant permissions desk on top of the adapter's synthetic permissions
 * source. Stub scope: the default port is the synthetic source. On
 * integration-http the same port is not-bound — the contract-only catalogue has
 * no read command for an organization, a role assignment, an account, a support
 * case, an audit entry, or a sensitive export, and no command that grants or
 * revokes a permission. This module does not invent one, send a second attempt,
 * or switch adapters.
 *
 * This module decides no access. It copies what the controller and the last read
 * hold: every row is the source's own, a hidden control is never the
 * enforcement, and the port checks every request that leaves this page. A
 * proposal and an approval are records; a membership or an account changes only
 * when the source applies it.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TENANT_ACTORS,
  TENANT_HOLD_NOT_BOUND,
  TENANT_NOT_BOUND_REASON,
  TENANT_NOT_COMPOSED,
  TENANT_ORGANIZER_ACTOR,
  TENANT_ROLES,
  TENANT_SCENARIOS,
  TenantPermissionsController,
  tenantAuthorityTable,
  tenantCapabilities,
  tenantPermissionsPortFor,
  type TenantActPhase,
  type TenantActResult,
  type TenantActionKind,
  type TenantAuditEntry,
  type TenantExportPhase,
  type TenantExportState,
  type TenantExportVerdict,
  type TenantFence,
  type TenantFocus,
  type TenantPermissionsPort,
  type TenantReadState,
  type TenantRole,
  type TenantScenario,
  type TenantSyntheticControl,
} from "@kix/protocol-adapter";
import { protocol } from "./connectivity/desk-protocol";

export const TENANT_PAGE_TITLE = "Tenant permissions desk (synthetic)";

export const TENANT_SOURCE_LINE =
  "Organizations, people, role assignments, resources, proposals, the audit record, and the export come from a synthetic permissions source on this page load. They are not a producer read and not a catalogue receipt.";

export const TENANT_BOUNDARY =
  "A role decides which resource kinds a workspace lists. A buyer sees its own rows. The audit record goes to the role that holds read-audit and nobody else. Nothing here grants a real permission.";

export const TENANT_HIDE_NOTE =
  "A hidden or greyed control is not enforcement. The source checks every read, export, and request against the assignment and the capability, and this page's tests send requests straight to the port to prove a hidden control is never the check.";

export const TENANT_CLAIM_NOTE =
  "Every read states uiHidingIsEnforcement, actorIsAuthenticated, exportHasRealPersonalData, approvalChangesResource, crossTenantAccess, and auditIsCompleteRecord as false. A payload that says anything else, or stays silent, is refused before a row is shown.";

export const TENANT_MAKER_NOTE =
  "A change is a proposal, and a different actor approves it. The same person's second role is not a different actor. A proposal and an approval are records: the membership or the account changes only when the source applies it, and nothing here applies it.";

export const TENANT_ROLE_NOTE =
  "An assignment carries a generation. A role switch is a new session: the earlier role's rows and export are cleared, a late answer is dropped, and a write built under an older generation is rejected as role-stale. A revoked assignment denies every call.";

export const TENANT_EXPORT_NOTE =
  "The export is the synthetic source's own sensitive file. It declares itself synthetic, holding no real personal data, not shared outside the tenant, and not an authority record. It is current only when it is one complete export of the very rows the last read saw. Anything else is withheld with every reason, and this page does not repair it.";

export const TENANT_SCOPE_NOTE =
  "Every request names a tenant, an actor, and a role. A direct open of a ref outside the role's kinds or outside the tenant is denied — never empty, never substituted with a row this tenant does own.";

export const TENANT_ACTOR_NOTE =
  "The actor and role strings are context labels. They are not an authentication result, and the source does not trust them for access.";

export const TENANT_READ_NOTE =
  "A read, an export, and a request are each one attempt. None is sent again by this page. An answer that arrives after the tenant, the actor, or the role changed is dropped. An answer that never arrives leaves the outcome unknown.";

export const TENANT_SESSION_NOTE =
  "Reads, exports, and requests live in this page load only. A reload or a new synthetic session clears them and resolves nothing at a producer.";

export const TENANT_SYNTHETIC_CONTROL_NOTE =
  "The Simulate controls are synthetic controls a real producer does not offer. They stand in for a revoked assignment, a rotated generation, and the source applying an approved change. Approving a proposal is not one of them.";

export const TENANT_HOLD_NOTE = `Holding a seat is not available here. ${TENANT_HOLD_NOT_BOUND.reason}`;

export const TENANT_NOT_COMPOSED_NOTE = `Catalogue actions recorded and never composed here: ${TENANT_NOT_COMPOSED.map((entry) => entry.action).join(", ")}.`;

export const SCENARIO_NOTES: Readonly<Record<TenantScenario, string>> = {
  clean: "Every read, export, and request is answered.",
  empty: "The source lists no row for this scope.",
  stale: "The source serves a watermark older than the floor this page holds.",
  denied: "Every assignment is revoked at the source.",
  "tenant-mix": "The source sends a member row that belongs to another tenant. The payload is refused.",
  "subject-mix": "The source sends an order that belongs to another subject. The payload is refused.",
  "role-rotated": "The settler assignment already moved a generation at the source. A write under the old one is rejected.",
  "proposal-pending": "An account-change proposal from the settler waits for the organizer.",
  "self-approval": "A role-revoke proposal waits, proposed by the dual-role person. The same person may not approve it under the other role.",
  "claims-enforced": "The source sends a payload that claims hidden controls enforce access. The payload is refused.",
  "audit-leak": "The source sends an audit entry of another tenant. The payload is refused.",
  "read-lost": "The answer to a read never arrives.",
  "act-lost": "A request reaches the source and is recorded. Its answer never arrives.",
  "export-denied": "The source grants the read and no export.",
  "export-leak": "The export carries a row of another tenant. It is judged against the last read and withheld.",
  "export-claims-real": "The export declares real personal data. The payload is refused.",
  "approve-claims-applied": "The source records an approval, then answers that the resource changed. The answer is not trusted.",
};

export type TenantScreenState =
  | "loading"
  | "ready"
  | "empty"
  | "stale"
  | "role-stale"
  | "denied"
  | "refused"
  | "invalid"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export interface ControlModel {
  enabled: boolean;
  reason: string | null;
}

export interface TenantMemberModel {
  memberRef: string;
  actorRef: string;
  role: string;
  generation: number;
  state: string;
  stateWord: string;
  /** The role-revoke control. Off with a reason when the read offers none. */
  proposeRevoke: ControlModel | null;
}

export interface TenantOrderModel {
  orderRef: string;
  subjectRef: string;
  eventRef: string;
  state: string;
  label: string;
}

export interface TenantEventModel {
  eventRef: string;
  title: string;
  state: string;
}

export interface TenantAccountModel {
  accountRef: string;
  label: string;
  /** Synthetic tail text, copied. Not a real account number. */
  tailLine: string;
  state: string;
  stateWord: string;
  proposeChange: ControlModel | null;
}

export interface TenantCaseModel {
  caseRef: string;
  subjectRef: string;
  topic: string;
  state: string;
}

export interface TenantProposalModel {
  proposalRef: string;
  kindWord: string;
  targetRef: string;
  note: string;
  proposedLine: string;
  state: string;
  stateWord: string;
  approve: ControlModel;
}

export interface TenantAuditModel {
  auditRef: string;
  seq: number;
  actorRef: string;
  role: string;
  action: string;
  targetRef: string | null;
  decision: string;
  detail: string;
}

export interface TenantAuthorityModel {
  capability: string;
  heldByLine: string;
  heldByRole: boolean;
}

export interface TenantFocusModel {
  kind: string;
  title: string;
  lines: string[];
}

export interface TenantExportRowModel {
  entryRef: string;
  kindWord: string;
  label: string;
  detail: string;
}

export interface TenantExportModel {
  phase: TenantExportPhase;
  statusLine: string;
  detailLine: string;
  verdictWord: "current" | "withheld" | "none";
  verdictLines: string[];
  exportRef: string | null;
  scopeLine: string | null;
  rowsLine: string | null;
  rows: TenantExportRowModel[];
}

export interface TenantRequestRecordModel {
  seq: number;
  kindWord: string;
  phase: TenantActPhase;
  phaseWord: string;
  code: string | null;
  detail: string | null;
  receiptLines: string[];
}

export interface TenantSessionModel {
  contextLine: string;
  capabilityLine: string;
  countersLine: string;
  earlierUnknownLine: string;
  notComposedLine: string;
  holdLine: string;
}

export type TenantLastAction = { seq: number; text: string; attention: boolean };

export interface TenantModel {
  state: TenantScreenState;
  statusLine: string;
  detailLine: string;
  actionLabel: string | null;
  freshnessWord: string;
  scopeLine: string;
  generationLine: string;
  watermarkLine: string;
  workspaceLine: string;
  authority: TenantAuthorityModel[];
  focus: TenantFocusModel | null;
  members: TenantMemberModel[];
  orders: TenantOrderModel[];
  events: TenantEventModel[];
  accounts: TenantAccountModel[];
  cases: TenantCaseModel[];
  proposals: TenantProposalModel[];
  audit: TenantAuditModel[];
  export: TenantExportModel;
  exportControl: ControlModel;
  accountBlock: string | null;
  revokeBlock: string | null;
  approveBlock: string | null;
  request: TenantRequestRecordModel | null;
  fenceLine: string | null;
  behindLine: string | null;
  session: TenantSessionModel;
  lastLine: string | null;
  lastNeedsFocus: boolean;
  lastSeq: number | null;
  focusToken: string | null;
}

const PROPOSAL_KIND_WORDS: Readonly<Record<string, string>> = {
  "account-change": "Account change",
  "role-revoke": "Role revoke",
};

const PROPOSAL_STATE_WORDS: Readonly<Record<string, string>> = {
  pending: "Pending",
  "approval-recorded": "Approval recorded, nothing changed",
  rejected: "Rejected",
  "applied-by-source": "Applied by the source",
};

const MEMBER_STATE_WORDS: Readonly<Record<string, string>> = {
  active: "Active",
  revoked: "Revoked at the source",
};

const ACCOUNT_STATE_WORDS: Readonly<Record<string, string>> = {
  active: "Active",
  "changed-by-source": "Changed by the source",
};

const EXPORT_REASON_WORDS: Readonly<Record<string, string>> = {
  NO_SNAPSHOT: "there is no read to judge it against",
  SCOPE: "the export names another tenant or role",
  WATERMARK: "the export was taken before the read this page holds",
  PARTIAL: "the producer says the export was cut off",
  COUNT: "the export lists a different number of rows than the read yields",
  ROWS_DIFFER: "the export rows differ from the rows the read yields",
};

const ACTION_WORDS: Readonly<Record<TenantActionKind, string>> = {
  "propose-account-change": "Account-change proposal",
  "propose-role-revoke": "Role-revoke proposal",
  "approve-proposal": "Proposal approval",
};

const PHASE_WORDS: Readonly<Record<TenantActPhase, string>> = {
  applied: "Recorded at the synthetic source",
  rejected: "Rejected by the source",
  denied: "Denied by the source",
  refused: "The answer was not trusted, and the request may have been recorded",
  invalid: "Refused before it was recorded",
  "tuple-changed": "Nothing was recorded because the pin tuple changed",
  "not-bound": "Not recorded: not bound",
  unknown: "Outcome unknown. The request may have been recorded",
};

function readStateToScreen(readState: TenantReadState): TenantScreenState {
  switch (readState) {
    case "none":
      return "loading";
    case "ready":
      return "ready";
    case "empty":
      return "empty";
    case "stale":
      return "stale";
    case "role-stale":
      return "role-stale";
    case "denied":
      return "denied";
    case "refused":
      return "refused";
    case "invalid":
      return "invalid";
    case "not-bound":
      return "not-bound";
    case "tuple-changed":
      return "tuple-changed";
    case "unavailable":
      return "unavailable";
    default: {
      const exhaustive: never = readState;
      return exhaustive;
    }
  }
}

function statusFor(
  state: TenantScreenState,
  code: string | null,
  detail: string | null,
): { statusLine: string; detailLine: string; actionLabel: string | null } {
  const suffix = code ? ` (${code})` : "";
  switch (state) {
    case "loading":
      return { statusLine: "Reading the synthetic permissions source. Nothing is shown yet.", detailLine: "", actionLabel: null };
    case "ready":
      return { statusLine: "Workspace read.", detailLine: "", actionLabel: null };
    case "empty":
      return {
        statusLine: "The source lists no row for this scope in this read.",
        detailLine: detail ?? "An empty workspace is not denied and not unknown.",
        actionLabel: "Read again",
      };
    case "stale":
      return { statusLine: "Stale read.", detailLine: detail ?? "", actionLabel: "Read again" };
    case "role-stale":
      return {
        statusLine: "The role assignment moved underneath this view.",
        detailLine: detail ?? "Read again under the current assignment.",
        actionLabel: "Read again",
      };
    case "denied":
      return {
        statusLine: `The source denied this call${suffix}.`,
        detailLine: `${detail ?? ""} No row is shown, and a hidden control was not what denied it.`,
        actionLabel: "Read again",
      };
    case "refused":
      return {
        statusLine: `The source sent a payload this page does not trust${suffix}.`,
        detailLine: `${detail ?? ""} No row from it is shown.`,
        actionLabel: "Read again",
      };
    case "invalid":
      return { statusLine: `The request was refused before it read${suffix}.`, detailLine: detail ?? "", actionLabel: "Read again" };
    case "not-bound":
      return { statusLine: TENANT_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: "The pin tuple changed. Nothing was read and nothing was applied.",
        detailLine: detail ?? "",
        actionLabel: "Start a new synthetic session",
      };
    case "unavailable":
      return {
        statusLine: "The source did not answer. This is not an empty workspace.",
        detailLine: detail ?? "",
        actionLabel: "Read again",
      };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function verdictModel(verdict: TenantExportVerdict | null): {
  verdictWord: TenantExportModel["verdictWord"];
  verdictLines: string[];
} {
  if (verdict === null) {
    return { verdictWord: "none", verdictLines: [] };
  }
  if (verdict.current) {
    return { verdictWord: "current", verdictLines: ["Current export for the last read."] };
  }
  return {
    verdictWord: "withheld",
    verdictLines: verdict.reasons.map((reason) => `${reason}: ${EXPORT_REASON_WORDS[reason] ?? reason}.`),
  };
}

function emptyExport(phase: TenantExportPhase, statusLine: string, detailLine: string): TenantExportModel {
  return {
    phase,
    statusLine,
    detailLine,
    verdictWord: "none",
    verdictLines: [],
    exportRef: null,
    scopeLine: null,
    rowsLine: null,
    rows: [],
  };
}

function exportModel(exported: TenantExportState): TenantExportModel {
  const verdict = verdictModel(exported.verdict);
  switch (exported.phase) {
    case "none":
      return emptyExport("none", "No export is loaded. An export is requested only after a ready read.", "");
    case "loaded": {
      const value = exported.value;
      const declaration = value?.scopeDeclaration;
      return {
        phase: "loaded",
        statusLine:
          verdict.verdictWord === "current" ? "Export loaded and current for the last read." : "Export loaded. It is not the current export.",
        detailLine: "",
        verdictWord: verdict.verdictWord,
        verdictLines: verdict.verdictLines,
        exportRef: value?.exportRef ?? null,
        scopeLine: declaration
          ? `SYNTHETIC export. provenance ${declaration.provenance} · realPersonalData ${String(declaration.realPersonalData)} · sharedOutsideTenant ${String(declaration.sharedOutsideTenant)} · authorityRecord ${String(declaration.authorityRecord)} · target ${declaration.target}.`
          : null,
        rowsLine: value ? `${value.rows.length} rows of ${value.declaredRowCount} declared.` : null,
        // A withheld export shows no row at all. Its rows are not this tenant's
        // to display — one of them may be the foreign row it was withheld for.
        rows:
          verdict.verdictWord === "current"
            ? (value?.rows.map((row) => ({
                entryRef: row.entryRef,
                kindWord: row.entryKind === "member" ? "Member" : "Account",
                label: row.label,
                detail: row.detail,
              })) ?? [])
            : [],
      };
    }
    case "denied":
      return emptyExport("denied", `The source denied the export (${exported.code ?? "no code"}).`, exported.detail ?? "");
    case "refused":
      return emptyExport("refused", `The export payload was refused (${exported.code ?? "no code"}).`, exported.detail ?? "");
    case "invalid":
      return emptyExport("invalid", `The export request was refused (${exported.code ?? "no code"}).`, exported.detail ?? "");
    case "not-bound":
      return emptyExport("not-bound", "The export stays not-bound.", exported.detail ?? TENANT_NOT_BOUND_REASON);
    case "tuple-changed":
      return emptyExport("tuple-changed", "The pin tuple changed. No export was applied.", exported.detail ?? "");
    case "unavailable":
      return emptyExport("unavailable", "The export answer did not arrive.", exported.detail ?? "");
    default: {
      const exhaustive: never = exported.phase;
      return exhaustive;
    }
  }
}

function fenceText(fence: TenantFence): string {
  return fence.reason === "in-flight"
    ? `A ${fence.action} request is in flight. One request goes at a time.`
    : `Request ${fence.seq} (${fence.action}) has an unknown outcome and may have been recorded. Nothing is sent again from here, and a read does not resolve it. Switching the tenant, the actor, or the role, or starting a new synthetic session, begins a new context and counts this unknown outcome.`;
}

function focusModel(focus: TenantFocus | null): TenantFocusModel | null {
  if (focus === null) {
    return null;
  }
  switch (focus.kind) {
    case "member":
      return {
        kind: "member",
        title: `Membership ${focus.row.memberRef}`,
        lines: [
          `Person ${focus.row.actorRef} holds role ${focus.row.role} in tenant ${focus.row.tenantId}, generation ${focus.row.generation}, ${focus.row.state}.`,
        ],
      };
    case "order":
      return {
        kind: "order",
        title: `Order ${focus.row.orderRef}`,
        lines: [`Subject ${focus.row.subjectRef}. Event ${focus.row.eventRef}. ${focus.row.state}. ${focus.row.label}`],
      };
    case "event":
      return {
        kind: "event",
        title: `Event ${focus.row.eventRef}`,
        lines: [`${focus.row.title}. Tenant ${focus.row.tenantId}. ${focus.row.state}.`],
      };
    case "account":
      return {
        kind: "account",
        title: `Account ${focus.row.accountRef}`,
        lines: [`${focus.row.label}. Synthetic tail ${focus.row.accountTail}. Tenant ${focus.row.tenantId}. ${focus.row.state}.`],
      };
    case "case":
      return {
        kind: "case",
        title: `Case ${focus.row.caseRef}`,
        lines: [`Subject ${focus.row.subjectRef}. ${focus.row.topic}. Tenant ${focus.row.tenantId}. ${focus.row.state}.`],
      };
    case "proposal":
      return {
        kind: "proposal",
        title: `Proposal ${focus.row.proposalRef}`,
        lines: [
          `${PROPOSAL_KIND_WORDS[focus.row.kind] ?? focus.row.kind} on ${focus.row.targetRef}. Proposed by ${focus.row.proposedBy} as ${focus.row.proposedAs}. ${PROPOSAL_STATE_WORDS[focus.row.state] ?? focus.row.state}. resourceChanged ${String(focus.row.resourceChanged)}.`,
        ],
      };
    case "audit": {
      const row: TenantAuditEntry = focus.row;
      return {
        kind: "audit",
        title: `Audit entry ${row.auditRef}`,
        lines: [`Seq ${row.seq}. ${row.actorRef} as ${row.role} called ${row.action}${row.targetRef ? ` on ${row.targetRef}` : ""}: ${row.decision}. ${row.detail}`],
      };
    }
    default: {
      const exhaustive: never = focus;
      return exhaustive;
    }
  }
}

export function buildTenantModel(input: { controller: TenantPermissionsController; last: TenantLastAction | null }): TenantModel {
  const { controller } = input;
  const state = controller.state();
  const screen = readStateToScreen(state.readState);
  const status = statusFor(screen, state.readCode, state.readDetail);
  const snapshot = state.snapshot;
  const assessment = state.assessment;
  const role = state.context.scope.role;
  const actorRef = state.context.actorRef;

  const freshnessWord =
    state.freshness === "CURRENT"
      ? state.behind
        ? "The last read is behind a request that reached the source. Read again."
        : "The last read is current."
      : state.freshness === "STALE"
        ? "The last read is behind the assignment or the watermark."
        : "There is no usable read.";

  const capabilities = tenantCapabilities(role);
  const authority: TenantAuthorityModel[] = tenantAuthorityTable().map((row) => ({
    capability: row.capability,
    heldByLine: row.heldBy.length === 0 ? "Held by no role on this desk." : `Held by ${row.heldBy.join(", ")}.`,
    heldByRole: row.heldBy.includes(role),
  }));

  const accountEligibility = controller.canSend("propose-account-change");
  const revokeEligibility = controller.canSend("propose-role-revoke");
  const approveEligibility = controller.canSend("approve-proposal");
  const accountBlock = accountEligibility.allowed ? null : (accountEligibility.reason ?? "Account changes are not on offer.");
  const revokeBlock = revokeEligibility.allowed ? null : (revokeEligibility.reason ?? "Role revokes are not on offer.");
  const approveBlock = approveEligibility.allowed ? null : (approveEligibility.reason ?? "Approvals are not on offer.");

  const members: TenantMemberModel[] = (snapshot?.members ?? []).map((row) => {
    const target = assessment?.memberTargets.some((item) => item.memberRef === row.memberRef) ?? false;
    const reason = revokeBlock !== null ? revokeBlock : target ? null : "The read offers no role-revoke on this membership.";
    return {
      memberRef: row.memberRef,
      actorRef: row.actorRef,
      role: row.role,
      generation: row.generation,
      state: row.state,
      stateWord: MEMBER_STATE_WORDS[row.state] ?? row.state,
      proposeRevoke: capabilities.includes("propose-role-revoke") ? { enabled: reason === null, reason } : null,
    };
  });

  const orders: TenantOrderModel[] = (snapshot?.orders ?? []).map((row) => ({
    orderRef: row.orderRef,
    subjectRef: row.subjectRef,
    eventRef: row.eventRef,
    state: row.state,
    label: row.label,
  }));

  const events: TenantEventModel[] = (snapshot?.events ?? []).map((row) => ({
    eventRef: row.eventRef,
    title: row.title,
    state: row.state,
  }));

  const accounts: TenantAccountModel[] = (snapshot?.accounts ?? []).map((row) => {
    const target = assessment?.accountTargets.some((item) => item.accountRef === row.accountRef) ?? false;
    const reason = accountBlock !== null ? accountBlock : target ? null : "The read offers no account change on this account.";
    return {
      accountRef: row.accountRef,
      label: row.label,
      tailLine: `Synthetic tail ${row.accountTail}. Not a real account number.`,
      state: row.state,
      stateWord: ACCOUNT_STATE_WORDS[row.state] ?? row.state,
      proposeChange: capabilities.includes("propose-account-change") ? { enabled: reason === null, reason } : null,
    };
  });

  const cases: TenantCaseModel[] = (snapshot?.cases ?? []).map((row) => ({
    caseRef: row.caseRef,
    subjectRef: row.subjectRef,
    topic: row.topic,
    state: row.state,
  }));

  const proposals: TenantProposalModel[] = (snapshot?.proposals ?? []).map((row) => {
    const approvable = assessment?.approvable.some((item) => item.proposalRef === row.proposalRef) ?? false;
    let reason: string | null;
    if (approveBlock !== null) {
      reason = approveBlock;
    } else if (!approvable) {
      reason =
        row.state !== "pending"
          ? `Proposal ${row.proposalRef} is ${row.state}. A proposal is approved only while it is pending.`
          : row.proposedBy === actorRef
            ? `Proposal ${row.proposalRef} was proposed by this actor. A different actor approves it.`
            : "The read does not offer an approval on this proposal.";
    } else {
      reason = null;
    }
    return {
      proposalRef: row.proposalRef,
      kindWord: PROPOSAL_KIND_WORDS[row.kind] ?? row.kind,
      targetRef: row.targetRef,
      note: row.note,
      proposedLine: `Proposed by ${row.proposedBy} as ${row.proposedAs}.`,
      state: row.state,
      stateWord: PROPOSAL_STATE_WORDS[row.state] ?? row.state,
      approve: { enabled: reason === null, reason },
    };
  });

  const audit: TenantAuditModel[] = (snapshot?.audit ?? []).map((row) => ({
    auditRef: row.auditRef,
    seq: row.seq,
    actorRef: row.actorRef,
    role: row.role,
    action: row.action,
    targetRef: row.targetRef,
    decision: row.decision,
    detail: row.detail,
  }));

  const exportEligibility = controller.canExport();
  const exportControl: ControlModel = exportEligibility.allowed
    ? { enabled: true, reason: null }
    : { enabled: false, reason: exportEligibility.reason };

  const last = state.last;
  const request: TenantRequestRecordModel | null =
    last === null
      ? null
      : {
          seq: last.seq,
          kindWord: ACTION_WORDS[last.action.kind],
          phase: last.phase,
          phaseWord: PHASE_WORDS[last.phase],
          code: last.code,
          detail: last.detail,
          receiptLines: last.receipt
            ? [
                `Receipt ${last.receipt.kind} for ${last.receipt.proposalRef} on ${last.receipt.targetRef}.`,
                `resourceChanged ${String(last.receipt.resourceChanged)} · approvalChangesResource ${String(last.receipt.approvalChangesResource)}`,
                "Recorded is not applied. The rows above change only when the source applies the change and this page reads again.",
              ]
            : [],
        };

  const counters = state.counters;
  const session: TenantSessionModel = {
    contextLine: `Actor ${actorRef}, tenant ${state.context.scope.tenantId}, role ${role}, session ${state.context.incarnation}, mode ${state.context.environment}.`,
    capabilityLine: `Role ${role} holds: ${capabilities.length === 0 ? "no capability" : capabilities.join(", ")}.`,
    countersLine: `Reads ${counters.reads}. Exports ${counters.exports}. Requests ${counters.acts}. Not sent ${counters.notSent}. Reads dropped ${counters.droppedReads}. Exports dropped ${counters.droppedExports}.`,
    earlierUnknownLine:
      state.earlierUnknown === 0
        ? "No unknown request outcome in earlier sessions."
        : `${state.earlierUnknown} unknown request outcome${state.earlierUnknown === 1 ? "" : "s"} in earlier sessions. They are counted, not forgotten.`,
    notComposedLine: TENANT_NOT_COMPOSED_NOTE,
    holdLine: TENANT_HOLD_NOTE,
  };

  const visible = snapshot?.visibleKinds ?? [];
  return {
    state: screen,
    statusLine: status.statusLine,
    detailLine: status.detailLine,
    actionLabel: status.actionLabel,
    freshnessWord,
    scopeLine: `Tenant ${state.context.scope.tenantId}. Actor ${actorRef} acting as ${role}.`,
    generationLine: snapshot
      ? `Assignment generation ${snapshot.roleGeneration} as of this read. A write built under an older one is rejected as role-stale.`
      : "No assignment generation without a ready read.",
    watermarkLine: snapshot ? `Watermark ${snapshot.watermark}. Read ${snapshot.snapshotId} on this port.` : "No watermark without a ready read.",
    workspaceLine:
      visible.length === 0
        ? "This role's workspace lists no resource kind."
        : `This role's workspace lists: ${visible.join(", ")}. Anything else stays absent, not hidden.`,
    authority,
    focus: focusModel(snapshot?.focus ?? null),
    members,
    orders,
    events,
    accounts,
    cases,
    proposals,
    audit,
    export: exportModel(state.export),
    exportControl,
    accountBlock,
    revokeBlock,
    approveBlock,
    request,
    fenceLine: state.fence === null ? null : fenceText(state.fence),
    behindLine: state.behind
      ? "A request reached the source after the last read. The rows on screen are the last read's. Read again to see the proposals."
      : null,
    session,
    lastLine: input.last === null ? null : input.last.text,
    lastNeedsFocus: input.last?.attention ?? false,
    lastSeq: input.last === null ? null : input.last.seq,
    focusToken: focusTokenFor(input.last, screen, state.counters, state.export.phase),
  };
}

const NOTICE_READ_STATES: readonly TenantScreenState[] = ["stale", "role-stale", "denied", "refused", "invalid", "tuple-changed", "unavailable"];
const NOTICE_EXPORT_PHASES: readonly TenantExportPhase[] = ["denied", "refused", "invalid", "tuple-changed", "unavailable"];

function focusTokenFor(
  last: TenantLastAction | null,
  screen: TenantScreenState,
  counters: { reads: number; exports: number },
  exportPhase: TenantExportPhase,
): string | null {
  if (last?.attention) {
    return `note-${last.seq}`;
  }
  if (NOTICE_READ_STATES.includes(screen)) {
    return `read-${screen}-${counters.reads}`;
  }
  if (NOTICE_EXPORT_PHASES.includes(exportPhase)) {
    return `export-${exportPhase}-${counters.exports}`;
  }
  return null;
}

function actResultLine(kind: TenantActionKind, result: TenantActResult): { text: string; attention: boolean } {
  const word = ACTION_WORDS[kind];
  switch (result.kind) {
    case "APPLIED":
      return {
        text: `${word} recorded at the synthetic source. Nothing was applied: no membership and no account changed. Read again to see it.`,
        attention: false,
      };
    case "REJECTED":
      return {
        text: `${word} rejected (${result.record.code ?? "no code"}). ${result.record.detail ?? ""} The source recorded nothing for this request.`.trim(),
        attention: true,
      };
    case "UNKNOWN":
      return {
        text: `${word} outcome unknown (${result.record.code ?? "no code"}). It may have been recorded. Every later request is fenced, and a read does not resolve it.`,
        attention: true,
      };
    case "FENCED":
      return { text: `${word} not sent. ${fenceText(result.fence)}`, attention: true };
    case "NOT_SENT":
      return { text: `${word} not sent. ${result.detail}`, attention: true };
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

export interface TenantActions {
  refresh(): void;
  openResource(ref: string): void;
  loadExport(): void;
  proposeAccountChange(accountRef: string, note: string): void;
  proposeRoleRevoke(memberRef: string, note: string): void;
  approveProposal(proposalRef: string): void;
  switchRole(role: TenantRole): void;
  switchActor(actor: string): void;
  switchTenant(): void;
  revokeRole(memberRef: string): void;
  rotateRole(memberRef: string): void;
  applyApproved(): void;
  setScenario(next: TenantScenario): void;
  newSession(): void;
}

interface Session {
  port: TenantPermissionsPort;
  controller: TenantPermissionsController;
}

function createSession(
  environment: "stub" | "integration-http",
  scenario: TenantScenario,
  actorRef: string,
  role: TenantRole,
): Session {
  const port = connectivityPort(tenantPermissionsPortFor(environment, { scenario }), "tenant-permissions");
  return { port, controller: connectivityController(new TenantPermissionsController(port, { actorRef, role }), port) };
}

export function useTenantPermissions(): {
  environment: "stub" | "integration-http";
  scenario: TenantScenario;
  actorRef: string;
  role: TenantRole;
  model: TenantModel;
  actions: TenantActions;
} {
  const environment = protocol.describe().environment;
  const sessionRef = useRef<Session | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createSession(environment, "clean", TENANT_ORGANIZER_ACTOR, "organizer");
  }
  const [scenario, setScenarioState] = useState<TenantScenario>("clean");
  const [actorRef, setActorRef] = useState<string>(TENANT_ORGANIZER_ACTOR);
  const [role, setRole] = useState<TenantRole>("organizer");
  const [epoch, setEpoch] = useState(0);
  const [, setTick] = useState(0);
  const [last, setLast] = useState<TenantLastAction | null>(null);
  const actionSeq = useRef(0);

  useEffect(() => {
    const session = sessionRef.current;
    if (session === null) {
      return undefined;
    }
    const off = session.controller.subscribe(() => setTick((value) => value + 1));
    void session.controller.read();
    return off;
  }, [epoch]);

  const note = useCallback((text: string, attention = false) => {
    actionSeq.current += 1;
    setLast({ seq: actionSeq.current, text, attention });
  }, []);

  const startSession = useCallback(
    (next: TenantScenario, actor: string, nextRole: TenantRole, text: string) => {
      sessionRef.current = createSession(environment, next, actor, nextRole);
      setScenarioState(next);
      setEpoch((value) => value + 1);
      note(text);
    },
    [environment, note],
  );

  const run = useCallback(
    (kind: TenantActionKind, send: () => Promise<TenantActResult>) => {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      void send().then((result) => {
        if (sessionRef.current !== session) {
          return;
        }
        const line = actResultLine(kind, result);
        note(line.text, line.attention);
      });
    },
    [note],
  );

  const synthetic = useCallback(
    (control: TenantSyntheticControl, ref: string | undefined, moved: string, nothing: string) => {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const done = session.port.synthetic(control, ref);
      note(done ? `${moved} A real producer offers no such control. Read again.` : nothing, done);
    },
    [note],
  );

  const actions: TenantActions = {
    refresh() {
      void sessionRef.current?.controller.read();
    },
    openResource(ref) {
      const text = ref.trim();
      if (text.length === 0) {
        note("A deep-open names a resource reference copied from a row or a URL. It is never guessed.", true);
        return;
      }
      void sessionRef.current?.controller.read(text);
    },
    loadExport() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      void session.controller.loadExport().then((result) => {
        if (sessionRef.current !== session) {
          return;
        }
        if (result.kind === "NOT_SENT") {
          note(result.reason === "not-bound" ? TENANT_NOT_BOUND_REASON : `No export was sent. ${result.detail}`, true);
        }
      });
    },
    proposeAccountChange(accountRef, noteText) {
      const session = sessionRef.current;
      if (session !== null) {
        run("propose-account-change", () => session.controller.proposeAccountChange(accountRef, noteText));
      }
    },
    proposeRoleRevoke(memberRef, noteText) {
      const session = sessionRef.current;
      if (session !== null) {
        run("propose-role-revoke", () => session.controller.proposeRoleRevoke(memberRef, noteText));
      }
    },
    approveProposal(proposalRef) {
      const session = sessionRef.current;
      if (session !== null) {
        run("approve-proposal", () => session.controller.approveProposal(proposalRef));
      }
    },
    switchRole(nextRole) {
      const session = sessionRef.current;
      if (session === null || !(TENANT_ROLES as readonly string[]).includes(nextRole)) {
        return;
      }
      const context = session.controller.switchRole(nextRole);
      if (context === null) {
        note("A request is in flight. The role cannot change under it.", true);
        return;
      }
      setRole(nextRole);
      note(
        `Switched the same actor to role ${context.scope.role}, session ${context.incarnation}. The earlier role's rows and export are cleared, a late answer is dropped, and proposals it offered are fenced off. One read for the new role was asked for.`,
      );
      void session.controller.read();
    },
    switchActor(next) {
      const session = sessionRef.current;
      if (session === null || !(TENANT_ACTORS as readonly string[]).includes(next)) {
        return;
      }
      const context = session.controller.switchActor(next);
      if (context === null) {
        note("A request is in flight. The actor cannot change under it.", true);
        return;
      }
      setActorRef(next);
      note(
        `Switched the desk actor to ${context.actorRef}, session ${context.incarnation}, still acting as ${context.scope.role}. The source decides whether that assignment exists. Rows and the export are cleared, and an answer in flight is dropped. One read was asked for.`,
      );
      void session.controller.read();
    },
    switchTenant() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const nextTenant = session.controller.state().context.scope.tenantId === "ten-0001" ? "ten-0002" : "ten-0001";
      const context = session.controller.switchTenant(nextTenant);
      if (context === null) {
        note("A request is in flight. The tenant cannot change under it.", true);
        return;
      }
      note(
        `Switched the tenant to ${context.scope.tenantId}, session ${context.incarnation}. Rows and the export of the earlier tenant are cleared, and an answer in flight for it is dropped. One read for the new tenant was asked for.`,
      );
      void session.controller.read();
    },
    revokeRole(memberRef) {
      synthetic(
        "revoke-role",
        memberRef,
        `The synthetic assignment ${memberRef} is withdrawn at the source. Its next call is denied.`,
        "There is no synthetic source to withdraw an assignment from, or that membership is already revoked.",
      );
    },
    rotateRole(memberRef) {
      synthetic(
        "rotate-role",
        memberRef,
        `The synthetic assignment ${memberRef} moved a generation at the source. A write built under the old one is rejected.`,
        "There is no synthetic source to rotate, or that membership is already revoked.",
      );
    },
    applyApproved() {
      synthetic(
        "apply-approved-change",
        undefined,
        "The synthetic source applied its oldest recorded approval. No approval chose to apply it; the source did.",
        "There is no recorded approval for the source to apply.",
      );
    },
    setScenario(next) {
      startSession(next, actorRef, role, `Started a new synthetic session with scenario ${next}. Earlier reads, exports, and requests are gone, as after a reload.`);
    },
    newSession() {
      startSession(
        scenario,
        actorRef,
        role,
        "Started a new synthetic session. Earlier reads, exports, and requests are gone, as after a reload. Nothing was resolved at a producer.",
      );
    },
  };

  const session = sessionRef.current;
  return {
    environment,
    scenario,
    actorRef,
    role,
    model: buildTenantModel({ controller: session.controller, last }),
    actions: connectedActions(actions, ['openResource', 'proposeAccountChange', 'proposeRoleRevoke', 'approveProposal', 'revokeRole', 'rotateRole', 'applyApproved', 'setScenario', 'newSession'], sessionRef.current?.port),
  };
}

export { TENANT_ACTORS, TENANT_ROLES, TENANT_SCENARIOS };
