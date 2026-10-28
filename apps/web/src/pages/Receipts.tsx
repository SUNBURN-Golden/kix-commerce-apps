import { messages as mergedCopy } from "../i18n/messages/merged-surfaces";
import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/pages--Receipts";
import { messages as copy1 } from "../i18n/messages/receipt-explorer";
import { messages as copy2 } from "../i18n/messages/consent-desk";
import { messages as copy3 } from "../i18n/messages/storage-allow-list";
import { messages as copy4 } from "../i18n/messages/gift-desk";
import { messages as copy5 } from "../i18n/messages/journey-desk";
import { messages as copy6 } from "../i18n/messages/organizer-desk";
import { messages as copy7 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { COMMERCE_COMMAND_BINDINGS } from "@kix/protocol-adapter";
import { AsyncState } from "../components/AsyncState";
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Link } from "react-router-dom";
import { StatusMark } from "../a11y/marks";
import {
  useReceiptExplorer,
  ROLE_CONTEXTS,
  type ReceiptContext,
  type ReceiptEntry,
  type ReceiptExplorerModel,
  type ReceiptGroup,
} from "../receipt-explorer";
import { buildReceiptTimelinePage, receiptSelectionKey, type ReceiptTimelineQuery } from "../receipt-pagination";
import { TRACK_STATES, WORKSPACE_ROLES, type WorkspaceRole, type TrackState } from "../workspace/registry";

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  buyer: "Buyer",
  organizer: "Organizer",
  operator: copy0.en["s15p"],
};

export function ReceiptsPage() {
  const [role, setRole] = useState<WorkspaceRole>("buyer");
  const model = useReceiptExplorer(role);
  return <ReceiptScreen model={model} role={role} onRole={setRole} />;
}

export function ReceiptScreen(props: {
  model: ReceiptExplorerModel;
  role: WorkspaceRole;
  onRole: (role: WorkspaceRole) => void;
}) {
  const roleFocus = useRef(false);
  const focusedEntry = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    if (roleFocus.current) {
      roleFocus.current = false;
      document.getElementById(`receipt-tab-${props.role}`)?.focus();
    }
  }, [props.role]);
  // Remount local presentation state synchronously at the authorization boundary.
  const key = JSON.stringify([props.model.sessionId, props.model.role, props.role]);
  const [boundary, setBoundary] = useState({ key, initialize: true });
  if (boundary.key !== key) setBoundary({ key, initialize: false });
  return <ReceiptView key={key} focusedEntry={focusedEntry} initialize={boundary.key === key && boundary.initialize} {...props} onRole={(next) => {
    roleFocus.current = next !== props.role;
    props.onRole(next);
  }} />;
}

