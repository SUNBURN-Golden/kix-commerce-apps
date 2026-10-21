import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { ValidatedForm } from "../forms/ValidatedForm";
import { field } from "../forms/validation";
import { useState } from "react";
import { Link } from "react-router-dom";
import { INVENTORY_SCENARIOS, type InventoryScenario } from "@kix/protocol-adapter";
import { AmountNotice, DeadlineLine, StatusMark } from "../a11y/marks";
import { applyPageKey, isListKey } from "../discovery/model";
import {
  INVENTORY_ADVANCE_LABEL,
  INVENTORY_BOUNDARY,
  INVENTORY_HOLD_NOTE,
  INVENTORY_PAGE_NOTE,
  INVENTORY_QUANTITY_HINT,
  INVENTORY_QUEUE_BOUNDARY,
  INVENTORY_QUEUE_JOIN_NOTE,
  INVENTORY_SCOPE_NOTE,
  INVENTORY_SOURCE_LINE,
  INVENTORY_TITLE,
  type InventoryActions,
  type PageModel,
  type PageRowView,
  type QueueModel,
  type SelectionModel,
  type SummaryModel,
} from "../inventory-venue";
import { WORKSPACE_RULING } from "../workspace/registry";

export function InventoryBanner({
  environment,
  scenario,
  servedGeneration,
  summary,
}: {
  environment: "stub" | "integration-http";
  scenario: InventoryScenario;
  servedGeneration: number;
  summary: SummaryModel;
}) {
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-served-generation={servedGeneration}
    >
      <p className="eyebrow">Inventory selection</p>
      <h2>{INVENTORY_TITLE}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-inventory">
        SYNTHETIC. {INVENTORY_SOURCE_LINE}
      </p>
      <p>{INVENTORY_BOUNDARY}</p>
      <AmountNotice />
      <p>{WORKSPACE_RULING}</p>
      <p data-hold-record="not-bound">{INVENTORY_HOLD_NOTE}</p>
      <p>{INVENTORY_SCOPE_NOTE}</p>
      <p className="muted" data-generation-line={summary.generationBehind ? "behind" : "current"}>
        {summary.metaLine}
      </p>
    </header>
  );
}

