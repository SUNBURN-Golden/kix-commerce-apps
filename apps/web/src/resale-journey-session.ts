import { canCancelBefore, ResaleJourney } from "../../../packages/protocol-adapter/src/resale-journey";
import { MARKET_STEPS, type MarketStep } from "../../../packages/protocol-adapter/src/resale-journey-fixture";
import type { CommerceJourneyPort } from "../../../packages/protocol-adapter/src/commerce-journey-command";
import { ProtocolError, type SessionStorePort } from "../../../packages/protocol-adapter/src/shell-entry";
import { EVIDENCE_LOST, persistOwnedIntent, pinDigest, type Mode } from "./booking-journey-intent";
import { onNavigation } from "./shell/navigation-observers";

interface Intent {
  v: 1;
  pinDigest: string;
  mode: Mode;
  operationId: string;
  step: MarketStep;
  confirmed: MarketStep | null;
  listed: "LISTED" | "NO_EVIDENCE";
  paid: "PAYMENT_NOTED" | "NO_EVIDENCE";
}
function readIntent(store: SessionStorePort | null, key: string, mode: Mode): Intent | typeof EVIDENCE_LOST | null {
  try {
    if (!store) return EVIDENCE_LOST;
    const raw = store.getItem(key);
    if (raw === null) return null;
    const row = JSON.parse(raw);
    const confirmedIndex = MARKET_STEPS.indexOf(row.confirmed);
    const next = MARKET_STEPS[confirmedIndex + 1];
    if (Object.keys(row).length === 8 && row.v === 1 && row.pinDigest === pinDigest && row.mode === mode &&
        (row.confirmed === null || confirmedIndex >= 0) && next &&
        (row.step === next || (row.step === "market-cancel" && canCancelBefore(next))) &&
        row.listed === (confirmedIndex >= MARKET_STEPS.indexOf("market-list") ? "LISTED" : "NO_EVIDENCE") &&
        row.paid === (confirmedIndex >= MARKET_STEPS.indexOf("market-pay") ? "PAYMENT_NOTED" : "NO_EVIDENCE") &&
        typeof row.operationId === "string" && /^resale:[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(row.operationId)) return row;
  } catch { /* Keep the write fence if tab history cannot be read. */ }
  return EVIDENCE_LOST;
}

/** A single pinned listing, isolated from all market product and quote identities. */
export class MarketJourneySession {
  private revision = 0;
  private listeners = new Set<() => void>();
  readonly version = () => this.revision;
  readonly subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private savedHistory: ReturnType<typeof readIntent>;
  get history() { return this.savedHistory; }
  private ownedIntent: ReturnType<typeof persistOwnedIntent> | undefined;
  readonly journey: ResaleJourney;
  constructor(port: CommerceJourneyPort, store: SessionStorePort | null, readonly mode: Mode) {
    const key = `kix-resale-intent:${mode}`;
    this.savedHistory = readIntent(store, key, mode);
    this.journey = new ResaleJourney({ advanceCommerceJourney: async call => {
      const { confirmed, facts } = this.journey.state();
      try {
        if (this.history || mode === "integration-http") throw new Error(EVIDENCE_LOST);
        this.ownedIntent = persistOwnedIntent(store, key, { v: 1, pinDigest, mode,
          operationId: call.operationId, step: call.step, confirmed, listed: facts.listed.state, paid: facts.paid.state });
      } catch {
        this.savedHistory = EVIDENCE_LOST;
        throw new ProtocolError("Tab history unavailable.", EVIDENCE_LOST);
      }
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
  }
  async run(step: MarketStep) {
    if (this.history || this.mode === "integration-http") return;
    const answer = this.journey.run(step);
    const owned = this.ownedIntent;
    this.ownedIntent = undefined;
    this.publish();
    const outcome = await answer;
    if (outcome && owned) {
      try {
        if (outcome.kind === "UNKNOWN") owned.verify();
        else owned();
      } catch { this.savedHistory = EVIDENCE_LOST; }
    }
    this.publish();
  }
  private publish() { this.revision++; this.listeners.forEach(fn => fn()); }
}
