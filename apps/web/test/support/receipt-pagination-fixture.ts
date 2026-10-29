import { PINNED_PROTOCOL_DOMAIN } from "@kix/protocol-adapter";
import { buildReceiptExplorer, profileFor, ROLE_CONTEXTS, type ReceiptExplorerInput, type ReceiptContext } from "../../src/receipt-explorer";
import type { WorkspaceRole } from "../../src/workspace/registry";

export const FIXTURE_SESSION = "sess-pagination";
const contexts = ["journey", "gift", "consent", "organizer"] as const;
const states = ["confirmed", "unknown", "rejected", "stale", "not-bound"] as const;

export function receiptCandidate(index: number, overrides: Record<string, unknown> = {}) {
  const context: ReceiptContext = contexts[Math.floor(index / 1250) % 4]!;
  const role = context === "organizer" ? "organizer" : "buyer";
  const paired = profileFor("stub-shape");
  return {
    sessionId: FIXTURE_SESSION, role, actor: role === "organizer" ? "desk-organizer" : "desk-buyer",
    context, domain: PINNED_PROTOCOL_DOMAIN, action: "prepare_trade", operationId: `op-page-${index}`,
    status: states[index % 5], source: "stub-shape", profile: paired.profile, profileVersion: paired.profileVersion,
    code: null, requestId: null, correlationId: null, refId: `ref-${context}`, sequence: index + 1,
    note: "", fields: [{ key: "email", value: "person@example.test" }, { key: "label", value: "safe" }],
    ...overrides,
  };
}

export function paginationInput(role: WorkspaceRole = "operator", count = 5000): ReceiptExplorerInput {
  const base = { source: "stub-shape" as const, path: { kind: "available-stub-shape" as const }, template: [] };
  return {
    screenSessionId: FIXTURE_SESSION, evidenceSessionId: FIXTURE_SESSION, role, environment: "stub",
    journey: { ...base, journeys: [] }, gift: { ...base, gifts: [] }, organizer: { ...base, events: [] },
    consent: { ...base, events: [], notComposed: [], deskNotBound: [] },
    extra: Array.from({ length: count }, (_, index) => receiptCandidate(index)).filter((entry) => ROLE_CONTEXTS[role].includes(entry.context)),
  };
}

export function paginationModel(role: WorkspaceRole = "operator", count = 5000) {
  return buildReceiptExplorer(paginationInput(role, count));
}
