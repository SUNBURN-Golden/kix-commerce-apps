import { describe, expect, it, vi } from "vitest";
import { ResaleMarketController } from "../src/resale-market-controller";
import { createMockResaleMarket, resaleMarketPortFor, validMarketRead, validMarketWrite, type ResaleMarketDetail, type ResaleMarketIntent, type ResaleMarketReadResult, type ResaleMarketWriteResult } from "../src/resale-market";

const read = { kind: "detail", productId: "demo-001" } as const;
const bid = (): ResaleMarketIntent => ({ kind: "bid", productId: read.productId, variantId: "standard", expectedVersion: 0, mockUnits: "115" });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function detailOf(answer: ResaleMarketReadResult): ResaleMarketDetail {
  if (answer.kind === "NOT_BOUND" || answer.payload.kind !== "detail" || !answer.payload.detail) throw new Error("fixture");
  return answer.payload.detail;
}
/** Exercise every published layer with writes and deletes, including arrays. */
function attack(value: unknown, seen = new WeakSet<object>()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  expect(Reflect.set(value, "injected", true)).toBe(false);
  for (const [key, child] of Object.entries(value)) {
    attack(child, seen);
    expect(Reflect.set(value, key, null)).toBe(false);
    expect(Reflect.deleteProperty(value, key)).toBe(false);
    expect(Reflect.defineProperty(value, key, { value: {} })).toBe(false);
  }
  if (Array.isArray(value)) {
    expect(() => value.push(null)).toThrow(TypeError);
    if (value.length) expect(() => value.splice(0, 1)).toThrow(TypeError);
  }
}

