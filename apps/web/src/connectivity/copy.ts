import { useLocale } from "../i18n/locale-context";
const en = {
  readAgain: "Read local session again",
  cached: "STALE · cached history. Only an explicitly accepted read refreshes its own group. Unavailable is not empty; UNKNOWN and NOT_BOUND stay separate.",
  readers: "Read again for these cached groups:",
  refresh: "STALE · read again before writing",
  writeOff: "Connection unavailable; nothing sent",
};
const ko: Record<keyof typeof en, string> = {
  readAgain: "로컬 세션 다시 읽기",
  cached: "STALE · cached 이력. 명시적으로 받아들인 읽기만 해당 그룹을 갱신합니다. 사용 불가와 빈 값, UNKNOWN과 NOT_BOUND는 구별됩니다.",
  readers: "다시 읽을 캐시 그룹:",
  refresh: "STALE · 쓰기 전에 다시 읽으세요",
  writeOff: "연결 불가; 전송하지 않음",
};
export function useConnectivityCopy() { return useLocale().locale === "ko" ? ko : en; }
