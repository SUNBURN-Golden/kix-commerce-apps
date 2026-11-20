import { canCancelBefore, ResaleJourney } from "../../../packages/protocol-adapter/src/resale-journey";
import { MARKET_STEPS, type MarketStep } from "../../../packages/protocol-adapter/src/resale-journey-fixture";
import type { CommerceJourneyPort } from "../../../packages/protocol-adapter/src/commerce-journey-command";
import { ProtocolError, type SessionStorePort } from "../../../packages/protocol-adapter/src/shell-entry";
import { onNavigation } from "./shell/navigation-observers";

interface Intent {
  operationId: string;
  step: MarketStep;
  confirmed: MarketStep | null;
  listed: "LISTED" | "NO_EVIDENCE";
  paid: "PAYMENT_NOTED" | "NO_EVIDENCE";
}
function readIntent(store: SessionStorePort | null, key: string): Intent | "SESSION_EVIDENCE_LOST" | null {
  try {
    if (!store) return "SESSION_EVIDENCE_LOST";
    const raw = store.getItem(key);
    if (raw === null) return null;
    const row = JSON.parse(raw);
    const confirmedIndex = MARKET_STEPS.indexOf(row.confirmed);
    const next = MARKET_STEPS[confirmedIndex + 1];
    if ((row.confirmed === null || confirmedIndex >= 0) && next &&
        (row.step === next || (row.step === "market-cancel" && canCancelBefore(next))) &&
        row.listed === (confirmedIndex >= MARKET_STEPS.indexOf("market-list") ? "LISTED" : "NO_EVIDENCE") &&
        row.paid === (confirmedIndex >= MARKET_STEPS.indexOf("market-pay") ? "PAYMENT_NOTED" : "NO_EVIDENCE") &&
        typeof row.operationId === "string" && /^resale:[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(row.operationId)) return row;
  } catch { /* Keep the write fence if tab history cannot be read. */ }
  return "SESSION_EVIDENCE_LOST";
}

/** A single pinned listing, isolated from all market product and quote identities. */
export class MarketJourneySession {
  private revision = 0;
  private listeners = new Set<() => void>();
  readonly version = () => this.revision;
  readonly subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  readonly history: ReturnType<typeof readIntent>;
  readonly journey: ResaleJourney;
  constructor(port: CommerceJourneyPort, store: SessionStorePort | null, readonly mode: "stub" | "integration-http") {
    const key = `kix-resale-intent:${mode}`;
    this.history = readIntent(store, key);
    this.journey = new ResaleJourney({ advanceCommerceJourney: async call => {
      const { confirmed, facts } = this.journey.state();
      try {
        if (!store || this.history || store.getItem(key) !== null) throw new Error();
        store.setItem(key, JSON.stringify({ operationId: call.operationId, step: call.step, confirmed,
          listed: facts.listed.state, paid: facts.paid.state }));
      } catch { throw new ProtocolError("Tab history unavailable.", "SESSION_EVIDENCE_LOST"); }
      // Departure severs this view's receipt channel even if the gate later applies the write.
      let off = () => {};
      const departed = new Promise<never>((_, reject) => {
        off = onNavigation(() => reject(new Error("Route departed during dispatch.")));
      });
      try {
        return await Promise.race([port.advanceCommerceJourney(call), departed]);
      } finally { off(); }
    } }, () => {
      const operationId = `resale:${crypto.randomUUID()}`;
      return { operationId, idempotencyKey: `key:${operationId}` };
    });
    this.clearKnown = () => store?.removeItem(key);
  }
  private readonly clearKnown: () => void;
  async run(step: MarketStep) {
    if (this.history || this.mode === "integration-http") return;
    const answer = this.journey.run(step);
    this.publish();
    const outcome = await answer;
    if (outcome && outcome.kind !== "UNKNOWN" && !(outcome.kind === "NOT_SENT" && outcome.code === "SESSION_EVIDENCE_LOST")) {
      try { this.clearKnown(); } catch { /* A retained intent blocks the next dispatch. */ }
    }
    this.publish();
  }
  private publish() { this.revision++; this.listeners.forEach(fn => fn()); }
}