describe("resale controller evidence ownership", () => {
  it("detaches list products, variants, echoed requests and claims without freezing the producer", async () => {
    const p = createMockResaleMarket();
    const request = { kind: "list", query: "", page: 1 } as const;
    const response = await p.read(request); const submit = vi.fn(p.submit);
    const c = new ResaleMarketController({ read: async () => response, submit });
    await c.read(request);
    const accepted = c.state(); const expected = structuredClone(accepted);
    attack(accepted);
    if (response.kind === "NOT_BOUND" || response.payload.kind !== "list") throw new Error("fixture");
    response.payload.products[0]!.productId = "forged";
    response.payload.products[0]!.variantIds.splice(0);
    response.payload.products.reverse(); response.payload.total = 0;
    response.request = { kind: "list", query: "forged", page: 99 };
    Object.assign(response, { protocolTruth: true, fundsExecuted: true });
    expect(c.state()).toBe(accepted); expect(c.state()).toEqual(expected);
    expect(c.detail()).toBeNull();
    await c.submit(bid()); expect(submit).not.toHaveBeenCalled();
    expect(c.state()).toMatchObject({ outcome: "REJECTED", code: "STALE_VERSION" });
  });

  it("protects all nested detail evidence and dispatches against the accepted quote", async () => {
    const p = createMockResaleMarket(); await p.submit(bid());
    const response = await p.read(read); const original = detailOf(response);
    if (response.kind === "NOT_BOUND") throw new Error("fixture");
    const submit = vi.fn(p.submit);
    const c = new ResaleMarketController({ read: async () => response, submit }); await c.read(read);
    const accepted = c.state(); const detail = c.detail(); const expected = structuredClone(accepted);
    attack(accepted); attack(detail);
    original.product.productId = "forged"; original.product.variantIds.splice(0);
    original.version = 999;
    Object.assign(original.quotes[1]!, { quoteId: "forged", productId: "forged", variantId: "wide", side: "bid", mockUnits: "999", version: 999, available: false });
    original.quotes.reverse(); original.offers[0]!.mockUnits = "999";
    original.trades[0]!.tradeId = "forged"; original.series[0]!.mockUnits = "999";
    Object.assign(original, { fundsExecuted: true }); response.request = { kind: "detail", productId: "forged" };
    expect(c.state()).toEqual(expected); expect(c.detail()).toBe(detail);
    const intent: ResaleMarketIntent = { kind: "instant-buy", productId: read.productId, variantId: "standard", expectedVersion: 1, quoteId: "demo-001-standard-ask" };
    await c.submit(intent);
    expect(submit).toHaveBeenCalledExactlyOnceWith(intent);
    expect(c.state().outcome).toBe("CONFIRMED");
    expect(c.detail()).toBe(detail); expect(accepted).toEqual(expected);
  });

  it("cannot manufacture quote availability, variants or versions through either accessor or producer", async () => {
    const p = createMockResaleMarket(); const request = { kind: "detail", productId: "demo-003" } as const;
    const response = await p.read(request); const original = detailOf(response); const submit = vi.fn(p.submit);
    const c = new ResaleMarketController({ read: async () => response, submit }); await c.read(request);
    attack(c.state()); attack(c.detail());
    original.quotes[0]!.available = true; original.product.variantIds.push("wide"); original.version = 9;
    await c.submit({ kind: "instant-sell", productId: request.productId, variantId: "standard", expectedVersion: 0, quoteId: "demo-003-standard-bid" });
    expect(c.state()).toMatchObject({ outcome: "REJECTED", code: "QUOTE_UNAVAILABLE" });
    await c.submit({ ...bid(), productId: request.productId, variantId: "invented" });
    expect(c.state().code).toBe("VARIANT_MISSING");
    await c.submit({ ...bid(), productId: request.productId, expectedVersion: 9 });
    expect(c.state().code).toBe("STALE_VERSION"); expect(submit).not.toHaveBeenCalled();
  });

  it.each([false, true])("captures the original intent and receipt evidence (forged answer: %s)", async forged => {
    const p = createMockResaleMarket(); const response = await p.read(read); const held = deferred<ResaleMarketWriteResult>();
    const submit = vi.fn((_input: ResaleMarketIntent) => held.promise);
    const c = new ResaleMarketController({ read: async () => response, submit }); await c.read(read);
    const input = bid(); const expected = structuredClone(input); const pending = c.submit(input);
    Object.assign(input, { variantId: "wide", mockUnits: "999", expectedVersion: 100 });
    detailOf(response).version = 100; detailOf(response).quotes[0]!.mockUnits = "999";
    attack(c.state());
    expect(submit).toHaveBeenCalledExactlyOnceWith(expected);
    attack(submit.mock.calls[0]![0]);
    held.resolve(await p.submit(forged ? { ...input, expectedVersion: 0 } : expected));
    await pending;
    expect(c.state()).toMatchObject(forged ? { outcome: "UNKNOWN", fenced: true } : { outcome: "CONFIRMED", fenced: false });
  });

  it("keeps UNKNOWN fenced across subscriber attacks, reads, navigation and another submit", async () => {
    const p = createMockResaleMarket(); const submit = vi.fn(async (i: ResaleMarketIntent) => { await p.submit(i); throw new Error("lost after effect"); });
    const c = new ResaleMarketController({ read: p.read, submit }); await c.read(read);
    const off = c.subscribe(() => { attack(c.state()); attack(c.detail()); });
    await c.submit(bid()); const unknown = c.state();
    expect(Reflect.set(unknown, "fenced", false)).toBe(false);
    expect(Reflect.set(unknown, "outcome", "CONFIRMED")).toBe(false);
    expect(Reflect.set(unknown, "freshness", "CURRENT")).toBe(false);
    c.invalidate(); await c.read({ kind: "detail", productId: "demo-002" }); await c.read(read);
    await c.submit({ ...bid(), expectedVersion: 1 });
    expect(submit).toHaveBeenCalledTimes(1); expect(c.state()).toMatchObject({ outcome: "UNKNOWN", fenced: true });
    expect(unknown).toMatchObject({ outcome: "UNKNOWN", fenced: true, freshness: "STALE" }); off();
  });

  it("suppresses deferred duplicates and reentrant IN_FLIGHT submissions before dispatch", async () => {
    const p = createMockResaleMarket(); const held = deferred<ResaleMarketWriteResult>(); const submit = vi.fn((_input: ResaleMarketIntent) => held.promise);
    const c = new ResaleMarketController({ read: p.read, submit }); await c.read(read);
    const off = c.subscribe(() => { if (c.state().outcome === "IN_FLIGHT") { attack(c.state()); void c.submit(bid()); } });
    const pending = c.submit(bid()); await c.submit(bid()); expect(submit).toHaveBeenCalledTimes(1);
    held.resolve(await p.submit(bid())); await pending; expect(c.state().outcome).toBe("CONFIRMED"); off();
  });

  it("preserves identities between publications, ignores late reads and unsubscribes", async () => {
    const p = createMockResaleMarket(); const held = deferred<ResaleMarketReadResult>(); const sourceRead = vi.fn(p.read);
    const c = new ResaleMarketController({ ...p, read: sourceRead }); const changed = vi.fn(); const off = c.subscribe(changed);
    const initial = c.state(); attack(initial); c.invalidate(); expect(c.state()).toBe(initial); expect(changed).not.toHaveBeenCalled();
    await c.read(read); const ready = c.state(); const detail = c.detail(); expect(ready).not.toBe(initial);
    expect(c.state()).toBe(ready); expect(c.detail()).toBe(detail); expect(changed).toHaveBeenCalled();
    await c.submit({ ...bid(), expectedVersion: 99 }); const rejected = c.state();
    expect(rejected).not.toBe(ready); expect(c.detail()).toBe(detail);
    changed.mockClear(); await c.submit({ ...bid(), expectedVersion: 99 }); attack(c.state());
    expect(c.state()).toBe(rejected); expect(changed).not.toHaveBeenCalled();
    sourceRead.mockReturnValueOnce(held.promise); const old = c.read(read);
    await c.read({ kind: "detail", productId: "demo-002" }); const current = c.state(); changed.mockClear();
    held.resolve(await p.read(read)); expect(await old).toEqual({ kind: "IGNORED" });
    expect(c.state()).toBe(current); expect(changed).not.toHaveBeenCalled();
    expect(ready).toMatchObject({ freshness: "CURRENT", outcome: null }); expect(initial.snapshot).toBeNull();
    off(); c.invalidate(); expect(c.state()).not.toBe(current); expect(changed).not.toHaveBeenCalled();
  });

  it("protects version floors from retained confirmed answers and stale read mutations", async () => {
    const p = createMockResaleMarket(); const old = await p.read(read); let receipt!: ResaleMarketWriteResult;
    const sourceRead = vi.fn(p.read);
    const c = new ResaleMarketController({ read: sourceRead, async submit(i) { receipt = await p.submit(i); return receipt; } });
    await c.read(read); await c.submit(bid());
    if (receipt.kind !== "CONFIRMED") throw new Error("fixture");
    receipt.version = 999; receipt.request.expectedVersion = 999; receipt.record.mockUnits = "999";
    attack(c.state()); detailOf(old).quotes[0]!.available = false;
    sourceRead.mockResolvedValueOnce(old); expect(await c.read(read)).toEqual({ kind: "IGNORED" });
    expect(c.state()).toMatchObject({ readState: "stale", freshness: "STALE" });
    await c.read(read); expect(c.detail()?.version).toBe(1); expect(c.state().freshness).toBe("CURRENT");
    await c.submit({ ...bid(), expectedVersion: 1 }); expect(c.state().outcome).toBe("CONFIRMED");
  });

  it("keeps integration-http NOT_BOUND and never dispatches after its read", async () => {
    const p = resaleMarketPortFor("integration-http"); const submit = vi.fn(p.submit);
    const c = new ResaleMarketController({ ...p, submit }); await c.read(read); attack(c.state()); await c.submit(bid());
    expect(c.state()).toMatchObject({ readState: "not-bound", outcome: "NOT_BOUND", freshness: "STALE" });
    expect(submit).not.toHaveBeenCalled();
    const stub = createMockResaleMarket(); const write = vi.fn(p.submit);
    const d = new ResaleMarketController({ read: stub.read, submit: write }); await d.read(read); await d.submit(bid());
    expect(write).toHaveBeenCalledTimes(1); expect(d.state()).toMatchObject({ outcome: "NOT_BOUND", freshness: "STALE" });
  });

  it.each([new Map([["mutable", 1]]), new Set([1]), new Date(), new Uint8Array([1]), new ArrayBuffer(1), new SharedArrayBuffer(1)])("rejects mutable built-ins anywhere in a read graph (%s)", async extra => {
    const p = createMockResaleMarket(); const list = { kind: "list", query: "", page: 1 } as const;
    const response = await p.read(list);
    if (response.kind === "NOT_BOUND") throw new Error("fixture");
    Object.assign(response.payload, { extra: { nested: [extra] } });
    expect(validMarketRead(response, list)).toBe(true); // Existing validator deliberately stays unchanged.
    const submit = vi.fn(p.submit); const c = new ResaleMarketController({ read: async () => response, submit });
    await c.read(list); expect(c.state()).toMatchObject({ readState: "error", freshness: "STALE", snapshot: null });
    await c.submit(bid()); expect(submit).not.toHaveBeenCalled();
  });

  it("rejects unsafe read graphs before committing a version floor", async () => {
    const p = createMockResaleMarket(); const response = await p.read(read);
    detailOf(response).version = 99; detailOf(response).quotes.forEach(q => { q.version = 99; });
    if (response.kind === "NOT_BOUND") throw new Error("fixture");
    Object.assign(response.payload, { extra: new Map() });
    const sourceRead = vi.fn(p.read).mockResolvedValueOnce(response);
    const c = new ResaleMarketController({ ...p, read: sourceRead }); await c.read(read);
    expect(c.state().readState).toBe("error"); await c.read(read);
    expect(c.state()).toMatchObject({ readState: "ready", freshness: "CURRENT" }); expect(c.detail()?.version).toBe(0);
  });

  it.each(["clone", "cycle"])("classifies %s failure as a stale read without publishing unsafe data", async fault => {
    const p = createMockResaleMarket(); const response = await p.read(read);
    if (response.kind === "NOT_BOUND") throw new Error("fixture");
    Object.assign(response.payload, { extra: fault === "clone" ? () => {} : response });
    const c = new ResaleMarketController({ ...p, read: async () => response }); await c.read(read);
    expect(c.state()).toMatchObject({ readState: "error", freshness: "STALE", snapshot: null });
  });

  it.each(["builtin", "clone", "validation"])("fences post-dispatch %s failures without advancing versions", async fault => {
    const p = createMockResaleMarket(); const input = Object.assign(bid(), { metadata: {} });
    const baseline = detailOf(await p.read(read)); const receipt = await p.submit(input);
    if (receipt.kind !== "CONFIRMED") throw new Error("fixture");
    if (fault === "builtin") {
      Object.assign(receipt.request, { metadata: new Map() });
      expect(validMarketWrite(receipt, input, baseline)).toBe(true);
    } else if (fault === "clone") Object.assign(receipt, { extra: () => {} });
    else receipt.version = 99;
    const sourceRead = vi.fn(async () => { const r = await createMockResaleMarket().read(read); return r; });
    const submit = vi.fn(async () => receipt); const c = new ResaleMarketController({ read: sourceRead, submit });
    await c.read(read); await c.submit(input);
    expect(c.state()).toMatchObject({ outcome: "UNKNOWN", code: "UNCONFIRMED_RESPONSE", fenced: true, freshness: "STALE" });
    await c.read(read); expect(c.state().readState).toBe("ready"); expect(c.detail()?.version).toBe(0);
    await c.submit(input); expect(submit).toHaveBeenCalledTimes(1); expect(c.state().fenced).toBe(true);
  });
});
