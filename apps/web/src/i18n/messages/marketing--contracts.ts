export const messages = {
  en: {
    "p.t252": " The display read is {v1}. That name is not a catalogue command.",
    "p.t253": "Published contract: none. Recorded state: no published command. Pending contract: {v1}.{v2}",
    "p.t254": "Published contract: {v1}. Recorded state: published-bound. Stub fields {v2} are not the set_consent body. Missing field names: {v3}.",
  },
  ko: {
    "p.t252": " 표시용 조회는 {v1}입니다. 명령 목록의 명령이 아닙니다.",
    "p.t253": "공개 계약 없음. 기록 상태: 공개 명령 없음. 대기 계약: {v1}.{v2}",
    "p.t254": "공개 계약 {v1}. 기록 상태 published-bound. stub 필드 {v2}은(는) set_consent 본문이 아닙니다. 누락 필드: {v3}.",
  },
} as const;
