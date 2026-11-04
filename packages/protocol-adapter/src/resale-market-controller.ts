import { intentRejection, validMarketRead, validMarketWrite, type ResaleMarketDetail, type ResaleMarketIntent, type ResaleMarketPort, type ResaleMarketRead, type ResaleMarketReadResult } from "./resale-market";
type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
interface BackingMarketState { readState: "loading" | "ready" | "empty" | "error" | "not-bound" | "stale"; freshness: "CURRENT" | "STALE"; snapshot: ResaleMarketReadResult | null; outcome: "CONFIRMED" | "REJECTED" | "UNKNOWN" | "NOT_BOUND" | "IN_FLIGHT" | null; code: string | null; outcomeRequest: ResaleMarketIntent | null; fenced: boolean }
export type MarketState = DeepReadonly<BackingMarketState>;
/** Only plain records and arrays can be made immutable with Object.freeze.
 * In particular, frozen Map/Set/Date/buffer objects still have mutable contents.
 * This runs on detached data, never on objects owned by the port.
 */
function freezeSnapshot<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) throw new Error("INVALID_SNAPSHOT_OBJECT");
  seen.add(value);
  for (const child of Object.values(value)) freezeSnapshot(child, seen);
  return Object.freeze(value);
}
/** Page-load lifetime. Reads never clear UNKNOWN. Each accepted read is tied to its navigation generation. */
export class ResaleMarketController {
  private value: BackingMarketState = freezeSnapshot({ readState: "loading", freshness: "STALE", snapshot: null, outcome: null, code: null, outcomeRequest: null, fenced: false });
  private listeners = new Set<() => void>();
  private generation = 0;
  private busy = false;
  private versions = new Map<string, number>();
  constructor(private port: ResaleMarketPort, private context: () => string = () => "") {}
  state = (): MarketState => this.value;
  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private update(patch: Partial<BackingMarketState>) {
    if (patch.outcome === this.value.outcome && patch.code === this.value.code && patch.outcomeRequest && JSON.stringify(patch.outcomeRequest) === JSON.stringify(this.value.outcomeRequest)) patch.outcomeRequest = this.value.outcomeRequest;
    if ((Object.keys(patch) as (keyof BackingMarketState)[]).every(key => Object.is(this.value[key], patch[key]))) return;
    this.value = freezeSnapshot({ ...this.value, ...patch });
    this.listeners.forEach(fn => fn());
  }
  invalidate() { ++this.generation; this.update({ freshness: "STALE", ...(this.busy ? { outcome: "UNKNOWN", fenced: true, code: "LATE_CONTEXT" } as const : {}) }); }
  async read(input: ResaleMarketRead): Promise<{ kind: "APPLIED" | "IGNORED" }> {
    this.invalidate(); const generation = this.generation; const context = this.context(); const request = freezeSnapshot(structuredClone(input));
    this.update({ readState: "loading", ...(this.value.snapshot && this.value.snapshot.kind !== "NOT_BOUND" && JSON.stringify(this.value.snapshot.request) === JSON.stringify(request) ? {} : { snapshot: null }) });
    try {
      const response: unknown = await this.port.read(request);
      if (generation !== this.generation || context !== this.context()) return { kind: "IGNORED" };
      const answer: unknown = freezeSnapshot(structuredClone(response));
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
  detail(): DeepReadonly<ResaleMarketDetail> | null { return this.detailEvidence(); }
  private detailEvidence(): ResaleMarketDetail | null { const s = this.value.snapshot; return s && s.kind !== "NOT_BOUND" && s.payload.kind === "detail" ? s.payload.detail : null; }
  async submit(input: ResaleMarketIntent): Promise<void> {
    if (this.busy || this.value.fenced) return;
    const request = freezeSnapshot(structuredClone(input));
    if (this.value.readState === "not-bound") { this.update({ outcome: "NOT_BOUND", code: null, outcomeRequest: request }); return; }
    const detail = this.detailEvidence();
    if (!detail || this.value.freshness !== "CURRENT") { this.update({ outcome: "REJECTED", code: "STALE_VERSION", outcomeRequest: request }); return; }
    const code = intentRejection(request,detail);
    if (code) { this.update({ outcome: "REJECTED", code, outcomeRequest: request }); return; }
    const captured = structuredClone(detail); const generation = this.generation; const context = this.context();
    this.busy = true; this.update({ outcome: "IN_FLIGHT", code: null, outcomeRequest: request });
    try {
      const answer: unknown = freezeSnapshot(structuredClone(await this.port.submit(request)));
      if (generation !== this.generation || context !== this.context() || this.value.fenced || !validMarketWrite(answer,request,captured)) throw new Error("UNKNOWN");
      if (answer.kind === "CONFIRMED") this.versions.set(request.productId,answer.version);
      this.update({ outcome: answer.kind, code: answer.kind === "REJECTED" ? answer.code : null, freshness: "STALE" });
    } catch { this.update({ outcome: "UNKNOWN", code: "UNCONFIRMED_RESPONSE", fenced: true, freshness: "STALE" }); }
    finally { this.busy = false; }
  }
}
