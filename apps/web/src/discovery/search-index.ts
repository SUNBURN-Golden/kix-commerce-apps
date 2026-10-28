import { deskText, makeScreenTranslate } from "../i18n/desk-translate";
import { messages as fixtureCopy } from "../i18n/messages/discovery--fixture";
import { DISCOVERY_FIXTURE, FIXTURE_IDS, type DiscoveryRow } from "./fixture";

export interface DiscoverySearchEntry {
  readonly rowId: string;
  readonly normalizedLabels: readonly string[];
}

export type DiscoverySearchIndex = ReadonlyMap<DiscoveryRow, DiscoverySearchEntry>;

/** Human labels only: identifiers and the user's stored query stay verbatim. */
export function normalizeDiscoverySearchText(value: string): string {
  return value.normalize("NFC").toLowerCase().normalize("NFC");
}

/** Only the supplied materialized rows; the separate scale window is never enumerated. */
export function buildDiscoverySearchIndex(rows: readonly DiscoveryRow[]): DiscoverySearchIndex {
  const translators = [makeScreenTranslate("en", fixtureCopy), makeScreenTranslate("ko", fixtureCopy)];
  return new Map(rows.map((row) => {
    const labels = [row.title, row.venueLabel];
    // The cancelled reprint uses singular "lantern". Keep it in the same bilingual family.
    if (row.rowId === FIXTURE_IDS.cancelled) labels.push(fixtureCopy.en.sq5);
    const normalizedLabels = [...new Set(labels.flatMap((label) => [
      normalizeDiscoverySearchText(label),
      ...translators.map((t) => normalizeDiscoverySearchText(deskText(t, label))),
    ]))];
    return [row, { rowId: row.rowId, normalizedLabels }];
  }));
}

export const DISCOVERY_SEARCH_INDEX = buildDiscoverySearchIndex(DISCOVERY_FIXTURE);
