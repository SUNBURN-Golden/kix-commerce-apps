import { useEffect, useRef, useState } from "react";

/**
 * After an error, the typed value and the selection come back with focus.
 * This record is a copy. It does not clear either field.
 */
export interface RestoredEntry {
  readonly controlId: string;
  readonly value: string;
  readonly selection: string | null;
}

export function restoreAfterError(entry: RestoredEntry): RestoredEntry {
  return {
    controlId: entry.controlId,
    value: entry.value,
    selection: entry.selection,
  };
}

export function heldAfterError(entry: RestoredEntry, error: boolean): RestoredEntry | null {
  if (!error) {
    return null;
  }
  return restoreAfterError(entry);
}

/** Control that still holds the conflicting discovery input. */
export function conflictControlId(code: string): string | null {
  if (code === "ga-section") {
    return "discovery-section";
  }
  if (code === "cancelled-purchasable") {
    return "discovery-purchasable";
  }
  if (code === "from-after-to") {
    return "discovery-from";
  }
  return null;
}

export function focusControl(id: string): void {
  if (typeof document === "undefined") {
    return;
  }
  const node = document.getElementById(id);
  if (node instanceof HTMLElement) {
    node.focus();
  }
}

/**
 * Moves focus when a later error token appears. The first paint is skipped
 * so a screen that opens already in error does not steal the skip link.
 */
export function useRestoreFocus(token: string | null, controlId: string | null): void {
  const seen = useRef(false);
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!seen.current) {
      seen.current = true;
      last.current = token;
      return;
    }
    if (token && token !== last.current && controlId) {
      focusControl(controlId);
    }
    last.current = token;
  }, [token, controlId]);
}

/**
 * A send whose control locks once it settles leaves focus on the document. This moves focus to the outcome status only
 * then: focus the person already moved elsewhere stays put, and the first paint never moves it.
 */
export function useSettledFocus(token: string | null, statusId: string | null): void {
  const last = useRef(token);
  useEffect(() => {
    if (token && token !== last.current && statusId) {
      const active = document.activeElement;
      if (!active || active === document.body || (active instanceof HTMLButtonElement && active.disabled)) {
        focusControl(statusId);
      }
    }
    last.current = token;
  }, [token, statusId]);
}

/** Only the step just sent is live, once it leaves ready: a refused submit leaves it ready, so only the form speaks. */
export const stepLive = (sent: string | null, step: string, status: string) =>
  step === sent && status !== "ready" ? { "aria-live": "polite" as const, "aria-busy": status === "in-flight" } : {};

/**
 * Journey step rows. Only the step that was just sent is a live region (busy while in flight), so its settled status is
 * announced once and the rows it unlocks stay quiet. Its status takes focus when its send control locks, and a locked
 * control is described by the row note.
 */
export function useStepOutcome(prefix: string, rows: readonly { step: string; status: string }[]) {
  const [sent, setSent] = useState<string | null>(null);
  const row = sent === null ? undefined : rows.find((item) => item.step === sent);
  const settled = row !== undefined && row.status !== "in-flight" && row.status !== "ready" && row.status !== "not-started";
  const statusId = (step: string) => `${prefix}-${step}-status`;
  useSettledFocus(settled ? `${row.step}:${row.status}` : null, row ? statusId(row.step) : null);
  return {
    markSent: setSent,
    noteId: (step: string) => `${prefix}-${step}-note`,
    /** A locked send control names the row note that says why. */
    reasonProps: (step: string, canSend: boolean, note: string | null | undefined) => (!canSend && note ? { "aria-describedby": `${prefix}-${step}-note` } : {}),
    statusProps: (step: string, status: string) => ({
      id: statusId(step),
      tabIndex: -1,
      ...stepLive(sent, step, status),
    }),
  };
}
