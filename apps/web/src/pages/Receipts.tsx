import { COMMERCE_COMMAND_BINDINGS } from "@kix/protocol-adapter";
import { AsyncState } from "../components/AsyncState";
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
  operator: "Operator",
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
  const entries = flatEntries(model);
  const [selected, setSelected] = useState<string | null>(null);
  const current = entries.find((entry) => entry.id === selected) ?? entries[0] ?? null;
  const panelId = useId();
  const keyboardRole = useRef(false);
  const exportRef = useRef<HTMLTextAreaElement>(null);
  const [copyNote, setCopyNote] = useState("The diagnostic is in the text box.");

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
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (index + 1) % WORKSPACE_ROLES.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + WORKSPACE_ROLES.length) % WORKSPACE_ROLES.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
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
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      next = Math.min(buttons.length - 1, index + 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      next = Math.max(0, index - 1);
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
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
      setCopyNote("Select the diagnostic and copy it from the text box.");
      return;
    }
    void clipboard.writeText(model.exportText).then(
      () => setCopyNote("Copied the diagnostic."),
      () => setCopyNote("Select the diagnostic and copy it from the text box."),
    );
  }

  return (
    <div
      className="receipt"
      data-adapter-environment={model.environment}
      data-profile={model.profile}
      data-role={model.role}
    >
      <nav className="receipt-nav" aria-label="Receipt sections" data-adapter-environment={model.environment}>
        <a href="#receipt-timeline">Timeline</a>
        <a href="#receipt-detail">Detail</a>
        <a href="#receipt-export">Export</a>
      </nav>
      <div className="receipt-body">
        <header className="section-head receipt-section" data-adapter-environment={model.environment}>
          <p className="eyebrow">Receipt explorer</p>
          <h2>Receipt explorer</h2>
          <p>{model.ruling}</p>
          <p>{model.stubSentence}</p>
          <p>{model.readNote}</p>
          <p>{model.sessionNote}</p>
          <p>{model.reloadNote}</p>
          <p>
            Mode {model.environment}. Profile {model.profile}. Domain {model.domain}.
          </p>
          <p>Session {model.sessionId}</p>
          <div role="tablist" aria-label="Receipt role">
            {WORKSPACE_ROLES.map((item) => (
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
                {ROLE_LABEL[item]}
              </button>
            ))}
          </div>
        </header>
        <div id={panelId} role="tabpanel" aria-labelledby={`receipt-tab-${role}`}>
          <section
            id="receipt-timeline"
            className="receipt-section"
            data-adapter-environment={model.environment}
            data-source={model.environment === "stub" ? "stub-shape" : "integration-gate"}
          >
            <h3>Timeline</h3>
            {model.paths.length > 0 ? (
              <div>
                <h4>Adapter path</h4>
                <p>An adapter path observation is not a protocol command and not a receipt.</p>
                {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Keyboard navigation is managed on the list because its items are buttons; arrow keys move focus among entries. */}
                <ol className="receipt-list" onKeyDown={onTimelineKey}>
                  {model.paths.map((entry) => (
                    <EntryButton key={entry.id} entry={entry} selected={current?.id === entry.id} onSelect={setSelected} />
                  ))}
                </ol>
              </div>
            ) : null}
            {model.groups.length === 0 ? <AsyncState kind="empty" label="Receipts"><p className="empty">No receipt on this page load.</p></AsyncState> : null}
            {model.groups.map((group) => (
              <GroupBlock key={group.id} group={group} selectedId={current?.id ?? null} onSelect={setSelected} onKeyDown={onTimelineKey} />
            ))}
          </section>
          <section
            id="receipt-detail"
            className="receipt-section"
            tabIndex={-1}
            data-adapter-environment={model.environment}
            data-state={current?.status ?? "empty"}
            aria-live="polite"
          >
            <h3 id="receipt-detail-title">Detail</h3>
            {current ? <Detail entry={current} /> : <AsyncState kind="empty" label="Receipt detail" announcement="parent"><p className="empty">No receipt on this page load.</p></AsyncState>}
          </section>
          <section
            id="receipt-quarantine"
            className="receipt-section"
            data-adapter-environment={model.environment}
            data-state={model.quarantine.length > 0 ? "error" : "empty"}
          >
            <h3>Not applied</h3>
            {model.quarantine.length === 0 ? <p>Nothing was kept off this screen.</p> : null}
            <ul className="receipt-list">
              {model.quarantine.map((item, index) => (
                <li key={`${item.reason}:${item.operationId ?? "none"}:${index}`} data-state="error" data-reason={item.reason}>
                  <p>{item.reason}</p>
                  <p>Action {item.action ?? "none"}</p>
                  <p>Operation {item.operationId ?? "none"}</p>
                  <p>This record was not applied. It does not confirm an outcome.</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="receipt-section" data-adapter-environment={model.environment} data-source="none">
            <h3>Recorded and not sent</h3>
            <ul className="receipt-list">
              <li data-state="not-bound" data-source="none">
                <AsyncState kind="not-bound" label="Hold" binding={{ method: "placeHold", record: COMMERCE_COMMAND_BINDINGS.placeHold }} />
                <p>
                  {model.placeHold.method} stays not-bound. consideredAction {model.placeHold.consideredAction}.
                  mappedOntoPrepareTrade false.
                </p>
                <p>{model.placeHold.reason}</p>
              </li>
              {model.recorded.map((entry) => (
                <li key={`${entry.sender}:${entry.action}`} data-state="not-bound" data-source="none">
                  <p>
                    {entry.sender} {entry.action}
                  </p>
                  <p>{entry.reason}</p>
                </li>
              ))}
            </ul>
          </section>
          <section
            id="receipt-export"
            className="receipt-section receipt-export"
            data-adapter-environment={model.environment}
            data-export="support-diagnostic"
          >
            <h3>Support export</h3>
            <p>The same diagnostic is shown to the person and to support. It does not confirm an unknown outcome.</p>
            <label htmlFor="receipt-diagnostic">Support diagnostic</label>
            <textarea
              id="receipt-diagnostic"
              ref={exportRef}
              readOnly
              spellCheck={false}
              value={model.exportText}
              aria-label="Support diagnostic"
            />
            <button type="button" className="receipt-action" onClick={onCopy}>
              Copy diagnostic
            </button>
            <p role="status">{copyNote}</p>
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
  return (
    <div data-group={group.id}>
      <h4>{group.heading}</h4>
      <p>{group.lastConfirmed}</p>
      <p>{group.unconfirmed}</p>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Keyboard navigation is managed on the list because its items are buttons; arrow keys move focus among entries. */}
      <ol className="receipt-list" onKeyDown={onKeyDown}>
        {group.entries.map((entry) => (
          <EntryButton key={entry.id} entry={entry} selected={selectedId === entry.id} onSelect={onSelect} />
        ))}
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
        {entry.operationId ? ` ${entry.operationId}` : ""}
      </button>
      <p>Operation {entry.operationId ?? "none"}</p>
      <p>Status {entry.status}</p>
      <p>Source {entry.source}</p>
      <p>Profile {entry.profile}</p>
      {entry.code ? <p>Code {entry.code}</p> : null}
      <p>{entry.meaning}</p>
      {entry.unconfirmedReason ? <p>{entry.unconfirmedReason}</p> : null}
      <p>{entry.nextAction}</p>
    </li>
  );
}

function Detail({ entry }: { entry: ReceiptEntry }) {
  return (
    <div data-action={entry.action} data-state={entry.status} data-confirmed={entry.confirmed ? "true" : "false"}>
      {entry.status === "unknown" ? <AsyncState kind="unknown" label="Receipt" announcement="parent" /> : null}
      {entry.status === "stale" ? <AsyncState kind="stale" label="Receipt" announcement="parent" /> : null}
      <dl className="receipt-detail">
        <dt>Operation</dt>
        <dd>{entry.operationId ?? "none"}</dd>
        <dt>Status</dt>
        <dd>{entry.status}</dd>
        <dt>Source</dt>
        <dd>{entry.source}</dd>
        <dt>Profile</dt>
        <dd>{entry.profile}</dd>
        <dt>Profile version</dt>
        <dd>{entry.profileVersion}</dd>
        <dt>Actor</dt>
        <dd>{entry.actorLabel}</dd>
        <dt>Code</dt>
        <dd>{entry.code ?? "none"}</dd>
        <dt>Code class</dt>
        <dd>{entry.codeClass}</dd>
        <dt>Request</dt>
        <dd>{entry.requestId ?? "none"}</dd>
        <dt>Correlation</dt>
        <dd>{entry.correlationId ?? "none"}</dd>
      </dl>
      <p>{entry.meaning}</p>
      {entry.unconfirmedReason ? <p>{entry.unconfirmedReason}</p> : null}
      <p>{entry.nextAction}</p>
      {entry.note.length > 0 ? <p>{entry.note}</p> : null}
      {entry.fields.length === 0 ? <p>No receipt fields on this action.</p> : null}
      {entry.fields.length > 0 ? (
        <ul className="receipt-list">
          {entry.fields.map((field) => (
            <li key={field.key}>
              {field.key} {field.value}
            </li>
          ))}
        </ul>
      ) : null}
      {entry.deskHref ? (
        <Link className="button receipt-action" to={entry.deskHref}>
          Open the desk
        </Link>
      ) : null}
    </div>
  );
}
