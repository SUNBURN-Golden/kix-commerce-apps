import { useCallback, useEffect, useState } from "react";
import { ProtocolError, type ResaleCaseView, type ResaleRightView } from "@kix/protocol-adapter";
import { protocol } from "./protocol";
import type { ResaleDeskCommand } from "./pages/ResalePanel";
import { DESK_EXPIRES_AT, reservationIds } from "./reservation-desk";
import { readDeskAttempt, writeDeskAttempt } from "./desk-attempts";

const SALE_EXPIRES_AT = "2099-06-01T00:00:00.000Z";
const SELLER = "desk-buyer";
const RECIPIENT = "desk-recipient";
const ISSUE_PAYMENT = "mock-issued";
const SALE_PAYMENT = "mock-resale-noted";

export function resaleIds(eventId: string) {
  const reservation = reservationIds(eventId);
  return {
    ...reservation,
    listingId: `rsl_${eventId}`,
    holdId: `rbuy_${eventId}`,
    transferId: `xfer_${eventId}`,
  };
}

export function useResaleDesk(eventId: string) {
  const [view, setView] = useState<ResaleCaseView | null>(null);
  const [right, setRight] = useState<ResaleRightView | null>(null);
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
      setRight(null);
      return;
    }
    const ids = resaleIds(trimmed);
    try {
      setRight(await protocol.viewResaleRight(ids.issuanceId));
    } catch (reason) {
      if (reason instanceof ProtocolError && reason.code === "UNKNOWN_RIGHT") {
        setRight(null);
      } else {
        throw reason;
      }
    }
    try {
      setView(await protocol.viewResaleCase(ids.listingId));
    } catch (reason) {
      if (reason instanceof ProtocolError && reason.code === "UNKNOWN_LISTING") {
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

  async function run(command: ResaleDeskCommand) {
    const trimmed = eventId.trim();
    if (!trimmed || pending) {
      return;
    }
    const ids = resaleIds(trimmed);
    const idempotencyKey = `desk-${command}:${ids.listingId}:${attempt}`;
    setPending(true);
    setError(null);
    try {
      switch (command) {
        case "advance_mock_clock":
          await protocol.advanceResaleClock({
            idempotencyKey: `desk-${command}:${trimmed}:${attempt}`,
            nowAt: DESK_EXPIRES_AT,
          });
          break;
        case "adopt":
          await protocol.adoptResaleIssued({
            rightId: ids.issuanceId,
            showId: ids.showId,
            eventId: trimmed,
            slot: ids.slot,
            holderRole: SELLER,
            reservationId: ids.reservationId,
            paymentRef: ISSUE_PAYMENT,
            idempotencyKey,
          });
          break;
        case "list":
          await protocol.listResaleCase({
            listingId: ids.listingId,
            rightId: ids.issuanceId,
            version: 1,
            sellerRole: SELLER,
            recipientRole: RECIPIENT,
            expiresAt: SALE_EXPIRES_AT,
            reservationId: ids.reservationId,
            idempotencyKey,
          });
          break;
        case "hold_buy":
          await protocol.holdResaleBuy({
            holdId: ids.holdId,
            listingId: ids.listingId,
            buyerRole: RECIPIENT,
            idempotencyKey,
          });
          break;
        case "release_hold":
          await protocol.releaseResaleHold({
            holdId: ids.holdId,
            buyerRole: RECIPIENT,
            idempotencyKey,
          });
          break;
        case "cancel":
          await protocol.cancelResaleListing({
            listingId: ids.listingId,
            sellerRole: SELLER,
            idempotencyKey,
          });
          break;
        case "observe_payment":
          await protocol.observeResalePayment({
            listingId: ids.listingId,
            paymentRef: SALE_PAYMENT,
            buyerRole: RECIPIENT,
            idempotencyKey,
          });
          break;
        case "bind_settlement":
          await protocol.bindResaleSettlement({
            listingId: ids.listingId,
            settlementId: ids.settlementId,
            idempotencyKey,
          });
          break;
        case "accept_transfer":
          await protocol.acceptResaleTransfer({
            transferId: ids.transferId,
            listingId: ids.listingId,
            idempotencyKey,
          });
          break;
        case "close":
          await protocol.closeResaleListing({ listingId: ids.listingId, idempotencyKey });
          break;
        case "reconcile":
          await protocol.reconcileResale({ listingId: ids.listingId, idempotencyKey });
          break;
        case "reject_external":
          await protocol.rejectExternalResale("EXTERNAL_MARKETPLACE");
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

  return { view, right, error, pending, run };
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Mock resale command was rejected.";
}

function readAttempt(eventId: string): number {
  return readDeskAttempt("resale", eventId);
}

function writeAttempt(eventId: string, attempt: number): void {
  writeDeskAttempt("resale", eventId, attempt);
}
