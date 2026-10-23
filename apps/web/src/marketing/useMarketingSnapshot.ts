import { connectivity } from "../connectivity/store";
import { acceptRead, registerReadGroup } from "../connectivity/write-guard";
import { useRef, useState } from "react";
import type { MarketingSnapshot } from "./desk";
import { marketingSession } from "./session";

export function useMarketingSnapshot(): {
  snapshot: MarketingSnapshot;
  refresh: () => void;
} {
  const group = useRef<ReturnType<typeof registerReadGroup> | null>(null);
  if (group.current === null) { group.current = registerReadGroup("marketing-session"); group.current.stamp = connectivity.stamp(); }
  const [snapshot, setSnapshot] = useState(() => marketingSession.snapshot());
  return {
    snapshot,
    refresh() {
      setSnapshot(marketingSession.snapshot());
      if (group.current) acceptRead(group.current, connectivity.stamp());
    },
  };
}