function ReceiptView({
  focusedEntry,
  initialize,
  model,
  role,
  onRole,
}: {
  initialize: boolean;
  focusedEntry: RefObject<HTMLButtonElement | null>;
  model: ReceiptExplorerModel;
  role: WorkspaceRole;
  onRole: (role: WorkspaceRole) => void;
}) {
  const t = useT(mergedCopy, deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7);
  const entries = flatEntries(model);
  const keyOf = (entry: ReceiptEntry) => receiptSelectionKey(model, entry);
  const identities = new Map<string, ReceiptEntry[]>();
  for (const entry of entries) {
    const key = keyOf(entry);
    identities.set(key, [...(identities.get(key) ?? []), entry]);
  }
  const [selected, setSelected] = useState<string | null>(() => {
    const first = entries[0];
    return initialize && first && identities.get(keyOf(first))?.length === 1 ? keyOf(first) : null;
  });
  const matches = selected === null ? [] : identities.get(selected) ?? [];
  const current = matches.length === 1 ? matches[0] : null;
  // Invalidate permanently: later arrivals must never restore a missing/ambiguous selection.
  if (selected !== null && !current) setSelected(null);
  const [query, setQuery] = useState<ReceiptTimelineQuery>({ status: "all", context: "all", page: 1 });
  const timeline = buildReceiptTimelinePage(model, query);
  if (timeline.page !== query.page && query.page !== 1) setQuery({ ...query, page: timeline.page || 1 });
  const offPage = current && !timeline.entries.includes(current);
  // The shell owns the initial route announcement. Local changes subsequently speak here.
  const announcementToken = JSON.stringify([timeline.start, timeline.end, timeline.filteredCount,
    timeline.totalCount, timeline.unknownCount, selected, current?.status, Boolean(offPage)]);
  const [announcement, setAnnouncement] = useState({ token: announcementToken, live: !initialize });
  if (announcement.token !== announcementToken) setAnnouncement({ token: announcementToken, live: true });
  const statusRef = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    if (focusedEntry.current && !focusedEntry.current.isConnected) {
      focusedEntry.current = null;
      statusRef.current?.focus();
    }
  });
  // Ambiguous evidence has no stable logical identity. Never reuse its DOM node for another candidate.
  const ambiguousKeys = useRef(new WeakMap<ReceiptEntry, number>());
  const nextAmbiguousKey = useRef(0);
  const rowKey = (entry: ReceiptEntry) => {
    const key = keyOf(entry);
    if (identities.get(key)?.length === 1) return key;
    let token = ambiguousKeys.current.get(entry);
    if (token === undefined) {
      token = nextAmbiguousKey.current++;
      ambiguousKeys.current.set(entry, token);
    }
    return `ambiguous:${key}:${token}`;
  };
  const panelId = useId();
  const exportRef = useRef<HTMLTextAreaElement>(null);
  const [copyNote, setCopyNote] = useState<string>(copy0.en["e.34"]);

  function chooseRole(next: WorkspaceRole) {
    setSelected(null);
    onRole(next);
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, currentRole: WorkspaceRole) {
    const index = WORKSPACE_ROLES.indexOf(currentRole);
    let next = index;
    if (event.key === copy0.en["s7p"] || event.key === copy0.en["s7n"]) {
      next = (index + 1) % WORKSPACE_ROLES.length;
    } else if (event.key === copy0.en["s7o"] || event.key === copy0.en["s7q"]) {
      next = (index - 1 + WORKSPACE_ROLES.length) % WORKSPACE_ROLES.length;
    } else if (event.key === copy0.en["sni"]) {
      next = 0;
    } else if (event.key === copy0.en["sid"]) {
      next = WORKSPACE_ROLES.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const roleNext = WORKSPACE_ROLES[next];
    if (roleNext) {
      chooseRole(roleNext);
    }
  }

  function onTimelineKey(event: KeyboardEvent<HTMLElement>) {
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-entry-id]"));
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) {
      return;
    }
    let next = index;
    if (event.key === copy0.en["s7n"] || event.key === copy0.en["s7p"]) {
      next = Math.min(buttons.length - 1, index + 1);
    } else if (event.key === copy0.en["s7q"] || event.key === copy0.en["s7o"]) {
      next = Math.max(0, index - 1);
    } else if (event.key === copy0.en["sni"]) {
      next = 0;
    } else if (event.key === copy0.en["sid"]) {
      next = buttons.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const button = buttons[next];
    button?.focus();
    const id = button?.dataset.entryId;
    if (id) {
      setSelected(id);
    }
  }

  function onCopy() {
    const node = exportRef.current;
    node?.focus();
    node?.select();
    const clipboard = navigator.clipboard;
    if (!clipboard || typeof clipboard.writeText !== "function") {
      setCopyNote(copy0.en["e.35"]);
      return;
    }
    void clipboard.writeText(model.exportText).then(
      () => setCopyNote(copy0.en["e.36"]),
      () => setCopyNote(copy0.en["e.35"]),
    );
  }

  return (
    <div
      className="receipt"
      data-adapter-environment={model.environment}
      data-profile={model.profile}
      data-role={model.role}
    >
      <nav className="receipt-nav" aria-label={t("s1dg")} data-adapter-environment={model.environment}>
        <a href="#receipt-timeline">{t("s248")}</a>
        <a href="#receipt-detail">{t("sgf")}</a>
        <a href="#receipt-export">{t("ski")}</a>
      </nav>
      <div className="receipt-body">
        <header className="section-head receipt-section" data-adapter-environment={model.environment}>
          <p className="eyebrow">{t("s1db")}</p>
          <h2 aria-describedby="receipt-timeline">{t("s1db")}</h2>
          <p>{deskText(t, model.ruling)}</p>
          <p>{deskText(t, model.stubSentence)}</p>
          <p>{deskText(t, model.readNote)}</p>
          <p>{deskText(t, model.sessionNote)}</p>
          <p>{deskText(t, model.reloadNote)}</p>
          <p>
            {t("st8")}{" "}{model.environment}{t("s19a")}{" "}{deskText(t, model.profile)}{t("sh4")}{" "}{model.domain}.
          </p>
          <p>{t("s1jl")}{" "}{deskText(t, model.sessionId)}</p>
          <div role="tablist" aria-label={t("s1df")}>
            {deskText(t, WORKSPACE_ROLES.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                id={`receipt-tab-${item}`}
                className="receipt-tab"
                aria-selected={role === item}
                aria-controls={panelId}
                tabIndex={role === item ? 0 : -1}
                onClick={() => chooseRole(item)}
                onKeyDown={(event) => onTabKey(event, item)}
              >
                {deskText(t, ROLE_LABEL[item])}
              </button>
            )))}
          </div>
        </header>
        <div id={panelId} role="tabpanel" aria-labelledby={`receipt-tab-${role}`}>
          <section
            id="receipt-timeline"
            className="receipt-section"
            data-adapter-environment={model.environment}
            data-source={model.environment === "stub" ? "stub-shape" : "integration-gate"}
          >
            <h3>{t("s248")}</h3>
            <div className="receipt-filters">
              <label htmlFor="receipt-status-filter">{t("page.status")}</label>{" "}
              <select className="receipt-action" id="receipt-status-filter" value={query.status} onChange={(event) => setQuery({ ...query, status: event.target.value as "all" | TrackState, page: 1 })}>
                <option value="all">{t("page.all")}</option>
                {TRACK_STATES.map((status) => <option key={status} value={status}>{status === "unknown" ? t("page.unresolved") : status}</option>)}
              </select>{" "}
              <label htmlFor="receipt-context-filter">{t("page.context")}</label>{" "}
              <select className="receipt-action" id="receipt-context-filter" value={query.context} onChange={(event) => setQuery({ ...query, context: event.target.value as "all" | ReceiptContext, page: 1 })}>
                <option value="all">{t("page.all")}</option>
                {ROLE_CONTEXTS[model.role].map((context) => <option key={context} value={context}>{t(`page.${context}`)}</option>)}
              </select>{" "}
              <button type="button" className="receipt-action" onClick={() => setQuery({ status: "all", context: "all", page: 1 })}>{t("page.clear")}</button>
            </div>
            <p id="receipt-timeline-status" style={{ overflowWrap: "anywhere" }} ref={statusRef} role="status" aria-live={announcement.live ? "polite" : "off"} tabIndex={-1}>
              {t("page.count", { start: timeline.start, end: timeline.end, filtered: timeline.filteredCount, total: timeline.totalCount })}{" "}
              {t("page.unknown", { count: timeline.unknownCount })}{" "}
              {current ? t("page.selected", { action: current.action, status: current.status, operationId: current.operationId ?? t("common.empty") }) : t("page.unselected")}{" "}
              {offPage ? t("page.offPage") : ""}
            </p>
            <nav aria-label={t("page.navigation")}>
              {([ ["first", 1], ["previous", timeline.page - 1], ["next", timeline.page + 1], ["last", timeline.pageCount] ] as const).map(([label, page]) => {
                const unavailable = !timeline.pageCount || (label === "first" || label === "previous" ? timeline.page <= 1 : timeline.page >= timeline.pageCount);
                return <button key={label} type="button" className="receipt-action" aria-disabled={unavailable} onClick={() => { if (!unavailable) setQuery({ ...query, page }); }}>{t(`page.${label}`)}</button>;
              })}
              <span>{t("page.number", { page: timeline.page, pages: timeline.pageCount })}</span>
            </nav>
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Entry buttons share arrow navigation across all visible groups. */}
            <div onKeyDown={onTimelineKey} onFocusCapture={(event) => {
              if (event.target instanceof HTMLButtonElement && event.target.dataset.entryId) focusedEntry.current = event.target;
            }} onBlurCapture={(event) => { if (event.relatedTarget) focusedEntry.current = null; }}>
              {timeline.paths.length > 0 ? (
                <div>
                  <h4>{t("s15")}</h4>
                  <p>{t("s3a")}</p>
                  <ol className="receipt-list">
                    {deskText(t, timeline.paths.map((entry) => (
                      <EntryButton key={rowKey(entry)} entry={entry} identity={keyOf(entry)} selected={current === entry} onSelect={setSelected} />
                    )))}
                  </ol>
                </div>
              ) : null}
              {timeline.filteredCount === 0 ? <AsyncState kind="empty" label={t("merge.receipts")} announcement="parent"><p className="empty">{t(timeline.totalCount === 0 ? "desk.buyer.empty" : "page.empty")}</p></AsyncState> : null}
              {deskText(t, timeline.groups.map((group) => (
                <GroupBlock key={group.id} group={group} selectedId={selected} onSelect={setSelected} keyOf={keyOf} rowKey={rowKey} />
              )))}
            </div>
          </section>
          <section
            id="receipt-detail"
            className="receipt-section"
            tabIndex={-1}
            data-adapter-environment={model.environment}
            data-state={current?.status ?? "empty"}
          >
            <h3 id="receipt-detail-title">{t("sgf")}</h3>
            {offPage ? <p>{t("page.offPage")}</p> : null}
            {current ? <Detail entry={current} /> : <AsyncState kind="empty" label={t("merge.receiptDetail")} announcement="parent"><p className="empty">{t(entries.length ? "page.unselected" : "desk.buyer.empty")}</p></AsyncState>}
          </section>
          <section
            id="receipt-quarantine"
            className="receipt-section"
            data-adapter-environment={model.environment}
            data-state={model.quarantine.length > 0 ? "error" : "empty"}
          >
            <h3>{t("szw")}</h3>
            {model.quarantine.length === 0 ? <p>{t("s11j")}</p> : null}
            <ul className="receipt-list">
              {deskText(t, model.quarantine.map((item, index) => (
                <li key={`${item.reason}:${item.operationId ?? "none"}:${index}`} data-state="error" data-reason={item.reason}>
                  <p>{deskText(t, item.reason)}</p>
                  <p>{t("sy")}{" "}{deskText(t, item.action) ?? t("common.empty")}</p>
                  <p>{t("s15j")}{" "}{deskText(t, item.operationId) ?? t("common.empty")}</p>
                  <p>{t("s23g")}</p>
                </li>
              )))}
            </ul>
          </section>
          <section className="receipt-section" data-adapter-environment={model.environment} data-source="none">
            <h3>{t("desk.buyer.recorded")}</h3>
            <ul className="receipt-list">
              <li data-state="not-bound" data-source="none">
                <AsyncState kind="not-bound" announcement="parent" label={t("merge.hold")} binding={{ method: "placeHold", record: COMMERCE_COMMAND_BINDINGS.placeHold }} />
                <p>
                  {model.placeHold.method} {t("s1mm")}{" "}{model.placeHold.consideredAction}{t("srq")}</p>
                <p>{deskText(t, model.placeHold.reason)}</p>
              </li>
              {deskText(t, model.recorded.map((entry) => (
                <li key={`${entry.sender}:${entry.action}`} data-state="not-bound" data-source="none">
                  <p>
                    {deskText(t, entry.sender)} {deskText(t, entry.action)}
                  </p>
                  <p>{deskText(t, entry.reason)}</p>
                </li>
              )))}
            </ul>
          </section>
          <section
            id="receipt-export"
            className="receipt-section receipt-export"
            data-adapter-environment={model.environment}
            data-export="support-diagnostic"
          >
            <h3>{t("s1nl")}</h3>
            <p>{t("s1xm")}</p>
            <p>{t("page.export")}</p>
            <label htmlFor="receipt-diagnostic">{t("s1ni")}</label>
            <textarea
              id="receipt-diagnostic"
              ref={exportRef}
              readOnly
              spellCheck={false}
              value={model.exportText}
              aria-label={t("s1ni")}
            />
            <button type="button" className="receipt-action" onClick={onCopy}>
              {t("see")}</button>
            <p role={copyNote === copy0.en["e.34"] ? undefined : "status"}>{deskText(t, copyNote)}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function flatEntries(model: ReceiptExplorerModel): ReceiptEntry[] {
  return [...model.paths, ...model.groups.flatMap((group) => group.entries)];
}

