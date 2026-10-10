/**
 * Synthetic discovery rows for the search screen.
 * Counts and tiers are labels. This module does not read the adapter.
 * FIXTURE_NOW is a fixed instant. The scale total is a count, not a loaded list.
 */

export const FIXTURE_NOW = "2026-10-09T00:00:00.000Z";

/** A tier older than FIXTURE_NOW by more than this span is stale. */
export const STALE_AFTER_MS = 86_400_000;

/** One second past the stale span before FIXTURE_NOW. */
export const STALE_PRICE_AS_OF = "2026-10-07T23:59:59.000Z";

export const SCALE_TOTAL = 1_000_000;

export const SCALE_ROW_HEIGHT = 48;

export const SCALE_OVERSCAN = 4;

export const SCALE_VIEWPORT_HEIGHT = 192;

export const FIXTURE_LENGTH = 360;

export const STUB_EVENT_IDS = ["evt_lanterns", "evt_paper_orchestra", "evt_last_ferry"] as const;

export type StubEventId = (typeof STUB_EVENT_IDS)[number];

export const DISCOVERY_KINDS = ["event", "seat", "ga", "resale"] as const;

export type DiscoveryKind = (typeof DISCOVERY_KINDS)[number];

export const DISCOVERY_STATUSES = ["on-sale", "sold-out", "cancelled"] as const;

export type DiscoveryStatus = (typeof DISCOVERY_STATUSES)[number];

export const SYNTHETIC_TIERS = ["T1", "T2", "T3"] as const;

export type SyntheticTier = (typeof SYNTHETIC_TIERS)[number];

export interface DiscoveryResale {
  askTier: SyntheticTier;
  listingLabel: "listing (synthetic)";
}

export interface DiscoveryRow {
  rowId: string;
  kind: DiscoveryKind;
  title: string;
  venueLabel: string;
  startsAt: string;
  status: DiscoveryStatus;
  inventoryMode: "none" | "seat" | "ga";
  section: string | null;
  syntheticCount: number | null;
  syntheticTier: SyntheticTier | null;
  priceAsOf: string;
  resale: DiscoveryResale | null;
  stubEventId: StubEventId | null;
  provenance: "synthetic";
}

export const FIXTURE_IDS = {
  lanterns: "syn-event-lanterns",
  paper: "syn-event-paper",
  ferry: "syn-event-ferry",
  cancelled: "syn-event-cancelled",
  stale: "syn-event-stale",
  seat: "syn-seat-sample",
  ga: "syn-ga-sample",
  resale: "syn-resale-sample",
  soldOut: "syn-event-sold-out",
  unlinked: "syn-event-unlinked",
} as const;

const SECTIONS = ["A", "B", "C"] as const;

const VENUES = ["Paper hall", "North annex", "Studio shed", "Hall C"] as const;

function plusDays(days: number, hours = 0): string {
  return new Date(Date.parse(FIXTURE_NOW) + days * 86_400_000 + hours * 3_600_000).toISOString();
}

function makeRow(fields: Omit<DiscoveryRow, "provenance">): DiscoveryRow {
  return { ...fields, provenance: "synthetic" };
}

function eventRow(fields: {
  rowId: string;
  title: string;
  venueLabel: string;
  startsAt: string;
  status: DiscoveryStatus;
  syntheticTier: SyntheticTier | null;
  priceAsOf: string;
  stubEventId: StubEventId | null;
}): DiscoveryRow {
  return makeRow({
    ...fields,
    kind: "event",
    inventoryMode: "none",
    section: null,
    syntheticCount: null,
    resale: null,
  });
}

