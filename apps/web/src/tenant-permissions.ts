import { messages as sourceCopy } from "./i18n/messages/tenant-permissions";
import { sourceMessage } from "./i18n/source-message";
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

export const TENANT_PAGE_TITLE = sourceCopy.en["s1pi"];

export const TENANT_SOURCE_LINE =
  sourceCopy.en["s160"];

export const TENANT_BOUNDARY =
  sourceCopy.en["s7g"];

export const TENANT_HIDE_NOTE =
  sourceCopy.en["s2f"];

export const TENANT_CLAIM_NOTE =
  sourceCopy.en["sjj"];

export const TENANT_MAKER_NOTE =
  sourceCopy.en["so"];

export const TENANT_ROLE_NOTE =
  sourceCopy.en["s3l"];

export const TENANT_EXPORT_NOTE =
  sourceCopy.en["s1sb"];

export const TENANT_SCOPE_NOTE =
  "Every request names a tenant, an actor, and a role. A direct open of a ref outside the role's kinds or outside the tenant is denied — never empty, never substituted with a row this tenant does own.";

export const TENANT_ACTOR_NOTE =
  sourceCopy.en["s1pr"];

export const TENANT_READ_NOTE =
  sourceCopy.en["s6a"];

export const TENANT_SESSION_NOTE =
  sourceCopy.en["s1c6"];

export const TENANT_SYNTHETIC_CONTROL_NOTE =
  sourceCopy.en["s1y7"];

export const TENANT_HOLD_NOTE = sourceMessage(sourceCopy.en["p.t8"], { v1: TENANT_HOLD_NOT_BOUND.reason });

export const TENANT_NOT_COMPOSED_NOTE = sourceMessage(sourceCopy.en["p.t9"], { v1: TENANT_NOT_COMPOSED.map((entry) => entry.action).join(", ") });

export const SCENARIO_NOTES: Readonly<Record<TenantScenario, string>> = {
  clean: sourceCopy.en["sjf"],
  empty: sourceCopy.en["s1zw"],
  stale: sourceCopy.en["s21a"],
  denied: sourceCopy.en["siz"],
  "tenant-mix": sourceCopy.en["s20s"],
  "subject-mix": sourceCopy.en["s20v"],
  "role-rotated": sourceCopy.en["s1y3"],
  "proposal-pending": sourceCopy.en["s39"],
  "self-approval": sourceCopy.en["s7h"],
  "claims-enforced": sourceCopy.en["s213"],
  "audit-leak": sourceCopy.en["s20t"],
  "read-lost": sourceCopy.en["s1q3"],
  "act-lost": sourceCopy.en["s7a"],
  "export-denied": sourceCopy.en["s1zc"],
  "export-leak": sourceCopy.en["s1s3"],
  "export-claims-real": sourceCopy.en["s1s5"],
  "approve-claims-applied": sourceCopy.en["s20b"],
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
  "account-change": sourceCopy.en["sh"],
  "role-revoke": sourceCopy.en["s1hi"],
};

const PROPOSAL_STATE_WORDS: Readonly<Record<string, string>> = {
  pending: sourceCopy.en["s17p"],
  "approval-recorded": sourceCopy.en["s5u"],
  rejected: sourceCopy.en["s1ew"],
  "applied-by-source": sourceCopy.en["s5g"],
};

const MEMBER_STATE_WORDS: Readonly<Record<string, string>> = {
  active: sourceCopy.en["s10"],
  revoked: sourceCopy.en["s1h4"],
};

const ACCOUNT_STATE_WORDS: Readonly<Record<string, string>> = {
  active: sourceCopy.en["s10"],
  "changed-by-source": sourceCopy.en["sbs"],
};

