# KIX Commerce 제품 설계 고도화 — 여정·복구·금융 조회·제품 수용

상태: **설계·계획 개정 후보, PENDING_NOT_IN_PLAN.** 기준은 #16 HEAD
`bb24207cb648acfe3083c4a2e7720251b06ad639`다. 이 문서는 기존 R-1, active 10개,
pending 20개 및 [통합 설계](INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md)를
이어받고 pending 6개를 추가한다. 앱 구현, 프로토콜 계약 채택, 서비스 qualification,
독립 Fable PASS, 사용자 화면 수용 또는 실서비스 출시는 아직 수행하지 않았다.

중앙 #46 후보 `a8b7355712c58de8d27c85a535fb241a09a4037c` 위의
[#47 복구 구현 후보](https://github.com/BeautifulMind-JT/ai-ops-control-plane/pull/47),
HEAD `94a768e19df12703ea0b9a49e49972feb2f6ef4f`는 개발용 Fable 기록·한도 복구다.
설치·사용자 채택·실제 host qualification 전이며 commerce 명령의 재시도 권한이 아니다.
현재 편입 대기/승인 경계와 금융·chain·공개 운영 잠금은 그대로 유지한다.

## 1. 실제 소스에서 확인한 확장 지점

기준 HEAD의 README, `.aiops/program.json`, `PENDING_NODES.json`, adapter와 실제
desk/UI 소스를 읽었다. 저장소 tree에 AGENTS.md는 없으며 상위 R-1/계약/README의
권위·잠금 규칙을 적용한다. 현재 제품은 operator desk + 별도 marketing stub이다.

| 실제 파일 | 현재 동작과 후속 설계 필요 |
|---|---|
| `packages/protocol-adapter/src/commerce-bindings.ts` | desk method/body가 published command와 같지 않으면 `not-bound`. 이름이 비슷하다고 재매핑하지 않고 실제 새 SDK binding을 먼저 완성해야 함 |
| `packages/protocol-adapter/src/http-adapter.ts` | one attempt, loopback origin, request/correlation echo, strict receipt 검사. fetch 뒤 timeout/response loss는 적용 여부 불명일 수 있음. UI의 generic 오류 문자열만으로 업무 실패를 확정할 수 없음 |
| `apps/web/src/desk-attempts.ts`, `reservation-desk.ts`, `resale-desk.ts`, `settlement-desk.ts` | 현재 stub은 rejection/reconcile 뒤 attempt를 높여 새 명령을 만듦. 이 편의 동작을 future HTTP의 UNKNOWN 뒤 새 operationId로 가져오면 안 됨. desk attempt는 프로토콜 exactly-once 증거가 아님 |
| `apps/web/src/protocol.ts`, `App.tsx`, `marketing/session.ts` | adapter/session singleton과 route별 desk가 있음. page reload는 stub 업무 상태를 비우지만 tab attempt는 남을 수 있음. actor/mode/manifest/재시작 경계를 명시한 recovery가 필요 |
| `apps/web/src/components/Shell.tsx`, `transport-status.ts` | route 변경과 15초 probe에서 generation을 비교함. 이것은 liveness 관찰이며 payment/입장/정산 권위가 아니고 업무 reducer 전체의 stale fencing을 대신하지 않음 |

작업 시작 시 실제 checkout에서 이 파일과 새 upstream 계약을 다시 확인한다. 미래
파일 위치가 바뀌면 mapping을 기록한다. 이미 충분한 시험은 재사용하며 파일 수나 테스트
개수로 완성도를 주장하지 않는다. 이 문서 작성에서는 runtime/CI/source를 바꾸지 않는다.

## 2. 레이어와 데이터 권위

`page/component → journey controller → protocol adapter/generated SDK → approved
reference gate` 한 경로를 유지한다. UI 컴포넌트의 fetch, settlement math 복사,
in-memory 화면 값의 receipt 승격은 금지다. controller는 연결·진행 가능성·표시만
계산하며 금액, 소유권, 검표 권한, 여신 노출의 진실은 protocol에 있다.

| 레이어 | 책임 | 금지 |
|---|---|---|
| SDK/adapter | exact producer manifest+SEMANTIC_CONFORMANCE tuple 검증, command/query/body/receipt 및 trace 경계 | 유사 desk body 재매핑, SDK 밖 즉석 endpoint, retry/header, public host, auth 발명 |
| journey controller | 서로 다른 aggregate의 확정 evidence 연결, 현재 context에서 다음 행동 허용 여부, outcome fence | local 클릭/health/view snapshot으로 지급·발행·양도·입장 확정 |
| projection reducer | 확정 receipt와 관찰 snapshot의 출처·freshness를 보존한 표시 상태 | 계산으로 receipt 제조, 과거 holder version의 승격, UNKNOWN을 rejected/완료로 변환 |
| session intent store | 최소 요청 intent, outcome/fence, schema/manifest/context와 마지막 검증 evidence 참조 저장 | 결제수단·secret·서명키·실 개인정보 저장, browser storage를 auth/durable protocol journal로 주장 |
| product UI | 작업 흐름, 이유가 있는 비활성 행동, 오류·부분 성공·mock/조회 출처, keyboard/보조기술 | 색만으로 상태 전달, 허위 “결제 완료/입장 가능/환불 완료”, 앱 화면 승인으로 출시 허가 |

제안 모듈 경계는 adapter `journey-outcome`/`read-observation`, web
`journey-context`/`journey-controller`/`journey-session`/`journey-projection`이다.
구현자는 저장소 관례에 맞는 실제 경로를 선택하고 책임과 테스트 매핑을 남긴다.
schema 이름을 정했다고 upstream API나 canonical body가 채택된 것은 아니다.

## 3. 정체성과 연결 계약

| 식별자 | 범위와 규칙 |
|---|---|
| `journeyId` | 사용자 흐름을 묶는 앱 로컬 opaque ID. 결제/권리/command ID나 auth로 쓰지 않음 |
| `contextKey` | adapter mode, producer manifest/domain, actor reference, browser session incarnation, aggregate scope의 tuple. 하나라도 바뀌면 pending callback은 현재 state를 갱신하지 않음 |
| protocol operation/body digest | published canonical encoding과 정확한 operationId/action/actor/body의 결합. client가 JS object stringify를 새로운 프로토콜 canonical digest로 선언하지 않음 |
| request/correlation ID | 한 전송의 trace. business identity, 인증, idempotency, 확정 effect와 분리 |
| booking/reservation/settlement/payment/right/listing/transfer/credit IDs | 서로 바꿔 쓰지 않음. 생성·반환·다음 명령 field mapping을 실제 contract receipt의 JSON path로 명시 |
| expected owner/version/epoch | 해당 protocol contract가 정한 사전조건. 앱 캐시·clock으로 증가시키거나 fresh로 추정하지 않음 |
| refresh epoch | 앱 내 read/callback 정렬용 monotonically increasing token. source의 commit position 또는 경제 finality가 아님 |

mapping register의 각 row는 source command/receipt path, target command/body path,
actor/authority boundary, required tuple/expected version, reference mode, expiry/
freshness 기준, 판정자를 포함한다. 해당 field가 없으면 `NOT_BOUND`다. 사용자에게
입력을 받아 source receipt가 있는 것처럼 채우거나 base64/UUID 형식을 즉석 가정하지 않는다.

동일 tab의 conflicting writes는 aggregate와 관련 resource scope별로 single-flight한다.
같은 right의 resale/gift/admission 및 동일 reservation의 cancel/issue 같은 경쟁을
등록한다. tab 간 공유 lock은 UI 중복 클릭 억제에 한정하고 프로토콜 concurrency
보장으로 주장하지 않는다. 실제 충돌 방어는 승인된 producer CAS/expected version에
의존한다. actor string은 인증이 아니므로 actor 분리 UI는 권한 통제의 증거가 아니다.

## 4. outcome reducer와 UNKNOWN 경계

업무 outcome은 `DRAFT / IN_FLIGHT / CONFIRMED / REJECTED / UNKNOWN`이며
view freshness는 별도 `CURRENT / STALE / UNAVAILABLE`다. 이 명칭은 앱의
표시 계약 후보이고 canonical protocol FSM phase 또는 중앙 node_state가 아니다.

| 입력 사건 | 전이·출력 | 허용되는 후속 행동 |
|---|---|---|
| client validation/not-bound 실패, fetch가 시작되지 않았다는 local 증거 있음 | DRAFT에 pre-send error 기록, effects 없음 | 입력 수정 또는 지원된 새 행동. 기존 intent는 자동 전송하지 않음 |
| valid context에서 명시 클릭, intent/fence 선저장 성공 | IN_FLIGHT; protocol command 한 번 전송 | 같은/충돌 scope의 write 잠금, 다른 독립 화면 조회 가능 |
| 같은 operation/action/body binding과 source tuple의 검증 receipt | CONFIRMED 또는 contract가 확정한 REJECTED | 다음 단계는 실제 receipt contract의 guard에 따름 |
| fetch 뒤 timeout, 응답 유실, 잘린 body, wrong trace/receipt, 불분명한 HTTP reject | UNKNOWN + 마지막 확정 단계 보존 | 자동 retry, 새 operationId로 같은 효과 요청, 반대/보상 write, 다음 의존 write 금지 |
| 다른 context/actor/manifest/session, 더 낮은 refresh epoch의 응답 | 현재 projection에는 적용하지 않음; 이전 intent의 fence는 보존 | context별 history/quarantine. 버린 callback으로 UNKNOWN을 해소하지 않음 |
| 조회 또는 `/health`·`/ready` 성공 | read/transport facet만 갱신 | payment/issue/transfer/refund/admit outcome 변경 없음 |

검증된 거절도 code 이름만 보지 않는다. published rejection 형식과 exact binding,
effect semantics가 확인되어야 REJECTED다. 기준 generic operational `rejected` 라벨은
UI 상태이고 확정 무효과 증거가 아닐 수 있으므로 새 reducer에서 구분한다.
AbortController/route unmount는 서버 취소 증거가 아니다. 클라이언트 timeout 뒤 늦은
응답도 same-context 검증 후 기록할 수 있지만 worker가 현재 scope를 덮어쓰게 하지 않는다.

앱은 business operation을 자동 재시도하지 않는다. idempotency는 producer가
지원한다고 명시한 exact contract에만 적용하며 stub-local echo/reconcile나 중앙 #47의
Fable model retry를 차용하지 않는다. UNKNOWN 해소 API가 아직 없으면 reconciliation
view가 있어도 HOLD다. 미래 authoritative resolution을 추가하려면 별도 A3 계약과
exact tuple/권위 증거가 필요하며 이 여섯 노드는 그 권한을 새로 만들지 않는다.

## 5. 새로고침·재접속·다중 화면 복구

1. 전송 전에 최소 intent와 conflicting-scope fence를 기록한다. 저장 실패/blocked quota는
   쓰기 전 거절한다. 전송 뒤 저장 실패는 UNKNOWN이며 진행을 잠근다.
2. reload/tab resume에서 모든 미해결 intent는 UNKNOWN으로 복구한다. 확인 없이 다시
   전송하지 않는다. cached CONFIRMED는 history이며 current outcome으로 쓰려면 producer
   tuple·receipt·현재 version/승인된 freshness를 재검증한다.
3. actor/mode/domain/manifest 변경, stub process reset, read dataset generation 변경은
   기존 session을 격리한다. stub이 초기화됐다고 이전 HTTP UNKNOWN이 사라지지 않는다.
   같은 sessionStorage attempt 번호는 복구 완료 증거가 아니다.
4. 새 consumer release가 이전 journal schema를 읽을 수 없으면 fail-closed quarantine.
   상태를 버리고 새 ID를 발급해 우회하지 않는다. migration은 snapshot backup과
   ID/field-preserving map, rollback 및 unsupported-version UI를 갖춘다.
5. browser storage 손실/삭제/다른 tab·device는 global exactly-once를 보장하지 않는다.
   근거가 없으면 `SESSION_EVIDENCE_LOST`를 표시하고 unknown-scope continuation은 HOLD.
   새 command 허용을 local fencing만으로 보장하는 출시 주장은 금지다.

session record 예산은 구현 PR에서 bytes/count 경계를 정하고 overflow를 시험한다.
완료 intent의 보존 기간, 법적/개인정보 정책은 `UNDETERMINED · 담당 사용자/법무`다.
확정되지 않은 TTL로 UNKNOWN fence를 지우지 않는다. 테스트는 작은 deterministic
fixture와 corrupt/unsupported/부분 write/storage quota를 포함하고 실제 PG 데이터를 쓰지 않는다.

## 6. 통합 여정의 부분 성공·보상 표

최소 Wave 6-A는 원본대로 첫 mock 한 여정이며 아래 전체 제품 수용의 대체가 아니다.
각 여정은 현재 채택된 command와 receipt path로 binding하며 미지원 단계는 NOT_BOUND로
드러낸다. 새로운 명령/가격/취소 정책이 필요하면 먼저 protocol의 결정 경로를 거친다.

| 여정 | 실제 연결해야 할 evidence | 핵심 실패·경쟁·완료 경계 |
|---|---|---|
| 예매·발행 | show/hold→reservation→mock settlement observation→issued right | hold expiry는 자동 cancel 아님; 결제 observation 뒤 issue 응답 유실이면 paid-like/issueUNKNOWN 분리; issue 전에 소유권 확정 금지 |
| box office·운영자 | event lifecycle, inventory/read snapshot, actor-scoped command receipts | stale catalog/다른 event 응답, cancel과 issue 경쟁, 관리 view를 admission 권위로 쓰지 않음 |
| 리셀·선물 | current holder/version→listing 또는 gift offer→transfer receipt→new presentation | resale/gift/admit 동시 경합, old holder/구 version credential 무효, 성공 양도 뒤 늦은 oldread로 되돌리기 금지 |
| 입장 | current right+admission authorization→consume receipt | valid presentation이나 health 성공은 입장 완료 아님; consume 응답 유실 뒤 duplicate consume 금지, cancelled/transferred/stale 경로 표시 |
| 취소·환불 | cancel eligibility, synthetic refund command, refund observation/source receipt | 취소 완료와 환불 완료 별도; 부분 refund/unknown refund 이후 임의 반대 명령 금지; producer policy의 compensation 미정은 `COMPENSATION_UNDEFINED` |
| 여신(mock) | claim/exposure snapshot, offer/draw/repayment sequence, mock settlement link | shared claim ceiling, sequence gap, partial repay/close/default 경계. DRAWN은 지급 완료/규제 승인 아님 |
| 마케팅 M01–M05 | membership/presale/coupon/referral/consent의 해당 contract receipt | coupon/order atomicity는 producer에; presale interest는 hold 아님; consent revoke와 authorize 경합. CRM send는 `none`, 보상 지급·토큰 혜택 실행 없음 |
| AI 위임 | query/propose input과 actor/source scope | AI가 transfer/refund/sign/execute 하지 않음; proposal을 receipt나 사용자 동의로 승격하지 않음 |

보상은 automatic saga가 아니다. 승인된 synthetic cancel/refund의 explicit user command와
protocol guard를 써서 별도 단계로 실행한다. 분모에는 성공/거절/UNKNOWN/정책상 unavailable
branch를 각각 두며 unavailable를 성공 수에 넣지 않는다. 계약상 no compensation은
그대로 노출하고 “다음에 자동 복구”라고 약속하지 않는다.

## 7. read projection과 금융 대사 표시

upstream 후보 `ReadObservationV1`은 `read_schema_version`, `query_digest`,
`subject_scope`, `fixture_mode`, `source_cut`, `projection_watermark`,
`snapshot_digest`, `observed_receipt_refs`, `producer_manifest_digest`,
`profile_revision`을 갖는 exact-current tuple의 조회 evidence 설계다. cut/watermark는
source kind/id/generation/position-domain/value의 typed identity이며 generic timestamp가
아니다. 이것은 protocol A3 계약과 새 SDK/profile로 채택될 후보이며 앱이 먼저 wire field로
만들지 않는다. 미지원/누락이면 NOT_BOUND/WAITING, 기존 receipt에 임의 추가하지 않는다.

같은 subject/mode/producer tuple의 source-cut와 projection-watermark만 비교한다.
lag/세대 변경/범위 불일치/해시 오류는 STALE 또는 UNAVAILABLE이며 양수 balance나
last seen receipt를 현재 권리로 바꾸지 않는다. pagination은 같은 snapshot token으로
완료하거나 재조회 실패를 명시한다. 다른 cut의 페이지 합계를 한 시점의 잔액으로 제시하지
않는다. refresh는 explicit navigation/사용자 행동/승인된 짧은 refresh 경로이며 write 재시도나
health probe 자동승격을 만들지 않는다.

KIX Finance는 현재 **kix-protocol 소유 program kix의 금융 영역**이다. 별도 finance
저장소나 program을 추정하지 않는다. `c-finance-projection`은 upstream 후보
`fin-catalogue-read-model`이 제공한 정확한 SDK/manifest/SEMANTIC_CONFORMANCE 조회만
소비한다. 회계 ledger나 수수료·반올림·이자·환불 배분을 앱에 다시 구현하지 않는다.

| 금융 view | 표시 및 대사 규약 |
|---|---|
| capture/claim/settlement | 각각의 source IDs/cut/unit, pending/confirmed/unknown/exception 항목; 여러 phase를 하나의 “paid”로 합치지 않음 |
| 다중 수취인·수수료·환불 | producer-defined 분개/배분·rounding evidence를 읽고 누락 행을 드러냄. 앱이 분배 잔액을 임의 특정 수취인에게 보내지 않음 |
| credit exposure | mock unit/claim scope/sequence와 reserved/drawn/repaid/outstanding의 의미를 그대로 출력. 승인 한도·통화 posting·bank debit을 주장하지 않음 |
| reconciliation exception | mismatch, unmatched, duplicate, late, UNKNOWN을 실제 producer code/참조에 따라 조회. 운영자가 고치려면 별도 producer command/권한 필요 |
| export | 동일 cut/manifest/query contract의 export reference만 읽고 rows/count/digest 검증. mixed cut/partial export는 확정 accounting report가 아님 |

string/BigInt 기반 protocol monetary codec이 있으면 그대로 소비하고 JS floating point로
계산하지 않는다. mode/source 단위 없이 원화·법정통화 기호를 붙이지 않는다. 금융 view는
실자금·은행·대출/KYC·세무 신고·감사 보고서 승인과 분리한다. 경제 completion truth를
client arithmetic으로 만든 tests는 수용 증거가 아니다.

## 8. 접근성·제품 수용·오류 진단

새로 구현한 실제 화면을 keyboard만으로 각 required 여정의 성공/거절/UNKNOWN 경로에
대해 시험한다. focus 복귀, label/input error 연결, dialog trap/escape, live region의 중복
announcement, 표 헤더/상태 text, 확대·좁은 viewport, contrast/색 외 상태 표식을 포함한다.
읽기 전용 분기와 비활성 버튼은 이유와 다음 가능한 행동을 설명한다. keyboard/보조기술
시험 기준과 도구/버전은 구현 PR에 남기며 자동 accessibility 검사만으로 사용자 수용을
대신하지 않는다. 공식 기준 버전/목표를 바꿀 때는 소스 확인과 별도 결정 기록을 둔다.

사용자 수용은 실제 새 UI artifact/current HEAD와 여정 evidence matrix를 보고 기록한다.
기존 stub 화면 baseline나 ZARI/다른 제품 승인을 전이하지 않는다. CI/browser automation
PASS, accessibility observation, human acceptance, release permission은 별도 facets다.
필수 baseline/판정자가 없는 행은 PENDING이며 완료 화면을 임의 “승인됨”이라고 쓰지 않는다.

진단 record는 app release/producer manifest/mode/journey+operation/trace IDs, outcome와
원본 rejection/evidence reference, sourcecut/refresh epoch, redacted reason을 포함한다.
actor display 값은 권한 증명도 비밀도 아니지만 로그의 실 개인정보는 최소화한다. token,
payment credential, 서명키·실명/KYC 데이터는 기록하지 않는다. 일반 사용자 흐름에는
내부 감사·receipt 저장 위치를 노출하지 않고, 실제 판단에 필요한 상태·출처·다음 행동을 쓴다.

## 9. 후속 DAG와 담당

모든 새 노드는 pending이고 `astra_auto_merge`는 실제 채택 범위 안의 실행 위임 후보다.
User-only/contract change/RELEASE 예외를 넘지 않는다. task writer는 중앙이 등록한 단일
writer, reviewer는 비작성자 exact-HEAD 독립 리뷰다. A3 node는 보호된 ARCHITECTURE
gate가 필요하다. UI 수용 판정자는 사용자, 금융·정책 미정 값은 사용자와 지정된 검토자다.

| 새 노드 | 앱 선행 | 외부 선행 (program kix) | 산출·등급 |
|---|---|---|---|
| `c-journey-identity` | consume-p-sdk-1, bind-list-read, api-state-distinction | protocol-runtime-boundary-register, protocol-canonical-identity-conformance, protocol-read-projection-evidence, contract-compatibility-profile | §§2–3/7 registry+adapter/read decoder+stale fixtures, A3 ARCHITECTURE |
| `c-async-session-fence` | c-journey-identity, bind-reservation-fsm, bind-settlement-fsm, bind-admission-fsm, bind-resale-fsm | protocol-local-recovery-conformance, protocol-read-projection-evidence, contract-compatibility-profile | §§4–5 reducer/intents/UNKNOWN recovery, A3 ARCHITECTURE |
| `c-cross-surface-journeys` | c-async-session-fence, bind-wave4-pointers, bind-credit-fsm, gift-surface, refund-surface, delegation-surface, organizer-admin-console, w7-m01-membership, w7-m02-presale, w7-m03-coupon, w7-m04-referral, w7-m05-consent-bind | contract-compatibility-profile | §6 full journey composition+failure branches, A3 ARCHITECTURE |
| `c-finance-projection` | c-journey-identity, bind-list-read, bind-settlement-fsm, bind-credit-fsm, primary-price-fee-ui | fin-catalogue-read-model, contract-compatibility-profile | §7 exact release read-only reconciliation/export UI, A3 ARCHITECTURE |
| `c-accessibility-acceptance` | c-cross-surface-journeys, c-finance-projection, browser-gate-path | contract-compatibility-profile | §8 real UI/accessibility evidence+pending User acceptance matrix, A2 |
| `c-integrated-chaos-qualification` | c-async-session-fence, c-cross-surface-journeys, c-finance-projection, c-accessibility-acceptance, e2e-browser-journeys | protocol-local-recovery-conformance, contract-compatibility-profile | §10 exact-current adverse journey qualification evidence, A3 ARCHITECTURE |

기존 `commerce-integration-closeout`는 기존 다른 29개와 이 6개, 총 **35개 선행**을
기다린다. 새 여섯 노드는 closeout을 선행으로 두지 않는다. `fin-finance-closeout`가
commerce `c-finance-projection`을 기다릴 수 있지만 c-finance-projection은 finance의
closeout을 기다리지 않는다. protocol final integration closeout도 finance final을 기다릴
수 있으나 이 commerce 여섯 노드의 선행은 protocol 중간 contract/evidence뿐이다.
root에서 protocol+finance+commerce 전체 DAG를 함께 검증해야 한다.

commerce 분모: active 원본 10 + 기존 pending 20 + 새 pending 6 = **36**.
원본 commerce scope 28개 + 이전 SDK 소비 1 + 이전 최종 closeout 1 + 이번 6개다.
closeout을 분모에서 빼지 않고 duplicate definition도 세지 않는다. 이번 통합 후보의 KIX 분모는 protocol82(active67+pending15, Finance 포함) +
commerce36(active10+pending26) = **118**이며 pending 합계는 **41**이다. 이전
“98개/양쪽 pending21개”는 이전 체크포인트 기록이다. finance 항목은 protocol 노드로
한 번만 센다. 전체 후보 파일과 맞는지 root 통합 검증에서 다시 확인한다.

## 10. 구현·수용 체크

1. 원본 active10 definitions byte-identical, pending 기존20 identity/선행/감사 floor 보존.
   기존 closeout은 새6 scope 선행과 §9 분모만 확장. active에는 unsupported external을
   넣지 않고 모든 새 node와 producer prerequisites의 정의가 양쪽 candidate inventory에 존재.
2. 각 후속 변경의 실제 exact producer source/manifest/generated SDK/profile/vectors를
   검증하고 current consumer HEAD의 CI와 binding evidence를 남김. 예전 profile node
   완료/BOOTSTRAP/PASS를 새 finance/read/body/version의 qualification으로 옮기지 않음.
3. fetch 호출 전/뒤, response loss, duplicate click/late callback, actor/mode/manifest switch,
   stale page/read, storage unavailable/corruption/reload, simultaneous gift/resale/admit를 주입.
   command count가 one attempt이고 UNKNOWN 다음 신규 write/compensation가 0임을 확인.
4. 전체 여정 matrix에 실제 bound/unbound, success/rejection/UNKNOWN, source cut/mode,
   app head/browser 또는 Node 결과를 모두 적음. live-gate CI secret 없어서 skipped거나
   browser gate가 의도적으로 닫혔으면 해당 facet은 UNQUALIFIED/NOT_BOUND; stub만으로 PASS 금지.
5. 회계/credit projection은 exact cut/계약 참조만 쓰고 math가 복사되지 않음. 현재 source와
   mismatch/partial export/lag가 표시되며 reconciliation read가 write outcome을 해소하지 않음.
6. `c-integrated-chaos-qualification`은 app/source/mode별 결과 산출 노드다. source merge와
   실제 서비스 qualification을 구분하고 채택된 중앙 core의 host-pinned valid-target-merge
   predicate로 node DONE를 읽음. required qualification/acceptance/release는 별도 facets;
   실제 새 제품 User acceptance는 없으면 PENDING, release NOT_AUTHORIZED.

자동으로 끝까지 진행한다는 것은 승인된 개발 DAG를 보존하고 가능한 노드를 계속
실행한다는 뜻이다. 새로운 정책·외부 답변·금융/chain/public 권한·서비스 부재는 해당
scope만 명시적으로 HOLD하고 다른 독립 work는 진행한다. UNKNOWN을 완료로 만들거나
미정 계약을 앱에서 임시로 구현해 분모를 줄이는 것이 아니다.
