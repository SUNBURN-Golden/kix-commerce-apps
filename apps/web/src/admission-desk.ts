import { useCallback, useEffect, useState } from "react";
import { type AdmissionPresentation } from "@kix/protocol-adapter";
import { protocol } from "./protocol";
import type { AdmissionDeskCommand } from "./pages/AdmissionCredentialPanel";
import { reservationIds } from "./reservation-desk";

export const ADMISSION_CLOCK_AT = "2099-01-01T00:00:00.000Z";
export const ADMISSION_EXPIRES_AT = "2099-06-01T00:00:00.000Z";
const DESK_HOLDER = "desk-buyer";
const DESK_REQUEST = "desk-request";
const DESK_VERSION = 1;

export function useAdmissionDesk(eventId: string, gateId: string) {
  const [presentation, setPresentation] = useState<AdmissionPresentation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(() => readAttempt(eventId));

  useEffect(() => {
    setAttempt(readAttempt(eventId));
  }, [eventId]);

  const refresh = useCallback(async () => {
    const trimmed = eventId.trim();
    if (!trimmed) {
      setPresentation(null);
      return;
    }
    const ids = reservationIds(trimmed);
    setPresentation(
      await protocol.presentAdmission({
        rightId: ids.issuanceId,
        version: DESK_VERSION,
        holderRole: DESK_HOLDER,
      }),
    );
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

  async function run(command: AdmissionDeskCommand) {
    const trimmed = eventId.trim();
    if (!trimmed || pending) {
      return;
    }
    const ids = reservationIds(trimmed);
    const idempotencyKey = `desk-admission-${command}:${ids.issuanceId}:${attempt}`;
    const gateRole = gateId.trim() || "gate-main";
    setPending(true);
    setError(null);
    try {
      switch (command) {
        case "adopt_issued":
          await protocol.adoptAdmissionIssued({
            rightId: ids.issuanceId,
            reservationId: ids.reservationId,
            idempotencyKey,
          });
          break;
        case "advance_mock_clock":
          await protocol.advanceAdmissionClock({
            idempotencyKey: `desk-admission-${command}:${trimmed}:${attempt}`,
            nowAt: ADMISSION_CLOCK_AT,
          });
          break;
        case "authorize":
          await protocol.authorizeAdmissionCredential({
            admissionId: ids.admissionId,
            rightId: ids.issuanceId,
            version: DESK_VERSION,
            holderRole: DESK_HOLDER,
            gateRole,
            request: DESK_REQUEST,
            expiresAt: ADMISSION_EXPIRES_AT,
            idempotencyKey,
          });
          break;
        case "consume":
          await protocol.consumeAdmissionCredential({
            consumeId: ids.consumeId,
            rightId: ids.issuanceId,
            version: DESK_VERSION,
            gateRole,
            request: DESK_REQUEST,
            idempotencyKey,
          });
          break;
        case "reconcile":
          await protocol.reconcileAdmission({ rightId: ids.issuanceId, idempotencyKey });
          break;
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

  return { presentation, error, pending, run };
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Admission credential command was rejected.";
}

function attemptKey(eventId: string): string {
  return `kix-admission-attempt:${eventId.trim()}`;
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
