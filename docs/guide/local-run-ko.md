# 로컬 실행과 문제 해결 (Local run and troubleshooting)

English summary: how to install, run and test the stub desk locally, which port it uses, how the CI jobs map to local commands, and what to do about CI failures, browser tests, port conflicts and UNKNOWN screens. Everything is loopback or in-process; nothing here reaches a public service.

## 처음 실행

1. `npm ci` — 의존성 설치(잠금 파일 기준).
2. `KIX_REQUIRE_GATE=0 npm test` — 라이브 게이트를 건너뛴 로컬 시험. 이 건너뜀은 라이브 게이트 통과가 아니다.
3. `npm run dev` — 개발 서버. 포트는 5173이다.

stub이 기본 환경이다. stub 모드에서 base URL을 넣어도 HTTP가 열리지 않는다. `integration-http`는 opt-in이며 `http://127.0.0.1` 루프백 게이트만 상대한다. 이 저장소는 게이트를 시작하지 않는다. 게이트는 별도 kix-protocol checkout에서 `python3 -m integration_gate --port 8765`로 시작한다(한 번의 시도, 재시도 없음, Idempotency-Key 없음, 리다이렉트 추적 없음, stub fallback 없음, 브라우저 CORS 닫힘).

## CI 작업과 로컬 명령 대응

| CI 작업 | 로컬 명령 |
| --- | --- |
| Typecheck, build, and test (stub) | `npm ci`, `npm run typecheck`, `npm run build`, `KIX_REQUIRE_GATE=0 npm test` |
| Adapter tests against the reviewed gate | 로컬에서 재현 불가. `KIX_PROTOCOL_READ_TOKEN`과 kix-protocol checkout이 필요하며, 건너뛰면 통과가 아니라 skipped로 표시된다 |
| Browser journeys (stub, headless Chrome) | `npm run typecheck:e2e`, `KIX_E2E_CHROME=<chrome 경로> KIX_E2E_NO_SANDBOX=1 npm run test:e2e` |
| Accessibility observation | 같은 Chrome 변수로 `npm run test:a11y` |
| Bundle budget | `npm run build`, `npm run budget`, `npm run test:budget` |
| Visual baselines (stub, headless Chrome) | 같은 Chrome 변수로 `npm run test:visual`. 기준선 갱신은 로컬에서만 `KIX_VISUAL_UPDATE=1`을 붙이고, 새 기준선은 눈으로 확인한 뒤 커밋한다 |

`KIX_E2E_NO_SANDBOX=1`은 Chrome 샌드박스를 띄울 수 없는 환경(컨테이너·CI 러너)에서만 쓴다. `KIX_E2E_CHROME`이 없으면 `/usr/bin/google-chrome` 등 기본 경로를 찾고, 브라우저가 없으면 건너뛰지 않고 그 실행을 멈춘다.

## 문제 해결

- **CI 실패**: 실패한 단계와 같은 명령을 로컬에서 그대로 실행한다. 라이브 게이트 작업만은 로컬 재현이 불가하므로 그 작업의 로그만 읽는다.
- **브라우저 시험 실패**: Chrome 경로를 `KIX_E2E_CHROME`으로 명시하고, 샌드박스 문제면 `KIX_E2E_NO_SANDBOX=1`을 붙인다. axe 위반은 `KNOWN_FINDINGS` 래칫과 비교한다 — 새 위반이면 수정하고, 기록된 OPEN이 사라졌으면 FIXED로 기록해야 한다.
- **포트 충돌(5173)**: 다른 개발 서버나 이전 실행이 점유 중인지 확인하고 끝낸다. 포트를 바꾸는 설정을 이 노드가 추가하지는 않는다.
- **UNKNOWN이 보일 때**: 결과를 모르는 상태이며 지워진 것이 아니다. 새로 고치기 전에 화면의 fence·영수증을 먼저 읽어 둔다. 새로 고침은 페이지가 메모리에 들고 있는 상태를 지우며 다시 보내지는 않는다. 한 번의 시도 규칙 때문에 자동 재시도는 없다.
- **게이트가 안 보일 때**: 배너가 `unavailable`이면 게이트가 루프백 주소에서 동작하는지 확인한다. 데스크는 integration HTTP에 머물며 stub으로 되돌아가지 않는다. `local`이면 stub 모드이며 게이트는 필요 없다.
- **세션 저장소**: 로케일 선택·세션 복구 저널 등은 이 탭의 sessionStorage에 있다. 탭을 닫거나 저장소를 지우면 사라지며, 보존 기간(TTL)은 UNDETERMINED — 이 문서도 값을 정하지 않는다. `SESSION_EVIDENCE_LOST`가 보이면 모든 쓰기가 보류된 것이며 새 intent를 시작한다.
- **화면을 불러오지 못할 때**: `SCREEN_LOAD_FAILED` 패널은 로드 장애이며 UNKNOWN 결과가 아니다. '이 화면 다시 불러오기'를 누르거나 새로 고친다.

## 읽기 전에 알아둘 것

- 이 데스크는 실제 결제·여신 지급·현장 검표·공개 서비스와 연결되지 않는다. 화면에 보이는 수치는 mock 단위다.
- 문서·화면에서 '검증됨'으로 보이지 않는 항목은 미검증이다. qualification·수용·release는 어느 화면에서도 주장되지 않는다.
