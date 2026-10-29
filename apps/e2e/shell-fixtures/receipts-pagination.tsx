/** Test-only large evidence fixture. Reuses the real screen and the adjudication boundary. */
import { useEffect, useState } from "react";
import { ReceiptScreen } from "../../web/src/pages/Receipts";
import { buildReceiptExplorer } from "../../web/src/receipt-explorer";
import type { WorkspaceRole } from "../../web/src/workspace/registry";
import { paginationInput, receiptCandidate } from "../../web/test/support/receipt-pagination-fixture";

declare global {
  interface Window {
    __kixReceiptPagination?: boolean;
    __kixReceiptChange?: (mode: "normal" | "transport" | "preceding" | "removed" | "missing" | "duplicate" | "unique") => void;
  }
}

export function PaginationReceipts() {
  const [role, setRole] = useState<WorkspaceRole>("operator");
  const [mode, setMode] = useState("normal");
  useEffect(() => {
    window.__kixReceiptChange = setMode;
    return () => { delete window.__kixReceiptChange; };
  }, []);
  const input = paginationInput(role);
  if (mode === "transport" || mode === "preceding") input.gift.path = { kind: "checking" };
  if (mode === "preceding") input.journey.path = { kind: "checking" };
  if (mode === "missing") input.extra = input.extra!.slice(2);
  if (mode === "duplicate") input.extra = [...input.extra!, receiptCandidate(1, { sequence: 9999 })];
  return <ReceiptScreen model={buildReceiptExplorer(input)} role={role} onRole={setRole} />;
}
