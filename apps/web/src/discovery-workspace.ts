/**
 * Discovery screen model over the synthetic fixture plus one catalogue read.
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * This module posts nothing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { COMMERCE_COMMAND_BINDINGS } from "@kix/protocol-adapter";
import {
  BUYER_RELOAD_NOTE,
  BUYER_STUB_SENTENCE,
  loadBuyerCatalog,
  type BuyerCatalogReader,
  type CatalogState,
} from "./buyer-workspace";
import {
  describeRow,
  findDiscoveryRow,
  runDiscoveryQuery,
  SCALE_TOTAL,
  type DiscoveryPageResult,
  type DiscoveryQuery,
  type RowFacts,
} from "./discovery/model";
import { type DiscoveryRow } from "./discovery/fixture";
import { protocol } from "./protocol";
import { WORKSPACE_RULING } from "./workspace/registry";

export const DISCOVERY_SAMPLE_NOTE =
  "Search and filters apply to the materialized sample only. The scale view is date order and is count-only.";

export const SEAT_GA_NOTE = "no supported purchase path here; seat/GA selection is c-inventory-venue";

export type PurchaseDecision =
  | { kind: "booking"; eventId: string }
  | { kind: "not-bound"; reason: string; source: "none" }
  | { kind: "unsupported"; message: string }
  | { kind: "unavailable"; message: string };

export interface DiscoveryDetailModel {
  row: DiscoveryRow;
  facts: RowFacts;
  purchase: PurchaseDecision;
}

export interface DiscoveryModel {
  environment: "stub" | "integration-http";
  ruling: string;
  stubSentence: string;
  reloadNote: string;
  sampleNote: string;
  catalog: CatalogState;
  catalogSource: "stub-shape" | "none";
  result: DiscoveryPageResult;
  resaleNotBoundReason: string;
  scaleTotal: number;
  detail: DiscoveryDetailModel | null;
  missingRow: boolean;
}

export function resolvePurchase(row: DiscoveryRow, catalog: CatalogState): PurchaseDecision {
  if (row.kind === "seat" || row.kind === "ga") {
    return { kind: "unsupported", message: SEAT_GA_NOTE };
  }
  if (row.kind === "resale") {
    return {
      kind: "not-bound",
      reason: COMMERCE_COMMAND_BINDINGS.listResale.reason,
      source: "none",
    };
  }
  if (row.status === "cancelled") {
    return { kind: "unsupported", message: "cancelled (synthetic)" };
  }
  if (catalog.kind === "not-bound") {
    return { kind: "not-bound", reason: catalog.reason, source: "none" };
  }
  if (
    row.kind === "event" &&
    row.status === "on-sale" &&
    row.stubEventId !== null &&
    catalog.kind === "ready" &&
    catalog.performances.some((item) => item.eventId === row.stubEventId)
  ) {
    return { kind: "booking", eventId: row.stubEventId };
  }
  if (catalog.kind === "loading") {
    return { kind: "unavailable", message: "Loading performances." };
  }
  if (catalog.kind === "error") {
    return { kind: "unavailable", message: catalog.message };
  }
  return { kind: "unsupported", message: "No supported purchase path on this row." };
}

/** One catalogue read. The caller does not try again on its own. */
export async function loadDiscoveryOnce(reader: BuyerCatalogReader): Promise<CatalogState> {
  return loadBuyerCatalog(reader);
}

export function catalogSourceFor(
  environment: "stub" | "integration-http",
  catalog: CatalogState,
): "stub-shape" | "none" {
  if (catalog.kind === "not-bound" || catalog.kind === "loading") {
    return "none";
  }
  if (environment === "stub") {
    return "stub-shape";
  }
  return "none";
}

export function buildDiscoveryModel(input: {
  environment: "stub" | "integration-http";
  catalog: CatalogState;
  query: DiscoveryQuery;
  rowId: string | null;
}): DiscoveryModel {
  const result = runDiscoveryQuery(input.query);
  let detail: DiscoveryDetailModel | null = null;
  let missingRow = false;
  if (input.rowId) {
    const row = findDiscoveryRow(input.rowId);
    if (!row) {
      missingRow = true;
    } else {
      detail = {
        row,
        facts: describeRow(row),
        purchase: resolvePurchase(row, input.catalog),
      };
    }
  }
  return {
    environment: input.environment,
    ruling: WORKSPACE_RULING,
    stubSentence: BUYER_STUB_SENTENCE,
    reloadNote: BUYER_RELOAD_NOTE,
    sampleNote: DISCOVERY_SAMPLE_NOTE,
    catalog: input.catalog,
    catalogSource: catalogSourceFor(input.environment, input.catalog),
    result,
    resaleNotBoundReason: COMMERCE_COMMAND_BINDINGS.listResale.reason,
    scaleTotal: SCALE_TOTAL,
    detail,
    missingRow,
  };
}

export function useDiscoveryWorkspace(
  query: DiscoveryQuery,
  rowId: string | null,
): { model: DiscoveryModel; readAgain: () => void } {
  const [catalog, setCatalog] = useState<CatalogState>({ kind: "loading" });
  const generation = useRef(0);
  const readAgain = useCallback(() => {
    const ticket = ++generation.current;
    setCatalog({ kind: "loading" });
    void loadDiscoveryOnce(protocol).then((next) => {
      if (ticket === generation.current) {
        setCatalog(next);
      }
    });
  }, []);

  useEffect(() => {
    readAgain();
  }, [readAgain]);

  const environment = protocol.describe().environment;
  return {
    model: buildDiscoveryModel({ environment, catalog, query, rowId }),
    readAgain,
  };
}
