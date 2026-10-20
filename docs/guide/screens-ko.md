# 화면별 읽는 법 (How to read each screen)

route registry의 모든 라우트를 한 항목씩 정리한다. 각 항목은 "이 화면에서 결론 내릴 수 있는 것", "결론 내릴 수 없는 것", "화면에 나오는 상태 단어"를 적는다. 상태 단어의 뜻은 [status-glossary-ko.md](status-glossary-ko.md)를 본다.

English summary: one entry per route-registry route — what this screen lets you conclude, what it never concludes, and which status words it shows. Word meanings are in the glossary. Every screen is stub-scope: no real payment, no live integration, and reading a screen never concludes qualification, acceptance or release.

## `/`

박스오피스 카탈로그. 합성 공연 행을 읽을 수 있다. 어떤 구매도 예약도 일어나지 않는다. 나오는 단어: `stub-only`, fixture 클래스(`SUCCESS`, `REJECT`).

## `/buyer`

구매자 작업공간. stub 데이터로 구매자가 보는 항목을 읽을 수 있다. 실제 주문·결제 흐름을 결론 내릴 수 없다. 나오는 단어: `stub-only`.

## `/discovery`

공연 찾기. 필터된 목록과 빈 결과·필터 충돌 안내를 읽을 수 있다. 검색 결과가 실제 재고라고 읽지 않는다. 나오는 단어: `stub-only`, `Blocked`.

## `/inventory`

좌석과 입석 선택. 행 선택과 섹션 페이지 탐색을 볼 수 있다. 선택은 예약이 아니다. 나오는 단어: `Selected`, `stub-only`.

## `/booking/:eventId`

예매 여정(published-bound). stub이 각본대로 응답한다. UNKNOWN fence가 보이면 결과를 알 수 없는 것이며 재시도가 없다. 결제·확정을 결론 내릴 수 없다. 나오는 단어: `published-bound`, `UNKNOWN`, `NOT_BOUND`, `STALE`, `FENCED`, `Loading`, `Blocked`, `In review`.

## `/admission`

입장 credential. 합성 credential 발급·검사 흐름을 읽는다. 실제 현장 검표가 아니다. 나오는 단어: `stub-only`, `ADMISSION_REQUIRED`, `GRANT_REVOKED`.

## `/resale`

재판매 데스크. 모의 게이트 흐름(`MOCK_GATE_ONLY`)을 읽는다. 실제 마켓플레이스 체결이 아니다. 나오는 단어: `stub-only`, `MOCK_GATE_ONLY`.

## `/gift`

선물 이전(published-bound). 빈 본문 거절 등 stub 흐름을 본다. 실제 티켓 이전이 아니다. 나오는 단어: `published-bound`, `REJECT`, `UNKNOWN`.

## `/mobile`

모바일 셸. 설치형 셸의 stub 동작을 본다. 실제 배포·설치를 주장하지 않는다. 나오는 단어: `stub-only`.

## `/assistant`

위임 어시스턴트. 합성 위임 흐름을 읽는다. 실제 자동 구매 권한이 아니다. 나오는 단어: `stub-only`.

## `/organizer`

주최자 콘솔(published-bound). stub 판매·이벤트 행을 읽는다. 실제 정산·매출이 아니다. 나오는 단어: `published-bound`.

## `/organizer/workspace`

주최자 작업공간(published-bound). 이벤트 id 입력과 빈 입력 안내를 본다. 실제 운영 데이터가 아니다. 나오는 단어: `published-bound`, `Blocked`.

## `/merchant`

판매자 작업실. 소스 cut별 합성 판매·정산 행을 읽는다. 판매 수치는 관찰이지 정산 자금이 아니다. 나오는 단어: `stub-only`.

## `/finance`

재무 운영. 합성 재무 행을 읽는다. 자금 이동을 결론 내릴 수 없다. 나오는 단어: `stub-only`.

## `/provider`

제공자 연결 여정. stub 여정 행을 읽는다. 실제 제공자 연결이 아니다. 나오는 단어: `stub-only`, `RECEIPT`, `NOT_SENT`, `FENCED`.

## `/credit`

크레딧 데스크. 모의 데이터(`MOCK_CREDIT_F04_ONLY`)를 읽는다. 여신 지급이 아니다. 나오는 단어: `stub-only`, `MOCK_CREDIT_F04_ONLY`.

## `/credit/origination`

크레딧 개설. 합성 개설 흐름을 읽는다. 실제 심사·개설이 아니다. 나오는 단어: `stub-only`.

