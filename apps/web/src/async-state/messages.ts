import type { AsyncStateKind } from "./kinds";
import type { Locale } from "../i18n/locales";

/** Screen-only copy, loaded with AsyncState; shell progress copy stays in the main catalogue. */
export const STATE_MESSAGES: Record<Locale, Record<Exclude<AsyncStateKind, "loading">, { word: string; note: string }>> = {
  en: {
    "empty": { word: "Empty", note: "No item in this view." },
    "error": { word: "Error", note: "This view encountered an error. Read the details and the next action; an earlier business outcome is unchanged." },
    "unknown": { word: "UNKNOWN", note: "Unconfirmed; it may have applied. No authoritative receipt establishes the outcome. Keep the fence and inspect the record before any next write." },
    "stale": { word: "STALE", note: "Treat this read as history. Reading again does not resolve an UNKNOWN outcome." },
    "not-bound": { word: "NOT_BOUND", note: "No command is bound here. The recorded reason is not a request." },
  },
  ko: {
    "empty": { word: "빈 값", note: "이 보기에 항목이 없습니다." },
    "error": { word: "오류", note: "이 보기에 오류가 발생했습니다. 상세 내용과 다음 행동을 확인하세요. 앞선 업무 결과는 바뀌지 않습니다." },
    "unknown": { word: "UNKNOWN", note: "결과 미확인입니다. 적용되었을 수도 있습니다. 차단을 유지하고 다음 쓰기 전에 기록을 확인하세요." },
    "stale": { word: "STALE", note: "이 읽기를 과거 기록으로 취급하세요. 다시 읽어도 UNKNOWN 결과가 확정되지 않습니다." },
    "not-bound": { word: "NOT_BOUND", note: "연결된 명령이 없습니다. 기록된 사유는 요청이 아닙니다." },
  },
};

export const STATE_ACTION_MESSAGES: Record<Locale, { help: string; fence: string }> = {
  en: { help: "Help with this state", fence: "Inspect the fence and receipts" },
  ko: { help: "상태 도움말", fence: "차단과 영수증 기록 확인" },
};
