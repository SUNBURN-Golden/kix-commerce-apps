import type { CommerceProtocol } from "@kix/protocol-adapter";
import { readDeskAttempt, writeDeskAttempt } from "./desk-attempts";
import type { SettlementDeskCommand } from "./pages/SettlementPanel";

const FAIL_REASON = "FIXTURE_DECLINE";
const CANCEL_REASON = "FIXTURE_WITHDRAW";

export interface AttemptStore {
  read(settlementId: string): number;
  write(settlementId: string, attempt: number): void;
}

export function settlementIdFor(eventId: string): string {
  return `stl_${eventId}`;
}

export function settlementCommandKey(command: SettlementDeskCommand, settlementId: string, attempt: number): string {
  return `desk-${command}:${settlementId}:${attempt}`;
}

/**
 * Sends one box office command to the mock settlement case.
 * A rejected command moves the desk to a new attempt, so the next click is a
 * new command and not a replay of the stored rejection. Reconcile always
 * moves on too, so a second reconcile checks the case again.
 */
export async function runSettlementCommand(
  protocol: CommerceProtocol,
  command: SettlementDeskCommand,
  eventId: string,
  attempts: AttemptStore = sessionAttempts,
): Promise<void> {
  const settlementId = settlementIdFor(eventId);
  const attempt = attempts.read(settlementId);
  const idempotencyKey = settlementCommandKey(command, settlementId, attempt);
  try {
    switch (command) {
      case "initiate":
        await protocol.initiateSettlement({ settlementId, eventId, idempotencyKey });
        break;
      case "authorize":
        await protocol.authorizeSettlement({ settlementId, idempotencyKey });
        break;
      case "capture":
        await protocol.captureSettlement({ settlementId, idempotencyKey });
        break;
      case "commit":
        await protocol.commitSettlement({ settlementId, idempotencyKey });
        break;
      case "fail":
        await protocol.failSettlement({ settlementId, idempotencyKey, reason: FAIL_REASON });
        break;
      case "cancel":
        await protocol.cancelSettlement({ settlementId, idempotencyKey, reason: CANCEL_REASON });
        break;
      case "reconcile":
        await protocol.reconcileSettlement({ settlementId, idempotencyKey });
        break;
    }
  } catch (reason) {
    attempts.write(settlementId, attempt + 1);
    throw reason;
  }
  if (command === "reconcile") {
    attempts.write(settlementId, attempt + 1);
  }
}

/** The box office counter, kept per settlement case for the tab. */
export const sessionAttempts: AttemptStore = {
  read: (settlementId) => readDeskAttempt("settlement", settlementId),
  write: (settlementId, attempt) => writeDeskAttempt("settlement", settlementId, attempt),
};