## `/credit/servicing`

크레딧 관리. 합성 관리 흐름을 읽는다. 실제 상환·연체 처리가 아니다. 나오는 단어: `stub-only`.

## `/marketing`

마케팅 허브. M01–M05 스텁으로 가는 허브. 게시 명령이 없는 표면이다. 나오는 단어: `no-published-command`.

## `/marketing/journey`

혜택 여정. 합성 혜택 여정을 읽는다. 실제 혜택 지급이 아니다. 나오는 단어: `stub-only`.

## `/marketing/m01`

마케팅 M01 스텁. 설계중 표시의 브라우저 세션 데모. 게시 명령 없음. 나오는 단어: `no-published-command`.

## `/marketing/m02`

마케팅 M02 스텁. M01과 같다. 나오는 단어: `no-published-command`.

## `/marketing/m03`

마케팅 M03 스텁. M01과 같다. 나오는 단어: `no-published-command`.

## `/marketing/m04`

마케팅 M04 스텁. M01과 같다. 나오는 단어: `no-published-command`.

## `/marketing/m05`

마케팅 M05(published-bound, ConsentBind 경유). stub이 동의 흐름을 응답한다. 실제 동의 수집 서비스가 아니다. 나오는 단어: `published-bound`.

## `/platform`

거래 플랫폼 여정. 합성 거래 여정을 읽는다. capture·settle_capture는 어디에도 합성되지 않는다. 나오는 단어: `stub-only`, `RECEIPT`, `REJECTED`, `NOT_SENT`, `FENCED`, `NONE_NEEDED`, `COMPENSATION_UNDEFINED`.

## `/marketplace-performance`

마켓플레이스 측정 벤치. 합성 지표를 읽는다. SLO가 아니다. 나오는 단어: `stub-only`.

## `/permissions`

권한. 합성 권한 표를 읽는다. 실제 권한 부여·회수가 아니다. 나오는 단어: `stub-only`, `GRANT_REVOKED`.

## `/notifications`

알림. 합성 알림함을 읽는다. 실제 발송이 아니다. 나오는 단어: `stub-only`.

## `/identity`

여정 맥락. 여정 identity의 합성 표시를 읽는다. 실제 KYC·본인확인이 아니다. 나오는 단어: `stub-only`.

## `/session`

세션 복구. 탭 세션 저장소의 intent·fence 저널을 읽는다. 저널 손상 시 `SESSION_EVIDENCE_LOST`로 모든 쓰기가 보류된다. 보존 기간은 UNDETERMINED이다. 나오는 단어: `stub-only`, `SESSION_EVIDENCE_LOST`, `UNKNOWN`, `FENCED`, `UNDETERMINED`.

## `/receipts`

영수증 탐색기. 페이지 로드 시 기록된 영수증·타임라인·지원용 내보내기(마스킹됨)를 읽는다. 쓰기는 없다. 나오는 단어: `stub-only`, `RECEIPT`, `STALE`.

## `/handoff`

로컬 인계 패킷. pin·지원 명령·pending producer·역할 여정을 읽는다. 통합 미완료를 그대로 표시한다. 나오는 단어: `stub-only`, `local-command`, `synthetic`, `unsupported`, `UNQUALIFIED`, `NOT_AUTHORIZED`.

## `/journeys`

여정 표. cross-surface 여정의 합성 셀을 읽는다. 보상 셀은 자동 명령이 아니다. 나오는 단어: `stub-only`, `RECEIPT`, `REJECTED`, `NOT_SENT`, `FENCED`, `NONE_NEEDED`, `COMPENSATION_UNDEFINED`.

## `/qualification`

자격 검증. UNQUALIFIED 상태 그대로를 읽는다. 어떤 qualification도 주장하지 않는다. 나오는 단어: `stub-only`, `UNQUALIFIED`, `PENDING`.

## `/release`

릴리스. 사용자 결정 대기 패킷을 읽는다. 아무것도 릴리스·배포·운영하지 않는다. 나오는 단어: `stub-only`, `PENDING_USER_DECISION`, `NOT_AUTHORIZED`, `UNDETERMINED`, `STUB_RUN_RECORDED`, `STUB_CANDIDATE_RECORDED`.

## `/help`

도움말. 상태 단어 용어집(이 문서 묶음의 영어 사본)을 읽는다. 읽는 행위는 아무것도 보내지 않고 기록하지 않는다. 나오는 단어: 용어집 전체.
