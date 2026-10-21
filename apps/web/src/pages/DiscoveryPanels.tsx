import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/pages--DiscoveryPanels";
import { messages as copy1 } from "../i18n/messages/discovery-live";
import { messages as copy2 } from "../i18n/messages/a11y--present";
import { messages as copy3 } from "../i18n/messages/discovery--fixture";
import { messages as copy4 } from "../i18n/messages/discovery--model";
import { messages as copy5 } from "../i18n/messages/discovery-workspace";
import { messages as copy6 } from "../i18n/messages/buyer-workspace";
import { messages as copy7 } from "../i18n/messages/gift-desk";
import { messages as copy8 } from "../i18n/messages/storage-allow-list";
import { messages as copy9 } from "../i18n/messages/journey-desk";
import { messages as copy10 } from "../i18n/messages/resale-desk";
import { messages as copy11 } from "../i18n/messages/reservation-desk";
import { messages as copy12 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  DISCOVERY_ROW_KINDS,
  DISCOVERY_STREAMS,
  type DiscoveryRowKind,
  type DiscoveryStreamKind,
} from "@kix/protocol-adapter";
import {
  LIVE_READ_BOUNDARY,
  LIVE_READ_PAGE_NOTE,
  LIVE_READ_REBUILD_LABEL,
  LIVE_READ_SCOPE_NOTE,
  LIVE_READ_SOURCE_LINE,
  LIVE_READ_TITLE,
  type LiveDetailHandlers,
  type LiveDetailModel,
  type LiveListHandlers,
  type LiveListModel,
} from "../discovery-live";
import {
  DISCOVERY_KINDS,
  DISCOVERY_STATUSES,
  SYNTHETIC_TIERS,
} from "../discovery/fixture";
import type { DiscoveryRow } from "../discovery/fixture";
import {
  applyConflictClear,
  applyPageKey,
  applyScaleKey,
  clearFilters,
  DISCOVERY_SORTS,
  isDiscoverySort,
  isListKey,
  isPageSize,
  PAGE_SIZES,
  scaleWindow,
  toggleValue,
  withFilter,
  describeRow,
  type DiscoveryQuery,
  type RowFacts,
} from "../discovery/model";
import { AmountNotice, StatusMark } from "../a11y/marks";
import type { DiscoveryModel, PurchaseDecision } from "../discovery-workspace";
import { useT } from "../i18n/desk-context";
import { useFormatWhen } from "../i18n/locale-context";

export function DiscoveryBanner({ model }: { model: DiscoveryModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7, copy8, copy9, copy10, copy11, copy12);
  return (
    <header className="section-head discovery-section" data-adapter-environment={model.environment}>
      <p className="eyebrow">{t("sgs")}</p>
      <h2>{t("route.discovery")}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-fixture">
        {t("s1ok")}</p>
      <AmountNotice />
      <p>{t("s247")}</p>
      <p>{deskText(t, model.ruling)}</p>
      <p>{deskText(t, model.stubSentence)}</p>
      <p>{deskText(t, model.reloadNote)}</p>
      <p>{deskText(t, model.sampleNote)}</p>
    </header>
  );
}

export function CatalogNotice({ model, onReadAgain }: { model: DiscoveryModel; onReadAgain: () => void }) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7, copy8, copy9, copy10, copy11, copy12);
  if (model.catalog.kind === "loading") {
    return (
      <p className="muted" role="status">
        <StatusMark kind="loading" /> {t("desk.performance.loading")}</p>
    );
  }
  if (model.catalog.kind === "error") {
    return (
      <div>
        <p className="alert" role="alert">
          <StatusMark kind="blocked" /> {deskText(t, model.catalog.message)}
        </p>
        <button type="button" className="discovery-action" onClick={() => onReadAgain()}>
          {t("s1ax")}</button>
      </div>
    );
  }
  if (model.catalog.kind === "not-bound") {
    return (
      <p className="alert" role="alert" data-state="not-bound" data-source="none">
        <StatusMark kind="blocked" /> {deskText(t, model.catalog.reason)}
      </p>
    );
  }
  if (model.catalog.kind === "empty") {
    return <p className="empty">{t("desk.performance.empty")}</p>;
  }
  return <p>{t("desk.buyer.source")}{" "}{deskText(t, model.catalogSource)}</p>;
}

