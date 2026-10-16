import { useSessionRecoveryDesk } from "../session-recovery";
import { SessionRecoveryPanel } from "./SessionRecoveryPanels";

/** The session recovery desk at /session. Synthetic source; no fetch, no send beyond the in-process attach. */
export function SessionRecoveryPage() {
  const live = useSessionRecoveryDesk();
  return <SessionRecoveryPanel live={live} />;
}
