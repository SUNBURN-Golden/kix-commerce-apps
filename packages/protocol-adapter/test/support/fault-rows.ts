/**
 * Row ids are app-internal (contract_change=NO). The doc test requires each id
 * to appear in docs/c-fault-injection-stub-apps-bind.md. Node and browser rows
 * keep separate denominators and are never summed.
 */
export type FaultStatus = "PASS" | "REUSED" | "LIMIT" | "NOT_REACHABLE" | "UNVERIFIED";
export type FaultRunner = "node" | "web-ssr" | "browser";

export interface FaultRow {
  id: string;
  runner: FaultRunner;
  fault: string;
  status: FaultStatus;
}

const MATRIX: ReadonlyArray<[string, string]> = [
  ["FI-N01", "PRE_SEND_THROW"],
  ["FI-N02", "LOST_AFTER_EFFECT"],
  ["FI-N03", "TRUNCATED_BODY"],
  ["FI-N04", "TIMEOUT"],
  ["FI-N05", "STALE_CORRELATION"],
  ["FI-N06", "INVALID_RECEIPT"],
  ["FI-N07", "REJECT_422"],
  ["FI-N08", "SERVER_5XX"],
  ["FI-N09", "REDIRECT"],
  ["FI-N10", "LATE_DELIVERY"],
];

export const FAULT_ROWS: readonly FaultRow[] = [
  ...MATRIX.map(([id, fault]): FaultRow => ({ id, runner: "node", fault, status: "PASS" })),
  { id: "FI-N11", runner: "node", fault: "duplicate trigger while in flight", status: "PASS" },
  { id: "FI-N12", runner: "node", fault: "probe after UNKNOWN lifts nothing", status: "PASS" },
  { id: "FI-N13", runner: "node", fault: "actor switch after UNKNOWN", status: "PASS" },
  { id: "FI-N14", runner: "node", fault: "mode selection never switches on failure", status: "PASS" },
  { id: "FI-N15", runner: "node", fault: "reload over a damaged store keeps one send", status: "PASS" },
  { id: "FI-N16", runner: "node", fault: "concurrent gift on two instances", status: "PASS" },
  { id: "FI-N17", runner: "node", fault: "concurrent resale", status: "REUSED" },
  { id: "FI-N18", runner: "node", fault: "admission desk call over HTTP sends no admit", status: "PASS" },
  { id: "FI-N19", runner: "node", fault: "stale read and context switch", status: "REUSED" },
  { id: "FI-N20", runner: "node", fault: "storage damage in the journal", status: "REUSED" },
  { id: "FI-N21", runner: "node", fault: "desk-method throw bumps the attempt", status: "NOT_REACHABLE" },
  { id: "FI-W01", runner: "web-ssr", fault: "every desk row cannot send after UNKNOWN", status: "PASS" },
  { id: "FI-W02", runner: "web-ssr", fault: "second desk after a reload", status: "LIMIT" },
  { id: "FI-W03", runner: "web-ssr", fault: "corrupt attempt counters", status: "PASS" },
  { id: "FI-B01", runner: "browser", fault: "storage quota on attach", status: "PASS" },
  { id: "FI-B02", runner: "browser", fault: "corrupt stored blob before reload", status: "PASS" },
  { id: "FI-B03", runner: "browser", fault: "storage cleared mid-session", status: "PASS" },
  { id: "FI-B04", runner: "browser", fault: "blocked sessionStorage", status: "PASS" },
  { id: "FI-B05", runner: "browser", fault: "repeated reload of a held answer", status: "PASS" },
  { id: "FI-B06", runner: "browser", fault: "concurrent gift, resale, admit across tabs", status: "NOT_REACHABLE" },
  { id: "FI-B07", runner: "browser", fault: "HTTP mode in a browser", status: "UNVERIFIED" },
];

/** Where a REUSED row is already pinned: file :: test title fragment. */
export const REUSED_POINTERS: Record<string, { file: string; title: string }> = {
  "FI-N17": { file: "platform-controller.test.ts", title: "two pages on one source" },
  "FI-N19": { file: "session-recovery-controller.test.ts", title: "turns an in-flight intent UNKNOWN on a tab resume" },
  "FI-N20": { file: "session-journal.test.ts", title: "refuses a partial write that throws" },
};
