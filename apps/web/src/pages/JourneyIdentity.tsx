import { useJourneyIdentityDesk } from "../journey-identity";
import { JourneyIdentityPanel } from "./JourneyIdentityPanels";

/** The journey context desk at /identity. Synthetic source; no fetch, no send. */
export function JourneyIdentityPage() {
  const live = useJourneyIdentityDesk();
  return <JourneyIdentityPanel live={live} />;
}
