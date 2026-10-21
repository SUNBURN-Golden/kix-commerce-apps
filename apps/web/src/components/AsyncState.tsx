import { Link } from "react-router-dom";
import type { COMMERCE_COMMAND_BINDINGS, CommerceMethod } from "@kix/protocol-adapter";
import { useLocale } from "../i18n/locale-context";
import { STATE_ACTION_MESSAGES, STATE_MESSAGES } from "../async-state/messages";
import { AsyncStateFrame, type AsyncStateFrameProps } from "./AsyncStateFrame";

/** Presentation only. Freshness may coexist with UNKNOWN; this is not an outcome reducer. */
export { ASYNC_STATES, type AsyncStateKind } from "../async-state/kinds";

export interface AsyncStateProps extends Omit<AsyncStateFrameProps, "word" | "note"> {
  code?: string | null;
  /** Only an existing read/recovery action. Never supply a write, reload or generic remount. */
  read?: { label: string; onRead: () => void; disabled?: boolean };
  /** Exact existing desk record, including nullable consideredAction. */
  binding?: { method: CommerceMethod; record: (typeof COMMERCE_COMMAND_BINDINGS)[CommerceMethod] };
}

export function AsyncState({ kind, children, code, read, binding, ...attributes }: AsyncStateProps) {
  const { t, locale } = useLocale();
  const copy = kind === "loading" ? { word: t("status.loading.word"), note: t("status.loading.meaning") } : STATE_MESSAGES[locale][kind];
  const actions = STATE_ACTION_MESSAGES[locale];
  // UNKNOWN never offers a read/recovery button; a fresh read cannot resolve its outcome.
  const canRead = read && (kind === "error" || kind === "stale");
  return (
    <AsyncStateFrame {...attributes} {...copy} kind={kind}>
      {code && /^[A-Z][A-Z0-9_]{1,47}$/.test(code) ? <p>{code}</p> : null}
      {binding ? <p>{binding.method} · consideredAction {binding.record.consideredAction ?? "none"}. {binding.record.reason}</p> : null}
      {children}
      {canRead ? <button type="button" disabled={read.disabled} onClick={read.onRead}>{read.label}</button> : null}
      {kind === "error" || kind === "stale" ? <Link to="/help">{actions.help}</Link> : null}
      {kind === "unknown" ? <Link to="/receipts">{actions.fence}</Link> : null}
    </AsyncStateFrame>
  );
}