function GroupBlock({
  group,
  selectedId,
  onSelect,
  keyOf,
  rowKey,
}: {
  group: ReceiptGroup;
  selectedId: string | null;
  onSelect: (id: string) => void;
  keyOf: (entry: ReceiptEntry) => string;
  rowKey: (entry: ReceiptEntry) => string;
}) {
  const t = useT(mergedCopy, deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7);
  return (
    <div data-group={group.id}>
      <h4>{deskText(t, group.heading)}</h4>
      <p>{deskText(t, group.lastConfirmed)}</p>
      <p>{deskText(t, group.unconfirmed)}</p>
      <ol className="receipt-list">
        {deskText(t, group.entries.map((entry) => (
          <EntryButton key={rowKey(entry)} entry={entry} identity={keyOf(entry)} selected={selectedId === keyOf(entry)} onSelect={onSelect} />
        )))}
      </ol>
    </div>
  );
}

function EntryButton({
  entry,
  identity,
  selected,
  onSelect,
}: {
  entry: ReceiptEntry;
  identity: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const t = useT(mergedCopy, deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7);
  return (
    <li
      className="receipt-entry"
      data-action={entry.action}
      data-state={entry.status}
      data-source={entry.source}
      data-profile={entry.profile}
      data-confirmed={entry.confirmed ? "true" : "false"}
    >
      {selected ? <StatusMark kind="selected" /> : null}
      <button type="button" data-entry-id={identity} aria-current={selected ? "true" : undefined} onClick={() => onSelect(identity)}>
        {entry.action} {entry.status}
        {entry.operationId ? t("s15l", { operationId: entry.operationId }) : ""}
      </button>
      <p>{t("s15j")}{" "}{entry.operationId ?? t("common.empty")}</p>
      <p>{t("s1mj")}{" "}{entry.status}</p>
      <p>{t("s1l5")}{" "}{entry.source}</p>
      <p>{t("s19b")}{" "}{deskText(t, entry.profile)}</p>
      {entry.code ? <p>{t("error.fact.code")}{" "}{deskText(t, entry.code)}</p> : null}
      <p>{deskText(t, entry.meaning)}</p>
      {entry.unconfirmedReason ? <p>{deskText(t, entry.unconfirmedReason)}</p> : null}
      <p>{deskText(t, entry.nextAction)}</p>
    </li>
  );
}

function Detail({ entry }: { entry: ReceiptEntry }) {
  const t = useT(mergedCopy, deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7);
  return (
    <div data-action={entry.action} data-state={entry.status} data-confirmed={entry.confirmed ? "true" : "false"}>
      {entry.status === "unknown" ? <AsyncState kind="unknown" label={t("merge.receipt")} announcement="parent" /> : null}
      {entry.status === "stale" ? <AsyncState kind="stale" label={t("merge.receipt")} announcement="parent" /> : null}
      <dl className="receipt-detail" style={{ overflowWrap: "anywhere" }}>
        <dt>{t("s15j")}</dt>
        <dd>{entry.operationId ?? t("common.empty")}</dd>
        <dt>{t("s1mj")}</dt>
        <dd>{entry.status}</dd>
        <dt>{t("s1l5")}</dt>
        <dd>{entry.source}</dd>
        <dt>{t("s19b")}</dt>
        <dd>{deskText(t, entry.profile)}</dd>
        <dt>{t("s19c")}</dt>
        <dd>{deskText(t, entry.profileVersion)}</dd>
        <dt>{t("s12")}</dt>
        <dd>{deskText(t, entry.actorLabel)}</dd>
        <dt>{t("error.fact.code")}</dt>
        <dd>{deskText(t, entry.code) ?? t("common.empty")}</dd>
        <dt>{t("sd3")}</dt>
        <dd>{deskText(t, entry.codeClass)}</dd>
        <dt>{t("s1fq")}</dt>
        <dd>{deskText(t, entry.requestId) ?? t("common.empty")}</dd>
        <dt>{t("sek")}</dt>
        <dd>{deskText(t, entry.correlationId) ?? t("common.empty")}</dd>
      </dl>
      <p>{deskText(t, entry.meaning)}</p>
      {entry.unconfirmedReason ? <p>{deskText(t, entry.unconfirmedReason)}</p> : null}
      <p>{deskText(t, entry.nextAction)}</p>
      {entry.note.length > 0 ? <p>{deskText(t, entry.note)}</p> : null}
      {entry.fields.length === 0 ? <p>{t("sxl")}</p> : null}
      {entry.fields.length > 0 ? (
        <ul className="receipt-list">
          {deskText(t, entry.fields.map((field) => (
            <li key={field.key}>
              {deskText(t, field.key)} {deskText(t, field.value)}
            </li>
          )))}
        </ul>
      ) : null}
      {entry.deskHref ? (
        <Link className="button receipt-action" to={entry.deskHref}>
          {t("s15d")}</Link>
      ) : null}
    </div>
  );
}
