export function notifyStoreListeners(listeners: ReadonlySet<() => void>): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Snapshot observers cannot determine a write's outcome or interrupt other observers.
    }
  }
}
