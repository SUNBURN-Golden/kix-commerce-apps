/**
 * Test-only stand-in for the receipts screen, swapped in by buildShellFaultApp. It throws a hostile error
 * on purpose while window.__kixShellFault is "route", and draws the real screen otherwise.
 * Not part of the product bundle and not under the e2e tsconfig include.
 */
import { createElement } from "react";
import { ReceiptsPage as RealReceiptsPage } from "../../web/src/pages/Receipts";

import { PaginationReceipts } from "./receipts-pagination";

export const HOSTILE = "Bearer sk_live_FAKE0123456789abcdef buyer.person@example.test {\"token\":\"tok_FAKE_body_secret\"}";

export function ReceiptsPage() {
  if ((window as unknown as { __kixShellFault?: string }).__kixShellFault === "route") {
    const error = new Error(HOSTILE);
    error.stack = `Error: leak\n    at renderReceipts (/srv/app/src/pages/Receipts.tsx:41:9)`;
    throw error;
  }
  if (window.__kixReceiptPagination) return createElement(PaginationReceipts);
  return createElement(RealReceiptsPage);
}
