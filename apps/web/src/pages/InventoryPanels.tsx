import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/pages--InventoryPanels";
import { messages as copy1 } from "../i18n/messages/discovery--model";
import { messages as copy2 } from "../i18n/messages/discovery--fixture";
import { messages as copy3 } from "../i18n/messages/a11y--present";
import { messages as copy4 } from "../i18n/messages/inventory-venue";
import { messages as copy5 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
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
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5);
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-served-generation={servedGeneration}
    >
      <p className="eyebrow">{t("sop")}</p>
      <h2>{deskText(t, INVENTORY_TITLE)}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-inventory">
        SYNTHETIC. {deskText(t, INVENTORY_SOURCE_LINE)}
      </p>
      <p>{deskText(t, INVENTORY_BOUNDARY)}</p>
      <AmountNotice />
      <p>{deskText(t, WORKSPACE_RULING)}</p>
      <p data-hold-record="not-bound">{deskText(t, INVENTORY_HOLD_NOTE)}</p>
      <p>{deskText(t, INVENTORY_SCOPE_NOTE)}</p>
      <p className="muted" data-generation-line={summary.generationBehind ? "behind" : "current"}>
        {deskText(t, summary.metaLine)}
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
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5);
  return (
    <section id="inventory-controls" className="discovery-section" aria-label={t("s1o9")}>
      <div className="discovery-controls">
        <label htmlFor="inventory-scenario">
          {t("s1p5")}<select
            id="inventory-scenario"
            value={scenario}
            onChange={(event) => actions.setScenario(event.target.value as InventoryScenario)}
          >
            {deskText(t, INVENTORY_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {deskText(t, item)}
              </option>
            )))}
          </select>
        </label>
        <ConnectivityWriteButton requiresFresh={false} type="button" className="discovery-action" onClick={() => actions.advanceGeneration()}>
          {deskText(t, INVENTORY_ADVANCE_LABEL)}
        </ConnectivityWriteButton>
        <button type="button" className="discovery-action" onClick={() => actions.readSummaryAgain()}>
          {t("s1ca")}</button>
      </div>
      <p className="muted">
        {deskText(t, INVENTORY_ADVANCE_LABEL)} {t("s1jg")}</p>
      {summary.generationBehind ? (
        <p role="status" data-generation="behind">
          <StatusMark kind="blocked" /> {t("s1tc")}</p>
      ) : null}
    </section>
  );
}

export function QueueCard({ queue }: { queue: QueueModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5);
  return (
    <div className="discovery-row" data-queue-state={queue.state} data-source="synthetic-inventory">
      <h3>{t("s1as")}</h3>
      <p className="discovery-status" aria-live="polite">{deskText(t, queue.stateLine)}</p>
      {queue.positionLine ? <p>{deskText(t, queue.positionLine)}</p> : null}
      {queue.deadline ? (
        <p>
          {t("s1r")}{" "}<DeadlineLine expiresAt={queue.deadline.expiresAt} expired={queue.deadline.expired} />
        </p>
      ) : null}
      <p>{deskText(t, queue.accessLine)}</p>
      <p>{deskText(t, queue.note)}</p>
      <p>{deskText(t, INVENTORY_QUEUE_BOUNDARY)}</p>
      <p className="muted">{deskText(t, INVENTORY_QUEUE_JOIN_NOTE)}</p>
    </div>
  );
}

