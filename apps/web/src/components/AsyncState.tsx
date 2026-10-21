import type { AsyncStateKind } from "../async-state/kinds";
import type { HTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { COMMERCE_COMMAND_BINDINGS, CommerceMethod } from "@kix/protocol-adapter";
import { useT } from "../i18n/locale-context";

/** Presentation only. Freshness may coexist with UNKNOWN; this is not an outcome reducer. */
export { ASYNC_STATES, type AsyncStateKind } from "../async-state/kinds";

export interface AsyncStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  kind: AsyncStateKind;
  label: string;
  children?: ReactNode;
  code?: string | null;
  /** Only an existing read/recovery action. Never supply a write, reload or generic remount. */
  read?: { label: string; onRead: () => void; disabled?: boolean };
  /** Set to parent when an existing live region on the parent screen owns this update. */
  announcement?: "self" | "parent";
  /** Exact existing desk record, including nullable consideredAction. */
  binding?: { method: CommerceMethod; record: (typeof COMMERCE_COMMAND_BINDINGS)[CommerceMethod] };
}

export function AsyncState({ kind, label, children, code, read, announcement = "self", binding, className = "", ...attributes }: AsyncStateProps) {
  const t = useT();
  const ownsLive = announcement === "self";
  // UNKNOWN never offers a read/recovery button; a fresh read cannot resolve its outcome.
  const canRead = read && (kind === "error" || kind === "stale");
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
        <span className="status-mark async-state-word" data-status-mark={kind}>{t(`async.${kind}.word`)}</span>{" "}
        {label ? `${label}: ` : ""}{t(`async.${kind}.note`)}
      </p>
      {code && /^[A-Z][A-Z0-9_]{1,47}$/.test(code) ? <p>{code}</p> : null}
      {binding ? <p>{binding.method} · consideredAction {binding.record.consideredAction ?? "none"}. {binding.record.reason}</p> : null}
      {children}
      {canRead ? <button type="button" disabled={read.disabled} onClick={read.onRead}>{read.label}</button> : null}
      {kind === "error" || kind === "stale" ? <Link to="/help">{t("async.help")}</Link> : null}
      {kind === "unknown" ? <Link to="/receipts">{t("async.fence")}</Link> : null}
    </div>
  );
}
