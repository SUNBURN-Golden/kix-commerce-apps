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
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { StatusMark } from "../a11y/marks";
import {
  useReceiptExplorer,
  type ReceiptEntry,
  type ReceiptExplorerModel,
  type ReceiptGroup,
} from "../receipt-explorer";
import { WORKSPACE_ROLES, type WorkspaceRole } from "../workspace/registry";

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

export function ReceiptScreen({
  model,
  role,
  onRole,
}: {
  model: ReceiptExplorerModel;
  role: WorkspaceRole;
  onRole: (role: WorkspaceRole) => void;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7);
  const entries = flatEntries(model);
  const [selected, setSelected] = useState<string | null>(null);
  const current = entries.find((entry) => entry.id === selected) ?? entries[0] ?? null;
  const panelId = useId();
  const keyboardRole = useRef(false);
  const exportRef = useRef<HTMLTextAreaElement>(null);
  const [copyNote, setCopyNote] = useState<string>(copy0.en["e.34"]);

  useEffect(() => {
    if (!keyboardRole.current) {
      return;
    }
    keyboardRole.current = false;
    document.getElementById(`receipt-tab-${role}`)?.focus();
  }, [role]);

  function chooseRole(next: WorkspaceRole, fromKeyboard: boolean) {
    keyboardRole.current = fromKeyboard;
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
      chooseRole(roleNext, true);
    }
  }

  function onTimelineKey(event: KeyboardEvent<HTMLOListElement>) {
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
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
          <h2>{t("s1db")}</h2>
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
                onClick={() => chooseRole(item, false)}
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
            {model.paths.length > 0 ? (
              <div>
                <h4>{t("s15")}</h4>
                <p>{t("s3a")}</p>
                {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Keyboard navigation is managed on the list because its items are buttons; arrow keys move focus among entries. */}
                <ol className="receipt-list" onKeyDown={onTimelineKey}>
                  {deskText(t, model.paths.map((entry) => (
                    <EntryButton key={entry.id} entry={entry} selected={current?.id === entry.id} onSelect={setSelected} />
                  )))}
                </ol>
              </div>
            ) : null}
            {model.groups.length === 0 ? <p className="empty">{t("desk.buyer.empty")}</p> : null}
            {deskText(t, model.groups.map((group) => (
              <GroupBlock key={group.id} group={group} selectedId={current?.id ?? null} onSelect={setSelected} onKeyDown={onTimelineKey} />
            )))}
          </section>
          <section
            id="receipt-detail"
            className="receipt-section"
            tabIndex={-1}
            data-adapter-environment={model.environment}
            data-state={current?.status ?? "empty"}
            aria-live="polite"
          >
            <h3 id="receipt-detail-title">{t("sgf")}</h3>
            {current ? <Detail entry={current} /> : <p className="empty">{t("desk.buyer.empty")}</p>}
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
            <p role="status">{deskText(t, copyNote)}</p>
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
  onKeyDown,
}: {
  group: ReceiptGroup;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLOListElement>) => void;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7);
  return (
    <div data-group={group.id}>
      <h4>{deskText(t, group.heading)}</h4>
      <p>{deskText(t, group.lastConfirmed)}</p>
      <p>{deskText(t, group.unconfirmed)}</p>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Keyboard navigation is managed on the list because its items are buttons; arrow keys move focus among entries. */}
      <ol className="receipt-list" onKeyDown={onKeyDown}>
        {deskText(t, group.entries.map((entry) => (
          <EntryButton key={entry.id} entry={entry} selected={selectedId === entry.id} onSelect={onSelect} />
        )))}
      </ol>
    </div>
  );
}

function EntryButton({
  entry,
  selected,
  onSelect,
}: {
  entry: ReceiptEntry;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7);
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
      <button type="button" data-entry-id={entry.id} aria-current={selected ? "true" : undefined} onClick={() => onSelect(entry.id)}>
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
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7);
  return (
    <div data-action={entry.action} data-state={entry.status} data-confirmed={entry.confirmed ? "true" : "false"}>
      <dl className="receipt-detail">
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
