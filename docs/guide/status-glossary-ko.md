# 상태 용어집 (Status word glossary)

이 문서는 stub 데스크 화면·인계 패킷·증거 문서에 나오는 상태 단어를 사용자와 운영자가 읽는 법을 정리한다. 단어 자체는 화면과 같은 철자(영어)를 유지하며 번역하지 않는다. `/help` 화면은 같은 목록의 영어 사본이며, 시험이 두 목록이 같은지 확인한다.

English summary: this glossary explains every status word a reader can meet on the stub screens, the handoff packet and the evidence documents — its meaning, what the reader may do, and the reading it never carries. The `/help` page shows the same list in English; a test holds the two equal. Nothing here is a qualification, an acceptance or a release.

| 단어 | 종류 | 뜻 | 사용자가 할 일 | 하면 안 되는 해석 |
| --- | --- | --- | --- | --- |
| `UNKNOWN` | 결과 단어 | 요청이 전송되었거나 전송되었을 수 있으나 결과를 읽지 못해 답을 알 수 없음 | fence나 영수증 화면을 먼저 읽고, 요청이 적용되었을 수 있다고 간주 | 실패도 성공도 아님. '일어나지 않았다'로 읽지 말 것 — 적용되었을 수 있음 |
| `NOT_BOUND` | 결과 단어 | 이 동작에 연결된 게시 명령이 없어 아무것도 만들어지지도 보내지지도 않음 | 기록된 사유를 읽기. 결과가 아니라 배선 사실 | 거절도 보류 결과도 아님. 재시도를 기다리는 것이 없음 |
| `STALE` | 결과 단어 | 화면의 값이 출처보다 오래되었으며 최신 값과 분리 표시됨 | 이력으로 취급하고 결정 전 새 값을 찾기 | 현재 값도 오류도 아님. 사라졌다는 증거가 아님 |
| `SUCCESS` | fixture 클래스 | 정상 응답으로 각본된 합성 fixture. 실제 결과가 아니라 미리 만든 증거 | 화면이 정상 응답을 다루는 모습의 시연으로 읽기 | 실제 결제·예매·통합 결과가 아님. 아무것도 사거나 예약한 것이 아님 |
| `REJECT` | fixture 클래스 | 응답으로 도착한 거절로 각본된 합성 fixture | 시연된 거절 경로로 읽기 | UNKNOWN이 아님. 거절은 답이고 UNKNOWN은 답의 부재 |
| `Loading` | 상태 표시 | 요청이 아직 불러오는 중. 확정된 것 없음 | 표시가 사라질 때까지 기다리기 | 어떤 요청 결과에 대한 약속이 아님 |
| `Blocked` | 상태 표시 | 이 동작은 차단됨 | 지정된 항목을 고치거나 다음 허용 단계를 읽기 | 결과 단어가 아님 |
| `Selected` | 상태 표시 | 이 행이 선택됨 | 선택은 예약도 결제도 아니라는 점을 유지 | 확정으로 읽지 말 것 |
| `In review` | 상태 표시 | 미리보기가 검토 중. 아무것도 보내지지 않음 | 내용을 확인한 뒤 다음 단계로 | 전송됨으로 읽지 말 것 |
| `checking` | 전송 배너 | 루프백 probe 결과가 아직 로드되지 않음 | 배너가 안정될 때까지 기다리기 | 장애도 준비 완료도 아님 |
| `unavailable` | 전송 배너 | 루프백 게이트가 응답하지 않음. 데스크는 integration HTTP에 머물며 stub으로 되돌아가지 않음 | 게이트가 루프백 주소에서 동작하는지 확인 후 새로 고침 | 프로덕션 준비도 아니고 stub 전환으로 읽지도 말 것 |
| `degraded` | 전송 배너 | 게이트가 응답했으나 부하 상태(NOT_READY, OVERLOADED 등)를 보고함 | 데스크는 integration HTTP에 머뭄. 배너의 코드를 읽기 | 장애도 stub fallback도 아님 |
| `up` | 전송 배너 | 루프백 probe가 응답함. 루프백 한정 | 로컬 읽기를 진행할 수 있음 | 프로덕션 준비·적합성·공개 서비스가 아님 |
| `local` | 전송 배너 | stub 모드. HTTP가 선택되지 않았고 probe도 동작하지 않음 | 확인할 것 없음. 합성 어댑터가 응답 | 오프라인 장애가 아님. stub은 기본값 |
| `published-bound` | 연결 단어 | 화면 동작이 게시 명령에 대응됨. stub 모드에서는 여전히 합성 응답 | 로컬 명령 한정, 최대 Node 루프백 | 통합 완료도 라이브도 아님 |
| `not-bound` | 연결 단어 | 데스크 메서드가 의도적으로 명령에 연결되지 않음. 고려된 action은 전송하지 않고 기록 | 기록된 사유를 읽기 | 빠진 기능도 결과도 아님 |
| `stub-only` | 연결 단어 | 합성 어댑터만이 이 화면에 응답 | 화면을 시연으로 읽기 | 어떤 producer나 게이트와도 연결되지 않음 |
| `no-published-command` | 연결 단어 | contract-only 카탈로그가 이 화면용 명령을 게시하지 않음 | 보낼 것이 없으므로 카탈로그 메모를 읽기 | 결함이 아님. 연결할 대상이 없음 |
| `planned` | 연결 단어 | 적어 두었으나 연결되지 않은 binding에 쓰이는 예약 단어 | 이 빌드에서는 registry 단어 자체 외에 할 일 없음 | 동작하는 경로가 아님 |
| `local-command` | 기능 상태 | stub 또는 루프백 게이트에 로컬 명령을 보낼 수 있는 화면 | stub을 기본으로 로컬에서 사용 | 라이브 통합이 아님 |
| `synthetic` | 기능 상태 | 화면이 통합된(canned) 또는 로컬 유도 행을 표시. 보내기가 아니라 읽기 시연 | 시연으로 읽기 | producer 데이터가 아님 |
| `unsupported` | 기능 상태 | 화면은 있으나 해당 단계의 명령도 합성 경로도 없음 | 시도할 것 없음 | 이 빌드에서 진행 예정이 아님 |
| `MERGED_RECORDED` | 증거 facet | 노드 표에 병합이 기록됨 | 인용된 PR을 읽기 | 완료 판단이 아님. 중앙 DONE은 NOT_EVALUATED |
| `REPO_PRESENT` | 증거 facet | 코드가 이 저장소에 존재 | 화면을 열 수 있음 | 자격 검증·수용·릴리스가 아님 |
| `NOT_PRESENT` | 증거 facet | 지명된 것이 이 저장소에 없음 | 열 것이 없음 | 삭제된 것이 아니라 처음부터 없음 |
| `WAITING` | 증거 facet | pending 노드가 기다리는 외부 전제 조건을 지명함 | Waits-on 열을 읽기 | 시작됨도 집계됨도 아님 |
| `NOT_STARTED` | 증거 facet | 카탈로그에는 있으나 병합된 작업 기록이 없음 | 아직 읽을 것 없음 | 진행 중이 아님 |
| `NOT_EVALUATED` | 증거 facet | 이 저장소는 중앙 done 플래그를 평가하지 않음 | 각 facet을 따로 읽기 | 통과도 아님 |
| `UNQUALIFIED` | 증거 facet | 자격 검증 실행이 존재하지 않거나 주장되지 않음 | 상시 상태로 읽기 | 실행 자체가 없었음 |
| `NOT_REQUIRED` | 증거 facet | 이 facet이 그 행에 적용되지 않음(예: 페이지 없는 행의 수용) | 건너뛰기 | 면제가 아니라 원래 해당 없음 |
| `PENDING` | 증거 facet | 사용자 소유의 결정이 아직 내려지지 않음 | 지명된 결정자를 기다리기 | 수용도 거절도 아님 |
| `NOT_AUTHORIZED` | 증거 facet | 릴리스 권한이 없으므로 아무것도 릴리스되지 않음 | 릴리스는 별도 권한이 필요 | 거부된 것이 아니라 처음부터 열리지 않음 |
| `RECORDED` | 증거 facet | 커버리지 증거가 존재하고 인용됨 | 포인터를 따라가기 | 라이브 시스템의 통과가 아님 |
| `NOT_REACHABLE` | 증거 facet | 이 빌드의 출처로는 그 분기를 만들 수 없음 | 분기 메모를 읽기 | 도달 불가는 사실이지 판정이 아님 |
| `NOT_APPLICABLE` | 증거 facet | 이 검사가 여기에 적용되지 않음 | 건너뛰기 | 편의상 생략한 것이 아님 |
| `UNVERIFIED` | 증거 facet | 이 셀을 덮는 fixture나 실행이 아직 없음 | 미결 작업으로 취급 | 검증됨도 아님 |
| `RECEIPT` | 여정 leg/보상 | leg가 도착해 영수증이 기록됨 | 영수증을 읽기 | 정산도 결제도 아님 |
| `REJECTED` | 여정 leg/보상 | leg가 거절 응답을 받음 | 거절 코드를 읽기 | UNKNOWN이 아님. 답이 있음 |
| `NOT_SENT` | 여정 leg/보상 | leg가 보내진 적 없음(not-bound, gate-open 또는 관찰 전용) | 기록된 사유를 읽기 | 유실이 아님. 애초에 나가지 않음 |
| `FENCED` | 여정 leg/보상 | 요청이 적용되었을 수 있고 이후 쓰기가 보류됨 | 새 동작 전에 fence를 읽고 멈추기 | 취소도 확정도 아님 |
| `NONE_NEEDED` | 여정 leg/보상 | 보상 셀: 적용된 것이 없어 되돌릴 것도 없음 | 할 일 없음 | 완료된 보상이 아님 |
| `COMPENSATION_UNDEFINED` | 여정 leg/보상 | 한 leg는 도착하고 이후 leg는 도착하지 않았으며 정해진 보상 경로가 없음 | 임의로 보상하지 말고 에스컬레이션 | 환불도 자동도 아님 |
| `GATE_UNAVAILABLE` | 코드 | 루프백 게이트에 도달하지 못함 | 게이트를 확인 후 새로 고침 | stub fallback이 아님 |
| `STALE_RESPONSE` | 코드 | 게이트의 응답이 요청이 기대한 것보다 오래됨 | 값을 STALE로 취급 | 새 답이 아님 |
| `REQUEST_TIMEOUT` | 코드 | 한 번의 시도가 시간 안에 끝나지 않음 | fence나 영수증이 달리 말할 때까지 결과는 UNKNOWN | 재시도 없음 |
| `GATE_TRANSPORT` | 코드 | 데스크와 루프백 게이트 사이 전송이 끊김 | 배너와 게이트 로그를 읽기 | 업무 거절이 아님 |
| `GATE_STATUS` | 코드 | 게이트가 데스크가 차단으로 취급하는 상태를 응답 | 옆의 코드를 읽기 | 결과 단어가 아님 |
| `GATE_REJECTED` | 코드 | 게이트가 요청을 거절 | 거절 사유를 읽기 | UNKNOWN이 아님 |
| `SCREEN_LOAD_FAILED` | 코드 | 화면 코드를 불러오거나 시작하지 못함. 결과가 아니라 로드 장애 | '이 화면 다시 불러오기' 또는 새로 고침 | UNKNOWN이 아님. 아무것도 보내지지 않음 |
| `SESSION_EVIDENCE_LOST` | 코드 | 세션 저널이 손상·미지원·유실되어 모든 쓰기가 보류됨 | 새 intent를 시작. 다시 보내는 것 없음 | 요청의 결과가 아님 |
| `ADMISSION_REQUIRED` | 코드 | 입장 경로에 credential 단계가 먼저 필요 | 지명된 단계를 따르기 | 거절이 아님 |
| `STALE_ISSUE` | 코드 | 읽는 issue가 현재 출처보다 오래됨 | 더 새 기록을 찾기 | 현재 사실이 아님 |
| `GRANT_REVOKED` | 코드 | 이전에 기록된 grant가 더 이상 유효하지 않음 | 권한 상태를 다시 읽기 | 새로운 거부가 아님 |
| `UNDETERMINED` | 정책/출처 | 이 저장소가 의도적으로 정하지 않는 값(보존 기간, 목표 표준 등) | 미결로 취급. 지명된 결정자 소유 | 0도 무한도 결정도 아님 |
| `PENDING_USER_DECISION` | 정책/출처 | 릴리스 패킷이 사용자만이 내릴 수 있는 결정을 기다림 | 사용자 판정 전까지 진행 없음 | 예정됨도 아님 |
| `STUB_RUN_RECORDED` | 정책/출처 | stub 실행이 증거로 기록됨 | 기록을 읽기 | 실환경 실행이 아님 |
| `STUB_CANDIDATE_RECORDED` | 정책/출처 | 릴리스 후보가 stub 범위에서 기록됨 | 기록을 읽기 | 릴리스가 아님 |
| `MOCK_SETTLEMENT_ONLY` | 정책/출처 | 이 화면의 정산 수치는 모의 단위뿐 | 시연으로 읽기 | 실제 돈도 정산 수학도 아님 |
| `MOCK_GATE_ONLY` | 정책/출처 | 보이는 흐름은 모의 게이트에서만 존재 | 시연으로 읽기 | 라이브 게이트 경로가 아님 |
| `MOCK_CREDIT_F04_ONLY` | 정책/출처 | 크레딧 행은 모의 데이터뿐 | 시연으로 읽기 | 여신 지급이 아님 |
| `stub` | 환경 | 기본 환경. 합성 어댑터가 응답하고 아무것도 기계 밖으로 나가지 않음 | 기본값. 켤 것 없음 | fallback 모드도 오프라인도 아님 |
| `integration-http` | 환경 | 루프백 게이트와만 통신하는 opt-in 환경 | 먼저 별도 checkout에서 게이트를 시작 | 프로덕션도 공개 엔드포인트도 아님 |
