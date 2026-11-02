import { intentRejection, validMarketRead, validMarketWrite, type ResaleMarketDetail, type ResaleMarketIntent, type ResaleMarketPort, type ResaleMarketRead, type ResaleMarketReadResult } from "./resale-market";
export interface MarketState { readState: "loading" | "ready" | "empty" | "error" | "not-bound" | "stale"; freshness: "CURRENT" | "STALE"; snapshot: ResaleMarketReadResult | null; outcome: "CONFIRMED" | "REJECTED" | "UNKNOWN" | "NOT_BOUND" | "IN_FLIGHT" | null; code: string | null; fenced: boolean }
/** Page-load lifetime. Reads never clear UNKNOWN. Each accepted read is tied to its navigation generation. */
export class ResaleMarketController {
  private value: MarketState = { readState: "loading", freshness: "STALE", snapshot: null, outcome: null, code: null, fenced: false };
  private listeners = new Set<() => void>();
  private generation = 0;
  private busy = false;
  private versions = new Map<string, number>();
  constructor(private port: ResaleMarketPort, private context: () => string = () => "") {}
  state = (): MarketState => this.value;
  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private update(patch: Partial<MarketState>) { this.value = { ...this.value, ...patch }; this.listeners.forEach(fn => fn()); }
  invalidate() { ++this.generation; this.update({ freshness: "STALE", ...(this.busy ? { outcome: "UNKNOWN", fenced: true, code: "LATE_CONTEXT" } as const : {}) }); }
  async read(input: ResaleMarketRead): Promise<{ kind: "APPLIED" | "IGNORED" }> {
    this.invalidate(); const generation = this.generation; const context = this.context(); const request = Object.freeze(structuredClone(input));
    this.update({ readState: "loading", ...(this.value.snapshot && this.value.snapshot.kind !== "NOT_BOUND" && JSON.stringify(this.value.snapshot.request) === JSON.stringify(request) ? {} : { snapshot: null }) });
    try {
      const answer: unknown = await this.port.read(request);
      if (generation !== this.generation || context !== this.context()) return { kind: "IGNORED" };
      if (!validMarketRead(answer,request)) throw new Error("INVALID_READ");
      if (answer.kind !== "NOT_BOUND" && answer.payload.kind === "detail" && answer.payload.detail) {
        const d = answer.payload.detail;
        if (d.version < (this.versions.get(d.product.productId) ?? 0)) {
          this.update({ readState: "stale", freshness: "STALE" });
          return { kind: "IGNORED" };
        }
        this.versions.set(d.product.productId,d.version);
      }
      this.update({ snapshot: answer, readState: answer.kind === "NOT_BOUND" ? "not-bound" : answer.kind, freshness: answer.kind === "NOT_BOUND" ? "STALE" : "CURRENT" });
    } catch { if (generation !== this.generation || context !== this.context()) return { kind: "IGNORED" }; this.update({ readState: "error", freshness: "STALE" }); }
    return { kind: "APPLIED" };
  }
  detail(): ResaleMarketDetail | null { const s = this.value.snapshot; return s && s.kind !== "NOT_BOUND" && s.payload.kind === "detail" ? s.payload.detail : null; }
  async submit(input: ResaleMarketIntent): Promise<void> {
    if (this.busy || this.value.fenced) return;
    if (this.value.readState === "not-bound") { this.update({ outcome: "NOT_BOUND" }); return; }
    const detail = this.detail();
    if (!detail || this.value.freshness !== "CURRENT") { this.update({ outcome: "REJECTED", code: "STALE_VERSION" }); return; }
    const request = Object.freeze(structuredClone(input));
    const code = intentRejection(request,detail);
    if (code) { this.update({ outcome: "REJECTED", code }); return; }
    const captured = structuredClone(detail); const generation = this.generation; const context = this.context();
    this.busy = true; this.update({ outcome: "IN_FLIGHT", code: null });
    try {
      const answer: unknown = await this.port.submit(request);
      if (generation !== this.generation || context !== this.context() || this.value.fenced || !validMarketWrite(answer,request,captured)) throw new Error("UNKNOWN");
      if (answer.kind === "CONFIRMED") this.versions.set(request.productId,answer.version);
      this.update({ outcome: answer.kind, code: answer.kind === "REJECTED" ? answer.code : null, freshness: "STALE" });
    } catch { this.update({ outcome: "UNKNOWN", code: "UNCONFIRMED_RESPONSE", fenced: true, freshness: "STALE" }); }
    finally { this.busy = false; }
  }
}
