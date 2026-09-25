import { useSyncExternalStore } from "react";
import { TrackingStub, type TrackInput } from "./tracking.js";
import type { TrackRecord } from "./types.js";

const session = new TrackingStub();
let snapshot: TrackRecord[] = [];
const listeners = new Set<() => void>();

function publish() {
  snapshot = session.list();
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeTracking(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTrackingSnapshot(): TrackRecord[] {
  return snapshot;
}

export function track(input: TrackInput): void {
  session.record(input);
  publish();
}

export function clearTracking(): void {
  session.clear();
  publish();
}

export function useTracking(): TrackRecord[] {
  return useSyncExternalStore(subscribeTracking, getTrackingSnapshot, getTrackingSnapshot);
}