export function DiscoveryForm({
  query,
  onQuery,
  invalidControlId,
}: {
  query: DiscoveryQuery;
  onQuery: (next: DiscoveryQuery) => void;
  invalidControlId?: string | null;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7, copy8, copy9, copy10, copy11, copy12);
  const invalid = invalidControlId ?? null;
  return (
    <form
      id="discovery-filters"
      className="discovery-form"
      aria-label={t("sgr")}
      onSubmit={(event) => event.preventDefault()}
    >
      <label htmlFor="discovery-q">
        {t("s1in")}<input
          id="discovery-q"
          type="search"
          value={query.text}
          aria-invalid={invalid === "discovery-q"}
          onChange={(event) => onQuery(withFilter(query, { text: event.target.value }))}
        />
      </label>
      <fieldset>
        <legend>{t("sps")}</legend>
        {deskText(t, DISCOVERY_KINDS.map((kind) => (
          <label key={kind}>
            <input
              type="checkbox"
              name="kinds"
              value={kind}
              checked={query.kinds.includes(kind)}
              onChange={() => onQuery(withFilter(query, { kinds: toggleValue(query.kinds, kind, DISCOVERY_KINDS) }))}
            />
            {deskText(t, kind)}
          </label>
        )))}
      </fieldset>
      <fieldset>
        <legend>{t("s1mj")}</legend>
        {deskText(t, DISCOVERY_STATUSES.map((status) => (
          <label key={status}>
            <input
              type="checkbox"
              name="statuses"
              value={status}
              checked={query.statuses.includes(status)}
              onChange={() =>
                onQuery(withFilter(query, { statuses: toggleValue(query.statuses, status, DISCOVERY_STATUSES) }))
              }
            />
            {deskText(t, status)}
          </label>
        )))}
      </fieldset>
      <fieldset>
        <legend>{t("s244")}</legend>
        {deskText(t, SYNTHETIC_TIERS.map((tier) => (
          <label key={tier}>
            <input
              type="checkbox"
              name="tiers"
              value={tier}
              checked={query.tiers.includes(tier)}
              onChange={() => onQuery(withFilter(query, { tiers: toggleValue(query.tiers, tier, SYNTHETIC_TIERS) }))}
            />
            {deskText(t, tier)}
          </label>
        )))}
      </fieldset>
      <label htmlFor="discovery-section">
        {t("s1iu")}<input
          id="discovery-section"
          value={query.section}
          aria-invalid={invalid === "discovery-section"}
          aria-describedby={invalid === "discovery-section" ? "discovery-conflict" : undefined}
          onChange={(event) => onQuery(withFilter(query, { section: event.target.value }))}
        />
      </label>
      <label htmlFor="discovery-from">
        {t("sm5")}<input
          id="discovery-from"
          type="date"
          value={query.from}
          aria-invalid={invalid === "discovery-from"}
          aria-describedby={invalid === "discovery-from" ? "discovery-conflict" : undefined}
          onChange={(event) => onQuery(withFilter(query, { from: event.target.value }))}
        />
      </label>
      <label htmlFor="discovery-to">
        {t("s24a")}<input
          id="discovery-to"
          type="date"
          value={query.to}
          onChange={(event) => onQuery(withFilter(query, { to: event.target.value }))}
        />
      </label>
      <label htmlFor="discovery-purchasable">
        <input
          id="discovery-purchasable"
          type="checkbox"
          checked={query.purchasableOnly}
          aria-invalid={invalid === "discovery-purchasable"}
          aria-describedby={invalid === "discovery-purchasable" ? "discovery-conflict" : undefined}
          onChange={(event) => onQuery(withFilter(query, { purchasableOnly: event.target.checked }))}
        />
        {t("s1ad")}</label>
      <label htmlFor="discovery-sort">
        {t("s1l4")}<select
          id="discovery-sort"
          value={query.sort}
          onChange={(event) => {
            const value = event.target.value;
            if (!isDiscoverySort(value)) {
              return;
            }
            onQuery(withFilter(query, { sort: value }));
          }}
        >
          {deskText(t, DISCOVERY_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {deskText(t, sort)}
            </option>
          )))}
        </select>
      </label>
      <label htmlFor="discovery-page-size">
        {t("s16z")}<select
          id="discovery-page-size"
          value={String(query.pageSize)}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (!isPageSize(value)) {
              return;
            }
            onQuery(withFilter(query, { pageSize: value }));
          }}
        >
          {deskText(t, PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {deskText(t, size)}
            </option>
          )))}
        </select>
      </label>
      <button type="button" className="discovery-action" onClick={() => onQuery(clearFilters(query))}>
        {t("scq")}</button>
    </form>
  );
}

