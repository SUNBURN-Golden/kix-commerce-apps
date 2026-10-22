import { useConnectivity } from "../connectivity/ConnectivityProvider";
import { useLocale } from "../i18n/locale-context";

/** Synchronous and outside app failures; it needs no presentation chunk to report disconnection. */
export function ConnectivityBanner({ reasonId = "connectivity-write-reason", label }: { reasonId?: string; label?: string } = {}) {
  const state = useConnectivity();
  const { locale } = useLocale();
  return <aside className="banner connectivity" aria-label={label ?? (locale === "ko" ? "연결 상태" : "Connectivity")}>
    <p role="status" aria-live="polite" data-connectivity-state={state.state}>
      {state.state}: {locale === "ko" ? "연결 불가 시 읽기 전용" : "Read-only when disconnected"}
    </p>
    <p id={reasonId}>{locale === "ko" ? "연결 또는 새 읽기 없이는 쓰기 차단. 전송·큐·재실행 없음." : "Writes need connectivity and fresh reads. Nothing sent, queued or replayed."} UNKNOWN / NOT_BOUND / STALE · cached</p>
  </aside>;
}
