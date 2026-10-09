import { useState } from "react";
import { Link } from "react-router-dom";
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
  SCALE_VIEWPORT_HEIGHT,
  scaleWindow,
  toggleValue,
  withFilter,
  describeRow,
  type DiscoveryQuery,
  type RowFacts,
} from "../discovery/model";
import type { DiscoveryModel, PurchaseDecision } from "../discovery-workspace";
import { formatWhen } from "../format";

export function DiscoveryBanner({ model }: { model: DiscoveryModel }) {
  return (
    <header className="section-head discovery-section" data-adapter-environment={model.environment}>
      <p className="eyebrow">Discovery fixture</p>
      <h2>Discover</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-fixture">
        SYNTHETIC fixture. Rows come from a synthetic-fixture. They are not a catalogue receipt.
      </p>
      <p>{model.ruling}</p>
      <p>{model.stubSentence}</p>
      <p>{model.reloadNote}</p>
      <p>{model.sampleNote}</p>
    </header>
  );
}

export function CatalogNotice({ model, onReadAgain }: { model: DiscoveryModel; onReadAgain: () => void }) {
  if (model.catalog.kind === "loading") {
    return (
      <p className="muted" role="status">
        Loading performances.
      </p>
    );
  }
  if (model.catalog.kind === "error") {
    return (
      <div>
        <p className="alert" role="alert">
          {model.catalog.message}
        </p>
        <button type="button" className="discovery-action" onClick={() => onReadAgain()}>
          Read again
        </button>
      </div>
    );
  }
  if (model.catalog.kind === "not-bound") {
    return (
      <p className="alert" role="alert" data-state="not-bound" data-source="none">
        {model.catalog.reason}
      </p>
    );
  }
  if (model.catalog.kind === "empty") {
    return <p className="empty">No performances on this adapter.</p>;
  }
  return <p>source {model.catalogSource}</p>;
}

