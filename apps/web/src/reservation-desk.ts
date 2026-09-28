import { useCallback, useEffect, useState } from "react";
import { ProtocolError, type ReservationCaseView } from "@kix/protocol-adapter";
import { protocol } from "./protocol";
import type { ReservationDeskCommand } from "./pages/ReservationPanel";
import { readDeskAttempt, writeDeskAttempt } from "./desk-attempts";

export const DESK_EXPIRES_AT = "2099-01-01T00:00:00.000Z";
export const DESK_CLOCK_AT = DESK_EXPIRES_AT;
const DESK_BUYER = "desk-buyer";
const DESK_PAYMENT_REF = "mock-noted";

export function reservationIds(eventId: string) {
  return {
    showId: `show_${eventId}`,
    reservationId: `rsv_${eventId}`,
    orderId: `ord_${eventId}`,
    issuanceId: `iss_${eventId}`,
    admissionId: `adm_${eventId}`,
    consumeId: `csm_${eventId}`,
    settlementId: `stl_${eventId}`,
    slot: "slot-0",
  };
}

export function useReservationDesk(eventId: string) {
  const [view, setView] = useState<ReservationCaseView | null>(null);
  const [showRegistered, setShowRegistered] = useState(false);
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
      setShowRegistered(false);
      return;
    }
    const ids = reservationIds(trimmed);
    try {
      await protocol.viewReservationShow(ids.showId);
      setShowRegistered(true);
    } catch (reason) {
      if (reason instanceof ProtocolError && reason.code === "UNKNOWN_SHOW") {
        setShowRegistered(false);
      } else {
        throw reason;
      }
    }
    try {
      setView(await protocol.viewReservation(ids.reservationId));
    } catch (reason) {
      if (reason instanceof ProtocolError && reason.code === "UNKNOWN_RESERVATION") {
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

  async function run(command: ReservationDeskCommand) {
    const trimmed = eventId.trim();
    if (!trimmed || pending) {
      return;
    }
    const ids = reservationIds(trimmed);
    const idempotencyKey = `desk-${command}:${ids.reservationId}:${attempt}`;
    setPending(true);
    setError(null);
    try {
      switch (command) {
        case "register_show":
          await protocol.registerReservationShow({
            showId: ids.showId,
            eventId: trimmed,
            idempotencyKey: `desk-${command}:${ids.showId}:${attempt}`,
            slots: [ids.slot],
          });
          break;
        case "advance_mock_clock":
          await protocol.advanceReservationClock({
            idempotencyKey: `desk-${command}:${trimmed}:${attempt}`,
            nowAt: DESK_CLOCK_AT,
          });
          break;
        case "hold":
          await protocol.holdReservation({
            reservationId: ids.reservationId,
            showId: ids.showId,
            slot: ids.slot,
            buyerRole: DESK_BUYER,
            expiresAt: DESK_EXPIRES_AT,
            idempotencyKey,
          });
          break;
        case "release":
          await protocol.releaseReservation({ reservationId: ids.reservationId, idempotencyKey });
          break;
        case "confirm":
          await protocol.confirmReservation({
            orderId: ids.orderId,
            reservationId: ids.reservationId,
            idempotencyKey,
          });
          break;
        case "cancel":
          await protocol.cancelReservation({ reservationId: ids.reservationId, idempotencyKey });
          break;
        case "observe_payment":
          await protocol.observeReservationPayment({
            orderId: ids.orderId,
            idempotencyKey,
            paymentRef: DESK_PAYMENT_REF,
          });
          break;
        case "bind_settlement":
          await protocol.bindReservationSettlement({
            reservationId: ids.reservationId,
            settlementId: ids.settlementId,
            idempotencyKey,
          });
          break;
        case "issue":
          await protocol.issueReservation({
            issuanceId: ids.issuanceId,
            orderId: ids.orderId,
            idempotencyKey,
          });
          break;
        case "authorize_admission":
          await protocol.authorizeReservationAdmission({
            admissionId: ids.admissionId,
            rightId: ids.issuanceId,
            idempotencyKey,
          });
          break;
        case "consume":
          await protocol.consumeReservation({
            consumeId: ids.consumeId,
            rightId: ids.issuanceId,
            idempotencyKey,
          });
          break;
        case "reconcile":
          await protocol.reconcileReservation({ reservationId: ids.reservationId, idempotencyKey });
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

  return { view, showRegistered, error, pending, run };
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Mock reservation command was rejected.";
}

function readAttempt(eventId: string): number {
  return readDeskAttempt("reservation", eventId);
}

function writeAttempt(eventId: string, attempt: number): void {
  writeDeskAttempt("reservation", eventId, attempt);
}
