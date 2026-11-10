import { describe, expect, it, vi } from "vitest";
import { ResaleMarketController } from "../src/resale-market-controller";
import { MARKET_CLAIMS, createMockResaleMarket, intentRejection, resaleMarketPortFor, validMarketDetail, validMarketIntent, validMarketWrite, type ResaleMarketDetail, type ResaleMarketIntent, type ResaleMarketPort, type ResaleMarketWriteResult } from "../src/resale-market";

const read = { kind: "detail", productId: "demo-001" } as const;
const kinds = ["bid", "ask", "instant-buy", "instant-sell"] as const;
function intent(kind: ResaleMarketIntent["kind"] = "bid"): ResaleMarketIntent {
  const common = { productId: read.productId, variantId: "standard", expectedVersion: 0 };
  return kind === "bid" || kind === "ask" ? { ...common, kind, mockUnits: "115" } : { ...common, kind, quoteId: `demo-001-standard-${kind === "instant-buy" ? "ask" : "bid"}` };
}
const untrusted = (value: unknown) => value as ResaleMarketIntent;
async function detail(port: ResaleMarketPort, productId: string = read.productId): Promise<ResaleMarketDetail> {
  const r = await port.read({ kind: "detail", productId });
  if (r.kind === "NOT_BOUND" || r.payload.kind !== "detail" || !r.payload.detail) throw new Error("fixture");
  return r.payload.detail;
}
const snapshots = (port: ResaleMarketPort) => Promise.all(["demo-001", "demo-002", "demo-003"].map(id => detail(port, id)));
type Case = [string, () => unknown];
const invalid: Case[] = [
  ...[null, undefined, [], [intent()], "bid", 1, true, () => {}].map((v, n): Case => [`container ${n}`, () => v]),
  ...["other", "", "instant_sell", "toString", null, undefined, 0, {}, ["instant-sell"]].map((kind, n): Case => [`unknown kind with available bid quote ${n}`, () => ({ ...intent("instant-sell"), kind })]),
  ["extra replacing required field", () => { const v = { ...intent() } as Record<string, unknown>; delete v.mockUnits; return { ...v, extra: "115" }; }],
  ["missing descriptor", () => new Proxy(intent(), { getOwnPropertyDescriptor(target, key) { return key === "mockUnits" ? undefined : Reflect.getOwnPropertyDescriptor(target, key); } })],
  ["inherited fields", () => Object.create(intent())],
  ["class", () => new (class { constructor() { Object.assign(this, intent()); } })()],
  ["Map", () => Object.assign(new Map(), intent())],
  ["Date", () => Object.assign(new Date(), intent())],
  ["symbol extra", () => ({ ...intent(), [Symbol("extra")]: true })],
  ["non-enumerable extra", () => Object.defineProperty(intent(), "extra", { value: true })],
  ["throwing prototype proxy", () => new Proxy(intent(), { getPrototypeOf() { throw new Error("untrusted"); } })],
  ["throwing keys proxy", () => new Proxy(intent(), { ownKeys() { throw new Error("untrusted"); } })],
  ["throwing descriptor proxy", () => new Proxy(intent(), { getOwnPropertyDescriptor() { throw new Error("untrusted"); } })],
  ["revoked proxy", () => { const p = Proxy.revocable(intent(), {}); p.revoke(); return p.proxy; }],
];
for (const kind of kinds) {
  const sample = intent(kind);
  for (const key of Object.keys(sample)) invalid.push([`${kind} missing ${key}`, () => { const v = { ...sample } as Record<string, unknown>; delete v[key]; return v; }]);
  for (const extra of [{ extra: true }, { metadata: {} }, kind === "bid" || kind === "ask" ? { quoteId: undefined } : { mockUnits: undefined }]) invalid.push([`${kind} extra ${Object.keys(extra)[0]}`, () => ({ ...sample, ...extra })]);
  invalid.push([`${kind} both payloads`, () => ({ ...sample, mockUnits: "115", quoteId: "demo-001-standard-bid" })]);
}
for (const key of ["productId", "variantId", "quoteId"]) {
  for (const [n, value] of ["", " \t\n", "x".repeat(101), 1, null, {}, [], true].entries()) invalid.push([`${key} invalid ${n}`, () => ({ ...intent(key === "quoteId" ? "instant-sell" : "bid"), [key]: value })]);
}
for (const [n, expectedVersion] of [-1, 0.5, "0", NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, null, {}, false].entries()) invalid.push([`version ${n}`, () => ({ ...intent(), expectedVersion })]);
for (const kind of ["bid", "ask"] as const) {
  for (const [n, mockUnits] of ["", " ", "01", "00", "-1", "+1", "1.0", "1e2", "１", "١", "1\n", "1\r\n", " 1", "1 ", "1".repeat(31), 1, 0, 1n, null, undefined, {}, []].entries()) invalid.push([`${kind} amount ${n}`, () => ({ ...intent(kind), mockUnits })]);
}

