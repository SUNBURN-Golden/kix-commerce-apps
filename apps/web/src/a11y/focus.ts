import { useEffect, useRef } from "react";

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
