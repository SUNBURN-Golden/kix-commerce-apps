import {
  OPENAPI_INTEGRATION_GATE_PIN,
  PINNED_ACTIONS,
  PINNED_PROTOCOL_DOMAIN,
  ProtocolError,
  echoIntegrationGateHeaders,
  type LocalCallInvoker,
} from "../../src/index.js";
import type { LocalCallInput } from "../../src/local-call.js";
import { localCallReceipt } from "./receipt.js";

/**
 * Test-only, deterministic fault injection for the two seams that already
 * exist: the fetchImpl argument of HttpProtocolAdapter and the LocalCallInvoker
 * seam the journeys use. No randomness and no clock. Only TIMEOUT and
 * LATE_DELIVERY wait on the adapter's own short timeoutMs. Nothing here is
 * production source, opens a socket or names a URL beyond the loopback base.
 * It never composes capture, settle_capture, commit_trade, open_admission,
 * admit or any reversal: those actions are counted as banned and nothing else.
 */
export type FaultKind =
  | "PRE_SEND_THROW"
  | "LOST_AFTER_EFFECT"
  | "TRUNCATED_BODY"
  | "TIMEOUT"
  | "STALE_CORRELATION"
  | "INVALID_RECEIPT"
  | "REJECT_422"
  | "SERVER_5XX"
  | "REDIRECT"
  | "LATE_DELIVERY";

export const FAULT_KINDS: readonly FaultKind[] = [
  "PRE_SEND_THROW",
  "LOST_AFTER_EFFECT",
  "TRUNCATED_BODY",
  "TIMEOUT",
  "STALE_CORRELATION",
  "INVALID_RECEIPT",
  "REJECT_422",
  "SERVER_5XX",
  "REDIRECT",
  "LATE_DELIVERY",
];

/** Faults after which the synthetic source already applied the write. */
export const APPLIED_FAULTS: ReadonlySet<FaultKind> = new Set<FaultKind>([
  "LOST_AFTER_EFFECT",
  "TRUNCATED_BODY",
  "TIMEOUT",
  "STALE_CORRELATION",
  "INVALID_RECEIPT",
  "LATE_DELIVERY",
]);

export interface FaultMatch {
  /** Zero-based index among writes, not probes. */
  nth?: number;
  action?: string;
}

export type FaultPlan = readonly { match: FaultMatch; fault: FaultKind }[];

/** Actions no surface here composes. A send of one is a failure of the row. */
export const BANNED_ACTIONS: readonly string[] = [
  "capture",
  "settle_capture",
  "commit_trade",
  "open_admission",
  "admit",
  "refund",
  "reverse",
  "compensate",
];

export interface SendEntry {
  index: number;
  kind: "write" | "probe";
  operationId: string | null;
  action: string | null;
  /** True when the synthetic source took the write, whatever the caller saw. */
  applied: boolean;
  fault: FaultKind | null;
  idempotencyKeyHeader: boolean;
  redirect: string | null;
  url: string;
}

export class SendLedger {
  readonly entries: SendEntry[] = [];

  get writes(): SendEntry[] {
    return this.entries.filter((entry) => entry.kind === "write");
  }

  get probes(): SendEntry[] {
    return this.entries.filter((entry) => entry.kind === "probe");
  }

  get attempts(): number {
    return this.writes.length;
  }

  get appliedAtSource(): number {
    return this.writes.filter((entry) => entry.applied).length;
  }

  /** Writes beyond the first for an operationId. */
  get retriesOfSameOperationId(): number {
    const seen = new Set<string>();
    let again = 0;
    for (const entry of this.writes) {
      const id = entry.operationId ?? "";
      if (seen.has(id)) {
        again += 1;
      }
      seen.add(id);
    }
    return again;
  }

  get bannedActions(): number {
    return this.writes.filter((entry) => entry.action !== null && BANNED_ACTIONS.includes(entry.action)).length;
  }

  get nonLoopback(): number {
    return this.entries.filter((entry) => !entry.url.startsWith("http://127.0.0.1")).length;
  }