export function SummarySection({ model, actions }: { model: SummaryModel; actions: InventoryActions }) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5);
  return (
    <section id="inventory-summary" className="discovery-section" data-inventory-state={model.state}>
      <h3>{t("s1ne")}</h3>
      <p role="status" data-inventory-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {deskText(t, model.statusLine)}
        {model.detailLine ? t("sgg", { detailLine: model.detailLine }) : ""}
      </p>
      {model.actionLabel ? (
        <button type="button" className="discovery-action" onClick={() => actions.runReturn("summary")}>
          {deskText(t, model.actionLabel)}
        </button>
      ) : null}
      {model.queue ? <QueueCard queue={model.queue} /> : null}
      {model.sections.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s25x")}>
          {deskText(t, model.sections.map((section) => (
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
                  {deskText(t, section.modeWord)}
                </span>
              </p>
              <h3>{deskText(t, section.label)}</h3>
              <p>{deskText(t, section.noteLine)}</p>
              {section.capacityLine ? <p>{deskText(t, section.capacityLine)}</p> : null}
              {section.bandLine ? <p>{deskText(t, section.bandLine)}</p> : null}
              {section.supported ? (
                <Link className="button discovery-action" to={`/inventory?section=${encodeURIComponent(section.sectionId)}`}>
                  {t("s156")}</Link>
              ) : (
                <p data-state="unsupported" data-source="none">
                  <span className="discovery-badge">UNSUPPORTED</span> {deskText(t, section.unsupportedLine)}
                </p>
              )}
            </li>
          )))}
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
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5);
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
          {deskText(t, row.observedWord)}
        </span>
      </p>
      {active ? <StatusMark kind="selected" /> : null}
      <h3>{deskText(t, row.title)}</h3>
      <p>{deskText(t, row.observedLine)}</p>
      {row.hold ? (
        <p>
          {t("desk.booking.hold")}{" "}<DeadlineLine expiresAt={row.hold.expiresAt} expired={row.hold.expired} />
        </p>
      ) : null}
      <button type="button" className="discovery-action" onClick={() => onOpen(row.unitId)}>
        {t("s152")}</button>
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
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5);
  const [focus, setFocus] = useState(0);
  const safe = rows.length === 0 ? 0 : Math.min(focus, rows.length - 1);
  const active = rows[safe];
  return (
    <ul
      className="discovery-list inventory-list"
      role="listbox"
      tabIndex={0}
      aria-label={t("s1it")}
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
      {deskText(t, rows.map((row) => (
        <ObservedRow key={row.unitId} row={row} active={row.unitId === selectedUnitId} onOpen={onOpen} />
      )))}
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
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5);
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
          {deskText(t, row.observedWord)}
        </span>
      </p>
      <h3>{deskText(t, row.title)}</h3>
      <p>{deskText(t, row.noteLine)}</p>
      <p>{deskText(t, row.observedLine)}</p>
      {row.capacityLine ? <p>{deskText(t, row.capacityLine)}</p> : null}
      <ValidatedForm id="inventory-ga-form" fields={[field("inventory-quantity", "validation.label.quantity", { kind: "positiveInteger" })]}
        className="discovery-controls"
        aria-label={t("smc")}
        onSubmit={(event) => {
          event.preventDefault();
          onSelect(row.unitId);
        }}
      >
        <label htmlFor="inventory-quantity">
          {t("desk.booking.quantity")}<input
            id="inventory-quantity"
            inputMode="numeric"
            value={quantityText}
            aria-invalid={quantityInvalid}
            aria-describedby="inventory-quantity-hint"
            onChange={(event) => onQuantity(event.target.value)}
          />
        </label>
        <button type="submit" className="discovery-action">
          {t("s1j1")}</button>
      </ValidatedForm>
      <p id="inventory-quantity-hint" className="muted">
        {deskText(t, INVENTORY_QUANTITY_HINT)}
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
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5);
  const seatRows = model.rows.filter((row) => row.mode === "seat");
  const poolRows = model.rows.filter((row) => row.mode === "ga");
  return (
    <section id="inventory-page" className="discovery-section" data-inventory-state={model.state} data-section={model.sectionId}>
      <h3>{t("s16u")}{" "}{deskText(t, model.sectionLabel)}</h3>
      <p className="muted">{deskText(t, INVENTORY_PAGE_NOTE)}</p>
      <p className="muted">{deskText(t, model.metaLine)}</p>
      <p role="status" data-inventory-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {deskText(t, model.statusLine)}
        {model.detailLine ? t("sgg", { detailLine: model.detailLine }) : ""}
      </p>
      {model.state === "queue-blocked" && model.queue ? <QueueCard queue={model.queue} /> : null}
      <div className="discovery-controls">
        <Link className="button discovery-action" to="/inventory">
          {t("s9k")}</Link>
        <button type="button" className="discovery-action" onClick={() => actions.readPageAgain()}>
          {t("s1c2")}</button>
        {model.mode === "seat" ? (
          <>
            <label htmlFor="inventory-free-only">
              <input
                id="inventory-free-only"
                type="checkbox"
                checked={model.freeOnly}
                onChange={(event) => actions.setFreeOnly(event.target.checked)}
              />
              {t("sm2")}</label>
            <button type="button" className="discovery-action" disabled={!model.canNext} onClick={() => actions.nextPage()}>
              {t("stq")}</button>
          </>
        ) : null}
        {model.actionLabel ? (
          <button type="button" className="discovery-action" onClick={() => actions.runReturn("page")}>
            {deskText(t, model.actionLabel)}
          </button>
        ) : null}
      </div>
      {seatRows.length > 0 ? <SeatList rows={seatRows} selectedUnitId={selectedUnitId} onOpen={onOpen} /> : null}
      {deskText(t, poolRows.map((row) => (
        <GaPool
          key={row.unitId}
          row={row}
          quantityText={quantityText}
          quantityInvalid={quantityInvalid}
          onQuantity={onQuantity}
          onSelect={onSelectPool}
        />
      )))}
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
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5);
  return (
    <section
      id="inventory-selection"
      className="discovery-section"
      data-inventory-state={model.state}
      data-selection={model.mode ?? "none"}
      data-section={sectionId}
      data-unit={unitId}
    >
      <h3>{t("s1ix")}</h3>
      <article
        className="discovery-detail"
        data-source={model.selected ? "synthetic-inventory" : "none"}
        data-selected={model.selected ? "true" : "false"}
      >
        <p role="status" aria-busy={model.state === "loading"} data-inventory-status={model.state}>
          {model.state === "loading" ? <StatusMark kind="loading" /> : null} {deskText(t, model.statusLine)}
          {model.detailLine ? t("sgg", { detailLine: model.detailLine }) : ""}
        </p>
        {model.selected ? (
          <>
            <StatusMark kind="selected" />
            <p>
              <span className="discovery-badge" data-provenance="synthetic">
                SYNTHETIC
              </span>{" "}
              <span className="discovery-badge">{deskText(t, model.observedWord)}</span>
            </p>
            <h3>{deskText(t, model.title)}</h3>
            {model.quantityLine ? <p data-quantity="count">{deskText(t, model.quantityLine)}</p> : null}
            {model.assignmentLine ? <p data-assignment="none">{deskText(t, model.assignmentLine)}</p> : null}
            {model.changedSincePage ? (
              <p data-changed-since-page="true">{t("s241")}</p>
            ) : null}
            <p data-selection-boundary="local">{deskText(t, model.boundaryLine)}</p>
            <p>{deskText(t, INVENTORY_BOUNDARY)}</p>
            <p className="muted">{t("sx8")}</p>
          </>
        ) : null}
        {model.hold ? (
          <p>
            {t("s13l")}{" "}<DeadlineLine expiresAt={model.hold.expiresAt} expired={model.hold.expired} />
          </p>
        ) : null}
        <div className="discovery-controls">
          {model.actionLabel ? (
            <button type="button" className="discovery-action" onClick={() => actions.runReturn("selection")}>
              {deskText(t, model.actionLabel)}
            </button>
          ) : null}
          <button type="button" className="discovery-action" onClick={() => actions.readSelectionAgain()}>
            {t("s1b8")}</button>
          <button type="button" className="discovery-action" onClick={onClear}>
            {model.selected ? t("scr") : t("scx")}
          </button>
        </div>
      </article>
    </section>
  );
}
