import { describe, expect, it, vi } from "vitest";
import { MARKET_CLAIMS, createMockResaleMarket, resaleMarketPortFor, validMarketRead, validMarketWrite, type ResaleMarketIntent, type ResaleMarketPort, type ResaleMarketDetail } from "../src/resale-market";
import { ResaleMarketController } from "../src/resale-market-controller";
const read = { kind: "detail", productId: "demo-001" } as const;
const intent = (kind: "bid" | "ask" = "bid"): Extract<ResaleMarketIntent, { kind: "bid" | "ask" }> => ({ kind, productId: "demo-001", variantId: "standard", expectedVersion: 0, mockUnits: "115" });
async function detail(port: ResaleMarketPort): Promise<ResaleMarketDetail> { const r = await port.read(read); if (r.kind === "NOT_BOUND" || r.payload.kind !== "detail" || !r.payload.detail) throw new Error("fixture"); return r.payload.detail; }
describe("synthetic resale market", () => {
  it("bounds bilingual search pages and isolates returned snapshots", async () => {
    const p = createMockResaleMarket();
    for (const query of ["orbit","궤도", "", "missing"]) { const q = { kind: "list", query, page: 1 } as const; const r = await p.read(q); expect(validMarketRead(r,q)).toBe(true); if (r.kind !== "NOT_BOUND" && r.payload.kind === "list") expect(r.payload.products.length).toBeLessThanOrEqual(2); }
    const d = await detail(p); d.quotes[0]!.available = false; expect((await detail(p)).quotes[0]!.available).toBe(true);
    const q = { kind: "list", query: "", page: 2 } as const; expect(validMarketRead(await p.read(q),q)).toBe(true);
    const missing = { kind: "detail", productId: "absent" } as const; expect((await p.read(missing)).kind).toBe("empty");
  });
  it.each(["bid","ask"] as const)("records %s without crossing or a trade", async kind => {
    const p = createMockResaleMarket(); const d = await detail(p); const i = intent(kind); const r = await p.submit(i); expect(validMarketWrite(r,i,d)).toBe(true); const after = await detail(p); expect(after.offers).toHaveLength(1); expect(after.trades).toHaveLength(1); expect(after.version).toBe(1);
  });
  it.each(["instant-buy","instant-sell"] as const)("consumes only the selected %s fixture and appends once", async kind => {
    const p = createMockResaleMarket(); const d = await detail(p); const q = d.quotes.find(x => x.side === (kind === "instant-buy" ? "ask" : "bid"))!;
    const i: ResaleMarketIntent = { kind, productId: "demo-001", variantId: "standard", expectedVersion: 0, quoteId: q.quoteId };
    expect(validMarketWrite(await p.submit(i),i,d)).toBe(true); expect((await detail(p)).trades).toHaveLength(2);
    expect(await p.submit(i)).toMatchObject({ kind: "REJECTED", code: "STALE_VERSION" });
    expect(await p.submit({ ...i, expectedVersion: 1 })).toMatchObject({ kind: "REJECTED", code: "QUOTE_UNAVAILABLE" });
  });
  it("rejects wrong product, variant, quote side and noncanonical digits", async () => {
    const p = createMockResaleMarket();
    for (const [i,code] of [[{ ...intent(), productId: "missing" }, "PRODUCT_MISSING"], [{ ...intent(), variantId: "other" }, "VARIANT_MISSING"], [{ ...intent(), mockUnits: "01" }, "INVALID_INPUT"], [{ kind: "instant-buy", productId: "demo-001", variantId: "standard", expectedVersion: 0, quoteId: "demo-001-standard-bid" }, "QUOTE_MISMATCH"]] as const) expect(await p.submit(i)).toMatchObject({ kind: "REJECTED", code });
  });
  it("keeps HTTP read and write NOT_BOUND without a fallback", async () => { const p = resaleMarketPortFor("integration-http"); expect((await p.read(read)).kind).toBe("NOT_BOUND"); expect((await p.submit(intent())).kind).toBe("NOT_BOUND"); });
  it("refuses mismatched identity, wrong amount, extra claims and missing flags", async () => {
    const p = createMockResaleMarket(); const d = await detail(p); const i = intent(); const r = await p.submit(i);
    expect(validMarketWrite({ ...r, request: { ...i, variantId: "wide" } },i,d)).toBe(false);
    if (r.kind !== "CONFIRMED") throw new Error("fixture");
    for (const record of [{ ...r.record, mockUnits: "999" },{ ...r.record, productId: "demo-002" },{ ...r.record, fundsExecuted: true }]) expect(validMarketWrite({ ...r, record },i,d)).toBe(false);
    expect(validMarketWrite({ ...r, protocolTruth: true },i,d)).toBe(false);
    expect(validMarketRead({ ...(await p.read(read)), request: { ...read, productId: "demo-002" } },read)).toBe(false);
  });
});
describe("resale controller", () => {
  it("rejects a late answer when the browser path changed before lazy cleanup", async () => {
    const p = createMockResaleMarket(); let path = "/product"; let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
    const c = new ResaleMarketController({ read: p.read, async submit(i) { const result = await p.submit(i); await held; return result; } }, () => path);
    await c.read(read); const pending = c.submit(intent()); path = "/market"; release(); await pending; expect(c.state()).toMatchObject({ outcome: "UNKNOWN", fenced: true });
  });
  it("refuses a regressed product version and notifies subscribers", async () => {
    const p = createMockResaleMarket(); const initial = await p.read(read); const sourceRead = vi.fn(p.read); const send = vi.fn(p.submit);
    const c = new ResaleMarketController({ read: sourceRead, submit: send }); const changed = vi.fn(); const off = c.subscribe(changed);
    await c.read(read); await c.submit(intent()); sourceRead.mockResolvedValueOnce(initial); expect(await c.read(read)).toEqual({ kind: "IGNORED" });
    expect(c.state()).toMatchObject({ readState: "stale", freshness: "STALE" }); await c.submit(intent()); expect(send).toHaveBeenCalledTimes(1); expect(changed).toHaveBeenCalled(); off();
    await c.read(read); expect(c.detail()?.version).toBe(1);
  });
  it("suppresses duplicates and freezes the dispatched request", async () => {
    const p = createMockResaleMarket(); let release!: () => void; const wait = new Promise<void>(r => { release = r; });
    const submit = vi.fn(async (i: ResaleMarketIntent) => { expect(Object.isFrozen(i)).toBe(true); await wait; return p.submit(i); });
    const c = new ResaleMarketController({ read: p.read, submit }); await c.read(read); const i = intent(); const pending = c.submit(i); i.variantId = "wide"; await c.submit(intent()); expect(submit).toHaveBeenCalledTimes(1); release(); await pending; expect(c.state().outcome).toBe("CONFIRMED");
  });
  it.each(["lost", "mismatch", "claim"])("keeps %s answer UNKNOWN across reads and navigation", async fault => {
    const p = createMockResaleMarket(); const submit = vi.fn(async (i: ResaleMarketIntent) => { const r = await p.submit(i); if (fault === "lost") throw new Error("lost after effect"); return fault === "claim" ? { ...r, fundsExecuted: true } : { ...r, request: { ...i, variantId: "wide" } }; });
    const c = new ResaleMarketController({ read: p.read, submit } as ResaleMarketPort); await c.read(read); await c.submit(intent()); expect(c.state()).toMatchObject({ outcome: "UNKNOWN", fenced: true }); c.invalidate(); await c.read(read); await c.submit({ ...intent(), expectedVersion: 1 }); expect(submit).toHaveBeenCalledTimes(1); expect(c.state().outcome).toBe("UNKNOWN"); expect(c.detail()?.offers).toHaveLength(1);
  });
  it("ignores older navigation reads and fences a late write result", async () => {
    const p = createMockResaleMarket(); let release!: () => void; const wait = new Promise<void>(r => { release = r; });
    const c = new ResaleMarketController({ read: p.read, async submit(i) { const r = await p.submit(i); await wait; return r; } });
    await c.read(read); const pending = c.submit(intent()); c.invalidate(); await c.read({ kind: "detail", productId: "demo-002" }); release(); await pending; expect(c.state().outcome).toBe("UNKNOWN"); expect(c.detail()?.product.productId).toBe("demo-002");
    let releaseRead!: () => void; const held = new Promise<void>(r => { releaseRead = r; });
    const d = new ResaleMarketController({ ...p, async read(i) { if (i.kind === "detail" && i.productId === "demo-001") await held; return p.read(i); } });
    const old = d.read(read); await d.read({ kind: "detail", productId: "demo-002" }); releaseRead(); expect(await old).toEqual({ kind: "IGNORED" }); expect(d.detail()?.product.productId).toBe("demo-002");
  });
});


