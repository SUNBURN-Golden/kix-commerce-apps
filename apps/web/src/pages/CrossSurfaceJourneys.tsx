import { useCrossSurfaceJourneys } from "../cross-surface-journeys";
import { CrossSurfacePanel } from "./CrossSurfaceJourneysPanels";

/** The cross-surface journeys screen at /journeys. Synthetic source, read-only, no fetch and no send. */
export function CrossSurfaceJourneysPage() {
  const live = useCrossSurfaceJourneys();
  return <CrossSurfacePanel live={live} />;
}
