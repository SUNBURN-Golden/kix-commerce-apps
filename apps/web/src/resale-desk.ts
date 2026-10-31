import { messages as sourceCopy } from "./i18n/messages/resale-desk";
import { connectedHandler } from "./connectivity/write-guard";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProtocolError, type ResaleCaseView, type ResaleRightView } from "@kix/protocol-adapter";
import { protocol } from "./connectivity/desk-protocol";
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

  // One mutable bag: g = selection generation (a selection owns its reads and
  // completion, including A → B → A); f = in-flight send (React state alone
  // cannot guard two activations from the same render).
  const box = useRef({ g: 0, f: false }).current;

  const refresh = useCallback(async (requestGeneration: number) => {
    const current = () => box.g === requestGeneration;
    const trimmed = eventId.trim();
    if (!trimmed) {
      setView(null);
      setRight(null);
      return;
    }
    const ids = resaleIds(trimmed);
    let nextRight: ResaleRightView | null = null;
    try {
      nextRight = await protocol.viewResaleRight(ids.issuanceId);
    } catch (reason) {
      if (!(reason instanceof ProtocolError && reason.code === "UNKNOWN_RIGHT")) throw reason;
    }
    if (!current()) return;
    setRight(nextRight);
    let next: ResaleCaseView | null = null;
    try {
      next = await protocol.viewResaleCase(ids.listingId);
    } catch (reason) {
      if (!(reason instanceof ProtocolError && reason.code === "UNKNOWN_LISTING")) throw reason;
    }
    if (current()) setView(next);
  }, [eventId, box]);

  useEffect(() => {
    const requestGeneration = ++box.g;
    box.f = false;
    setPending(false);
    setView(null);
    setRight(null);
    setError(null);
    refresh(requestGeneration).catch((reason: unknown) => {
      if (box.g === requestGeneration) {
        setError(message(reason));
      }
    });
  }, [refresh, eventId, box]);

  async function run(command: ResaleDeskCommand) {
    if (!connectedHandler()) return;
    const trimmed = eventId.trim();
    if (!trimmed || box.f) {
      return;
    }
    const requestGeneration = box.g;
    const current = () => box.g === requestGeneration;
    box.f = true;
    const ids = resaleIds(trimmed);
    const attempt = readAttempt(trimmed);
    const idempotencyKey = `desk-${command}:${ids.listingId}:${attempt}`;
    const advanceAttempt = () => writeAttempt(trimmed, readAttempt(trimmed) + 1);
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

  return { view, right, error, pending, run };
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : sourceCopy.en["st2"];
}

function readAttempt(eventId: string): number {
  return readDeskAttempt("resale", eventId);
}

function writeAttempt(eventId: string, attempt: number): void {
  writeDeskAttempt("resale", eventId, attempt);
}
