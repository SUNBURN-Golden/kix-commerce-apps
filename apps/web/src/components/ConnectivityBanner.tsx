import { useConnectivity } from "../connectivity/ConnectivityProvider";
import { useLocale } from "../i18n/locale-context";

/** Synchronous and outside app failures; it needs no presentation chunk to report disconnection. */
export function ConnectivityBanner({ reasonId = "connectivity-write-reason", label }: { reasonId?: string; label?: string } = {}) {
  const state = useConnectivity();
  const { t } = useLocale();
  return <aside className="banner connectivity" aria-label={label ?? t("connectivity.label")}>
    <p role="status" aria-live="polite" data-connectivity-state={state.state}>
      {state.state}: {t("connectivity.readOnly")}
    </p>
    <p id={reasonId}>{t("connectivity.writeReason")} {t("connectivity.states")}</p>
  </aside>;
}
