import type { HTMLAttributes } from "react";
import type { AsyncStateKind } from "../async-state/kinds";

export interface AsyncStateFrameProps extends HTMLAttributes<HTMLDivElement> {
  kind: AsyncStateKind;
  label: string;
  word: string;
  note: string;
  /** Set to parent when an existing live region on the parent screen owns this update. */
  announcement?: "self" | "parent";
}

/** Shared words and announcements; the shell can show progress before screen actions load. */
export function AsyncStateFrame({ kind, label, word, note, children, announcement = "self", className = "", ...attributes }: AsyncStateFrameProps) {
  const ownsLive = announcement === "self";
  return (
    <div
      {...attributes}
      className={`async-state ${className}`}
      data-async-state={kind}
      role={ownsLive ? (kind === "error" ? "alert" : "status") : undefined}
      aria-live={ownsLive ? (kind === "error" ? "assertive" : "polite") : undefined}
      aria-busy={kind === "loading"}
    >
      <p>
        <span className="status-mark async-state-word" data-status-mark={kind}>{word}</span>{" "}
        {label ? `${label}: ` : ""}{note}
      </p>
      {children}
    </div>
  );
}
