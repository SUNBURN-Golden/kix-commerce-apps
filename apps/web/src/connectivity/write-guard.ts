import { ProtocolError, type CommerceProtocol, type LocalCallInvoker } from "@kix/protocol-adapter";
import { connectivity, type ConnectivityStore, type ReadConnectivityStamp } from "./store";

export const OFFLINE_NOT_SENT = "Connection unavailable. Nothing sent. No write is queued or retried.";
export const CACHED_NOT_SENT = "STALE · cached read. Read again before writing. Nothing sent.";
export const INTERRUPTED_UNKNOWN = "UNKNOWN: connection changed after dispatch. The write may have applied. No replacement attempt or automatic retry.";

/** Plain Error on purpose: catalogue controllers classify untraced ProtocolError as NOT_SENT. */
export class ConnectivityInterrupted extends Error {
  constructor() { super(INTERRUPTED_UNKNOWN); this.name = "ConnectivityInterrupted"; }
}
export function assertConnected(store: ConnectivityStore = connectivity): void {
  if (store.getSnapshot().writesBlocked) throw new ProtocolError(OFFLINE_NOT_SENT, "CONNECTIVITY_BLOCKED");
}

/** Invoked at the boundary awaited by the controller, never around its outer handler. */
export async function guardedWrite<T>(send: () => Promise<T>, store: ConnectivityStore = connectivity, onInterrupted: () => void = () => {}): Promise<T> {
  assertConnected(store);
  const epoch = store.getSnapshot().epoch;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const off = store.subscribe(() => {
      if (!settled && (store.getSnapshot().epoch !== epoch || store.getSnapshot().writesBlocked)) {
        settled = true;
        off();
        onInterrupted();
        reject(new ConnectivityInterrupted());
      }
    });
    // Dispatch now, once. Reconnection holds no callback to run.
    let answer: Promise<T>;
    try { answer = send(); } catch (error) { settled = true; off(); reject(error); return; }
    answer.then((value) => { if (!settled) { settled = true; off(); resolve(value); } },
      (error: unknown) => { if (!settled) { settled = true; off(); reject(error); } });
  });
}

