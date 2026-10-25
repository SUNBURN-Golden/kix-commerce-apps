import { describe, expect, it } from "vitest";
import { parseReadState, serialiseReadState, READ_STATE_PARAMS, type ReadStateScreen } from "../src/shell/read-state-params";
import { ROUTES } from "../src/shell/route-registry";
import type { SessionRecord } from "@kix/protocol-adapter";

const journalFields: Record<keyof SessionRecord, true> = {
  seq: true, intentRef: true, scope: true, contextTag: true, outcome: true,
  code: true, loadNo: true,
};
const expected = {
  buyer: ["receipt"], platform: ["channel", "trade"], merchant: ["cut", "row"], finance: ["queue", "case"],
  "credit-origination": ["lane", "application"], "credit-servicing": ["lane", "obligation"],
  "marketing-journey": ["benefit"], assistant: ["grant"], permissions: ["workspace"],
  notifications: ["filter", "item"], identity: ["item"], session: ["item"], journeys: ["row"], provider: ["step"],
};
describe("read-only screen URL allow-lists", () => {
  it("enumerates every screen and forbids command, actor, authority and journal keys", () => {
    expect(Object.keys(READ_STATE_PARAMS)).toEqual(Object.keys(expected));
    for (const [screen, params] of Object.entries(READ_STATE_PARAMS)) {
      expect(ROUTES.some((route) => route.id === screen)).toBe(true);
      expect(params.map((param) => param.name)).toEqual(expected[screen as ReadStateScreen]);
      for (const { name, nav } of params) {
        expect(name).not.toMatch(/intent|actor|operation|seq|journal|attach|scenario|role|tenant|token|session|approve|capture|settle|idempot/i);
        expect(Object.keys(journalFields)).not.toContain(name);
        expect(nav).toBe(["channel", "cut", "queue", "lane", "workspace", "filter"].includes(name) ? "push" : "replace");
      }
    }
  });
  for (const [screen, params] of Object.entries(READ_STATE_PARAMS)) {
    it(`${screen}: validates parse and serialization for every allowed key`, () => {
      const id = screen as ReadStateScreen;
      const domain = Object.fromEntries(params.map(({ name }) => [name, ["fixture-1"]]));
      const good = new URLSearchParams(params.map(({ name }) => [name, "fixture-1"]));
      const values = Object.fromEntries(good);
      expect(parseReadState(id, good.toString(), domain).values).toEqual(values);
      expect(serialiseReadState(id, good, {}, domain).toString()).toBe(good.toString());
      for (const { name } of params) {
        for (const bad of ["", "nope", "<script>", "x".repeat(200), "a b", "a/b"]) {
          const search = new URLSearchParams(good); search.set(name, bad);
          expect(parseReadState(id, search.toString(), domain).dropped).toContain(name);
          expect(serialiseReadState(id, good, { [name]: bad }, domain).has(name)).toBe(false);
        }
        const duplicate = new URLSearchParams(good); duplicate.append(name, "fixture-1");
        expect(parseReadState(id, duplicate.toString(), domain).dropped).toContain(name);
      }
      const dirty = new URLSearchParams(good); dirty.set("actor", "person"); dirty.set("foo", "1"); dirty.set("lang", "ko");
      const clean = serialiseReadState(id, dirty, { actor: "someone", operationId: "op-1" }, domain);
      expect(clean.has("actor")).toBe(false); expect(clean.has("foo")).toBe(false);
      expect(clean.has("operationId")).toBe(false); expect(clean.get("lang")).toBe("ko");
    });
  }
  it("defers source membership only, with strict locale, duplicate, empty and unknown-key handling", () => {
    expect(parseReadState("finance", "?case=x&foo=1&lang=KO", { case: null })).toEqual({ values: {}, dropped: ["foo", "lang"], pending: ["case"] });
    expect(parseReadState("finance", "?case=%3Cscript%3E&lang=ko&lang=en", { case: null }).dropped).toEqual(["lang", "case"]);
    expect(serialiseReadState("finance", new URLSearchParams("lang=no"), { case: "x" }, { case: null }).toString()).toBe("");
  });
  it("clears a dependent selection when changing filters and rejects mismatched combined links", () => {
    const domain = { cut: ["cut-1", "cut-2"], row: (values: Record<string, string | undefined>) => values.cut === "cut-2" ? ["row-2"] : ["row-1"] };
    expect(serialiseReadState("merchant", new URLSearchParams("cut=cut-1&row=row-1"), { cut: "cut-2" }, domain).toString()).toBe("cut=cut-2");
    expect(parseReadState("merchant", "cut=cut-2&row=row-1", domain).dropped).toEqual(["row"]);
    expect(parseReadState("merchant", "cut=nope&row=row-1", domain).dropped).toEqual(["cut", "row"]);
  });
});