export function InventoryControls({
  scenario,
  summary,
  actions,
}: {
  scenario: InventoryScenario;
  summary: SummaryModel;
  actions: InventoryActions;
}) {
  return (
    <section id="inventory-controls" className="discovery-section" aria-label="Synthetic controls">
      <div className="discovery-controls">
        <label htmlFor="inventory-scenario">
          Synthetic scenario
          <select
            id="inventory-scenario"
            value={scenario}
            onChange={(event) => actions.setScenario(event.target.value as InventoryScenario)}
          >
            {INVENTORY_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <ConnectivityWriteButton requiresFresh={false} type="button" className="discovery-action" onClick={() => actions.advanceGeneration()}>
          {INVENTORY_ADVANCE_LABEL}
        </ConnectivityWriteButton>
        <button type="button" className="discovery-action" onClick={() => actions.readSummaryAgain()}>
          Read summary again
        </button>
      </div>
      <p className="muted">
        {INVENTORY_ADVANCE_LABEL} serves the next synthetic generation and reads nothing. Your next read is refused until you go back to the
        summary.
      </p>
      {summary.generationBehind ? (
        <p role="status" data-generation="behind">
          <StatusMark kind="blocked" /> The inventory serves a newer generation than your last summary read.
        </p>
      ) : null}
    </section>
  );
}

export function QueueCard({ queue }: { queue: QueueModel }) {
  return (
    <div className="discovery-row" data-queue-state={queue.state} data-source="synthetic-inventory">
      <h3>Queue admission</h3>
      <p className="discovery-status">{queue.stateLine}</p>
      {queue.positionLine ? <p>{queue.positionLine}</p> : null}
      {queue.deadline ? (
        <p>
          Admitted until <DeadlineLine expiresAt={queue.deadline.expiresAt} expired={queue.deadline.expired} />
        </p>
      ) : null}
      <p>{queue.accessLine}</p>
      <p>{queue.note}</p>
      <p>{INVENTORY_QUEUE_BOUNDARY}</p>
      <p className="muted">{INVENTORY_QUEUE_JOIN_NOTE}</p>
    </div>
  );
}

export function SummarySection({ model, actions }: { model: SummaryModel; actions: InventoryActions }) {
  return (
    <section id="inventory-summary" className="discovery-section" data-inventory-state={model.state}>
      <h3>Summary</h3>
      <p role="status" data-inventory-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {model.statusLine}
        {model.detailLine ? ` ${model.detailLine}` : ""}
      </p>
      {model.actionLabel ? (
        <button type="button" className="discovery-action" onClick={() => actions.runReturn("summary")}>
          {model.actionLabel}
        </button>
      ) : null}
      {model.queue ? <QueueCard queue={model.queue} /> : null}
      {model.sections.length > 0 ? (
        <ul className="discovery-list" aria-label="Venue sections">
          {model.sections.map((section) => (
            <li
              key={section.sectionId}
              className="discovery-row"
              data-mode={section.mode}
              data-supported={section.supported ? "true" : "false"}
              data-provenance="synthetic"
              data-source="synthetic-inventory"
            >
              <p>
                <span className="discovery-badge" data-provenance="synthetic">
                  SYNTHETIC
                </span>{" "}
                <span className="discovery-badge" data-mode-badge={section.mode}>
                  {section.modeWord}
                </span>
              </p>
              <h3>{section.label}</h3>
              <p>{section.noteLine}</p>
              {section.capacityLine ? <p>{section.capacityLine}</p> : null}
              {section.bandLine ? <p>{section.bandLine}</p> : null}
              {section.supported ? (
                <Link className="button discovery-action" to={`/inventory?section=${encodeURIComponent(section.sectionId)}`}>
                  Open section
                </Link>
              ) : (
                <p data-state="unsupported" data-source="none">
                  <span className="discovery-badge">UNSUPPORTED</span> {section.unsupportedLine}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ObservedRow({
  row,
  active,
  onOpen,
}: {
  row: PageRowView;
  active: boolean;
  onOpen: (unitId: string) => void;
}) {
  return (
    <li
      id={`inventory-row-${row.unitId}`}
      role="option"
      aria-selected={active}
      className="discovery-row"
      data-mode={row.mode}
      data-observed={row.observedKind ?? undefined}
      data-hold-expired={row.hold ? (row.hold.expired ? "true" : "false") : undefined}
      data-provenance="synthetic"
      data-source="synthetic-inventory"
    >
      <p>
        <span className="discovery-badge" data-provenance="synthetic">
          SYNTHETIC
        </span>{" "}
        <span className="discovery-badge" data-observed-badge={row.observedKind ?? "band"}>
          {row.observedWord}
        </span>
      </p>
      {active ? <StatusMark kind="selected" /> : null}
      <h3>{row.title}</h3>
      <p>{row.observedLine}</p>
      {row.hold ? (
        <p>
          Hold <DeadlineLine expiresAt={row.hold.expiresAt} expired={row.hold.expired} />
        </p>
      ) : null}
      <button type="button" className="discovery-action" onClick={() => onOpen(row.unitId)}>
        Open detail
      </button>
    </li>
  );
}

function SeatList({
  rows,
  selectedUnitId,
  onOpen,
}: {
  rows: readonly PageRowView[];
  selectedUnitId: string | null;
  onOpen: (unitId: string) => void;
}) {
  const [focus, setFocus] = useState(0);
  const safe = rows.length === 0 ? 0 : Math.min(focus, rows.length - 1);
  const active = rows[safe];
  return (
    <ul
      className="discovery-list inventory-list"
      role="listbox"
      tabIndex={0}
      aria-label="Seats on this page"
      aria-activedescendant={active ? `inventory-row-${active.unitId}` : undefined}
      onKeyDown={(event) => {
        if (!isListKey(event.key)) {
          return;
        }
        const next = applyPageKey(safe, event.key, rows.length);
        event.preventDefault();
        setFocus(next.index);
        const row = rows[next.index];
        if (next.open && row) {
          onOpen(row.unitId);
        }
      }}
    >
      {rows.map((row) => (
        <ObservedRow key={row.unitId} row={row} active={row.unitId === selectedUnitId} onOpen={onOpen} />
      ))}
    </ul>
  );
}

function GaPool({
  row,
  quantityText,
  quantityInvalid,
  onQuantity,
  onSelect,
}: {
  row: PageRowView;
  quantityText: string;
  quantityInvalid: boolean;
  onQuantity: (next: string) => void;
  onSelect: (unitId: string) => void;
}) {
  return (
    <div
      className="discovery-row"
      data-mode="ga"
      data-provenance="synthetic"
      data-source="synthetic-inventory"
      data-pool={row.unitId}
    >
      <p>
        <span className="discovery-badge" data-provenance="synthetic">
          SYNTHETIC
        </span>{" "}
        <span className="discovery-badge" data-observed-badge="band">
          {row.observedWord}
        </span>
      </p>
      <h3>{row.title}</h3>
      <p>{row.noteLine}</p>
      <p>{row.observedLine}</p>
      {row.capacityLine ? <p>{row.capacityLine}</p> : null}
      <ValidatedForm id="inventory-ga-form" fields={[field("inventory-quantity", "validation.label.quantity", { kind: "positiveInteger" })]}
        className="discovery-controls"
        aria-label="GA quantity"
        onSubmit={(event) => {
          event.preventDefault();
          onSelect(row.unitId);
        }}
      >
        <label htmlFor="inventory-quantity">
          Quantity
          <input
            id="inventory-quantity"
            inputMode="numeric"
            value={quantityText}
            aria-invalid={quantityInvalid}
            aria-describedby="inventory-quantity-hint"
            onChange={(event) => onQuantity(event.target.value)}
          />
        </label>
        <button type="submit" className="discovery-action">
          Select quantity
        </button>
      </ValidatedForm>
      <p id="inventory-quantity-hint" className="muted">
        {INVENTORY_QUANTITY_HINT}
      </p>
    </div>
  );
}

export function PageSection({
  model,
  actions,
  selectedUnitId,
  quantityText,
  quantityInvalid,
  onQuantity,
  onOpen,
  onSelectPool,
}: {
  model: PageModel;
  actions: InventoryActions;
  selectedUnitId: string | null;
  quantityText: string;
  quantityInvalid: boolean;
  onQuantity: (next: string) => void;
  onOpen: (unitId: string) => void;
  onSelectPool: (unitId: string) => void;
}) {
  const seatRows = model.rows.filter((row) => row.mode === "seat");
  const poolRows = model.rows.filter((row) => row.mode === "ga");
  return (
    <section id="inventory-page" className="discovery-section" data-inventory-state={model.state} data-section={model.sectionId}>
      <h3>Page: {model.sectionLabel}</h3>
      <p className="muted">{INVENTORY_PAGE_NOTE}</p>
      <p className="muted">{model.metaLine}</p>
      <p role="status" data-inventory-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {model.statusLine}
        {model.detailLine ? ` ${model.detailLine}` : ""}
      </p>
      {model.state === "queue-blocked" && model.queue ? <QueueCard queue={model.queue} /> : null}
      <div className="discovery-controls">
        <Link className="button discovery-action" to="/inventory">
          Back to summary
        </Link>
        <button type="button" className="discovery-action" onClick={() => actions.readPageAgain()}>
          Read page again
        </button>
        {model.mode === "seat" ? (
          <>
            <label htmlFor="inventory-free-only">
              <input
                id="inventory-free-only"
                type="checkbox"
                checked={model.freeOnly}
                onChange={(event) => actions.setFreeOnly(event.target.checked)}
              />
              Free-observed only
            </label>
            <button type="button" className="discovery-action" disabled={!model.canNext} onClick={() => actions.nextPage()}>
              Next page
            </button>
          </>
        ) : null}
        {model.actionLabel ? (
          <button type="button" className="discovery-action" onClick={() => actions.runReturn("page")}>
            {model.actionLabel}
          </button>
        ) : null}
      </div>
      {seatRows.length > 0 ? <SeatList rows={seatRows} selectedUnitId={selectedUnitId} onOpen={onOpen} /> : null}
      {poolRows.map((row) => (
        <GaPool
          key={row.unitId}
          row={row}
          quantityText={quantityText}
          quantityInvalid={quantityInvalid}
          onQuantity={onQuantity}
          onSelect={onSelectPool}
        />
      ))}
    </section>
  );
}

export function SelectionSection({
  model,
  sectionId,
  unitId,
  actions,
  onClear,
}: {
  model: SelectionModel;
  sectionId: string;
  unitId: string;
  actions: InventoryActions;
  onClear: () => void;
}) {
  return (
    <section
      id="inventory-selection"
      className="discovery-section"
      data-inventory-state={model.state}
      data-selection={model.mode ?? "none"}
      data-section={sectionId}
      data-unit={unitId}
    >
      <h3>Selection detail</h3>
      <article
        className="discovery-detail"
        data-source={model.selected ? "synthetic-inventory" : "none"}
        data-selected={model.selected ? "true" : "false"}
      >
        <p role="status" data-inventory-status={model.state}>
          {model.state === "loading" ? <StatusMark kind="loading" /> : null} {model.statusLine}
          {model.detailLine ? ` ${model.detailLine}` : ""}
        </p>
        {model.selected ? (
          <>
            <StatusMark kind="selected" />
            <p>
              <span className="discovery-badge" data-provenance="synthetic">
                SYNTHETIC
              </span>{" "}
              <span className="discovery-badge">{model.observedWord}</span>
            </p>
            <h3>{model.title}</h3>
            {model.quantityLine ? <p data-quantity="count">{model.quantityLine}</p> : null}
            {model.assignmentLine ? <p data-assignment="none">{model.assignmentLine}</p> : null}
            {model.changedSincePage ? (
              <p data-changed-since-page="true">This unit changed since the page was read.</p>
            ) : null}
            <p data-selection-boundary="local">{model.boundaryLine}</p>
            <p>{INVENTORY_BOUNDARY}</p>
            <p className="muted">No purchase path runs from this selection.</p>
          </>
        ) : null}
        {model.hold ? (
          <p>
            Observed hold <DeadlineLine expiresAt={model.hold.expiresAt} expired={model.hold.expired} />
          </p>
        ) : null}
        <div className="discovery-controls">
          {model.actionLabel ? (
            <button type="button" className="discovery-action" onClick={() => actions.runReturn("selection")}>
              {model.actionLabel}
            </button>
          ) : null}
          <button type="button" className="discovery-action" onClick={() => actions.readSelectionAgain()}>
            Read detail again
          </button>
          <button type="button" className="discovery-action" onClick={onClear}>
            {model.selected ? "Clear selection" : "Close detail"}
          </button>
        </div>
      </article>
    </section>
  );
}
