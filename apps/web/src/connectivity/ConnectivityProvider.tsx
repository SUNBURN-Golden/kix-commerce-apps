import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { browserConnectivity, connectivity } from "./store";

export function useConnectivity() {
  return useSyncExternalStore(connectivity.subscribe, connectivity.getSnapshot, connectivity.getSnapshot);
}
export function ConnectivityProvider({ children }: { children: ReactNode }) {
  useEffect(() => browserConnectivity(connectivity, window), []);
  return <>{children}</>;
}
