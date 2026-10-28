import { describe, expect, it, vi } from "vitest";
import * as fixture from "../src/discovery/fixture";
import { DEFAULT_DISCOVERY_QUERY, runDiscoveryQuery } from "../src/discovery/model";
import { buildDiscoverySearchIndex, DISCOVERY_SEARCH_INDEX, normalizeDiscoverySearchText } from "../src/discovery/search-index";
import { deskText, makeScreenTranslate } from "../src/i18n/desk-translate";
import { messages } from "../src/i18n/messages/discovery--fixture";

const { DISCOVERY_FIXTURE, FIXTURE_IDS, FIXTURE_LENGTH } = fixture;
const search = (text: string) => runDiscoveryQuery({ ...DEFAULT_DISCOVERY_QUERY, text, pageSize: 50 });
const ids = (text: string) => search(text).rows.map((row) => row.rowId);

describe("bounded bilingual discovery search", () => {
  it("finds the same five lantern rows in stable order, including the cancelled reprint", () => {
    const expected = [FIXTURE_IDS.lanterns, FIXTURE_IDS.cancelled, FIXTURE_IDS.seat, FIXTURE_IDS.ga, FIXTURE_IDS.resale];
    for (const text of ["등불", "Lanterns", "  lAnTeRnS  ", "등불".normalize("NFD")]) {
      expect(ids(text)).toEqual(expected);
      expect(search(text).totalMatching).toBe(5);
    }
  });

  it.each([
    ["종이 홀", "Paper hall"], ["북쪽 별관", "North annex"],
    ["C홀", "Hall C"], ["스튜디오 창고", "Studio shed"],
  ])("matches displayed venue %s and original %s, including generated rows", (ko, en) => {
    expect(search(ko)).toEqual(search(en));
    expect(search(ko.normalize("NFD"))).toEqual(search(ko));
    expect(search(ko).totalMatching).toBeGreaterThan(50);
    expect(ids(ko).some((id) => id.startsWith("syn-bulk-"))).toBe(true);
  });

  it("indexes every displayed title and venue with the existing display resolver", () => {
    for (const locale of ["ko", "en"] as const) {
      const t = makeScreenTranslate(locale, messages);
      for (const row of DISCOVERY_FIXTURE) {
        const entry = DISCOVERY_SEARCH_INDEX.get(row)!;
        expect(entry.rowId).toBe(row.rowId);
        for (const label of [row.title, row.venueLabel]) {
          expect(entry.normalizedLabels).toContain(normalizeDiscoverySearchText(deskText(t, label)));
        }
        expect(new Set(entry.normalizedLabels).size).toBe(entry.normalizedLabels.length);
        expect(entry.normalizedLabels.length).toBeLessThanOrEqual(6);
      }
    }
    expect(ids("합성 표본 349")).toEqual(["syn-bulk-349"]);
    expect(ids("Synthetic sample 349")).toEqual(["syn-bulk-349"]);
  });

  it("treats identifiers verbatim and labels as literal normalized human text", () => {
    const row = { ...DISCOVERY_FIXTURE[0]!, rowId: "ID-가-AbC", title: "ÉTUDE [demo]", venueLabel: "Custom" };
    const before = JSON.stringify(row);
    const run = (text: string) => runDiscoveryQuery({ ...DEFAULT_DISCOVERY_QUERY, text }, [row]).rows;
    expect(run(row.rowId)).toEqual([row]);
    expect(run("AbC")).toEqual([row]);
    expect(run("ID-가-AbC".normalize("NFD"))).toEqual([]);
    expect(run("id-가-abc")).toEqual([]);
    expect(run("e\u0301tude")).toEqual([row]);
    expect(run("[demo]")).toEqual([row]);
    expect(run(".*")).toEqual([]);
    expect(ids("resale")).toContain(FIXTURE_IDS.resale);
    expect(JSON.stringify(row)).toBe(before);
  });

  it("keeps blank and no-match behavior and never constructs a scale row", () => {
    const scale = vi.spyOn(fixture, "scaleRowAt");
    try {
      expect(buildDiscoverySearchIndex(DISCOVERY_FIXTURE).size).toBe(FIXTURE_LENGTH);
      expect(DISCOVERY_SEARCH_INDEX.size).toBe(360);
      expect([...DISCOVERY_SEARCH_INDEX.values()].some((entry) => entry.rowId.startsWith("scale-"))).toBe(false);
      expect(search("   ")).toEqual(search(""));
      expect(search("").totalMatching).toBe(360);
      expect(search("no-such-venue").state).toBe("empty");
      expect(search("scale-999999").rows).toEqual([]);
      expect(scale).not.toHaveBeenCalled();
    } finally {
      scale.mockRestore();
    }
  });
});
