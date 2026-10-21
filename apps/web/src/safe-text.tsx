import { useT } from "./i18n/locale-context";
import type { JSX } from "react";

// Intentionally matches control and bidirectional-override characters so they can be stripped.
// eslint-disable-next-line no-control-regex
const UNSAFE_CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

export interface SafeTextProps {
  value: unknown;
  maxDisplay?: number;
  className?: string;
  copyLabel?: string;
}

export function visibleSafeText(value: unknown, maxDisplay = 120): { display: string; original: string; shortened: boolean } {
  const original = typeof value === "string" ? value : String(value ?? "");
  const visible = original.replace(UNSAFE_CONTROLS, "�");
  const points = Array.from(visible);
  const shortened = points.length > maxDisplay;
  return { display: shortened ? `${points.slice(0, Math.max(0, maxDisplay)).join("")}…` : visible, original, shortened };
}

export function SafeText({ value, maxDisplay = 120, className, copyLabel }: SafeTextProps): JSX.Element {
  const t = useT();
  const safe = visibleSafeText(value, maxDisplay);
  return (
    <span className={className}>
      <span>{safe.display}</span>
      {safe.shortened || safe.display !== safe.original ? (
        <details className="safe-text-original">
          <summary>{copyLabel ?? t("safe.copyOriginal")}</summary>
          <pre>{safe.original}</pre>
        </details>
      ) : null}
    </span>
  );
}
