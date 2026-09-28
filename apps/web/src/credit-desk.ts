import { useCallback, useEffect, useState } from "react";
import { ProtocolError, type CreditCaseView } from "@kix/protocol-adapter";
import { protocol } from "./protocol";
import type { CreditDeskCommand } from "./pages/CreditPanel";

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
  const [attempt, setAttempt] = useState(() => readAttempt(eventId));

  useEffect(() => {
    setAttempt(readAttempt(eventId));
  }, [eventId]);

  const refresh = useCallback(async () => {
    const trimmed = eventId.trim();
    if (!trimmed) {
      setView(null);
      return;
    }
    const ids = creditIds(trimmed);
    try {
      setView(await protocol.viewCredit(ids.advanceId));
    } catch (reason) {
      if (reason instanceof ProtocolError && reason.code === "UNKNOWN_ADVANCE") {
        setView(null);
        return;
      }
      throw reason;
    }
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    refresh().catch((reason: unknown) => {
      if (!cancelled) {
        setError(message(reason));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function run(command: CreditDeskCommand) {
    const trimmed = eventId.trim();
    if (!trimmed || pending) {
      return;
    }
    const ids = creditIds(trimmed);
    const idempotencyKey = `desk-${command}:${ids.advanceId}:${attempt}`;
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
        setAttempt((value) => {
          const next = value + 1;
          writeAttempt(trimmed, next);
          return next;
        });
      }
      await refresh();
    } catch (reason) {
      setAttempt((value) => {
        const next = value + 1;
        writeAttempt(trimmed, next);
        return next;
      });
      setError(message(reason));
      try {
        await refresh();
      } catch {
        // The command error stays on the panel.
      }
    } finally {
      setPending(false);
    }
  }

  return { view, error, pending, run };
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Mock credit command was rejected.";
}

function attemptKey(eventId: string): string {
  return `kix-credit-attempt:${eventId.trim()}`;
}

function readAttempt(eventId: string): number {
  if (eventId.trim().length === 0 || typeof sessionStorage === "undefined") {
    return 0;
  }
  const parsed = Number(sessionStorage.getItem(attemptKey(eventId)));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function writeAttempt(eventId: string, attempt: number): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.setItem(attemptKey(eventId), String(attempt));
}