/** Bind methods to their original receiver, including methods on class prototypes. No network proxy. */
export function bindMethods<T extends object>(target: T): T {
  const result = Object.create(target) as T;
  let proto: object | null = target;
  const seen = new Set<string>();
  while (proto && proto !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (seen.has(key) || key === "constructor") continue;
      seen.add(key);
      const value: unknown = Reflect.get(target, key);
      if (typeof value === "function") Object.defineProperty(result, key, { value: value.bind(target), configurable: true });
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  return result;
}


export interface ReadGroup {
  label: string;
  path: string;
  stamp: ReadConnectivityStamp | null;
  interrupted: boolean;
  candidate?: ReadConnectivityStamp | null;
}
const groups = new Set<ReadGroup>();
export function registerReadGroup(label: string): ReadGroup {
  const group: ReadGroup = { label, path: typeof location === "undefined" ? "" : location.pathname, stamp: null, interrupted: false };
  for (const old of groups) if (old.label === label && old.path === group.path) groups.delete(old);
  groups.add(group);
  return group;
}
export function acceptRead(group: ReadGroup, stamp: ReadConnectivityStamp): void {
  group.stamp = stamp;
  connectivity.changed();
}
export function cachedGroups(path: string): ReadGroup[] {
  return [...groups].filter((group) => group.path === path && group.stamp !== null && !connectivity.accepts(group.stamp));
}

const groupOf = new WeakMap<object, ReadGroup>();
export function actionAllowed(port?: object): boolean {
  if (connectivity.getSnapshot().writesBlocked) return false;
  const group = port && groupOf.get(port);
  return !group || !connectivity.getSnapshot().disconnected || group.stamp === null || connectivity.accepts(group.stamp);
}

/** App-only synthetic port decoration. No changes to adapter types, bodies or selection. */
export function connectivityPort<T extends object>(port: T, label: string): T {
  const result = bindMethods(port);
  const group = registerReadGroup(label);
  groupOf.set(result, group);
  const methods = port as Record<string, unknown>;
  for (const key of ["read", "readPage"]) {
    if (typeof methods[key] !== "function") continue;
    const read = methods[key] as (...args: unknown[]) => Promise<unknown>;
    Object.defineProperty(result, key, { value: async (...args: unknown[]) => {
      const stamp = connectivity.stamp();
      group.candidate = null;
      const answer = await read.apply(port, args);
      const kind = answer && typeof answer === "object" && "kind" in answer ? answer.kind : null;
      if ((kind === "ready" || kind === "empty") && connectivity.accepts(stamp)) {
        group.candidate = stamp;
      } else if (group.stamp === null) {
        group.stamp = { epoch: -1, online: false };
        connectivity.changed();
      }
      // A pre-disconnection answer cannot be accepted as current by the controller either.
      if (!connectivity.accepts(stamp) && (kind === "ready" || kind === "empty")) throw new Error(CACHED_NOT_SENT);
      return answer;
    } });
  }
  for (const key of ["submit", "act", "run", "joinQueue"]) {
    if (typeof methods[key] !== "function") continue;
    const send = methods[key] as (...args: unknown[]) => Promise<unknown>;
    Object.defineProperty(result, key, { value: (...args: unknown[]) => {
      assertConnected();
      if (!actionAllowed(result)) return Promise.reject(new ProtocolError(group.interrupted ? INTERRUPTED_UNKNOWN : CACHED_NOT_SENT, "CONNECTIVITY_BLOCKED"));
      return guardedWrite(() => send.apply(port, args), connectivity, () => { group.interrupted = true; connectivity.changed(); });
    } });
  }
  return result;
}

/** Handler fence before allocating an intent, in addition to the dispatch fence. */
export function connectedActions<T extends object>(actions: T, writes: readonly NoInfer<keyof T>[], port?: object): T {
  const result = { ...actions };
  const fixtures = new Set(["newSession", "setScenario", "resetSource", "rotateCut", "deliverHeld", "deliverLate", "simulate", "synthetic", "markReturnRequired", "landReturn", "deliverReport", "abandon", "dropConnection", "restoreConnection", "offerUpdate", "expireSession", "advanceReview", "advancePolicy", "withdrawConsent", "expireDocument", "rivalRequest", "revokeGrant", "observeDraw", "receivePayment", "reverseAllocation", "markOverdue", "advanceSchedule", "advanceCut", "postSourceCorrection", "rotateGrant"]);
  for (const key of writes) {
    const run = actions[key] as (...args: unknown[]) => unknown;
    result[key] = ((...args: unknown[]) => { if (actionAllowed(fixtures.has(String(key)) ? undefined : port)) return run(...args); return undefined; }) as T[keyof T];
  }
  return result;
}

const readerBindings = new WeakMap<object, { port: object }>();
/** Promote a read only after the existing controller accepts it, including its context checks. */
export function connectivityController<T extends object>(controller: T, port: object): T {
  const existing = readerBindings.get(controller);
  if (existing) { existing.port = port; return controller; }
  const binding = { port };
  readerBindings.set(controller, binding);
  const methods = controller as Record<string, unknown>;
  for (const key of ["refresh", "read"]) {
    if (typeof methods[key] !== "function" || typeof methods.state !== "function") continue;
    const read = methods[key] as (...args: unknown[]) => Promise<unknown>;
    const state = methods.state as () => { freshness?: string; readState?: string };
    Object.defineProperty(controller, key, { configurable: true, value: async (...args: unknown[]) => {
      const result = await read.apply(controller, args);
      const group = groupOf.get(binding.port);
      const value = state.call(controller);
      const applied = result && typeof result === "object" && "kind" in result && result.kind === "APPLIED";
      if (group?.candidate && applied && value.freshness === "CURRENT" && (value.readState === "ready" || value.readState === "empty") && connectivity.accepts(group.candidate)) {
        acceptRead(group, group.candidate);
        group.candidate = null;
      }
      return result;
    } });
  }
  return controller;
}

/** Explicit read inventory: the independent interface-inventory test rejects an unguarded new write. */
export const PROTOCOL_READS = ["listPerformances", "getBooking", "listResale", "settlementPreview", "viewSettlement", "viewReservation", "viewReservationShow", "presentAdmission", "viewResaleCase", "viewResaleRight", "viewResalePresentation", "viewCredit"] as const;
const reads = new Set<string>(PROTOCOL_READS);
const wrapped = new WeakMap<CommerceProtocol, CommerceProtocol>();
function family(method: string): string {
  return /Settlement/.test(method) ? "settlement" : /Reservation/.test(method) ? "reservation"
    : /Admission/.test(method) ? "admission" : /Resale/.test(method) ? "resale" : /Credit/.test(method) ? "credit" : "booking";
}

export function connectivityProtocol(protocol: CommerceProtocol): CommerceProtocol {
  const existing = wrapped.get(protocol);
  if (existing) return existing;
  const result = bindMethods(protocol);
  const interrupted = new Set<string>();
  const groups = new Map<string, ReturnType<typeof registerReadGroup>>();
  // Epoch comparison invalidates prior reads without listeners or retained callbacks.
  const currentRead = new Map<string, number>();
  const initialEpoch = connectivity.getSnapshot().epoch;
  let proto: object | null = protocol;
  const seen = new Set<string>();
  while (proto && proto !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (seen.has(key)) continue;
      seen.add(key);
      if (key === "constructor" || key === "describe" || key === "observeTransport") continue;
      // The existing public desk method prefixes are inventoried by an independent test.
      if (!(key in protocol) || key.startsWith("_") || !/^(list|get|view|present|settlementPreview|place|release|confirm|check|open|accept|initiate|authorize|capture|commit|fail|cancel|reconcile|reject|advance|register|hold|observe|bind|issue|consume|adopt|close|offer|approve|draw|repay|default)/.test(key)) continue;
      const method: unknown = Reflect.get(protocol, key);
      if (typeof method !== "function") continue;
      const group = family(key);
      Object.defineProperty(result, key, { value: async (...args: unknown[]) => {
        if (reads.has(key)) {
          const stamp = connectivity.stamp();
          const answer: unknown = await method.apply(protocol, args);
          let reader = groups.get(group);
          if (!reader || reader.path !== (typeof location === "undefined" ? "" : location.pathname)) {
            reader = registerReadGroup(`protocol-${group}`);
            groups.set(group, reader);
          }
          const status = answer && typeof answer === "object" && "state" in answer ? answer.state : null;
          if (connectivity.accepts(stamp) && status !== "unavailable-server" && status !== "stale" && status !== "unavailable") {
            currentRead.set(group, stamp.epoch);
            acceptRead(reader, stamp);
          } else if (!reader.stamp) acceptRead(reader, { epoch: -1, online: false });
          return answer;
        }
        assertConnected();
        if (interrupted.has(group)) throw new Error(INTERRUPTED_UNKNOWN);
        if (connectivity.getSnapshot().epoch !== initialEpoch && currentRead.get(group) !== connectivity.getSnapshot().epoch) {
          throw new ProtocolError(CACHED_NOT_SENT, "CONNECTIVITY_BLOCKED");
        }
        return guardedWrite(() => method.apply(protocol, args) as Promise<unknown>, connectivity, () => { interrupted.add(group); });
      } });
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  wrapped.set(protocol, result);
  wrapped.set(result, result);
  return result;
}

export function connectivityInvoker(invoker: LocalCallInvoker): LocalCallInvoker {
  const result = bindMethods(invoker);
  for (const key of Object.getOwnPropertyNames(result)) {
    const method: unknown = Reflect.get(result, key);
    if (typeof method !== "function") continue;
    Object.defineProperty(result, key, { value: (...args: unknown[]) => guardedWrite(() => method(...args) as Promise<unknown>) });
  }
  return result;
}
export function connectedHandler(): boolean { return !connectivity.getSnapshot().writesBlocked; }
