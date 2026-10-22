import { preferFresh, type HeldObservation } from "../transport-status";

export interface ConnectivitySnapshot {
  browserOnline: boolean | null;
  environment: "stub" | "integration-http";
  epoch: number;
  revision: number;
  transport: HeldObservation | null;
  state: "local" | "checking" | "online" | "offline" | "degraded" | "unavailable";
  writesBlocked: boolean;
  disconnected: boolean;
}

/** Probe ordering and the browser connection epoch are deliberately independent. */
export interface ConnectivityObservation {
  epoch: number;
  held: HeldObservation;
}
export interface ReadConnectivityStamp { epoch: number; online: boolean }

export function createConnectivityStore(environment: ConnectivitySnapshot["environment"] = "stub", browserOnline: boolean | null = null) {
  const listeners = new Set<() => void>();
  let snapshot: ConnectivitySnapshot = {
    browserOnline, environment, epoch: 0, revision: 0, transport: null,
    state: "checking", writesBlocked: true, disconnected: browserOnline === false,
  };
  function derive() {
    const state = snapshot.browserOnline === false ? "offline"
      : snapshot.browserOnline === null ? "checking"
      : snapshot.environment === "stub" ? "local"
      : !snapshot.transport ? "checking"
      : snapshot.transport.observation.state === "up" ? "online"
      : snapshot.transport.observation.state === "degraded" ? "degraded" : "unavailable";
    snapshot = { ...snapshot, state, writesBlocked: state !== "local" && state !== "online" };
  }
  derive();
  function publish() {
    snapshot = { ...snapshot, revision: snapshot.revision + 1 };
    derive();
    listeners.forEach((listener) => listener());
  }
  const getSnapshot = () => snapshot;
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
  return {
    getSnapshot, subscribe,
    configure(next: ConnectivitySnapshot["environment"]) {
      if (snapshot.environment !== next) { snapshot = { ...snapshot, environment: next, transport: null }; publish(); }
    },
    setBrowserOnline(online: boolean | null) {
      if (online === snapshot.browserOnline) return;
      snapshot = { ...snapshot, browserOnline: online, epoch: snapshot.epoch + 1, transport: null,
        disconnected: snapshot.disconnected || online !== true };
      publish();
    },
    observeTransport({ epoch, held }: ConnectivityObservation): boolean {
      if (epoch !== snapshot.epoch || snapshot.browserOnline !== true) return false;
      const wasBlocked = snapshot.writesBlocked;
      snapshot = { ...snapshot, transport: preferFresh(snapshot.transport, held) };
      derive();
      // Losing transport availability invalidates read evidence too, even without a browser event.
      if (!wasBlocked && snapshot.writesBlocked) {
        snapshot = { ...snapshot, epoch: snapshot.epoch + 1, disconnected: true };
      }
      publish();
      return true;
    },
    stamp(): ReadConnectivityStamp { return { epoch: snapshot.epoch, online: !snapshot.writesBlocked }; },
    accepts(stamp: ReadConnectivityStamp) { return stamp.online && stamp.epoch === snapshot.epoch && !snapshot.writesBlocked; },
    changed: publish,
  };
}
export type ConnectivityStore = ReturnType<typeof createConnectivityStore>;
// Browser-less rendering/tests have a known local environment; mounted browsers read navigator synchronously.
export const connectivity = createConnectivityStore("stub", typeof window === "undefined" ? true : typeof navigator.onLine === "boolean" ? navigator.onLine : null);

export function browserConnectivity(store: ConnectivityStore, browser: Pick<Window, "addEventListener" | "removeEventListener" | "navigator">): () => void {
  const update = () => store.setBrowserOnline(typeof browser.navigator.onLine === "boolean" ? browser.navigator.onLine : null);
  update();
  browser.addEventListener("online", update);
  browser.addEventListener("offline", update);
  return () => { browser.removeEventListener("online", update); browser.removeEventListener("offline", update); };
}