export function DiscoveryRowCard({
  row,
  facts,
  resaleReason,
  active,
  onOpen,
}: {
  row: DiscoveryRow;
  facts: RowFacts;
  resaleReason: string | null;
  active: boolean;
  onOpen: (rowId: string) => void;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7, copy8, copy9, copy10, copy11, copy12);
  const formatWhen = useFormatWhen();
  return (
    <li
      id={`discovery-result-${row.rowId}`}
      role="option"
      aria-selected={active}
      data-kind={row.kind}
      data-status={row.status}
      data-provenance="synthetic"
      data-source="synthetic-fixture"
      data-stale={facts.stale ? "true" : "false"}
      className="discovery-row"
    >
      <p>
        <span className="discovery-badge" data-provenance="synthetic">
          SYNTHETIC
        </span>
      </p>
      <p className="when">
        <time dateTime={row.startsAt}>{deskText(t, formatWhen(row.startsAt))}</time>
      </p>
      {active ? <StatusMark kind="selected" /> : null}
      <h3>{deskText(t, row.title)}</h3>
      <p className="muted">{deskText(t, row.venueLabel)}</p>
      <p>{deskText(t, facts.kindLine)}</p>
      <p className="discovery-status">{deskText(t, facts.statusLine)}</p>
      {facts.inventoryLine ? <p>{deskText(t, facts.inventoryLine)}</p> : null}
      {facts.countLine ? <p>{deskText(t, facts.countLine)}</p> : null}
      {facts.tierLine ? <p>{deskText(t, facts.tierLine)}</p> : null}
      {facts.resaleLine ? <p>{deskText(t, facts.resaleLine)}</p> : null}
      {facts.stale ? (
        <p>
          <span className="discovery-badge" data-state="stale">
            STALE
          </span>{" "}
          <time dateTime={row.priceAsOf}>{deskText(t, formatWhen(row.priceAsOf))}</time>
        </p>
      ) : null}
      {row.kind === "resale" && resaleReason ? (
        <p data-state="not-bound" data-source="none">
          {deskText(t, resaleReason)}
        </p>
      ) : null}
      <button type="button" className="discovery-action" onClick={() => onOpen(row.rowId)}>
        {t("s152")}</button>
    </li>
  );
}

export function ResultList({
  model,
  focus,
  onFocus,
  onOpen,
}: {
  model: DiscoveryModel;
  focus: number;
  onFocus: (index: number) => void;
  onOpen: (rowId: string) => void;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7, copy8, copy9, copy10, copy11, copy12);
  const rows = model.result.rows;
  const active = rows[focus];
  return (
    <ul
      className="discovery-list"
      role="listbox"
      tabIndex={0}
      aria-label={t("sgt")}
      aria-activedescendant={active ? `discovery-result-${active.rowId}` : undefined}
      onKeyDown={(event) => {
        if (!isListKey(event.key)) {
          return;
        }
        const next = applyPageKey(focus, event.key, rows.length);
        event.preventDefault();
        onFocus(next.index);
        const row = rows[next.index];
        if (next.open && row) {
          onOpen(row.rowId);
        }
      }}
    >
      {deskText(t, rows.map((row, index) => (
        <DiscoveryRowCard
          key={row.rowId}
          row={row}
          facts={describeRow(row)}
          resaleReason={row.kind === "resale" ? model.resaleNotBoundReason : null}
          active={index === focus}
          onOpen={onOpen}
        />
      )))}
    </ul>
  );
}

