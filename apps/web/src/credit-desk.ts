import { messages as sourceCopy } from "./i18n/messages/credit-desk";
import { connectedHandler } from "./connectivity/write-guard";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProtocolError, type CreditCaseView } from "@kix/protocol-adapter";
import { protocol } from "./connectivity/desk-protocol";
import type { CreditDeskCommand } from "./pages/CreditPanel";
import { readDeskAttempt, writeDeskAttempt } from "./desk-attempts";

const OPEN_FACE = 100_000;
const OFFER_AMOUNT = 80_000;
const REPAY_PART = 30_000;
const BENEFICIARY = "desk-beneficiary";

export function creditIds(eventId: string) {
  return {
    advanceId: `adv_${eventId}`,
    claimId: `claim_${eventId}`,
    drawId: `draw_${eventId}`,
    settlementId: `stl_${eventId}`,
  };
}

export function useCreditDesk(eventId: string) {
  const [view, setView] = useState<CreditCaseView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // One mutable bag: g = selection generation (a selection owns its reads and
  // completion, including A → B → A); f = in-flight send (React state alone
  // cannot guard two activations from the same render).
  const box = useRef({ g: 0, f: false }).current;

  const refresh = useCallback(async (requestGeneration: number) => {
    const trimmed = eventId.trim();
    if (!trimmed) {
      setView(null);
      return;
    }
    const ids = creditIds(trimmed);
    let next: CreditCaseView | null = null;
    try {
      next = await protocol.viewCredit(ids.advanceId);
    } catch (reason) {
      if (!(reason instanceof ProtocolError && reason.code === "UNKNOWN_ADVANCE")) throw reason;
    }
    if (box.g === requestGeneration) setView(next);
  }, [eventId, box]);

  useEffect(() => {
    const requestGeneration = ++box.g;
    box.f = false;
    setPending(false);
    setView(null);
    setError(null);
    refresh(requestGeneration).catch((reason: unknown) => {
      if (box.g === requestGeneration) {
        setError(message(reason));
      }
    });
  }, [refresh, eventId, box]);

  async function run(command: CreditDeskCommand) {
    if (!connectedHandler()) return;
    const trimmed = eventId.trim();
    if (!trimmed || box.f) {
      return;
    }
    const requestGeneration = box.g;
    const current = () => box.g === requestGeneration;
    box.f = true;
    const ids = creditIds(trimmed);
    const attempt = readAttempt(trimmed);
    const idempotencyKey = `desk-${command}:${ids.advanceId}:${attempt}`;
    const advanceAttempt = () => writeAttempt(trimmed, readAttempt(trimmed) + 1);
    setPending(true);
    setError(null);
    try {
      switch (command) {
        case "offer":
          await protocol.offerCredit({
            advanceId: ids.advanceId,
            claimId: ids.claimId,
            openFace: OPEN_FACE,
            amount: OFFER_AMOUNT,
            beneficiaryRole: BENEFICIARY,
            idempotencyKey,
            product: null,
          });
          break;
        case "approve":
          await protocol.approveCredit({ advanceId: ids.advanceId, idempotencyKey });
          break;
        case "reject":
          await protocol.rejectCredit({
            advanceId: ids.advanceId,
            idempotencyKey,
            reason: "FIXTURE_DECLINE",
          });
          break;
        case "cancel":
          await protocol.cancelCredit({
            advanceId: ids.advanceId,
            idempotencyKey,
            reason: "FIXTURE_WITHDRAW",
          });
          break;
        case "bind_settlement":
          await protocol.bindCreditSettlement({
            advanceId: ids.advanceId,
            settlementId: ids.settlementId,
            idempotencyKey,
          });
          break;
        case "draw":
          await protocol.drawCredit({
            advanceId: ids.advanceId,
            drawId: ids.drawId,
            idempotencyKey,
          });
          break;
        case "repay": {
          const sequence = (view?.repaymentCount ?? 0) + 1;
          const outstanding = view?.outstandingExposure ?? 1;
          const amount = outstanding > REPAY_PART ? REPAY_PART : Math.max(outstanding, 1);
          await protocol.repayCredit({
            advanceId: ids.advanceId,
            repayId: `repay_${trimmed}_${sequence}`,
            sequence,
            amount,
            idempotencyKey: `desk-${command}:${ids.advanceId}:${sequence}:${attempt}`,
          });
          break;
        }
        case "close":
          await protocol.closeCredit({ advanceId: ids.advanceId, idempotencyKey });
          break;
        case "default":
          await protocol.defaultCredit({
            advanceId: ids.advanceId,
            idempotencyKey,
            reason: "FIXTURE_EXPOSURE",
          });
          break;
        case "reconcile":
          await protocol.reconcileCredit({ advanceId: ids.advanceId, idempotencyKey });
          break;
        case "reject_real_funds":
          await protocol.rejectUnsupportedCredit("DISBURSE");
          break;
        case "reject_undefined_product":
          await protocol.rejectUnsupportedCredit("INTEREST");
          break;
      }
      if (command === "reconcile") {
        // A second reconcile checks the case again instead of replaying this receipt.
        advanceAttempt();
      }
      await refresh(requestGeneration);
    } catch (reason) {
      advanceAttempt();
      if (!current()) return;
      setError(message(reason));
      try {
        await refresh(requestGeneration);
      } catch {
        // The command error stays on the panel.
      }
    } finally {
      if (current()) {
        box.f = false;
        setPending(false);
      }
    }
  }

  return { view, error, pending, run };
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : sourceCopy.en["ssx"];
}

function readAttempt(eventId: string): number {
  return readDeskAttempt("credit", eventId);
}

function writeAttempt(eventId: string, attempt: number): void {
  writeDeskAttempt("credit", eventId, attempt);
}