  get idempotencyKeyHeaders(): number {
    return this.entries.filter((entry) => entry.idempotencyKeyHeader).length;
  }

  get nonManualRedirects(): number {
    return this.entries.filter((entry) => entry.redirect !== null && entry.redirect !== "manual").length;
  }

  assertOneAttempt(expected: number): void {
    if (this.attempts !== expected) {
      throw new Error(`expected ${expected} write attempt(s), the ledger has ${this.attempts}`);
    }
    if (this.retriesOfSameOperationId !== 0) {
      throw new Error("an operationId was sent twice");
    }
  }

  assertNoWriteAfter(count: number): void {
    if (this.attempts > count) {
      throw new Error(`a write followed the fault: ${this.attempts} writes, expected ${count}`);
    }
  }

  assertNoBanned(): void {
    if (this.bannedActions !== 0) {
      throw new Error("a banned action reached the transport");
    }
  }

  assertTransportHygiene(): void {
    if (this.nonLoopback !== 0 || this.idempotencyKeyHeaders !== 0 || this.nonManualRedirects !== 0) {
      throw new Error("a request left the loopback origin, carried an Idempotency-Key or allowed a redirect");
    }
  }
}

export interface FaultFetchHandle {
  fetch: typeof fetch;
  ledger: SendLedger;
  /** Releases every LATE_DELIVERY answer. Returns how many were waiting. */
  release(): number;
}

/**
 * A fake fetch for HttpProtocolAdapter. `source` is the synthetic write
 * target. The plan decides, per write, what the caller sees.
 */
export function createFaultFetch(source: LocalCallInvoker, plan: FaultPlan = []): FaultFetchHandle {
  const ledger = new SendLedger();
  const pending: Array<() => void> = [];
  const used = new Set<number>();
  let writes = 0;

  const faultFor = (action: string | null): FaultKind | null => {
    const nth = writes;
    const at = plan.findIndex(
      (item, index) =>
        !used.has(index) &&
        (item.match.nth === undefined || item.match.nth === nth) &&
        (item.match.action === undefined || item.match.action === action),
    );
    if (at < 0) {
      return null;
    }
    used.add(at);
    return plan[at]?.fault ?? null;
  };

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const base = {
      index: ledger.entries.length,
      idempotencyKeyHeader: headers.has("idempotency-key"),
      redirect: init?.redirect ?? null,
      url,
    };
    if (init?.method === "GET") {
      ledger.entries.push({ ...base, kind: "probe", operationId: null, action: null, applied: false, fault: null });
      return new Response(JSON.stringify(probeBody(url)), { status: 200, headers: echoIntegrationGateHeaders(init) });
    }
    const envelope = JSON.parse(String(init?.body)) as LocalCallInput;
    const fault = faultFor(envelope.action);
    const entry: SendEntry = {
      ...base,
      kind: "write",
      operationId: envelope.operationId,
      action: envelope.action,
      applied: false,
      fault,
    };
    ledger.entries.push(entry);
    writes += 1;
    const ok = (receipt: unknown, extra: Record<string, string> = {}): Response =>
      new Response(JSON.stringify(receipt), { status: 200, headers: echoIntegrationGateHeaders(init, extra) });

    if (fault === "PRE_SEND_THROW") {
      throw new TypeError("injected: connection refused before send");
    }
    if (fault === "REJECT_422") {
      return new Response(JSON.stringify({ rejected: true, error: "INJECTED_REJECT" }), {
        status: 422,
        headers: echoIntegrationGateHeaders(init),
      });
    }
    if (fault === "SERVER_5XX") {
      return new Response(JSON.stringify({ error: "INJECTED_5XX" }), {
        status: 500,
        headers: echoIntegrationGateHeaders(init),
      });
    }
    if (fault === "REDIRECT") {
      return new Response(null, {
        status: 307,
        headers: { ...echoIntegrationGateHeaders(init), location: "http://localhost:1/elsewhere" },
      });
    }
    const receipt = await source.invokeLocalCall(envelope);
    entry.applied = true;
    switch (fault) {
      case "LOST_AFTER_EFFECT":
        throw new TypeError("injected: connection reset after the effect");
      case "TRUNCATED_BODY": {
        const cut = new Response("{", { status: 200, headers: echoIntegrationGateHeaders(init) });
        Object.defineProperty(cut, "text", { value: () => Promise.reject(new TypeError("injected: body cut off")) });
        return cut;
      }
      case "TIMEOUT":
        return new Promise<Response>(() => undefined);
      case "STALE_CORRELATION":
        return ok(receipt, { "x-request-id": "req-from-an-older-call" });
      case "INVALID_RECEIPT":
        return ok(localCallReceipt(envelope.operationId, "close_sales", { wrong: true }));
      case "LATE_DELIVERY":
        return new Promise<Response>((resolve) => {
          pending.push(() => resolve(ok(receipt)));
        });
      default:
        return ok(receipt);
    }
  };

  return {
    fetch: fetchImpl,
    ledger,
    release() {
      const waiting = pending.splice(0);
      for (const free of waiting) {
        free();
      }
      return waiting.length;
    },
  };
}