const NAMED: readonly DiscoveryRow[] = [
  eventRow({
    rowId: FIXTURE_IDS.lanterns,
    title: "Lanterns synthetic show",
    venueLabel: "Paper hall",
    startsAt: "2026-10-09T18:00:00.000Z",
    status: "on-sale",
    syntheticTier: "T1",
    priceAsOf: FIXTURE_NOW,
    stubEventId: "evt_lanterns",
  }),
  eventRow({
    rowId: FIXTURE_IDS.paper,
    title: "Paper orchestra synthetic show",
    venueLabel: "North annex",
    startsAt: "2026-10-10T18:00:00.000Z",
    status: "on-sale",
    syntheticTier: "T2",
    priceAsOf: FIXTURE_NOW,
    stubEventId: "evt_paper_orchestra",
  }),
  eventRow({
    rowId: FIXTURE_IDS.ferry,
    title: "Last ferry synthetic show",
    venueLabel: "Studio shed",
    startsAt: "2026-10-11T18:00:00.000Z",
    status: "on-sale",
    syntheticTier: "T3",
    priceAsOf: FIXTURE_NOW,
    stubEventId: "evt_last_ferry",
  }),
  eventRow({
    rowId: FIXTURE_IDS.cancelled,
    title: "Cancelled lantern reprint",
    venueLabel: "Paper hall",
    startsAt: "2026-10-12T18:00:00.000Z",
    status: "cancelled",
    syntheticTier: "T2",
    priceAsOf: FIXTURE_NOW,
    stubEventId: "evt_lanterns",
  }),
  eventRow({
    rowId: FIXTURE_IDS.stale,
    title: "Stale paper reprint",
    venueLabel: "North annex",
    startsAt: "2026-10-13T18:00:00.000Z",
    status: "on-sale",
    syntheticTier: "T1",
    priceAsOf: STALE_PRICE_AS_OF,
    stubEventId: "evt_paper_orchestra",
  }),
  makeRow({
    rowId: FIXTURE_IDS.seat,
    kind: "seat",
    title: "Lanterns seat marker",
    venueLabel: "Hall C",
    startsAt: "2026-10-14T18:00:00.000Z",
    status: "on-sale",
    inventoryMode: "seat",
    section: "A",
    syntheticCount: 4,
    syntheticTier: "T1",
    priceAsOf: FIXTURE_NOW,
    resale: null,
    stubEventId: null,
  }),
  makeRow({
    rowId: FIXTURE_IDS.ga,
    kind: "ga",
    title: "Lanterns floor marker",
    venueLabel: "Paper hall",
    startsAt: "2026-10-15T18:00:00.000Z",
    status: "on-sale",
    inventoryMode: "ga",
    section: null,
    syntheticCount: 80,
    syntheticTier: "T2",
    priceAsOf: FIXTURE_NOW,
    resale: null,
    stubEventId: null,
  }),
  makeRow({
    rowId: FIXTURE_IDS.resale,
    kind: "resale",
    title: "Lanterns listing marker",
    venueLabel: "North annex",
    startsAt: "2026-10-16T18:00:00.000Z",
    status: "on-sale",
    inventoryMode: "none",
    section: null,
    syntheticCount: 1,
    syntheticTier: "T3",
    priceAsOf: FIXTURE_NOW,
    resale: { askTier: "T3", listingLabel: "listing (synthetic)" },
    stubEventId: null,
  }),
  eventRow({
    rowId: FIXTURE_IDS.soldOut,
    title: "Sold out synthetic show",
    venueLabel: "Hall C",
    startsAt: "2026-10-17T18:00:00.000Z",
    status: "sold-out",
    syntheticTier: "T2",
    priceAsOf: FIXTURE_NOW,
    stubEventId: null,
  }),
  eventRow({
    rowId: FIXTURE_IDS.unlinked,
    title: "Unlinked synthetic show",
    venueLabel: "Studio shed",
    startsAt: "2026-10-18T18:00:00.000Z",
    status: "on-sale",
    syntheticTier: "T2",
    priceAsOf: FIXTURE_NOW,
    stubEventId: null,
  }),
];

function bulkRow(index: number): DiscoveryRow {
  const kind = DISCOVERY_KINDS[index % DISCOVERY_KINDS.length] ?? "event";
  const tier = SYNTHETIC_TIERS[index % SYNTHETIC_TIERS.length] ?? "T1";
  const status = DISCOVERY_STATUSES[(index + 1) % DISCOVERY_STATUSES.length] ?? "on-sale";
  const stale = index % 17 === 0;
  const section = kind === "seat" ? (SECTIONS[index % SECTIONS.length] ?? "A") : null;
  return makeRow({
    rowId: `syn-bulk-${index}`,
    kind,
    title: `Synthetic sample ${index}`,
    venueLabel: VENUES[index % VENUES.length] ?? "Paper hall",
    startsAt: plusDays(30 + Math.floor(index / 24), index % 24),
    status,
    inventoryMode: kind === "seat" ? "seat" : kind === "ga" ? "ga" : "none",
    section,
    syntheticCount: kind === "event" ? null : (index % 15) + 1,
    syntheticTier: tier,
    priceAsOf: stale ? STALE_PRICE_AS_OF : FIXTURE_NOW,
    resale: kind === "resale" ? { askTier: tier, listingLabel: "listing (synthetic)" } : null,
    stubEventId: null,
  });
}

const BULK_COUNT = FIXTURE_LENGTH - NAMED.length;

export const DISCOVERY_FIXTURE: readonly DiscoveryRow[] = [
  ...NAMED,
  ...Array.from({ length: BULK_COUNT }, (_, index) => bulkRow(index)),
];

/** One lightweight scale row. Callers ask only for the visible window. */
export function scaleRowAt(index: number): DiscoveryRow {
  const safe = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  const kind = DISCOVERY_KINDS[safe % DISCOVERY_KINDS.length] ?? "event";
  const tier = SYNTHETIC_TIERS[safe % SYNTHETIC_TIERS.length] ?? "T1";
  const status = DISCOVERY_STATUSES[safe % DISCOVERY_STATUSES.length] ?? "on-sale";
  const section = kind === "seat" ? (SECTIONS[safe % SECTIONS.length] ?? "A") : null;
  return makeRow({
    rowId: `scale-${safe}`,
    kind,
    title: `Scale row ${safe}`,
    venueLabel: "Scale venue",
    startsAt: plusDays(Math.floor(safe / 24), safe % 24),
    status,
    inventoryMode: kind === "seat" ? "seat" : kind === "ga" ? "ga" : "none",
    section,
    syntheticCount: kind === "event" ? null : (safe % 20) + 1,
    syntheticTier: tier,
    priceAsOf: FIXTURE_NOW,
    resale: kind === "resale" ? { askTier: tier, listingLabel: "listing (synthetic)" } : null,
    stubEventId: null,
  });
}