export function DiscoveryForm({ query, onQuery }: { query: DiscoveryQuery; onQuery: (next: DiscoveryQuery) => void }) {
  return (
    <form
      id="discovery-filters"
      className="discovery-form"
      aria-label="Discovery filters"
      onSubmit={(event) => event.preventDefault()}
    >
      <label htmlFor="discovery-q">
        Search
        <input
          id="discovery-q"
          type="search"
          value={query.text}
          onChange={(event) => onQuery(withFilter(query, { text: event.target.value }))}
        />
      </label>
      <fieldset>
        <legend>Kind</legend>
        {DISCOVERY_KINDS.map((kind) => (
          <label key={kind}>
            <input
              type="checkbox"
              name="kinds"
              value={kind}
              checked={query.kinds.includes(kind)}
              onChange={() => onQuery(withFilter(query, { kinds: toggleValue(query.kinds, kind, DISCOVERY_KINDS) }))}
            />
            {kind}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Status</legend>
        {DISCOVERY_STATUSES.map((status) => (
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
            {status}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Tier</legend>
        {SYNTHETIC_TIERS.map((tier) => (
          <label key={tier}>
            <input
              type="checkbox"
              name="tiers"
              value={tier}
              checked={query.tiers.includes(tier)}
              onChange={() => onQuery(withFilter(query, { tiers: toggleValue(query.tiers, tier, SYNTHETIC_TIERS) }))}
            />
            {tier}
          </label>
        ))}
      </fieldset>
      <label htmlFor="discovery-section">
        Section
        <input
          id="discovery-section"
          value={query.section}
          onChange={(event) => onQuery(withFilter(query, { section: event.target.value }))}
        />
      </label>
      <label htmlFor="discovery-from">
        From
        <input
          id="discovery-from"
          type="date"
          value={query.from}
          onChange={(event) => onQuery(withFilter(query, { from: event.target.value }))}
        />
      </label>
      <label htmlFor="discovery-to">
        To
        <input
          id="discovery-to"
          type="date"
          value={query.to}
          onChange={(event) => onQuery(withFilter(query, { to: event.target.value }))}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={query.purchasableOnly}
          onChange={(event) => onQuery(withFilter(query, { purchasableOnly: event.target.checked }))}
        />
        Purchasable only
      </label>
      <label htmlFor="discovery-sort">
        Sort
        <select
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
          {DISCOVERY_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {sort}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="discovery-page-size">
        Page size
        <select
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
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="discovery-action" onClick={() => onQuery(clearFilters(query))}>
        Clear filters
      </button>
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
      <p className="when">{formatWhen(row.startsAt)}</p>
      <h3>{row.title}</h3>
      <p className="muted">{row.venueLabel}</p>
      <p>{facts.kindLine}</p>
      <p className="discovery-status">{facts.statusLine}</p>
      {facts.inventoryLine ? <p>{facts.inventoryLine}</p> : null}
      {facts.countLine ? <p>{facts.countLine}</p> : null}
      {facts.tierLine ? <p>{facts.tierLine}</p> : null}
      {facts.resaleLine ? <p>{facts.resaleLine}</p> : null}
      {facts.stale ? (
        <p>
          <span className="discovery-badge" data-state="stale">
            STALE
          </span>{" "}
          <time dateTime={row.priceAsOf}>{formatWhen(row.priceAsOf)}</time>
        </p>
      ) : null}
      {row.kind === "resale" && resaleReason ? (
        <p data-state="not-bound" data-source="none">
          {resaleReason}
        </p>
      ) : null}
      <button type="button" className="discovery-action" onClick={() => onOpen(row.rowId)}>
        Open detail
      </button>
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
  const rows = model.result.rows;
  const active = rows[focus];
  return (
    <ul
      className="discovery-list"
      role="listbox"
      tabIndex={0}
      aria-label="Discovery results"
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
      {rows.map((row, index) => (
        <DiscoveryRowCard
          key={row.rowId}
          row={row}
          facts={describeRow(row)}
          resaleReason={row.kind === "resale" ? model.resaleNotBoundReason : null}
          active={index === focus}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );
}

export function ScaleList({ onOpen, scaleTotal }: { onOpen: (rowId: string) => void; scaleTotal: number }) {
  const [scrollTop, setScrollTop] = useState(0);
  const [focus, setFocus] = useState(0);
  const windowed = scaleWindow({ scrollTop });
  const active = windowed.rows.find((row) => row.rowId === `scale-${focus}`);
  return (
    <section id="discovery-scale" className="discovery-section">
      <h3>Scale</h3>
      <p>synthetic scale {scaleTotal}</p>
      <p>Search and filters apply to the materialized sample only.</p>
      <ul
        className="discovery-list discovery-scale"
        role="listbox"
        tabIndex={0}
        aria-label="Scale index"
        style={{ height: SCALE_VIEWPORT_HEIGHT }}
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
        {windowed.rows.map((row) => {
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
              <span>{row.title}</span> <span>{facts.kindLine}</span> <span>{facts.statusLine}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function PurchasePathView({ purchase }: { purchase: PurchaseDecision }) {
  if (purchase.kind === "booking") {
    return (
      <p data-purchase="booking">
        <Link className="button discovery-action" to={`/booking/${encodeURIComponent(purchase.eventId)}`}>
          Open booking
        </Link>
      </p>
    );
  }
  if (purchase.kind === "not-bound") {
    return (
      <p data-purchase="not-bound" data-state="not-bound" data-source="none">
        {purchase.reason}
      </p>
    );
  }
  if (purchase.kind === "unavailable") {
    return <p data-purchase="unavailable">{purchase.message}</p>;
  }
  return <p data-purchase="unsupported">{purchase.message}</p>;
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
  return (
    <section id="discovery-results" className="discovery-section" data-state={model.result.state}>
      <h3>Results</h3>
      <p>
        materialized sample {model.result.ofFixtureRows}. synthetic scale {model.scaleTotal}.
      </p>
      {model.result.state === "filter-conflict" ? (
        <div>
          <p role="status">Filter conflict. The query was not run.</p>
          <ul className="discovery-list">
            {model.result.conflicts.map((conflict) => (
              <li key={conflict.code}>
                <p>{conflict.message}</p>
                <button
                  type="button"
                  className="discovery-action"
                  onClick={() => onQuery(applyConflictClear(query, conflict.code))}
                >
                  Clear conflict
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {model.result.state === "empty" ? (
        <div>
          <p className="empty">No matching synthetic rows.</p>
          <button type="button" className="discovery-action" onClick={() => onQuery(clearFilters(query))}>
            Clear filters
          </button>
        </div>
      ) : null}
      {model.result.state === "ready" ? (
        <div>
          <p>
            page {model.result.page} of {model.result.pageCount}. matching {model.result.totalMatching}.
          </p>
          <button
            type="button"
            className="discovery-action"
            disabled={query.page <= 1}
            onClick={() => onQuery({ ...query, page: query.page - 1 })}
          >
            Previous page
          </button>
          <button
            type="button"
            className="discovery-action"
            disabled={model.result.pageCount === 0 || query.page >= model.result.pageCount}
            onClick={() => onQuery({ ...query, page: query.page + 1 })}
          >
            Next page
          </button>
          <ResultList model={model} focus={focus} onFocus={onFocus} onOpen={onOpen} />
        </div>
      ) : null}
    </section>
  );
}