export function ScaleList({ onOpen, scaleTotal }: { onOpen: (rowId: string) => void; scaleTotal: number }) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7, copy8, copy9, copy10, copy11, copy12);
  const [scrollTop, setScrollTop] = useState(0);
  const [focus, setFocus] = useState(0);
  const windowed = scaleWindow({ scrollTop });
  const active = windowed.rows.find((row) => row.rowId === `scale-${focus}`);
  return (
    <section id="discovery-scale" className="discovery-section">
      <h3>{t("s1i9")}</h3>
      <p>{t("s1p2")}{" "}{deskText(t, scaleTotal)}</p>
      <p>{t("s1io")}</p>
      <ul
        className="discovery-list discovery-scale"
        role="listbox"
        tabIndex={0}
        aria-label={t("s1ia")}
        aria-activedescendant={active ? `discovery-scale-${active.rowId}` : undefined}
        onKeyDown={(event) => {
          if (!isListKey(event.key)) {
            return;
          }
          const next = applyScaleKey({ scrollTop, focus }, event.key);
          event.preventDefault();
          setScrollTop(next.scrollTop);
          setFocus(next.focus);
          if (next.open) {
            onOpen(`scale-${next.focus}`);
          }
        }}
      >
        {deskText(t, windowed.rows.map((row) => {
          const facts = describeRow(row);
          return (
            <li
              key={row.rowId}
              id={`discovery-scale-${row.rowId}`}
              role="option"
              aria-selected={row.rowId === `scale-${focus}`}
              data-kind={row.kind}
              data-provenance="synthetic"
              data-source="synthetic-fixture"
            >
              <span className="discovery-badge" data-provenance="synthetic">
                SYNTHETIC
              </span>{" "}
              <span>{deskText(t, row.title)}</span> <span>{deskText(t, facts.kindLine)}</span> <span>{deskText(t, facts.statusLine)}</span>
            </li>
          );
        }))}
      </ul>
    </section>
  );
}

