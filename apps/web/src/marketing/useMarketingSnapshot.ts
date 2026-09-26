import { useState } from "react";
import type { MarketingSnapshot } from "./desk";
import { marketingSession } from "./session";

export function useMarketingSnapshot(): {
  snapshot: MarketingSnapshot;
  refresh: () => void;
} {
  const [snapshot, setSnapshot] = useState(() => marketingSession.snapshot());
  return {
    snapshot,
    refresh() {
      setSnapshot(marketingSession.snapshot());
    },
  };
}