describe("submitted resale identity", () => {
  it.each(["confirmed", "rejected", "local", "not-bound", "late"] as const)("retains the original %s request across product navigation", async mode => {
    const p = mode === "not-bound" ? resaleMarketPortFor("integration-http") : createMockResaleMarket();
    let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
    const submit = vi.fn(async (i: ResaleMarketIntent) => {
      if (mode === "rejected") return { kind: "REJECTED", request: i, code: "STALE_VERSION", ...MARKET_CLAIMS } as const;
      const answer = await p.submit(i); if (mode === "late") await held; return answer;
    });
    const c = new ResaleMarketController({ read: p.read, submit }); await c.read(read);
    const input = { ...intent(), ...(mode === "local" ? { expectedVersion: 99 } : {}) }; const original = structuredClone(input);
    const writing = c.submit(input); input.variantId = "wide";
    expect(c.state().outcomeRequest).toEqual(original);
    expect(Object.isFrozen(c.state().outcomeRequest)).toBe(true);
    if (mode === "late") {
      expect(c.state().outcome).toBe("IN_FLIGHT");
      await c.submit({ ...intent(), productId: "demo-002" });
      expect(c.state().outcomeRequest).toEqual(original);
    } else await writing;
    await c.read({ kind: "detail", productId: "demo-002" });
    if (mode !== "not-bound") expect(c.detail()?.product.productId).toBe("demo-002");
    expect(c.state().outcomeRequest).toEqual(original);
    release(); await writing;
    if (mode === "late") {
      expect(c.state()).toMatchObject({ outcome: "UNKNOWN", fenced: true, outcomeRequest: original });
      await c.submit({ ...intent(), productId: "demo-002" }); expect(submit).toHaveBeenCalledTimes(1);
    } else {
      expect(c.state().outcome).toBe(mode === "confirmed" ? "CONFIRMED" : mode === "not-bound" ? "NOT_BOUND" : "REJECTED");
    }
  });
});
