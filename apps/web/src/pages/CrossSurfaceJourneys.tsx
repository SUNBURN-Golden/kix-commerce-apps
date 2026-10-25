import { useReadState } from "../shell/read-state-params";
import { readSettled, ReadView } from "./ReadState";
import { useCrossSurfaceJourneys } from "../cross-surface-journeys";
import { CrossSurfacePanel } from "./CrossSurfaceJourneysPanels";

/** The cross-surface journeys screen at /journeys. Synthetic source, read-only, no fetch and no send. */
export function CrossSurfaceJourneysPage() {
  const live = useCrossSurfaceJourneys();
  const read = useReadState("journeys", { row: !readSettled(live.model.state) ? null : live.model.rows.map((row) => row.id) });
  return <ReadView state={read}><CrossSurfacePanel live={live} /></ReadView>;
}
