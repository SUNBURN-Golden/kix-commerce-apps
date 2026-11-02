import { onNavigation } from "./shell/navigation-observers";
import { useEffect, useSyncExternalStore } from "react";
import { resaleMarketPortFor, type ResaleMarketRead } from "../../../packages/protocol-adapter/src/resale-market";
import { ResaleMarketController } from "../../../packages/protocol-adapter/src/resale-market-controller";
import { protocol } from "./connectivity/desk-protocol";
import { connectedActions, connectivityController, connectivityPort } from "./connectivity/write-guard";
// One source/controller per page load, shared by both lazy routes. No storage or replay.
const port = connectivityPort(resaleMarketPortFor(protocol.describe().environment), "resale-market");
export const marketController = connectivityController(new ResaleMarketController(port, () => typeof location === "undefined" ? "" : location.pathname), port);
// Lazy route transitions can retain the previous screen until its replacement loads. Fence at departure.
onNavigation(() => marketController.invalidate());
const actions = { submit: (input: Parameters<ResaleMarketController["submit"]>[0]) => marketController.submit(input) };
export const marketActions = connectedActions(actions, ["submit"], port);
export function useResaleMarket(input: ResaleMarketRead) {
  const state = useSyncExternalStore(marketController.subscribe, marketController.state, marketController.state);
  const key = JSON.stringify(input);
  useEffect(() => {
    void marketController.read(JSON.parse(key) as ResaleMarketRead);
    return () => marketController.invalidate();
  }, [key]);
  return { state, controller: marketController, actions: marketActions };
}