export function LiveReadSection({
  model,
  handlers,
  onOpen,
}: {
  model: LiveListModel;
  handlers: LiveListHandlers;
  onOpen: (rowId: string) => void;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7, copy8, copy9, copy10, copy11, copy12);
  const formatWhen = useFormatWhen();
  const [focus, setFocus] = useState(0);
  const rows = model.rows;
  const safeFocus = rows.length === 0 ? 0 : Math.min(focus, rows.length - 1);
  const active = rows[safeFocus];
  return (
    <section id="discovery-live" className="discovery-section" data-live-state={model.state}>
      <h3>{deskText(t, LIVE_READ_TITLE)}</h3>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-projection">
        {deskText(t, LIVE_READ_SOURCE_LINE)}
      </p>
      <p>{deskText(t, LIVE_READ_BOUNDARY)}</p>
      <p>{deskText(t, LIVE_READ_SCOPE_NOTE)}</p>
      <p className="muted">{deskText(t, LIVE_READ_PAGE_NOTE)}</p>
      <p className="muted">{deskText(t, model.metaLine)}</p>
      <p role="status" data-live-status={model.state}>
        {deskText(t, model.statusLine)}
        {model.detailLine ? t("sgg", { detailLine: model.detailLine }) : ""}
      </p>
      <div className="discovery-controls">
        <label htmlFor="discovery-live-stream">
          {t("s1pa")}<select
            id="discovery-live-stream"
            value={model.stream}
            onChange={(event) => handlers.setStream(event.target.value as DiscoveryStreamKind)}
          >
            {deskText(t, DISCOVERY_STREAMS.map((stream) => (
              <option key={stream} value={stream}>
                {deskText(t, stream)}
              </option>
            )))}
          </select>
        </label>
        <label htmlFor="discovery-live-text">
          {t("s1pn")}<input
            id="discovery-live-text"
            type="search"
            maxLength={64}
            value={model.filter.text}
            onChange={(event) => handlers.setFilter({ ...model.filter, text: event.target.value })}
          />
        </label>
        <label htmlFor="discovery-live-kind">
          {t("sps")}<select
            id="discovery-live-kind"
            value={model.filter.kinds[0] ?? ""}
            onChange={(event) =>
              handlers.setFilter({
                ...model.filter,
                kinds: event.target.value === "" ? [] : [event.target.value as DiscoveryRowKind],
              })
            }
          >
            <option value="">{t("s2p")}</option>
            {deskText(t, DISCOVERY_ROW_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {deskText(t, kind)}
              </option>
            )))}
          </select>
        </label>
        <button type="button" className="discovery-action" onClick={() => handlers.rebuildProjection()}>
          {deskText(t, LIVE_READ_REBUILD_LABEL)}
        </button>
        {model.actionLabel ? (
          <button type="button" className="discovery-action" onClick={() => handlers.runReturn()}>
            {deskText(t, model.actionLabel)}
          </button>
        ) : null}
        <button
          type="button"
          className="discovery-action"
          disabled={!model.canNext}
          onClick={() => handlers.nextPage()}
        >
          {t("stq")}</button>
      </div>
      {rows.length > 0 ? (
        <ul
          className="discovery-list discovery-live-list"
          role="listbox"
          tabIndex={0}
          aria-label={t("s1ot")}
          aria-activedescendant={active ? `discovery-live-row-${active.rowId}` : undefined}
          onKeyDown={(event) => {
            if (!isListKey(event.key)) {
              return;
            }
            const next = applyPageKey(safeFocus, event.key, rows.length);
            event.preventDefault();
            setFocus(next.index);
            const row = rows[next.index];
            if (next.open && row) {
              onOpen(row.rowId);
            }
          }}
        >
          {deskText(t, rows.map((row, index) => (
            <li
              key={row.rowId}
              id={`discovery-live-row-${row.rowId}`}
              role="option"
              aria-selected={index === safeFocus}
              data-kind={row.kind}
              data-status={row.statusLabel}
              data-provenance="synthetic"
              data-source="synthetic-projection"
              className="discovery-row"
            >
              <p>
                <span className="discovery-badge" data-provenance="synthetic">
                  SYNTHETIC
                </span>
              </p>
              {index === safeFocus ? <StatusMark kind="selected" /> : null}
              <h3>{deskText(t, row.title)}</h3>
              <p>
                {deskText(t, row.kind)} · {deskText(t, row.statusLabel)} {t("s1jf")}{" "}{deskText(t, row.sequence)}
              </p>
              <p className="muted">{deskText(t, row.venueLabel)}</p>
              <p className="when">
                <time dateTime={row.watermark}>{formatWhen(row.watermark)}</time>
              </p>
              <button type="button" className="discovery-action" onClick={() => onOpen(row.rowId)}>
                {t("s152")}</button>
            </li>
          )))}
        </ul>
      ) : null}
    </section>
  );
}

export function LiveReadDetail({
  model,
  handlers,
}: {
  model: LiveDetailModel;
  handlers: LiveDetailHandlers;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7, copy8, copy9, copy10, copy11, copy12);
  const formatWhen = useFormatWhen();
  const row = model.row;
  return (
    <article
      className="discovery-detail"
      data-live-detail={model.state}
      data-source={row ? "synthetic-projection" : "none"}
    >
      {row ? (
        <>
          <p>
            <span className="discovery-badge" data-provenance="synthetic">
              {t("s1or")}</span>
          </p>
          <p className="muted">{t("s233")}</p>
          <h3>{deskText(t, row.title)}</h3>
          <p>
            {row.kind} · {deskText(t, row.statusLabel)} {t("s1jf")}{" "}{row.sequence}
          </p>
          <p className="muted">{deskText(t, row.venueLabel)}</p>
          <p className="when">
            <time dateTime={row.startsAt}>{deskText(t, formatWhen(row.startsAt))}</time>
          </p>
          <p className="when">
            {t("s26a")}{" "}<time dateTime={row.watermark}>{deskText(t, formatWhen(row.watermark))}</time>
          </p>
          <p>{deskText(t, LIVE_READ_BOUNDARY)}</p>
          <p className="muted">{t("sx7")}</p>
        </>
      ) : (
        <>
          <p role="status" data-live-status={model.state}>
            {deskText(t, model.statusLine)}
            {model.detailLine ? t("sgg", { detailLine: model.detailLine }) : ""}
          </p>
          {model.actionLabel ? (
            <button type="button" className="discovery-action" onClick={() => handlers.readAgain()}>
              {deskText(t, model.actionLabel)}
            </button>
          ) : null}
        </>
      )}
    </article>
  );
}

