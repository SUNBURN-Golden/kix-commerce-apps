import { useReadState } from "../shell/read-state-params";
import { readSettled, ReadView } from "./ReadState";
import { useJourneyIdentityDesk } from "../journey-identity";
import { JourneyIdentityPanel } from "./JourneyIdentityPanels";

/** The journey context desk at /identity. Synthetic source; no fetch, no send. */
export function JourneyIdentityPage() {
  const live = useJourneyIdentityDesk();
  const read = useReadState("identity", { item: !readSettled(live.model.state) ? null : live.model.items.map((row) => row.itemId) });
  return <ReadView state={read}><JourneyIdentityPanel live={live} /></ReadView>;
}
