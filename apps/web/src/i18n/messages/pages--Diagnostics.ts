export const messages = {
  en: {
    "diag.yes": "yes", "diag.no": "no",
    "diag.title": "Diagnostics", "diag.boundary": "App-internal view and export for this page load. Not evidence, approval or production readiness. Nothing is sent. Retention remains UNDETERMINED.",
    "diag.build": "Build identity", "diag.version": "App version", "diag.digest": "Pin digest", "diag.pins": "Pinned digests",
    "diag.state": "Display and connection", "diag.mode": "Adapter mode", "diag.origin": "Origin class", "diag.locale": "Display locale",
    "diag.scheme": "Colour scheme", "diag.forced": "Forced colours", "diag.motion": "Reduced motion", "diag.connection": "Connectivity", "diag.epoch": "Connection epoch", "diag.blocked": "Writes blocked",
    "diag.journal": "Session journal", "diag.cause": "Cause", "diag.records": "Records used / maximum",
    "diag.outcomes": "Last page-load outcomes", "diag.limit": "At most {count} completions, in completion order across desks. Omitted: {omitted}.",
    "diag.empty": "No outcome on this page load.", "diag.trace": "Journey / operation / request / correlation", "diag.reason": "Redacted reason",
    "diag.export": "Redacted diagnostics JSON", "diag.copy": "Copy diagnostics", "diag.idle": "Copy stays available offline.", "diag.selected": "Text selected. Copy it from the field if clipboard access is unavailable.", "diag.copied": "Diagnostics copied.",
  },
  ko: {
    "diag.yes": "예", "diag.no": "아니요",
    "diag.title": "진단", "diag.boundary": "이 페이지 로드의 앱 내부 조회·내보내기입니다. 증거·승인·운영 준비 완료가 아닙니다. 아무것도 전송하지 않습니다. 보존 기간은 UNDETERMINED입니다.",
    "diag.build": "빌드 식별", "diag.version": "앱 버전", "diag.digest": "핀 다이제스트", "diag.pins": "고정 다이제스트",
    "diag.state": "표시 및 연결", "diag.mode": "어댑터 모드", "diag.origin": "출처 분류", "diag.locale": "표시 언어",
    "diag.scheme": "색 구성", "diag.forced": "강제 색상", "diag.motion": "동작 줄이기", "diag.connection": "연결 상태", "diag.epoch": "연결 세대", "diag.blocked": "쓰기 차단",
    "diag.journal": "세션 저널", "diag.cause": "원인", "diag.records": "사용 기록 / 최대",
    "diag.outcomes": "최근 페이지 로드 결과", "diag.limit": "데스크 전체 완료 순서로 최대 {count}개입니다. 생략: {omitted}.",
    "diag.empty": "이 페이지 로드의 결과가 없습니다.", "diag.trace": "여정 / 작업 / 요청 / 상관관계", "diag.reason": "가린 사유",
    "diag.export": "가린 진단 JSON", "diag.copy": "진단 복사", "diag.idle": "오프라인에서도 복사할 수 있습니다.", "diag.selected": "텍스트를 선택했습니다. 클립보드를 사용할 수 없으면 필드에서 복사하세요.", "diag.copied": "진단을 복사했습니다.",
  },
} as const;
