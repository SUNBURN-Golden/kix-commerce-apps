import { useReadState } from "../shell/read-state-params";
import { ReadView } from "./ReadState";
import { useSessionRecoveryDesk } from "../session-recovery";
import { SessionRecoveryPanel } from "./SessionRecoveryPanels";

/** The session recovery desk at /session. Synthetic source; no fetch, no send beyond the in-process attach. */
export function SessionRecoveryPage() {
  const live = useSessionRecoveryDesk();
  const read = useReadState("session", { item: live.model.items.length === 0 ? null : live.model.items.map((row) => row.itemId) });
  return <ReadView state={read}><SessionRecoveryPanel live={live} /></ReadView>;
}
