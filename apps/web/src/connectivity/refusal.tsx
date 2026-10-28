import { createContext, useState, type ReactNode } from "react";

interface Refusal {
  /** The element that says why the last send was refused, or null. */
  reason: string | null;
  pressed: string | null;
  press: (key: string | null) => void;
  report: (reason: string | null) => void;
}
export const RefusalContext = createContext<Refusal | null>(null);

/**
 * A refused send stays fenced: aria-disabled, with the refusal named through aria-describedby, until another send in
 * the scope or an edit in a form inside it. Fields stay editable, so the correction path stays open. A form inside the
 * scope reports its own refused submit; `reason` names a refusal the desk shows itself.
 */
export function RefusalScope({ reason = null, children }: { reason?: string | null; children: ReactNode }) {
  const [pressed, press] = useState<string | null>(null);
  const [reported, report] = useState<string | null>(null);
  return <RefusalContext.Provider value={{ reason: reason ?? reported, pressed, press, report }}>{children}</RefusalContext.Provider>;
}
