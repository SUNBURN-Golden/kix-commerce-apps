import { useState } from "react";
import { useSettledFocus } from "./a11y/focus";

/** A local read failure, distinct from the session journal's write UNKNOWN. */
export const unknownRead = (): { kind: "unknown"; message: string } => ({ kind: "unknown", message: "" });

/** Consume synchronous throws and promise rejections, including obsolete reads.
 * Ownership guards the outcome and every dependent cache mutation together.
 * This runs one read only; recovery belongs to an explicit user action.
 */
export async function settleRead<T>(
  read: () => Promise<T>,
  owns: () => boolean,
  apply: (outcome: NoInfer<T> | ReturnType<typeof unknownRead>) => void,
): Promise<void> {
  let outcome: T | ReturnType<typeof unknownRead>;
  try {
    outcome = await read();
  } catch {
    outcome = unknownRead();
  }
  if (owns()) apply(outcome);
}

/** Arm focus repair only for an explicit recovery, never an initial effect read. */
export function useReadRecoveryFocus(state: string, statusId: string): (read: () => void) => void {
  const [attempt, setAttempt] = useState(0);
  useSettledFocus(attempt > 0 && state !== "loading" ? `${attempt}:${state}` : null, statusId);
  return (read) => {
    setAttempt((current) => current + 1);
    read();
  };
}
