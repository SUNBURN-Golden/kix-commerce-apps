# KIX Commerce 통합 여정·계약 소비·최종 완료 설계 후보

공통 후속 규약: [중앙 #46](https://github.com/BeautifulMind-JT/ai-ops-control-plane/pull/46), 후보 HEAD `a8b7355712c58de8d27c85a535fb241a09a4037c`. [고정 설계](https://github.com/BeautifulMind-JT/ai-ops-control-plane/blob/a8b7355712c58de8d27c85a535fb241a09a4037c/engineering/docs/PROGRAM_EXECUTION_EVOLUTION_DESIGN_KO.md)는 아직 운영·승인 evidence가 아니다.

상태: **설계·계획 개정 후보. 실제 앱 구현·서비스 qualification·출시가 아니다.**
기준은 commerce #15 `a7c9d4467a9170ba4a062554562a4610c0b27573`와 protocol
#82 `1fc02920d93fe0fb1f272fa917f6e20ba26cc987`다. 원본 감사 대상 #14
`e80c5d53989af35987aa0b8371b4220acd4e3808`와 protocol #81
`eee77d135f03471b78ce673223dafc7e0b0fb36b`는 그대로다.
사용자의 2026-09-30 고도화 지시에 따라 작성했으며, 기존 사용자 채택/정확한 HEAD의
독립 검토/중앙 설치·attestation을 대신하지 않는다. PENDING을 유지한다.

## 1. 권위와 실행 경계

README의 fail-closed 규칙, [실행 위임 후보](PROGRAM_ASTRA_DELEGATION.md),
protocol 로드맵 R-1과 계약을 이어받는다. 계산·정산·권리 진실의 정본은 protocol이며
앱은 그 의미를 복사하거나 desk body를 다른 명령으로 재매핑하지 않는다.
중앙 `BeautifulMind-JT/ai-ops-control-plane`의
`engineering/docs/PROGRAM_EXECUTION_EVOLUTION_DESIGN_KO.md`와 protocol의
`docs/aiops/CONTRACT_RELEASE_AND_COMPLETION_DESIGN_KO.md`는 후속 설계 후보다.
실제 채택된 중앙 schema를 알기 전 receipt/MAC/verdict를 만들지 않는다.

stub 기본, 명시적 127.0.0.1 loopback만, one attempt, retry/redirect/proxy/stub fallback
금지, actor≠인증, no funds/KYC/public/venue/bank/credit disbursement를 유지한다.
M05 CRM 편집, token benefits 실행, AI transfer/refund/signing 권한은 열리지 않는다.

## 2. 계약 소비를 하나의 호환 묶음으로 검증

consumer는 producer의 exact source commit/tree, contract/gate OpenAPI blob+sha256,
generated SDK source/toolchain/output digest, protocol domain/schema/profile,
shared vectors digest를 canonical manifest와 대조한다. 파일 핀 5종을 함께 옮기는
기존 규칙에 더해, **소비 SDK가 그 같은 새 catalogue에서 생성됐는지** 확인한다.
consumer 최종 HEAD와 producer manifest digest는 실제 exact-head CI/독립 리뷰/보호된
completion evidence에서 결합한다. manifest 안에 자기 최종 HEAD를 넣지 않는다.

초기 `consume-p-sdk-0`는 protocol `p-sdk-0`가 제공한 manifest-v1 형식과
BOOTSTRAP profile·offline 최소 verifier·golden vectors를 원본 catalogue의 정확한
tuple로 소비한다. profile kind/revision/digest와 schema/두 OpenAPI/generator/SDK/
output/vector 결합을 확인하며, 초기 profile의 실제 비작성자 A3 검토·보호된 완료
증거·병합을 확인하기 전에는 입력 artifact만으로 승인됐다고 하지 않는다.
BOOTSTRAP은 초기 입력의 재현성과 결합에 한정하며 확대 catalogue의 의미 검증이나
N/N−1 호환을 증명하지 않는다. protocol의 `p-sdk-0` floor는 이 형식/검증 경계에
맞춰 A3/ARCHITECTURE로 올라간 후보이며 아직 실제 감사 PASS가 아니다.

`consume-p-sdk-1`은 초기 `consume-p-sdk-0` 뒤에, protocol `p-sdk-1`과
`contract-compatibility-profile` 완료 뒤에 새 catalogue SDK를 소비한다.
`bind-list-read`는 초기 SDK만 기다리던 정의를 고쳐 이 소비와 protocol
`read-model-reference`/`p-sdk-1`을 모두 기다린다.
`consume-p-sdk-0` 이외 pending 앱 노드도 `contract-compatibility-profile` 완료의
명시적 외부 선행을 둔다. 변경된 catalogue/gate/schema/receipt를 소비할 때는 초기
BOOTSTRAP을 거부하고, 소비하는 정확한 새 source tuple의 SEMANTIC_CONFORMANCE
profile/evidence를 검증한다. profile node가 완료됐다는 사실만으로 다른 tuple을
수락하지 않는다. 기존 Wave 6-A active10의 최소 gate·선행은 그대로다.

FSM/쿼리/Wave7 catalogue가 이후 바뀌면 소비 노드마다 그 변경의 새로운 manifest와
SDK를 다시 확인한다. 첫 compatibility-profile이나 초기 SDK 소비의 PASS를 후속
버전으로 옮기지 않는다. 선택 필드/enum/receipt 추가를 자동 호환으로 읽지 않고,
엄격한 guards와 승인된 profile을 따르며 미검증 조합은 쓰기 전에 거부한다.

## 3. 통합 시험의 선행 그래프

Wave 6-A `w6a-evidence`는 기존 **최소 한 표면 mock 여정** 게이트로 유지한다.
새 최종 검증이나 Wave7 계약을 선행시켜 cycle을 만들지 않는다.

| 노드 | 선행/증거 역할 |
|---|---|
| `e2e-browser-journeys` | 기존 browser-gate-path, api-state-distinction, bind-list-read, organizer-admin-console에 bind-admission-fsm, bind-resale-fsm, bind-credit-fsm, gift-surface 추가 |
| `commerce-integration-closeout` | 원본 active 10개+pending 18개와 새 consume-p-sdk-1 전부를 기다림. 자기 자신은 제외. 각 표면·모드·정확한 source tuple·오류 여정의 최종 evidence matrix |

E2E는 예매·box office·입장·리셀·여신(mock)·선물·운영자 7종의 실제 binding 상태를
검증한다. 미결합 stub 표면이 있다는 사실을 숨기지 않는다. final closeout은 그 7종에
가격/수수료 표시, 합성 환불·취소, read/propose 위임, M01~M05 계약 소비까지 포함한다.
승인된 판정이 browser gate를 닫아 두었다면 live 여정은 Node loopback으로 확인하고,
브라우저에서는 unavailable를 확인한다. 이 경우 browser HTTP qualification을 PASS로
만들지 않는다. feature 선택 문서로 끝난 노드와 구현된 경로를 matrix에 구분한다.

## 4. 부분 성공과 UNKNOWN의 고객 여정 의미

명령마다 다음 항목을 여정 binding 문서에 기록한다. UI의 설명은 원본 계약 용어와
같아야 하며 새 업무 의미가 필요하면 DECISION_REQUIRED다.

| 항목 | 정의할 내용 |
|---|---|
| 입력 연결 | 이전 확정 receipt의 어느 field가 다음 command/body에 쓰이는지 |
| 정체성 | operationId/actor/action/body fingerprint와 booking/payment/right identity의 차이 |
| 성공 | 정확한 command와 operation의 검증된 receipt가 있을 때만 다음 단계 허용 |
| 명시적 거절 | protocol이 확정한 거절 코드와 허용되는 다음 동작; 실패를 임의 보상/반대 명령으로 뒤집지 않음 |
| 응답 유실/timeout/잘못된 receipt | 적용 여부 UNKNOWN. 자동 재시도·대체 id·다음 쓰기 금지. 저장소/프로세스 경계를 넘은 replay 보장 추론 금지 |
| 조회 | non-authoritative read와 authoritative receipt 구분. read UI가 payment/issuance/admission 증명이 아님 |
| 재진입 | 새로고침·tab 종료·다른 actor·오래된 receipt에서 현재 tuple와 확정 evidence를 재검증 |
| 정리/보상 | 승인된 synthetic cancel/refund 경로와 권위/입력만 사용. COMPENSATION_UNDEFINED는 숨기지 않음 |

UNKNOWN이 되는 단계는 “확정 실패” 또는 “완료”로 표시하지 않는다. UI는 마지막
확정 단계, 확인되지 않은 요청, 막힌 다음 행동을 보여준다. 실제 권위 있는 확인
경로가 protocol에 없으면 UNKNOWN을 임의 조회·재시도로 해소하지 않는다.
처음 Wave 6-A는 읽기 명령 없는 receipt-chain이라 그 제한을 특히 명시한다.
이 설계는 새 idempotency/retry API나 authoritative ledger를 만드는 권한이 아니다.

시험은 각 연결 지점에서 요청 전 실패, 서버 효과 뒤 응답 유실, 잘린 body, stale
correlation, 새로고침, hold 만료, 양도/취소 뒤 구 receipt 재사용을 주입한다.
성공·거절·UNKNOWN을 구분하고 중복 쓰기, 다음 단계의 조기 활성화, UI의 거짓
payment/admission/refund 완료 표시가 없어야 한다. 이미 충분한 기존 coverage는
정확한 test/path를 매핑하며 같은 구현을 복사한 테스트 수로 검증했다고 하지 않는다.

## 5. 편입 대기는 계속 비활성

현재 active program은 10개이며 unsupported `depends_on_external`을 넣지 않는다.
pending은 원본 18개+`consume-p-sdk-1`+`commerce-integration-closeout` = 20개다.
pending의 `astra_auto_merge=true`는 실행 가능한 승인 영수증이 아니다. 실제 승인
범위와 중앙 기능 채택·qualification·attestation 뒤에만 적용하는 후보 위임이다.
protocol pending 1개까지 포함하면 양쪽 pending은 21개다.

현재 런타임에서는 외부/내부 선행이 실제 병합된 뒤 비작성자 리뷰와 사용자 병합의
계획 개정으로 편입한다. 미래 외부 의존성 기능을 쓰려면 중앙 기능 채택·host
qualification·attestation와 승인된 immutable pending catalogue, scope-preserving
revision 규칙이 먼저 있어야 한다. adoption 전에는 event나 pin만으로 자동 편입하지 않는다.

외부 완료는 `repository`, `program_id`, `node_key`, `approved_plan_commit`,
`node_definition_sha256`, `task_issue`, `task_revision`, `writer_launch_id`,
`delivered_pr`, `delivered_head`, `merge_commit`, `protected_receipt_id`,
`runtime_attestation_id`와 `protected_receipt_sha256`의 **전체 결합**으로 검증한다.
`artifacts`와 selector가 요구한 `qualification_state`/`qualification_evidence_ids`도
검증한다.
기존 protected root ledger/host pin의 실제 채택된 schema/issuer/signature를 따르며
새 cross-host signer/key를 만들지 않는다. 중앙이 등록·보호하지 않는 upstream은
UNSUPPORTED_AUTHORITY로 HOLD한다. 일부 tuple 일치만으로 READY를
부여하지 않는다. 댓글·PR 이름·SDK pin만으로
승인 또는 완료를 추론하지 않는다. 한 완료 사건은 durable dedupe 뒤 한 번만
downstream을 깨운다. 중복/역순/wrong binding/UNKNOWN은 HOLD, polling/model 재시도 없음.

## 6. 최종 evidence matrix와 완료 측면

각 row는 표면/사용자 여정, 허용 mode, 승인 contract/producer manifest, actual app
head, 성공·거절·UNKNOWN 시험, browser 또는 Node 실제 실행 증거, skipped/미결합
사유, 수용 판정, qualification 대상을 기록한다. manifest는 입력 정본일 뿐 감사
PASS가 아니며, closure의 증거는 보호된 실제 결과와 exact-head checks다.

| 필드 | 허용 상태·판정 |
|---|---|
| `node_state` | `NOT_STARTED / WAITING / IN_PROGRESS / DONE`은 신규 정규화 query 후보. DONE은 중앙 기존 core가 계산한 host-pinned exact delivered HEAD의 유효한 target 병합 predicate와 같음 |
| `qualification_state` | `NOT_REQUIRED / UNQUALIFIED / PARTIAL / QUALIFIED`; 대상 mode/source/evidence를 명시 |
| `acceptance_state` | `NOT_REQUIRED / PENDING / ACCEPTED / REJECTED`; 실제 필요한 사용자/제품 판정만 |
| `release_state` | `NOT_AUTHORIZED / NOT_RELEASED / RELEASED`; 별도 권한과 실제 출시 여부 |

post-merge 시험·서비스 evidence는 요구된 task deliverable check 또는 별도
qualification/acceptance 측면에서 판정한다. node_state DONE의 중앙 predicate를
이 문서가 더 늘리거나 독자적으로 계산하지 않는다.
stub/합성 금액/loopback-reference를 production qualification으로 표시하지 않는다.
live-gate CI가 secret 없이 skipped라면 skipped와 실제 로컬 증거를 구분하고 자동 PASS를
만들지 않는다. 화면 baseline 또는 제품 수용 판정이 없다면 PENDING/UNQUALIFIED를
유지한다. 전체 승인된 개발의 완료와 실서비스 출시를 한 상태로 합치지 않는다.
pending/User decision/external input/qualification holds를 개별 집계한다.

## 7. 수용 기준

1. 원본 명세/잠금/User-only 권한을 유지하며 외부 의존성 및 전체 DAG가 acyclic.
2. 같은 producer tuple의 generated SDK를 실제 소비하고 혼합 catalogue/gate/SDK와
   wrong digest/domain/version/receipt를 쓰기 전에 거부. 초기 소비의 BOOTSTRAP과
   후속 소비의 SEMANTIC_CONFORMANCE를 구분하고 unknown/wrong profile kind,
   다른 revision/digest 또는 초기 profile로 확대 catalogue를 소비하는 입력을 거부.
3. final closeout이 다른 원본 28개와 SDK 소비 1개의 완료 증거를 요구하고 missing,
   stub-only, skipped, NOT_BOUND, blocked-browser, 미승인 release를 정확히 분리.
4. 단계별 partial-success/response-loss 시험이 no retry, UNKNOWN fencing과 UI 진실성을 확인.
5. 완료 통지는 현재 host-pinned exact delivery/plan/runtime binding 없이 합성되지 않음.

이 후속 PR은 설계와 candidate task definitions만 변경한다. 앱 코드·CI·credentials·
settings·activation·독립 Fable 실행·제품 qualification·실배포는 실행하지 않는다.

중앙 bootstrap의 현 채택 검토 후보는 #44/#45를 통합·보완한 [#46](https://github.com/BeautifulMind-JT/ai-ops-control-plane/pull/46)이다. 기존 #44 감사의 DECISION_REQUIRED를 통과한 것으로 간주하지 않는다. PA-1 권한 예외는 PENDING이며, 보호된 reconcile과 실제 host qualification 전에는 전체 실행 NOT_READY다. 기존 중앙 포인터는 이전 체크포인트 기록이고 최종 승인 registration에는 실제 채택·qualification commit을 pin해야 한다.