describe("resale intent runtime boundaries", () => {
  it.each(invalid)("rejects %s without dispatch, mutation or sequence allocation", async (_label, make) => {
    const p = createMockResaleMarket(); const baseline = await snapshots(p); const input = make();
    expect(validMarketIntent(input)).toBe(false);
    expect(intentRejection(untrusted(input), baseline[0]!)).toBe("INVALID_INPUT");
    const submit = vi.fn(p.submit); const c = new ResaleMarketController({ ...p, submit }); await c.read(read);
    const outcomes: unknown[] = []; const off = c.subscribe(() => outcomes.push(c.state().outcome));
    await expect(c.submit(untrusted(input))).resolves.toBeUndefined();
    expect(c.state()).toMatchObject({ outcome: "REJECTED", code: "INVALID_INPUT", outcomeRequest: null, fenced: false, freshness: "CURRENT" });
    expect(submit).not.toHaveBeenCalled(); expect(outcomes).not.toContain("IN_FLIGHT"); off();
    await expect(p.submit(untrusted(input))).rejects.toThrow("INVALID_INPUT");
    expect(await snapshots(p)).toEqual(baseline);
    const control = createMockResaleMarket();
    for (const next of [intent(), { ...intent("instant-sell"), expectedVersion: 1 }]) expect(await p.submit(next)).toEqual(await control.submit(next));
    expect(await snapshots(p)).toEqual(await snapshots(control));
  });

  it.each(["kind", "productId", "variantId", "expectedVersion", "mockUnits", "extra"])("never executes a %s accessor", async key => {
    const getter = vi.fn(() => { throw new Error("accessor executed"); });
    const input = Object.defineProperty(intent(), key, { enumerable: true, get: getter });
    const p = createMockResaleMarket(); const before = await snapshots(p); const submit = vi.fn(p.submit);
    const c = new ResaleMarketController({ ...p, submit }); await c.read(read);
    expect(validMarketIntent(input)).toBe(false); await c.submit(input);
    await expect(p.submit(input)).rejects.toThrow("INVALID_INPUT");
    expect(getter).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled(); expect(await snapshots(p)).toEqual(before);
  });

  it("contains reflective failures after an earlier valid descriptor inspection", async () => {
    let inspections = 0;
    const input = new Proxy(intent(), { ownKeys(target) { if (++inspections > 1) throw new Error("preparation failed"); return Reflect.ownKeys(target); } });
    expect(validMarketIntent(input)).toBe(true);
    const p = createMockResaleMarket(); const before = await snapshots(p); const submit = vi.fn(p.submit);
    const c = new ResaleMarketController({ ...p, submit }); await c.read(read); await c.submit(input);
    expect(c.state()).toMatchObject({ outcome: "REJECTED", code: "INVALID_INPUT", outcomeRequest: null, fenced: false });
    await expect(p.submit(input)).rejects.toThrow("INVALID_INPUT");
    expect(submit).not.toHaveBeenCalled(); expect(await snapshots(p)).toEqual(before);
    expect(await p.submit(intent())).toEqual(await createMockResaleMarket().submit(intent()));
  });

  it("contains pre-dispatch context preparation failure", async () => {
    const p = createMockResaleMarket(); const submit = vi.fn(p.submit); const context = vi.fn(() => "context");
    const c = new ResaleMarketController({ ...p, submit }, context); await c.read(read);
    context.mockImplementationOnce(() => { throw new Error("context failed"); }); await c.submit(intent());
    expect(submit).not.toHaveBeenCalled(); expect(c.state()).toMatchObject({ outcome: "REJECTED", code: "INVALID_INPUT", outcomeRequest: null, fenced: false });
  });

  it.each(["0", "9".repeat(30)])("preserves exact canonical units %s", async mockUnits => {
    for (const kind of ["bid", "ask"] as const) {
      const input = { ...intent(kind), mockUnits }; const p = createMockResaleMarket(); const c = new ResaleMarketController(p);
      expect(validMarketIntent(input)).toBe(true); await c.read(read); await c.submit(input);
      expect(c.state()).toMatchObject({ outcome: "CONFIRMED", outcomeRequest: input });
      expect((await detail(p)).offers[0]?.mockUnits).toBe(mockUnits);
    }
  });

  it.each(kinds)("retains %s behavior at both boundaries", async kind => {
    const input = intent(kind); const p = createMockResaleMarket(); const baseline = await snapshots(p);
    const submit = vi.fn(p.submit); const c = new ResaleMarketController({ ...p, submit }); await c.read(read); await c.submit(input);
    expect(submit).toHaveBeenCalledExactlyOnceWith(input); expect(c.state()).toMatchObject({ outcome: "CONFIRMED", outcomeRequest: input, fenced: false });
    const control = createMockResaleMarket(); const original = await detail(control); const direct = await control.submit(input);
    expect(validMarketWrite(direct, input, original)).toBe(true);
    expect(direct).toMatchObject({ kind: "CONFIRMED", request: input, version: 1 }); expect(await snapshots(p)).toEqual(await snapshots(control));
    const after = await snapshots(p); expect(after.slice(1)).toEqual(baseline.slice(1));
    const d = after[0]!; expect(d.version).toBe(1); expect(d.quotes.every(q => q.version === 1)).toBe(true);
    expect(d.series).toEqual(baseline[0]!.series);
    if (kind === "bid" || kind === "ask") {
      expect(d.offers).toEqual([{ offerId: "offer-1", productId: read.productId, variantId: "standard", side: kind, mockUnits: "115", state: "open" }]);
      expect(d.trades).toEqual(baseline[0]!.trades); expect(d.quotes.every(q => q.available)).toBe(true);
    } else {
      expect(d.offers).toEqual([]); expect(d.trades.at(-1)).toMatchObject({ tradeId: "trade-1", productId: read.productId, variantId: "standard", mockUnits: kind === "instant-buy" ? "120" : "100", state: "simulated" });
      expect(d.trades).toHaveLength(2); expect(d.quotes.filter(q => !q.available).map(q => q.quoteId)).toEqual([`demo-001-standard-${kind === "instant-buy" ? "ask" : "bid"}`]);
    }
  });

  it("preserves identifiers verbatim, null prototypes and non-enumerable required data", async () => {
    for (const productId of ["x", "x".repeat(100), " demo-001 "]) expect(validMarketIntent({ ...intent(), productId, variantId: productId })).toBe(true);
    for (const quoteId of ["x", "x".repeat(100), " demo-001-standard-bid "]) expect(validMarketIntent({ ...intent("instant-sell"), quoteId })).toBe(true);
    for (const input of [Object.assign(Object.create(null), intent()), Object.defineProperty(intent(), "mockUnits", { value: "115", enumerable: false })] as ResaleMarketIntent[]) {
      expect(validMarketIntent(input)).toBe(true); const p = createMockResaleMarket(); const c = new ResaleMarketController(p); await c.read(read); await c.submit(input);
      expect(c.state().outcome).toBe("CONFIRMED"); expect(await createMockResaleMarket().submit(input)).toMatchObject({ kind: "CONFIRMED" });
    }
    const p = createMockResaleMarket(); const submit = vi.fn(p.submit); const c = new ResaleMarketController({ ...p, submit }); await c.read(read);
    await c.submit({ ...intent(), productId: " demo-001 " }); expect(c.state().code).toBe("PRODUCT_MISSING");
    await c.submit(untrusted({ ...intent("instant-sell"), quoteId: " demo-001-standard-bid " })); expect(c.state().code).toBe("QUOTE_MISMATCH"); expect(submit).not.toHaveBeenCalled();
  });

  it("allows a safe successor but keeps MAX_SAFE_INTEGER details read-only", async () => {
    const p = createMockResaleMarket(); const d = await detail(p); d.version = Number.MAX_SAFE_INTEGER - 1; d.quotes.forEach(q => { q.version = d.version; });
    const input = { ...intent(), expectedVersion: d.version }; expect(validMarketIntent(input)).toBe(true); expect(intentRejection(input, d)).toBeNull();
    const readPort = vi.fn(async () => ({ ...(await p.read(read)), payload: { kind: "detail" as const, detail: d } }));
    const submit = vi.fn(async (request: ResaleMarketIntent): Promise<ResaleMarketWriteResult> => ({ ...MARKET_CLAIMS, kind: "CONFIRMED", request, version: d.version + 1, record: { offerId: "boundary", productId: read.productId, variantId: "standard", side: "bid", mockUnits: "115", state: "open" } }));
    const c = new ResaleMarketController({ read: readPort, submit }); await c.read(read); await c.submit(input); expect(c.state().outcome).toBe("CONFIRMED");
    d.version = Number.MAX_SAFE_INTEGER; d.quotes.forEach(q => { q.version = d.version; }); expect(validMarketDetail(d)).toBe(true); await c.read(read);
    expect(c.state().freshness).toBe("CURRENT"); expect(c.detail()?.version).toBe(Number.MAX_SAFE_INTEGER);
    await c.submit({ ...intent(), expectedVersion: d.version }); expect(c.state()).toMatchObject({ outcome: "REJECTED", code: "INVALID_INPUT" }); expect(submit).toHaveBeenCalledTimes(1);
  });

  it("checks shape before stale/detail and semantic rejection precedence", async () => {
    const p = createMockResaleMarket(); const d = await detail(p); const c = new ResaleMarketController(p);
    await c.submit(untrusted(null)); expect(c.state().code).toBe("INVALID_INPUT");
    await c.submit(intent()); expect(c.state()).toMatchObject({ code: "STALE_VERSION", outcomeRequest: intent() });
    for (const [patch, code] of [[{ productId: "missing", variantId: "missing", expectedVersion: 99 }, "PRODUCT_MISSING"], [{ variantId: "missing", expectedVersion: 99 }, "VARIANT_MISSING"], [{ expectedVersion: 99 }, "STALE_VERSION"]] as const) {
      const input = { ...intent(), ...patch }; expect(intentRejection(input, d)).toBe(code);
      const before = await snapshots(p); expect(await p.submit(input)).toMatchObject({ kind: "REJECTED", code, request: input }); expect(await snapshots(p)).toEqual(before);
    }
    expect(intentRejection(untrusted({ ...intent(), productId: "missing", mockUnits: "01" }), d)).toBe("INVALID_INPUT");
  });

  it.each(["missing", "product", "variant", "version", "side", "unavailable"])("validates exact quote reference: %s", async fault => {
    const p = createMockResaleMarket(); const d = await detail(p); const input = intent("instant-sell");
    const q = d.quotes.find(q => q.quoteId === "demo-001-standard-bid")!;
    if (fault === "missing") q.quoteId = "other";
    else if (fault === "product") q.productId = "demo-002";
    else if (fault === "variant") q.variantId = "wide";
    else if (fault === "version") q.version = 1;
    else if (fault === "side") q.side = "ask";
    else q.available = false;
    expect(intentRejection(input, d)).toBe(fault === "unavailable" ? "QUOTE_UNAVAILABLE" : "QUOTE_MISMATCH");
  });

  it.each(["absent", "demo-002-standard-bid", "demo-001-wide-bid", "demo-001-standard-ask"])("never substitutes a direct quote: %s", async quoteId => {
    const p = createMockResaleMarket(); const before = await snapshots(p); const input = { ...intent("instant-sell"), quoteId };
    const submit = vi.fn(p.submit); const c = new ResaleMarketController({ ...p, submit }); await c.read(read); await c.submit(input);
    expect(c.state().code).toBe("QUOTE_MISMATCH"); expect(submit).not.toHaveBeenCalled();
    expect(await p.submit(input)).toMatchObject({ kind: "REJECTED", code: "QUOTE_MISMATCH" }); expect(await snapshots(p)).toEqual(before);
  });

  it("keeps NOT_BOUND precedence for every malformed or uncloneable input", async () => {
    const p = resaleMarketPortFor("integration-http"); const submit = vi.fn(p.submit); const c = new ResaleMarketController({ ...p, submit }); await c.read(read);
    for (const [, make] of invalid) {
      const input = untrusted(make()); await expect(c.submit(input)).resolves.toBeUndefined();
      expect(c.state()).toMatchObject({ outcome: "NOT_BOUND", code: null, outcomeRequest: null, fenced: false });
      expect(await p.submit(input)).toMatchObject({ kind: "NOT_BOUND" });
    }
    expect(submit).not.toHaveBeenCalled();
  });

  it("suppresses malformed duplicates before touching busy or UNKNOWN evidence", async () => {
    const p = createMockResaleMarket(); let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
    const submit = vi.fn(async (i: ResaleMarketIntent) => { await p.submit(i); await held; throw new Error("lost"); });
    const c = new ResaleMarketController({ ...p, submit }); await c.read(read); const pending = c.submit(intent()); const inFlight = c.state();
    await c.submit(untrusted(null)); expect(c.state()).toBe(inFlight); release(); await pending; const unknown = c.state();
    await c.submit(untrusted({ kind: "other" })); expect(c.state()).toBe(unknown); expect(unknown).toMatchObject({ outcome: "UNKNOWN", fenced: true }); expect(submit).toHaveBeenCalledTimes(1);
  });
});
