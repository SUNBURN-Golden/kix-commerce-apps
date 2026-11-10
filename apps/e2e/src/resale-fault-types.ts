/** Browser-global typing for the test-only substituted port. No product import. */
export {};
import type { ResaleMarketIntent, ResaleMarketWriteResult } from "../../../packages/protocol-adapter/src/resale-market";
declare global { interface Window { __kixResaleFault?: { mode: "normal" | "reject" | "lost" | "held" | "wrong-side"; dispatches: number; requests?: ResaleMarketIntent[]; results?: ResaleMarketWriteResult[]; reads?: number; history?: { count: number; wideCount: number; generation?: number; reverse?: boolean }; release?: () => void } } }
