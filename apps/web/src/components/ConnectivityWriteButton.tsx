import type { ButtonHTMLAttributes } from "react";
import { useConnectivity } from "../connectivity/ConnectivityProvider";
import { cachedGroups } from "../connectivity/write-guard";
import { useConnectivityCopy } from "../connectivity/copy";

/** Focusable when connectivity blocks it; existing native/domain disabled restrictions remain. */
export function ConnectivityWriteButton({ onClick, disabled, children, "aria-describedby": describedBy, "aria-disabled": domainDisabled, requiresFresh = true, inspection = false, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { requiresFresh?: boolean; inspection?: boolean }) {
  const state = useConnectivity();
  const copy = useConnectivityCopy();
  const stale = requiresFresh && state.disconnected && typeof location !== "undefined" && cachedGroups(location.pathname).length > 0;
  const blocked = !inspection && (state.writesBlocked || stale);
  return <button {...props} disabled={disabled} data-connectivity-write={inspection ? undefined : "true"}
    aria-disabled={blocked || domainDisabled || undefined}
    aria-describedby={[describedBy, blocked ? "connectivity-write-reason" : null].filter(Boolean).join(" ") || undefined}
    onClick={(event) => {
      if (blocked || domainDisabled === true || domainDisabled === "true") { event.preventDefault(); return; }
      onClick?.(event);
    }}>{children}{blocked ? <span className="connectivity-button-reason"> — {stale && !state.writesBlocked ? copy.refresh : copy.writeOff}</span> : null}</button>;
}