/**
 * Invoker-level injection for the in-process stub-shape source. A thrown
 * ProtocolError with a trace reads as UNKNOWN to the journeys, one without
 * reads as not-sent. The ledger records the same fields as the fetch ledger.
 */
export function createFaultInvoker(
  inner: LocalCallInvoker,
  plan: FaultPlan = [],
): { invoker: LocalCallInvoker; ledger: SendLedger } {
  const ledger = new SendLedger();
  const used = new Set<number>();
  let writes = 0;
  const invoker: LocalCallInvoker = {
    async invokeLocalCall(input) {
      const at = plan.findIndex(
        (item, index) =>
          !used.has(index) &&
          (item.match.nth === undefined || item.match.nth === writes) &&
          (item.match.action === undefined || item.match.action === input.action),
      );
      const fault = at < 0 ? null : (plan[at]?.fault ?? null);
      if (at >= 0) {
        used.add(at);
      }
      const entry: SendEntry = {
        index: ledger.entries.length,
        kind: "write",
        operationId: input.operationId,
        action: input.action,
        applied: false,
        fault,
        idempotencyKeyHeader: false,
        redirect: null,
        url: "http://127.0.0.1/in-process",
      };
      ledger.entries.push(entry);
      writes += 1;
      const trace = { requestId: "req-injected", correlationId: "corr-injected" };
      if (fault === "PRE_SEND_THROW") {
        throw new ProtocolError("injected: unavailable before send", "GATE_UNAVAILABLE", trace);
      }
      if (fault === "REJECT_422") {
        const { GateRejectedError } = await import("../../src/http-adapter.js");
        throw new GateRejectedError("injected rejection", "INJECTED_REJECT", trace, 422);
      }
      const receipt = await inner.invokeLocalCall(input);
      entry.applied = true;
      if (fault === "LOST_AFTER_EFFECT" || fault === "TIMEOUT" || fault === "TRUNCATED_BODY") {
        throw new ProtocolError("injected: answer lost after the effect", "GATE_UNAVAILABLE", trace);
      }
      if (fault === "INVALID_RECEIPT" || fault === "STALE_CORRELATION") {
        return localCallReceipt(input.operationId, "close_sales", { wrong: true });
      }
      return receipt;
    },
  };
  return { invoker, ledger };
}

function probeBody(url: string): Record<string, unknown> {
  const ready = url.endsWith("/ready");
  return {
    status: ready ? "ready" : "up",
    production: false,
    publicHost: false,
    productionReadiness: false,
    productionConformance: false,
    protocolTruth: false,
    liveHttpServer: OPENAPI_INTEGRATION_GATE_PIN.liveHttpServerMode,
    role: "integration-gate",
    localFileJournal: false,
    ...(ready ? { liveMoney: false, durable: false, commandCount: PINNED_ACTIONS.length, domain: PINNED_PROTOCOL_DOMAIN } : {}),
  };
}
