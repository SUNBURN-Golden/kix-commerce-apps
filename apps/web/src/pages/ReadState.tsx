import { Children, cloneElement, isValidElement, createContext, useContext, useEffect, useState, type HTMLAttributes, type ReactNode } from "react";
import { StatusMark } from "../a11y/marks";
import type { ReadState } from "../shell/read-state-params";
import { useT } from "../i18n/desk-context";
import { messages } from "../i18n/messages/read-state";

const ReadContext = createContext<ReadState | null>(null);
export function ReadView({ state, children }: { state: ReadState; children: ReactNode }) {
  const t = useT(messages);
  return <ReadContext.Provider value={state}>
    {state.notice ? <p role="status" data-read-notice="true">{t("read.notice")}</p> : null}
    {children}
  </ReadContext.Provider>;
}
export function useReadMark(name: string, value: string) {
  const state = useContext(ReadContext);
  const selected = state?.values[name] === value;
  return { "aria-current": selected ? "true" as const : undefined, "data-read-selected": selected ? "true" : undefined, "data-read-id": value };
}
export function ReadChoice({ name, value }: { name: string; value: string }) {
  const state = useContext(ReadContext);
  const t = useT(messages);
  if (!state) return null;
  return <button type="button" data-read-choice={name} data-read-value={value} aria-pressed={state.values[name] === value} onClick={() => state.set(name, value)}>{state.values[name] === value ? <StatusMark kind="selected" /> : null} {t("read.select")}</button>;
}
export function ReadFilter({ state, name, options }: { state: ReadState; name: "channel" | "cut" | "queue" | "lane" | "workspace" | "filter"; options: readonly string[] }) {
  const t = useT(messages);
  const current = state.values[name] ?? "";
  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [current]);
  return <div className="discovery-controls" data-read-filter={name}>
    <label htmlFor={`read-${name}`}>{t(`read.${name}`)}<select id={`read-${name}`} value={draft} onChange={(event) => setDraft(event.target.value)}>
      <option value="">{t("read.all")}</option>
      {[...new Set(options)].map((value) => <option key={value} value={value}>{name === "filter" ? value === "all" ? t("read.all") : value === "unread" ? t("read.unread") : t("read.read") : value}</option>)}
    </select></label>
    <button type="button" id={`read-apply-${name}`} onClick={() => state.set(name, draft || null)}>{t("read.apply")}</button>
  </div>;
}

export function receiptPointer(row: { kind: string; refId: string; step: string }) {
  return `${row.kind}:${row.refId}:${row.step}`;
}
export function ReadObligation({ value, children }: { value: string; children: ReactNode }) {
  return <ReadRow as="div" name="obligation" value={value}><p>{value}</p>{children}</ReadRow>;
}

export function ReadRow({ as: Tag, name, value, children, ...props }: HTMLAttributes<HTMLElement> & { as: "li" | "tr" | "div"; name: string; value: string }) {
  const mark = useReadMark(name, value);
  const choice = <ReadChoice name={name} value={value} />;
  let added = false;
  const content = Tag === "tr" ? Children.map(children, (child) => {
    if (!added && isValidElement<{ children?: ReactNode }>(child) && (child.type === "td" || child.type === "th")) {
      added = true;
      return cloneElement(child, {}, child.props.children, choice);
    }
    return child;
  }) : <>{children}{choice}</>;
  return <Tag {...props} {...mark}>{content}</Tag>;
}

/** A tab only changes which facts from the current read are displayed. */
export function ReadLane({ lane, children }: { lane: string; children: ReactNode }) {
  const state = useContext(ReadContext);
  return !state?.values.lane || state.values.lane === lane ? <div data-read-lane={lane}>{children}</div> : null;
}
export function readSettled(state: string) {
  return state === "ready" || state === "empty";
}