const EXPORT_REASON_WORDS: Readonly<Record<string, string>> = {
  NO_SNAPSHOT: sourceCopy.en["s1wk"],
  SCOPE: sourceCopy.en["s1sg"],
  WATERMARK: sourceCopy.en["s1sr"],
  PARTIAL: sourceCopy.en["s1vg"],
  COUNT: sourceCopy.en["s1sd"],
  ROWS_DIFFER: sourceCopy.en["s1sj"],
};

const ACTION_WORDS: Readonly<Record<TenantActionKind, string>> = {
  "propose-account-change": sourceCopy.en["si"],
  "propose-role-revoke": sourceCopy.en["s1hj"],
  "approve-proposal": sourceCopy.en["s19h"],
};

const PHASE_WORDS: Readonly<Record<TenantActPhase, string>> = {
  applied: sourceCopy.en["s1du"],
  rejected: sourceCopy.en["s1ez"],
  denied: sourceCopy.en["sgb"],
  refused: sourceCopy.en["s1q6"],
  invalid: sourceCopy.en["s1eu"],
  "tuple-changed": sourceCopy.en["s11m"],
  "not-bound": sourceCopy.en["s12f"],
  unknown: sourceCopy.en["s16j"],
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
      return { statusLine: sourceCopy.en["s1bk"], detailLine: "", actionLabel: null };
    case "ready":
      return { statusLine: sourceCopy.en["s26z"], detailLine: "", actionLabel: null };
    case "empty":
      return {
        statusLine: sourceCopy.en["s1zx"],
        detailLine: detail ?? sourceCopy.en["s40"],
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "stale":
      return { statusLine: sourceCopy.en["s1lw"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    case "role-stale":
      return {
        statusLine: sourceCopy.en["s1xe"],
        detailLine: detail ?? sourceCopy.en["s1b6"],
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "denied":
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t290"], { v1: suffix }),
        detailLine: sourceMessage(sourceCopy.en["p.t291"], { v1: detail ?? "" }),
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "refused":
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t11"], { v1: suffix }),
        detailLine: sourceMessage(sourceCopy.en["p.t12"], { v1: detail ?? "" }),
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "invalid":
      return { statusLine: sourceMessage(sourceCopy.en["p.t13"], { v1: suffix }), detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    case "not-bound":
      return { statusLine: TENANT_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: sourceCopy.en["s1v8"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1m2"],
      };
    case "unavailable":
      return {
        statusLine: sourceCopy.en["s1yy"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1ax"],
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
    return { verdictWord: "current", verdictLines: [sourceCopy.en["sfa"]] };
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
      return emptyExport("none", sourceCopy.en["svf"], "");
    case "loaded": {
      const value = exported.value;
      const declaration = value?.scopeDeclaration;
      return {
        phase: "loaded",
        statusLine:
          verdict.verdictWord === "current" ? sourceCopy.en["skj"] : sourceCopy.en["skk"],
        detailLine: "",
        verdictWord: verdict.verdictWord,
        verdictLines: verdict.verdictLines,
        exportRef: value?.exportRef ?? null,
        scopeLine: declaration
          ? sourceMessage(sourceCopy.en["p.t432"], { v1: declaration.provenance, v2: String(declaration.realPersonalData), v3: String(declaration.sharedOutsideTenant), v4: String(declaration.authorityRecord), v5: declaration.target })
          : null,
        rowsLine: value ? sourceMessage(sourceCopy.en["p.t147"], { v1: value.rows.length, v2: value.declaredRowCount }) : null,
        // A withheld export shows no row at all. Its rows are not this tenant's
        // to display — one of them may be the foreign row it was withheld for.
        rows:
          verdict.verdictWord === "current"
            ? (value?.rows.map((row) => ({
                entryRef: row.entryRef,
                kindWord: row.entryKind === "member" ? sourceCopy.en["ssf"] : sourceCopy.en["sg"],
                label: row.label,
                detail: row.detail,
              })) ?? [])
            : [],
      };
    }
    case "denied":
      return emptyExport("denied", sourceMessage(sourceCopy.en["p.t433"], { v1: exported.code ?? "no code" }), exported.detail ?? "");
    case "refused":
      return emptyExport("refused", sourceMessage(sourceCopy.en["p.t150"], { v1: exported.code ?? "no code" }), exported.detail ?? "");
    case "invalid":
      return emptyExport("invalid", sourceMessage(sourceCopy.en["p.t151"], { v1: exported.code ?? "no code" }), exported.detail ?? "");
    case "not-bound":
      return emptyExport("not-bound", sourceCopy.en["s1sm"], exported.detail ?? TENANT_NOT_BOUND_REASON);
    case "tuple-changed":
      return emptyExport("tuple-changed", sourceCopy.en["s1v6"], exported.detail ?? "");
    case "unavailable":
      return emptyExport("unavailable", sourceCopy.en["s1s2"], exported.detail ?? "");
    default: {
      const exhaustive: never = exported.phase;
      return exhaustive;
    }
  }
}

function fenceText(fence: TenantFence): string {
  return fence.reason === "in-flight"
    ? sourceMessage(sourceCopy.en["p.t14"], { v1: fence.action })
    : sourceMessage(sourceCopy.en["p.t311"], { v1: fence.seq, v2: fence.action });
}

function focusModel(focus: TenantFocus | null): TenantFocusModel | null {
  if (focus === null) {
    return null;
  }
  switch (focus.kind) {
    case "member":
      return {
        kind: "member",
        title: sourceMessage(sourceCopy.en["p.t577"], { v1: focus.row.memberRef }),
        lines: [
          sourceMessage(sourceCopy.en["p.t434"], { v1: focus.row.actorRef, v2: focus.row.role, v3: focus.row.tenantId, v4: focus.row.generation, v5: focus.row.state }),
        ],
      };
    case "order":
      return {
        kind: "order",
        title: sourceMessage(sourceCopy.en["p.t578"], { v1: focus.row.orderRef }),
        lines: [sourceMessage(sourceCopy.en["p.t579"], { v1: focus.row.subjectRef, v2: focus.row.eventRef, v3: focus.row.state, v4: focus.row.label })],
      };
    case "event":
      return {
        kind: "event",
        title: sourceMessage(sourceCopy.en["p.t580"], { v1: focus.row.eventRef }),
        lines: [sourceMessage(sourceCopy.en["p.t581"], { v1: focus.row.title, v2: focus.row.tenantId, v3: focus.row.state })],
      };
    case "account":
      return {
        kind: "account",
        title: sourceMessage(sourceCopy.en["p.t582"], { v1: focus.row.accountRef }),
        lines: [sourceMessage(sourceCopy.en["p.t435"], { v1: focus.row.label, v2: focus.row.accountTail, v3: focus.row.tenantId, v4: focus.row.state })],
      };
    case "case":
      return {
        kind: "case",
        title: sourceMessage(sourceCopy.en["p.t583"], { v1: focus.row.caseRef }),
        lines: [sourceMessage(sourceCopy.en["p.t584"], { v1: focus.row.subjectRef, v2: focus.row.topic, v3: focus.row.tenantId, v4: focus.row.state })],
      };
    case "proposal":
      return {
        kind: "proposal",
        title: sourceMessage(sourceCopy.en["p.t585"], { v1: focus.row.proposalRef }),
        lines: [
          sourceMessage(sourceCopy.en["p.t436"], { v1: PROPOSAL_KIND_WORDS[focus.row.kind] ?? focus.row.kind, v2: focus.row.targetRef, v3: focus.row.proposedBy, v4: focus.row.proposedAs, v5: PROPOSAL_STATE_WORDS[focus.row.state] ?? focus.row.state, v6: String(focus.row.resourceChanged) }),
        ],
      };
    case "audit": {
      const row: TenantAuditEntry = focus.row;
      return {
        kind: "audit",
        title: sourceMessage(sourceCopy.en["p.t437"], { v1: row.auditRef }),
        lines: [sourceMessage(sourceCopy.en["p.t586"], { v1: row.seq, v2: row.actorRef, v3: row.role, v4: row.action, v5: row.targetRef ? ` on ${row.targetRef}` : "", v6: row.decision, v7: row.detail })],
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
        ? sourceCopy.en["s1tj"]
        : sourceCopy.en["s1tn"]
      : state.freshness === "STALE"
        ? sourceCopy.en["s1tm"]
        : sourceCopy.en["s1wv"];

  const capabilities = tenantCapabilities(role);
  const authority: TenantAuthorityModel[] = tenantAuthorityTable().map((row) => ({
    capability: row.capability,
    heldByLine: row.heldBy.length === 0 ? sourceCopy.en["snc"] : sourceMessage(sourceCopy.en["p.t160"], { v1: row.heldBy.join(", ") }),
    heldByRole: row.heldBy.includes(role),
  }));

  const accountEligibility = controller.canSend("propose-account-change");
  const revokeEligibility = controller.canSend("propose-role-revoke");
  const approveEligibility = controller.canSend("approve-proposal");
  const accountBlock = accountEligibility.allowed ? null : (accountEligibility.reason ?? sourceCopy.en["sj"]);
  const revokeBlock = revokeEligibility.allowed ? null : (revokeEligibility.reason ?? sourceCopy.en["s1hk"]);
  const approveBlock = approveEligibility.allowed ? null : (approveEligibility.reason ?? sourceCopy.en["s5v"]);

  const members: TenantMemberModel[] = (snapshot?.members ?? []).map((row) => {
    const target = assessment?.memberTargets.some((item) => item.memberRef === row.memberRef) ?? false;
    const reason = revokeBlock !== null ? revokeBlock : target ? null : sourceCopy.en["s1w6"];
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
    const reason = accountBlock !== null ? accountBlock : target ? null : sourceCopy.en["s1w4"];
    return {
      accountRef: row.accountRef,
      label: row.label,
      tailLine: sourceMessage(sourceCopy.en["p.t438"], { v1: row.accountTail }),
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
          ? sourceMessage(sourceCopy.en["p.t59"], { v1: row.proposalRef, v2: row.state })
          : row.proposedBy === actorRef
            ? sourceMessage(sourceCopy.en["p.t439"], { v1: row.proposalRef })
            : sourceCopy.en["s1w0"];
    } else {
      reason = null;
    }
    return {
      proposalRef: row.proposalRef,
      kindWord: PROPOSAL_KIND_WORDS[row.kind] ?? row.kind,
      targetRef: row.targetRef,
      note: row.note,
      proposedLine: sourceMessage(sourceCopy.en["p.t440"], { v1: row.proposedBy, v2: row.proposedAs }),
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
                sourceMessage(sourceCopy.en["p.t511"], { v1: last.receipt.kind, v2: last.receipt.proposalRef, v3: last.receipt.targetRef }),
                `resourceChanged ${String(last.receipt.resourceChanged)} · approvalChangesResource ${String(last.receipt.approvalChangesResource)}`,
                sourceCopy.en["s1dy"],
              ]
            : [],
        };

  const counters = state.counters;
  const session: TenantSessionModel = {
    contextLine: sourceMessage(sourceCopy.en["p.t548"], { v1: actorRef, v2: state.context.scope.tenantId, v3: role, v4: state.context.incarnation, v5: state.context.environment }),
    capabilityLine: sourceMessage(sourceCopy.en["p.t549"], { v1: role, v2: capabilities.length === 0 ? "no capability" : capabilities.join(", ") }),
    countersLine: sourceMessage(sourceCopy.en["p.t172"], { v1: counters.reads, v2: counters.exports, v3: counters.acts, v4: counters.notSent, v5: counters.droppedReads, v6: counters.droppedExports }),
    earlierUnknownLine:
      state.earlierUnknown === 0
        ? sourceCopy.en["s131"]
        : sourceMessage(sourceCopy.en["p.t173"], { v1: state.earlierUnknown, v2: state.earlierUnknown === 1 ? "" : "s" }),
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
    scopeLine: sourceMessage(sourceCopy.en["p.t319"], { v1: state.context.scope.tenantId, v2: actorRef, v3: role }),
    generationLine: snapshot
      ? sourceMessage(sourceCopy.en["p.t441"], { v1: snapshot.roleGeneration })
      : sourceCopy.en["su5"],
    watermarkLine: snapshot ? sourceMessage(sourceCopy.en["p.t41"], { v1: snapshot.watermark, v2: snapshot.snapshotId }) : sourceCopy.en["s134"],
    workspaceLine:
      visible.length === 0
        ? sourceCopy.en["s23j"]
        : sourceMessage(sourceCopy.en["p.t442"], { v1: visible.join(", ") }),
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
      ? sourceCopy.en["s78"]
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
        text: sourceMessage(sourceCopy.en["p.t443"], { v1: word }),
        attention: false,
      };
    case "REJECTED":
      return {
        text: sourceMessage(sourceCopy.en["p.t176"], { v1: word, v2: result.record.code ?? "no code", v3: result.record.detail ?? "" }).trim(),
        attention: true,
      };
    case "UNKNOWN":
      return {
        text: sourceMessage(sourceCopy.en["p.t177"], { v1: word, v2: result.record.code ?? "no code" }),
        attention: true,
      };
    case "FENCED":
      return { text: sourceMessage(sourceCopy.en["p.t45"], { v1: word, v2: fenceText(result.fence) }), attention: true };
    case "NOT_SENT":
      return { text: sourceMessage(sourceCopy.en["p.t45"], { v1: word, v2: result.detail }), attention: true };
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
      note(done ? sourceMessage(sourceCopy.en["p.t46"], { v1: moved }) : nothing, done);
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
        note(sourceCopy.en["s1b"], true);
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
          note(result.reason === "not-bound" ? TENANT_NOT_BOUND_REASON : sourceMessage(sourceCopy.en["p.t178"], { v1: result.detail }), true);
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
        note(sourceCopy.en["s73"], true);
        return;
      }
      setRole(nextRole);
      note(
        sourceMessage(sourceCopy.en["p.t444"], { v1: context.scope.role, v2: context.incarnation }),
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
        note(sourceCopy.en["s72"], true);
        return;
      }
      setActorRef(next);
      note(
        sourceMessage(sourceCopy.en["p.t445"], { v1: context.actorRef, v2: context.incarnation, v3: context.scope.role }),
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
        note(sourceCopy.en["s74"], true);
        return;
      }
      note(
        sourceMessage(sourceCopy.en["p.t446"], { v1: context.scope.tenantId, v2: context.incarnation }),
      );
      void session.controller.read();
    },
    revokeRole(memberRef) {
      synthetic(
        "revoke-role",
        memberRef,
        sourceMessage(sourceCopy.en["p.t447"], { v1: memberRef }),
        sourceCopy.en["s1ws"],
      );
    },
    rotateRole(memberRef) {
      synthetic(
        "rotate-role",
        memberRef,
        sourceMessage(sourceCopy.en["p.t448"], { v1: memberRef }),
        sourceCopy.en["s1wt"],
      );
    },
    applyApproved() {
      synthetic(
        "apply-approved-change",
        undefined,
        sourceCopy.en["s21y"],
        sourceCopy.en["s1wl"],
      );
    },
    setScenario(next) {
      startSession(next, actorRef, role, sourceMessage(sourceCopy.en["p.t181"], { v1: next }));
    },
    newSession() {
      startSession(
        scenario,
        actorRef,
        role,
        sourceCopy.en["s1m8"],
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