export function PurchasePathView({ purchase }: { purchase: PurchaseDecision }) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7, copy8, copy9, copy10, copy11, copy12);
  if (purchase.kind === "booking") {
    return (
      <p data-purchase="booking">
        <Link className="button discovery-action" to={`/booking/${encodeURIComponent(purchase.eventId)}`}>
          {t("desk.buyer.open")}</Link>
      </p>
    );
  }
  if (purchase.kind === "not-bound") {
    return (
      <p data-purchase="not-bound" data-state="not-bound" data-source="none">
        {deskText(t, purchase.reason)}
      </p>
    );
  }
  if (purchase.kind === "unavailable") {
    return <p data-purchase="unavailable">{deskText(t, purchase.message)}</p>;
  }
  return (
    <p data-purchase="unsupported">
      {deskText(t, purchase.message)}
      {purchase.inventoryRoute ? (
        <>
          {" "}
          <Link className="button discovery-action" to={purchase.inventoryRoute}>
            {t("s159")}</Link>
        </>
      ) : null}
    </p>
  );
}

export function ResultSection({
  model,
  query,
  focus,
  onFocus,
  onQuery,
  onOpen,
}: {
  model: DiscoveryModel;
  query: DiscoveryQuery;
  focus: number;
  onFocus: (index: number) => void;
  onQuery: (next: DiscoveryQuery) => void;
  onOpen: (rowId: string) => void;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7, copy8, copy9, copy10, copy11, copy12);
  return (
    <section id="discovery-results" className="discovery-section" data-state={model.result.state}>
      <h3>{t("s1gl")}</h3>
      <p>
        {t("ssa")}{" "}{deskText(t, model.result.ofFixtureRows)}{t("s1p3")}{" "}{deskText(t, model.scaleTotal)}.
      </p>
      {model.result.state === "filter-conflict" ? (
        <div>
          <p id="discovery-conflict" role="status">
            <StatusMark kind="blocked" /> {t("sl8")}</p>
          <ul className="discovery-list">
            {deskText(t, model.result.conflicts.map((conflict) => (
              <li key={conflict.code}>
                <p>{deskText(t, conflict.message)}</p>
                <button
                  type="button"
                  className="discovery-action"
                  onClick={() => onQuery(applyConflictClear(query, conflict.code))}
                >
                  {t("scn")}</button>
              </li>
            )))}
          </ul>
        </div>
      ) : null}
      {model.result.state === "empty" ? (
        <div>
          <p className="empty">{t("sw4")}</p>
          <button type="button" className="discovery-action" onClick={() => onQuery(clearFilters(query))}>
            {t("scq")}</button>
        </div>
      ) : null}
      {model.result.state === "ready" ? (
        <div>
          <p>
            {t("s16s")}{" "}{deskText(t, model.result.page)} {t("s13t")}{" "}{deskText(t, model.result.pageCount)}{t("ss8")}{" "}{deskText(t, model.result.totalMatching)}.
          </p>
          <button
            type="button"
            className="discovery-action"
            disabled={query.page <= 1}
            onClick={() => onQuery({ ...query, page: query.page - 1 })}
          >
            {t("s193")}</button>
          <button
            type="button"
            className="discovery-action"
            disabled={model.result.pageCount === 0 || query.page >= model.result.pageCount}
            onClick={() => onQuery({ ...query, page: query.page + 1 })}
          >
            {t("stq")}</button>
          <ResultList model={model} focus={focus} onFocus={onFocus} onOpen={onOpen} />
        </div>
      ) : null}
    </section>
  );
}
