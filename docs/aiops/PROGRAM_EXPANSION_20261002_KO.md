# kix-commerce-apps — 원대한 제품 목표와 상세 실행 계획

2026-10-02 KST · 확대 계획 후보 / 이번 변경은 계획·문서만 작성

## 목표

발견·예매·권리 보유·리셀·선물·입장·환불의 구매자 경험과, 주최자·판매자·금융·운영자의 업무를 같은 현재 프로토콜 위에 연결하는 제품군. 대규모 검색/거래·혜택·여신·운영·모바일·위임 보조까지 통합한다.

사용자 원문: “ZARI, film-unit-mv-studio, Kixprotocol, kixcommerce 전부 최대한 원대하고 .aiops/program.json 넣어줘”, 후속 “원대하고 자세히”. 기능 목록을 넘어 구현 범위·산출물·실패 검증·정확한 선행관계를 작성하라는 지시로 반영했다. 현재 대화는 계획 작성의 근거이며 미래의 모든 상품 정책·실환경 권한·릴리스 결정을 미리 승인한 기록으로 사용하지 않는다.

## 계획을 읽는 방법

- `.aiops/program.json`: schema-v1 형태의 로컬 작업 **18개**. 현재 pointer는 PENDING이므로 실행 입력으로 사용할 수 없다. 기존 10개 정의를 보존하고 8개를 추가했다.
- `docs/aiops/PENDING_NODES.json`: 외부 선행·새 계약·실환경 자격이 필요한 **42개**. 기존 26개를 보존하고 16개를 추가했다. 이 catalogue는 스케줄러가 실행하지 않는다.
- 전체 검토 분모: **60개**. Finance 등 같은 ID의 부분집합을 두 번 세지 않는다. 필요 없는 기능의 연기는 명시적인 범위 개정으로 기록하며 완료로 바꾸지 않는다.
- `docs/aiops/KIX_COMMERCE_PROGRAM_DRAFT.json`는 위 program과 바이트가 같은 비활성 원본이다. `REGISTRATION_SCOPE_DRAFT.json`은 전체 정의와 문서 해시를 묶는다.
- 기존 작업의 구현을 반복하는 계획이 아니다. 착수 시 현재 소스·증거와 대조해 이미 충족된 요구는 정확한 근거를 연결하고, 남은 gap만 구현한다. 기존 source/의미를 보존한 채 검증 없이 DONE 처리하지 않는다.

## 기준과 기존 등록 PR의 관계

- 관측 main: `b0217cc9e92cc87813f6ce6724632699d400eb3a`.
- 기존 시작 PR #17: `17e7938b7a6b260453754b96e16af6ae5bd095d1` / `aiops/register-program-20261002`. 이번 확대 후보는 그 위의 별도 draft PR이며 원래 시작 PR을 수정하지 않는다.
- 기존 [중앙 #57](https://github.com/BeautifulMind-JT/ai-ops-control-plane/issues/57)의 시작 범위·과거 감사는 새 정의에 승계되지 않는다. 원래 시작 PR을 선택할지 확대 범위로 대체할지는 검토 후 한 개의 채택 plan으로 정한다.
- 승인 전 program mirror를 운영 중인 기본 브랜치에 합치지 않는다. 확대 정의를 검토·채택한 뒤 시작 개정에서는 승인된 원본을 복사하고 approval_pointer만 정확한 결정으로 바꾼다. 기존 schema-v1 reader는 PENDING을 실제 거절한다.
- 이번 형식 검증에 사용한 중앙 소스: `a34a38b73f096c9f6597b38a111d95ca12ecd159`. source 읽기/검증 사실은 설치·호스트 자격·독립 감사가 아니다.

## 단계와 의존관계

| 작업 묶음 | 신규 작업 ID |
|---|---|
| 통합 제품 UX | `c-workspace-design`, `c-buyer-workspace`, `c-organizer-workspace`, `c-receipt-explorer`, `c-discovery-prototype` |
| 제품 품질 | `c-accessibility-baseline`, `c-contract-fixture-library`, `c-local-workspace-closeout` |
| 전체 거래 플랫폼 | `c-discovery-live`, `c-inventory-venue`, `c-platform-journey`, `c-merchant-operations`, `c-credit-origination`, `c-credit-servicing-journey`, `c-finance-operations`, `c-marketing-journey`, `c-delegated-assistant`, `c-tenant-permissions`, `c-notification-inbox`, `c-marketplace-performance`, `c-provider-connected-journey`, `c-installable-mobile`, `c-platform-operational-qualification` |
| 출시와 운영 | `c-platform-release` |

각 노드의 `depends_on`은 같은 레포의 정확한 ID를 가리킨다. pending의 `depends_on_external`은 producer/consumer의 정확한 repo·program·node를 가리킨다. 목록 순서를 실행 순서로 추정하지 않는다. 독립 branch는 선행이 충족되면 진행할 수 있지만 같은 task/checkout의 writer는 하나다.

외부 의존성이 충족되지 않은 노드를 “문서에 적어두었으니 실행 가능”으로 승격하지 않는다. reader가 채택되거나, 실제 외부 완료와 현재 producer tuple을 검토해 승인된 계획 개정을 만들 때까지 pending을 유지한다. 같은 레포의 미래 계약 노드도 명시된 승격 조건을 만족해야 한다.

## AIOPS가 자율적으로 진행할 범위

- 한 작업 소유자가 구현→테스트→실패 분석→수정→PR을 이어간다. 일상적 알고리즘·리팩터링·레이아웃 선택은 승인 계약 안에서 자율 결정한다.
- 독립 reviewer는 같은 HEAD의 실제 diff와 acceptance를 확인한다. 실패하면 같은 소유자에게 지적을 돌리고 변경 HEAD에서 다시 검토한다. 작성 세션은 자기 독립 감사 PASS를 발급하지 않는다.
- 작업별 실제 산출물과 검증 근거가 필요하다. 빈 모듈·고정 성공 응답·미연결 화면·테스트 대역만으로 실사용 완료를 선언하지 않는다.
- 계정 로그인/OS 권한/제공자 scope·중요 계약/실제 공개·릴리스처럼 사용자 권한이 필요한 결정만 질문한다. 기존 user_merge·A3·RELEASE를 일반 구현 질문으로 대체하지 않는다.
- 계획 노드 개수와 실제 비용·기간은 다르다. 정액 소요 기간·무제한 계정 사용·운영 성능을 약속하지 않는다. 사용량/외부 실행의 미확정 결과는 중복 제출하지 않는다.

## 공통 완료 판정

개발 delivery, 실제 기기/provider qualification, 사용자 화면/작품 수용, 운영 release를 분리한다. 각 근거는 해당 source·contract/profile·environment·artifact에 연결한다. 필요한 실제 환경이 없으면 UNQUALIFIED 또는 PENDING으로 남긴다. 계획 문서의 존재·PR 생성·합성 테스트 성공은 제품 완료가 아니다.

## 신규 작업 상세

### c-workspace-design — 구매자·주최자·운영자의 전체 제품 흐름 설계

**배치:** schema-v1 로컬 후보 · **선행:** w6a-evidence, organizer-admin-console · **검토:** A3/ARCHITECTURE

목표: 개별 stub 화면을 사용자가 이해할 수 있는 역할별 작업 공간으로 묶는다.

작업 묶음: 통합 제품 UX

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. 발견→선택→예약→결제 상태→권리→입장→환불 흐름을 매핑한다
2. 주최자의 공연/재고/판매/정산과 운영자의 예외 처리를 연결한다
3. 기존 command-bound UI와 미연결 기능의 표시 규칙을 설계한다

필수 산출물:
- 전체 information architecture와 상태별 화면 계약
- 기능/프로토콜 command/작업 ID 대응표

완료 판정/실패 검증:
1. 예약·결제·발행·입장이 한 개의 완료 배지로 합쳐지지 않는다
2. 존재하지 않는 producer 기능을 실제로 동작한다고 표시하지 않는다
3. 승인된 명세 내 보통 UX 선택은 사용자 재질문 없이 결정한다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

### c-buyer-workspace — 예매·보유 권리·리셀·선물의 구매자 작업실

**배치:** schema-v1 로컬 후보 · **선행:** c-workspace-design, w6a-ui-skeleton, gift-surface · **검토:** A2/NONE

목표: 현재 지원 계약과 receipt 안에서 다음에 할 수 있는 행동을 보여준다.

작업 묶음: 통합 제품 UX

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. 선택/예약/주문/권리의 진행과 각 만료·거절 이유를 표시한다
2. 내가 가진 ticket/선물/거래의 실제 근거를 연결한다
3. blank/error/loading/unsupported 상태의 복귀 동작을 제공한다

필수 산출물:
- 구매자 화면과 모바일 navigation
- 성공·거절·UNKNOWN·NOT_BOUND stub 여정

완료 판정/실패 검증:
1. stub 상태는 모든 핵심 화면에서 식별된다
2. UI 성공 애니메이션이 receipt보다 먼저 확정을 알리지 않는다
3. 새로고침 후 미확정 작업을 자동 재실행하지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

### c-organizer-workspace — 주최자 공연·재고·판매의 명확한 관리 흐름

**배치:** schema-v1 로컬 후보 · **선행:** c-workspace-design, organizer-admin-console · **검토:** A2/NONE

목표: 기존 명령으로 행사 준비와 판매 상태를 쉽게 점검한다.

작업 묶음: 통합 제품 UX

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. 공연 lifecycle·수량·일정·권한의 현재 지원 필드를 편집한다
2. 대량 변경은 지원 명령별 미리보기와 개별 결과로 표시한다
3. 아직 없는 read/정산/실자금 기능은 미연결로 남긴다

필수 산출물:
- 주최자 편집·변경 미리보기 UI
- 부분 거절·stale selection·권한 부족 시나리오

완료 판정/실패 검증:
1. 여러 명령을 원자 거래라고 표시하지 않는다
2. 같은 제출을 더블클릭으로 중복 송신하지 않는다
3. client 계산 재고가 protocol 권위를 대신하지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

### c-receipt-explorer — receipt·원인·다음 행동의 설명 가능한 조회

**배치:** schema-v1 로컬 후보 · **선행:** c-buyer-workspace, c-organizer-workspace · **검토:** A2/NONE

목표: 사용자와 지원 담당자가 작업이 멈춘 이유를 같은 근거로 이해한다.

작업 묶음: 통합 제품 UX

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. 이미 받은 receipt의 operation/상태/source/profile을 역할에 맞춰 표시한다
2. 오류 code를 정확한 행동·미확인 이유와 연결한다
3. 민감정보를 가린 문의용 진단 패키지를 만든다

필수 산출물:
- receipt 상세·흐름 연표·지원용 export
- malformed receipt/다른 actor/context 거절 tests

완료 판정/실패 검증:
1. 설명용 read가 UNKNOWN을 확정으로 바꾸지 않는다
2. 토큰·개인정보·계좌 원문이 진단에 무단 포함되지 않는다
3. 한 사용자 receipt가 다른 session 화면에 섞이지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

### c-discovery-prototype — 공연·매물 발견과 검색의 대규모 UI fixture

**배치:** schema-v1 로컬 후보 · **선행:** c-workspace-design · **검토:** A2/NONE

목표: 조회 API가 준비되기 전에 제품 탐색 UX를 합성 자료로 구체화한다.

작업 묶음: 통합 제품 UX

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. 검색/필터/정렬/페이지/가상화의 화면 모델을 기존 stub에 둔다
2. 행사 상세·좌석/GA·매물의 표시 차이를 드러낸다
3. 빈 결과·필터 충돌·stale 가격·취소된 행사를 포함한다

필수 산출물:
- 합성 발견/검색 화면과 fixture
- 검색→상세→지원된 구매 흐름 연결

완료 판정/실패 검증:
1. 합성 수량·가격·리셀 매물이 실제 데이터처럼 표시되지 않는다
2. 프런트 페이지 전체에 백만 항목을 적재하지 않는다
3. 새 producer query를 UI 내부 fetch로 몰래 만들지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

### c-accessibility-baseline — 키보드·모바일·금액·시간 표현 품질

**배치:** schema-v1 로컬 후보 · **선행:** c-buyer-workspace, c-organizer-workspace, c-discovery-prototype · **검토:** A2/NONE

목표: 누구나 오류를 이해하고 핵심 거래 화면을 조작할 수 있다.

작업 묶음: 제품 품질

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. 금액/수량/시간대/기한 표시를 계약 의미와 일치시킨다
2. 키보드·터치·focus·스크린리더·확대 경로를 점검한다
3. 로딩/차단/선택/검수 상태를 색상 외 의미로 제공한다

필수 산출물:
- 공통 UI 구성과 접근성 수정
- 실제 브라우저 keyboard/mobile journey 증거

완료 판정/실패 검증:
1. 금액을 JS 부동소수점으로 새로 계산하지 않는다
2. 시간 표시 locale 변경이 예약 만료 권위를 바꾸지 않는다
3. 오류 후 입력·선택·focus가 복귀한다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

### c-contract-fixture-library — 지원 화면별 정상·거절·미확정 fixture 라이브러리

**배치:** schema-v1 로컬 후보 · **선행:** c-receipt-explorer, c-accessibility-baseline · **검토:** A2/NONE

목표: 화면과 adapter가 계약 변화에 함께 실패하도록 검증 자료를 유지한다.

작업 묶음: 제품 품질

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. 현재 tuple의 성공/reject/UNKNOWN/NOT_BOUND/STALE 사례를 분류한다
2. UI·adapter 테스트가 같은 fixture 출처를 참조한다
3. invalid/새 enum/누락 필드·다른 identity를 거절한다

필수 산출물:
- versioned fixture catalogue와 매핑 표
- adapter/UI 계약 회귀

완료 판정/실패 검증:
1. 실패한 live 호출을 stub 성공으로 대체하지 않는다
2. 이전 fixture PASS를 다른 tuple 검증으로 쓰지 않는다
3. finance/권리 계산을 fixture generator가 운영 구현처럼 제공하지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

### c-local-workspace-closeout — 통합 작업실 로컬 인계와 설치 안내

**배치:** schema-v1 로컬 후보 · **선행:** c-contract-fixture-library, c-organizer-workspace, c-discovery-prototype · **검토:** A2/NONE

목표: 현재 사용 가능한 로컬 경험과 실제 연결이 필요한 범위를 정확히 전달한다.

작업 묶음: 제품 품질

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. first run·stub mode·loopback 연결·오류 진단을 문서화한다
2. 지원 command와 미연결 화면·pending producer를 표로 만든다
3. 전체 역할 여정과 브라우저 evidence를 제공한다

필수 산출물:
- 로컬 제품 인계 packet
- 기능별 실제 연결/합성/미지원 현황

완료 판정/실패 검증:
1. 화면이 존재한다는 이유만으로 protocol integration을 완료 처리하지 않는다
2. 기존 original10 노드의 증거를 보존한다
3. 공개 서비스·실결제·실제 검표 완료를 주장하지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

### c-discovery-live — 현재성 있는 공연·권리·매물 검색 연결

**배치:** pending catalogue · **선행:** c-discovery-prototype, bind-list-read, c-journey-identity · **검토:** A2/NONE

목표: 화면의 검색과 상세를 정확한 producer read 계약에 연결한다.

작업 묶음: 전체 거래 플랫폼

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. bounded cursor·filter·watermark·access scope를 adapter에서 검증한다
2. gap/stale/cursor invalid를 사용자 복귀 동작으로 연결한다
3. 현재 조회와 거래 command 재검증의 경계를 유지한다

필수 산출물:
- 실제 SDK 기반 검색/상세 연결
- 중복/역순/재구축/tenant 혼합 browser tests

완료 판정/실패 검증:
1. 검색 결과만으로 판매 가능·소유·결제 완료를 확정하지 않는다
2. 백만 건을 한 요청으로 내려받지 않는다
3. 변경된 projection tuple이 호출 전에 검출된다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

승격 조건: 현재 producer의 실제 채택 소스·SDK/manifest·외부 선행 완료를 확인하고 지원 reader 또는 별도 승인된 계획 개정으로 승격한다. 합성/loopback과 실제 서비스 자격을 구분한다. 이 항목은 pending catalogue이며 현재 schema-v1 dispatch 대상이 아니다. depends_on_external을 spec 문장으로 바꾸거나 삭제하여 우회하지 않는다.

외부 선행: BeautifulMind-JT/kix-protocol / kix/ps-05-query-projections

### c-inventory-venue — 좌석·GA·공연 입장 범위의 대규모 선택

**배치:** pending catalogue · **선행:** c-discovery-live, bind-reservation-fsm, bind-admission-fsm · **검토:** A2/NONE

목표: 대규모 행사에서도 실제 지원 inventory mode에 맞춰 권리를 선택한다.

작업 묶음: 전체 거래 플랫폼

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. 요약→페이지→선택 상세의 흐름과 명시적 refresh를 제공한다
2. 예약 만료·다른 세대·queue admission 상태를 표시한다
3. accessibility 좌석 등 미정 정책은 미지원으로 둔다

필수 산출물:
- 대규모 좌석/GA 선택 화면
- hot page·stale hold·mode mismatch tests

완료 판정/실패 검증:
1. GA 수량을 특정 좌석 소유로 표시하지 않는다
2. queue 입장이 결제/권리 발행으로 표시되지 않는다
3. 화면상 빈 좌석을 경제 writer 승인 없이 확정하지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

승격 조건: 현재 producer의 실제 채택 소스·SDK/manifest·외부 선행 완료를 확인하고 지원 reader 또는 별도 승인된 계획 개정으로 승격한다. 합성/loopback과 실제 서비스 자격을 구분한다. 이 항목은 pending catalogue이며 현재 schema-v1 dispatch 대상이 아니다. depends_on_external을 spec 문장으로 바꾸거나 삭제하여 우회하지 않는다.

외부 선행: BeautifulMind-JT/kix-protocol / kix/ps-05-query-projections, BeautifulMind-JT/kix-protocol / kix/ps-06-admission-load

### c-platform-journey — 다중 채널 구매·리셀·환불의 통합 연결

**배치:** pending catalogue · **선행:** c-inventory-venue, bind-resale-fsm, refund-surface, c-async-session-fence · **검토:** A2/NONE

목표: 플랫폼 규모에서도 receipt를 따라 하나의 거래 결과를 끝까지 추적한다.

작업 묶음: 전체 거래 플랫폼

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. 다중 매물·가격 변경·권리 양도·결제 관측·이전의 identity를 연결한다
2. UNKNOWN/late result 동안 새 쓰기를 차단한다
3. 부분 실패·환불·원권리 상태를 함께 설명한다

필수 산출물:
- producer SDK 기반 거래 adapter와 UI
- 동시 체결·지급 유실·stale session E2E

완료 판정/실패 검증:
1. 같은 권리의 두 채널 체결 경쟁에서 UI가 두 성공을 만들지 않는다
2. client retry로 새로운 결제 효과를 만들지 않는다
3. 예매/결제/발행/환불 상태를 독립 관측한다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

승격 조건: 현재 producer의 실제 채택 소스·SDK/manifest·외부 선행 완료를 확인하고 지원 reader 또는 별도 승인된 계획 개정으로 승격한다. 합성/loopback과 실제 서비스 자격을 구분한다. 이 항목은 pending catalogue이며 현재 schema-v1 dispatch 대상이 아니다. depends_on_external을 spec 문장으로 바꾸거나 삭제하여 우회하지 않는다.

외부 선행: BeautifulMind-JT/kix-protocol / kix/ps-03-resale-contract, BeautifulMind-JT/kix-protocol / kix/ps-04-execution-partitions, BeautifulMind-JT/kix-protocol / kix/ps-05-query-projections

### c-merchant-operations — 주최자·판매자의 실제 매출·권리·정산 작업실

**배치:** pending catalogue · **선행:** c-organizer-workspace, c-finance-projection, c-discovery-live · **검토:** A2/NONE

목표: 주최자가 판매와 금융 상태의 출처·차이를 이해하고 예외를 처리한다.

작업 묶음: 전체 거래 플랫폼

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. 행사/매물/거래/정산 의무별 read model을 연결한다
2. 미지급·보류·환불 부담과 source cut을 표시한다
3. 내보내기를 일관성 있는 producer export에 연결한다

필수 산출물:
- 판매자 운영 화면과 current export
- stale aggregate/불일치/권한 거절 tests

완료 판정/실패 검증:
1. 매출을 정산 완료나 가용 대출 재원으로 표시하지 않는다
2. 클라이언트 합계가 금융 정본이 되지 않는다
3. source cut이 다른 수치를 한 확정 잔액으로 합치지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

승격 조건: 현재 producer의 실제 채택 소스·SDK/manifest·외부 선행 완료를 확인하고 지원 reader 또는 별도 승인된 계획 개정으로 승격한다. 합성/loopback과 실제 서비스 자격을 구분한다. 이 항목은 pending catalogue이며 현재 schema-v1 dispatch 대상이 아니다. depends_on_external을 spec 문장으로 바꾸거나 삭제하여 우회하지 않는다.

외부 선행: BeautifulMind-JT/kix-protocol / kix/fin-catalogue-read-model, BeautifulMind-JT/kix-protocol / kix/ps-05-query-projections

### c-credit-origination — 여신 신청·채권 근거·심사·약정·인출 UI

**배치:** pending catalogue · **선행:** bind-credit-fsm, c-finance-projection, c-journey-identity · **검토:** A2/NONE

목표: 사업자 선지급의 자료 제출과 판단 상태를 하나의 여정으로 연결한다.

작업 묶음: 전체 거래 플랫폼

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. 채권 근거/부담·정책 revision·동의·자료 만료를 표시한다
2. 조건부/추가자료/거절/승인·약정/인출 권한을 구분한다
3. 심사 이유와 수정·재검토 경로를 제공한다

필수 산출물:
- 여신 신청/약정/인출 화면
- stale policy/동의 철회/한도 경쟁 fixtures

완료 판정/실패 검증:
1. 신청 완료나 AI 설명을 심사 승인으로 표시하지 않는다
2. UI가 금리·한도·상환표를 임의 계산하지 않는다
3. current producer tuple이 없으면 NOT_BOUND다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

승격 조건: 현재 producer의 실제 채택 소스·SDK/manifest·외부 선행 완료를 확인하고 지원 reader 또는 별도 승인된 계획 개정으로 승격한다. 합성/loopback과 실제 서비스 자격을 구분한다. 이 항목은 pending catalogue이며 현재 schema-v1 dispatch 대상이 아니다. depends_on_external을 spec 문장으로 바꾸거나 삭제하여 우회하지 않는다.

외부 선행: BeautifulMind-JT/kix-protocol / kix/cr-08-producer-sdk

### c-credit-servicing-journey — 지급·상환·연체·회수의 사용자/운영자 여정

**배치:** pending catalogue · **선행:** c-credit-origination, c-async-session-fence, c-finance-projection · **검토:** A2/NONE

목표: 지급이 불명확하거나 연체·후기 입금이 생겨도 사실을 추적한다.

작업 묶음: 전체 거래 플랫폼

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. draw 지시/지급 관측/예약/노출을 별도 표시한다
2. 상환표·입금 배분·미배분·reversal·조정·case 이력을 연결한다
3. actor별 조회/제안/승인의 분리를 유지한다

필수 산출물:
- 여신 servicing/운영 desk와 사건 연표
- UNKNOWN/부분 상환/상각 후 입금 E2E

완료 판정/실패 검증:
1. 부분 repay가 자동으로 약정 한도를 복원했다고 표시하지 않는다
2. 상각·회수 case 종결이 채무 소멸로 혼동되지 않는다
3. 실제 연락·추심·지급을 화면 테스트가 수행하지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

승격 조건: 현재 producer의 실제 채택 소스·SDK/manifest·외부 선행 완료를 확인하고 지원 reader 또는 별도 승인된 계획 개정으로 승격한다. 합성/loopback과 실제 서비스 자격을 구분한다. 이 항목은 pending catalogue이며 현재 schema-v1 dispatch 대상이 아니다. depends_on_external을 spec 문장으로 바꾸거나 삭제하여 우회하지 않는다.

외부 선행: BeautifulMind-JT/kix-protocol / kix/cr-08-producer-sdk

### c-finance-operations — 정산·환불·대사·회계 export 운영 경험

**배치:** pending catalogue · **선행:** c-merchant-operations, c-credit-servicing-journey, refund-surface · **검토:** A2/NONE

목표: 불일치 사건을 원 거래와 연결해 재무 담당자가 검토한다.

작업 묶음: 전체 거래 플랫폼

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. 미대사·중복 관측·late fact·다중 수취인·잔여 배분을 설명한다
2. 현재성 있는 query와 consistent export를 연결한다
3. 정정 제안과 실제 경제 상태 변경 권한을 구분한다

필수 산출물:
- 대사/예외 큐·회계 export 화면
- balance mismatch/다른 source cut/권한 fixtures

완료 판정/실패 검증:
1. 사용자 확인 버튼으로 원장을 강제로 맞추지 않는다
2. export의 synthetic/실제 scope를 명확히 한다
3. 합계·잔여·배분 값은 producer 결과를 그대로 소비한다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

승격 조건: 현재 producer의 실제 채택 소스·SDK/manifest·외부 선행 완료를 확인하고 지원 reader 또는 별도 승인된 계획 개정으로 승격한다. 합성/loopback과 실제 서비스 자격을 구분한다. 이 항목은 pending catalogue이며 현재 schema-v1 dispatch 대상이 아니다. depends_on_external을 spec 문장으로 바꾸거나 삭제하여 우회하지 않는다.

외부 선행: BeautifulMind-JT/kix-protocol / kix/fin-catalogue-read-model, BeautifulMind-JT/kix-protocol / kix/cr-08-producer-sdk

### c-marketing-journey — 멤버십·선예매·쿠폰·추천·동의의 제품 연결

**배치:** pending catalogue · **선행:** w7-m01-membership, w7-m02-presale, w7-m03-coupon, w7-m04-referral, w7-m05-consent-bind, c-platform-journey · **검토:** A2/NONE

목표: 팬 혜택이 실제 구매 흐름에 연결되면서 권한과 동의를 유지한다.

작업 묶음: 전체 거래 플랫폼

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. 자격/우선순위/사용 횟수/쿠폰 예산/추천 귀속을 producer에 결합한다
2. 취소·환불·혜택 회수와 중복 사용을 표시한다
3. M05 CRM 독립 범위와 동의 소비만 구분한다

필수 산출물:
- 혜택 발견→적용→거절→회수 사용자 여정
- 동의 철회/혜택 중복/stale eligibility E2E

완료 판정/실패 검증:
1. 혜택 안내가 구입 확정이나 보상을 지급하지 않는다
2. 동의 철회 뒤 새 마케팅 권한을 재사용하지 않는다
3. 전체 CRM 제품을 계약 없는 UI stub으로 완료 처리하지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

승격 조건: 현재 producer의 실제 채택 소스·SDK/manifest·외부 선행 완료를 확인하고 지원 reader 또는 별도 승인된 계획 개정으로 승격한다. 합성/loopback과 실제 서비스 자격을 구분한다. 이 항목은 pending catalogue이며 현재 schema-v1 dispatch 대상이 아니다. depends_on_external을 spec 문장으로 바꾸거나 삭제하여 우회하지 않는다.

외부 선행: BeautifulMind-JT/kix-protocol / kix/wave7-marketing-contracts

### c-delegated-assistant — 사용자 위임 범위 안의 거래 보조 에이전트

**배치:** pending catalogue · **선행:** delegation-surface, c-platform-journey, c-receipt-explorer · **검토:** A3/ARCHITECTURE

목표: 자연어 요청을 현재 권한 안의 조회·제안·승인된 명령으로 연결한다.

작업 묶음: 전체 거래 플랫폼

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. scope·기한·대상·예산·허용 동작을 구조화한다
2. proposal과 실제 실행 승인을 별도 표시한다
3. revoke/stale grant/명령 유실을 현재 protocol과 대사한다

필수 산출물:
- 위임 보조 UI와 좁은 adapter 도구
- prompt injection/범위 초과/철회 뒤 실행 tests

완료 판정/실패 검증:
1. LLM 문장이 자금·권리 실행 권한으로 승격되지 않는다
2. 모호한 목표에서 새 위험 권한을 추정하지 않는다
3. 미채택 실행 위임은 query/propose 모드에 머문다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

승격 조건: 현재 producer의 실제 채택 소스·SDK/manifest·외부 선행 완료를 확인하고 지원 reader 또는 별도 승인된 계획 개정으로 승격한다. 합성/loopback과 실제 서비스 자격을 구분한다. 이 항목은 pending catalogue이며 현재 schema-v1 dispatch 대상이 아니다. depends_on_external을 spec 문장으로 바꾸거나 삭제하여 우회하지 않는다.

외부 선행: BeautifulMind-JT/kix-protocol / kix/ai-delegation-execution-decision, BeautifulMind-JT/kix-protocol / kix/k-authority-qualification

### c-tenant-permissions — 조직·역할·민감정보·감사 권한

**배치:** pending catalogue · **선행:** c-merchant-operations, c-finance-operations · **검토:** A3/ARCHITECTURE

목표: 구매자·주최자·정산 담당자·지원 담당자의 접근과 실행을 분리한다.

작업 묶음: 전체 거래 플랫폼

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. tenant/actor/role/resource scope를 SDK 경계에 결합한다
2. maker/checker·권한 철회·계좌 변경·민감 export를 연결한다
3. UI 숨김과 서버 권한 검증을 별도로 시험한다

필수 산출물:
- 역할별 작업 공간·권한 adapter
- tenant 혼합/권한 상승/stale role tests

완료 판정/실패 검증:
1. URL 직접 접근·캐시·export로 다른 조직 자료가 새지 않는다
2. 같은 사용자의 역할 전환이 옛 session 결과를 섞지 않는다
3. UI 버튼 숨김만으로 권한이 구현됐다고 주장하지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

승격 조건: 현재 producer의 실제 채택 소스·SDK/manifest·외부 선행 완료를 확인하고 지원 reader 또는 별도 승인된 계획 개정으로 승격한다. 합성/loopback과 실제 서비스 자격을 구분한다. 이 항목은 pending catalogue이며 현재 schema-v1 dispatch 대상이 아니다. depends_on_external을 spec 문장으로 바꾸거나 삭제하여 우회하지 않는다.

외부 선행: BeautifulMind-JT/kix-protocol / kix/k-operator-contract

### c-notification-inbox — 거래 알림·다음 행동·지원 문의 흐름

**배치:** pending catalogue · **선행:** c-tenant-permissions, c-receipt-explorer · **검토:** A3/ARCHITECTURE

목표: 사용자가 지금 확인해야 할 사건을 중복·오인 없이 이해한다.

작업 묶음: 전체 거래 플랫폼

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. producer가 계약한 사건만 알림 inbox로 투영한다
2. dedupe·읽음·현재성·민감정보 표시와 알림 권한을 정의한다
3. 알림에서 현재 권위 조회/지원 자료로 이동한다

필수 산출물:
- in-app 알림/문의 자료 UI
- 늦은/중복/다른 tenant/권한 철회 알림 tests

완료 판정/실패 검증:
1. 알림 도착을 경제 효과 확정으로 사용하지 않는다
2. 미채택 외부 발송·제공자 API를 자동 연결하지 않는다
3. 오래된 알림의 action이 현재 세대 검사를 건너뛰지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

승격 조건: 현재 producer의 실제 채택 소스·SDK/manifest·외부 선행 완료를 확인하고 지원 reader 또는 별도 승인된 계획 개정으로 승격한다. 합성/loopback과 실제 서비스 자격을 구분한다. 이 항목은 pending catalogue이며 현재 schema-v1 dispatch 대상이 아니다. depends_on_external을 spec 문장으로 바꾸거나 삭제하여 우회하지 않는다.

외부 선행: BeautifulMind-JT/kix-protocol / kix/k-operator-contract

### c-marketplace-performance — 대형 마켓플레이스 화면·경합·접근성 실측

**배치:** pending catalogue · **선행:** c-platform-journey, c-marketing-journey, c-notification-inbox · **검토:** A2/NONE

목표: 큰 데이터와 집중 접속에서도 핵심 거래 흐름을 검증한다.

작업 묶음: 전체 거래 플랫폼

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. bounded read·virtualization·취소·stale response·메모리 분모를 고정한다
2. slow network/대기열/권한 변경/중복 탭의 사용자 여정을 실행한다
3. 실제 장치별 지연과 오류·UNKNOWN을 함께 보고한다

필수 산출물:
- 브라우저/장치·workload별 성능 및 accessibility 결과
- hot page/빠른 검색 전환/queue expiry E2E

완료 판정/실패 검증:
1. 데스크톱 에뮬레이션을 실제 모바일 근거로 표시하지 않는다
2. 빠른 UI가 stale 가격이나 권리를 확정하지 않는다
3. producer 부하 시험과 브라우저 실측의 분모를 혼합하지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

승격 조건: 현재 producer의 실제 채택 소스·SDK/manifest·외부 선행 완료를 확인하고 지원 reader 또는 별도 승인된 계획 개정으로 승격한다. 합성/loopback과 실제 서비스 자격을 구분한다. 이 항목은 pending catalogue이며 현재 schema-v1 dispatch 대상이 아니다. depends_on_external을 spec 문장으로 바꾸거나 삭제하여 우회하지 않는다.

외부 선행: BeautifulMind-JT/kix-protocol / kix/ps-07-scale-qualification

### c-provider-connected-journey — 승인 sandbox의 결제·발행·환불 연결

**배치:** pending catalogue · **선행:** c-platform-journey, c-finance-operations · **검토:** A2/NONE

목표: 실제 승인된 테스트 제공자 범위에서 사용자 여정의 연결을 확인한다.

작업 묶음: 전체 거래 플랫폼

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. sandbox/production 배너와 계정·환경 검사를 강제한다
2. 결제 redirect/return/관측·권리 발행·환불을 receipt로 연결한다
3. 사용자 이탈·응답 유실·이중 탭·지연 결과를 검증한다

필수 산출물:
- 실제 sandbox E2E와 환경 evidence
- provider 오류/late callback/UNKNOWN 복귀 보고서

완료 판정/실패 검증:
1. 결제 return URL만으로 성공 처리하지 않는다
2. 테스트 계정·제공자 자격 없이는 합성으로 명시한다
3. sandbox 성공이 실결제·실제 검표 권한을 만들지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

승격 조건: 현재 producer의 실제 채택 소스·SDK/manifest·외부 선행 완료를 확인하고 지원 reader 또는 별도 승인된 계획 개정으로 승격한다. 합성/loopback과 실제 서비스 자격을 구분한다. 이 항목은 pending catalogue이며 현재 schema-v1 dispatch 대상이 아니다. depends_on_external을 spec 문장으로 바꾸거나 삭제하여 우회하지 않는다.

외부 선행: BeautifulMind-JT/kix-protocol / kix/k-provider-sandbox, BeautifulMind-JT/kix-protocol / kix/k-authority-qualification

### c-installable-mobile — 모바일 설치·세션 복귀·연결 단절 UX

**배치:** pending catalogue · **선행:** c-marketplace-performance, c-provider-connected-journey · **검토:** A3/ARCHITECTURE

목표: 사용자 기기에서 설치와 재방문이 쉬우면서 오래된 권리를 오용하지 않는다.

작업 묶음: 전체 거래 플랫폼

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. 설치형 웹/모바일 포장의 지원 범위와 업데이트를 결정한다
2. cached read와 current authority를 구분한다
3. 네트워크 단절·재로그인·앱 resume·device time 차이를 처리한다

필수 산출물:
- 설치/업데이트/재접속 사용자 흐름
- 실제 모바일 복귀·오프라인·stale session tests

완료 판정/실패 검증:
1. 오프라인 QR/보관 화면이 실제 입장 권한을 새로 만들지 않는다
2. 기기 시계가 protocol 만료 권위를 대신하지 않는다
3. 앱 복귀가 미확정 결제·인출을 재실행하지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

승격 조건: 현재 producer의 실제 채택 소스·SDK/manifest·외부 선행 완료를 확인하고 지원 reader 또는 별도 승인된 계획 개정으로 승격한다. 합성/loopback과 실제 서비스 자격을 구분한다. 이 항목은 pending catalogue이며 현재 schema-v1 dispatch 대상이 아니다. depends_on_external을 spec 문장으로 바꾸거나 삭제하여 우회하지 않는다.

### c-platform-operational-qualification — 플랫폼·금융·마케팅 전체 실사용 준비 검증

**배치:** pending catalogue · **선행:** commerce-integration-closeout, c-local-workspace-closeout, c-credit-servicing-journey, c-finance-operations, c-marketing-journey, c-delegated-assistant, c-tenant-permissions, c-notification-inbox, c-marketplace-performance, c-provider-connected-journey, c-installable-mobile · **검토:** A2/NONE

목표: 구매자와 운영자의 전체 여정을 같은 producer tuple과 실제 scope로 닫는다.

작업 묶음: 전체 거래 플랫폼

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. 정상/거절/STALE/UNKNOWN/취소/환불/복구/권한 철회를 종합 실행한다
2. source·장치·제공자·권리·금융 미해결을 별도 분모로 보고한다
3. 운영 지원·장애 인계·현재 UI 검수 자료를 묶는다

필수 산출물:
- 통합 qualification packet과 실제 사용자 검수 후보
- scope별 기능/성능/보안/환경 evidence

완료 판정/실패 검증:
1. 모든 API의 개별 성공을 종단 여정 성공으로 대신하지 않는다
2. 후기 결과와 actor 전환 중 identity 누수가 없다
3. qualification이 공개 배포·실자금 승인으로 승격되지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

승격 조건: 현재 producer의 실제 채택 소스·SDK/manifest·외부 선행 완료를 확인하고 지원 reader 또는 별도 승인된 계획 개정으로 승격한다. 합성/loopback과 실제 서비스 자격을 구분한다. 이 항목은 pending catalogue이며 현재 schema-v1 dispatch 대상이 아니다. depends_on_external을 spec 문장으로 바꾸거나 삭제하여 우회하지 않는다.

외부 선행: BeautifulMind-JT/kix-protocol / kix/ps-07-scale-qualification, BeautifulMind-JT/kix-protocol / kix/cr-10-credit-qualification

### c-platform-release — 커머스 제품 최종 검수·운영 인계

**배치:** pending catalogue · **선행:** c-platform-operational-qualification · **검토:** A3/RELEASE

목표: 검증한 실제 범위의 설치·공개·운영 결정을 사용자에게 제시한다.

작업 묶음: 출시와 운영

설계 근거: README.md; docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md; docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md

구현 범위:
1. producer/consumer current source·배포 artifact·설정 tuple을 고정한다
2. 지원·장애·개인정보·접근성·업데이트/되돌리기 인계를 준비한다
3. 범위 연기와 미해결 사항을 최종 분모에 남긴다

필수 산출물:
- release candidate와 사용자 검수 패키지
- 운영 checklist·지원/업데이트 안내

완료 판정/실패 검증:
1. 현재 소스와 다른 UI/계약의 승인을 재사용하지 않는다
2. 실제 사용자 수용과 기술 qualification을 구분한다
3. User RELEASE 결정 전 공개·실자금·실제 운영을 시작하지 않는다

공통 경계: 프로토콜 계산을 UI에 복제하지 않는다. 기본 stub, 명시적 loopback, 1회 요청, UNKNOWN/NOT_BOUND/STALE 분리를 유지한다. 미채택 retry·Idempotency-Key·공개 proxy·UI 직접 fetch를 추가하지 않는다. producer 변경을 소비할 때 두 OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA·protocolMergeSha와 SDK/manifest/vector tuple을 함께 검증한다. 실결제·여신 지급·현장 검표·공개 서비스는 별도 권한이다.

증거/인계: 실제 변경 파일·실행 명령·성공 및 실패 사례·정확한 소스 SHA를 PR에 남긴다. 기존 충분한 coverage는 재사용하고 새 gap만 검증한다. UI 변경은 실제 브라우저의 정상/빈 값/오류/진행 중 화면과 키보드 동작을 확인한다. 실환경 부재는 미검증으로 남긴다. 독립 검토 지적과 CI 실패는 같은 소유자가 수정하고 변경 HEAD를 다시 검토한다. 일반 구현 선택은 자율 결정하며 계정·중요 계약·실사용 승인만 구체적인 결정을 요청한다.

승격 조건: 상세 계약 채택·정확한 소스의 독립 검토·범위별 실제 환경 자격 확인 뒤 계획 개정으로 승격한다. 이 항목은 pending catalogue이며 현재 schema-v1 dispatch 대상이 아니다. depends_on_external을 spec 문장으로 바꾸거나 삭제하여 우회하지 않는다.

외부 선행: BeautifulMind-JT/kix-protocol / kix/k-platform-release

## 2026-10-02 대규모·여신 설계 출처

- [권리 확장 #84](https://github.com/BeautifulMind-JT/kix-protocol/pull/84), [플랫폼 규모 #85](https://github.com/BeautifulMind-JT/kix-protocol/pull/85), [여신 lifecycle #86](https://github.com/BeautifulMind-JT/kix-protocol/pull/86)는 관측 시 미병합 후보다.
- 읽은 합성 설계 source: `0846e4ddf1d55cc4ac619e2c350c4e3574547bda`. [플랫폼 상세](https://github.com/BeautifulMind-JT/kix-protocol/blob/0846e4ddf1d55cc4ac619e2c350c4e3574547bda/docs/blueprints/platform-scale-v1/README.md), [여신 상세](https://github.com/BeautifulMind-JT/kix-protocol/blob/0846e4ddf1d55cc4ac619e2c350c4e3574547bda/docs/blueprints/credit-lifecycle-v1/README.md).
- PS/CR 추적 ID를 새 노드에 대응하되 기존 RS/Finance/F04 구현을 새로 완성된 것으로 세지 않는다. producer→consumer→통합검증 방향을 유지하고 최종 closeout을 producer 자체의 선행으로 역참조하지 않는다.

## 전체 작업 색인

| ID | 작업 | 배치 | 선행 |
|---|---|---|---|
| w6a-journey-map | Wave 6-A step 1: map one receipt-chained mock booking journey onto published commands | local candidate | 없음 |
| w6a-journey-adapter | Wave 6-A step 2: adapter helper that composes the approved journey | local candidate | w6a-journey-map |
| w6a-journey-test | Wave 6-A step 3: live-gate journey test and stub parity | local candidate | w6a-journey-adapter |
| w6a-ui-skeleton | Wave 6-A step 4: booking and box-office screens show the journey | local candidate | w6a-journey-adapter |
| w6a-evidence | Wave 6-A step 5: binding table, docs and the alignment evidence that opens Wave 7 | local candidate | w6a-journey-test, w6a-ui-skeleton |
| organizer-admin-console | Organizer console for event lifecycle commands | local candidate | w6a-evidence |
| gift-surface | Gift transfer surface (offer, accept, cancel) | local candidate | w6a-journey-adapter |
| doc-m05-label | Correct the M05 status label to the ORIGINAL_32 source | local candidate | 없음 |
| w7-marketing-align | Wave 7: align the M01-M05 stub surfaces with the published contracts | local candidate | w6a-evidence |
| w7-m05-consent-bind | Wave 7 M05: bind consent to set_consent and authorize_marketing | local candidate | w7-marketing-align, w6a-journey-adapter |
| c-workspace-design | 구매자·주최자·운영자의 전체 제품 흐름 설계 | local candidate | w6a-evidence, organizer-admin-console |
| c-buyer-workspace | 예매·보유 권리·리셀·선물의 구매자 작업실 | local candidate | c-workspace-design, w6a-ui-skeleton, gift-surface |
| c-organizer-workspace | 주최자 공연·재고·판매의 명확한 관리 흐름 | local candidate | c-workspace-design, organizer-admin-console |
| c-receipt-explorer | receipt·원인·다음 행동의 설명 가능한 조회 | local candidate | c-buyer-workspace, c-organizer-workspace |
| c-discovery-prototype | 공연·매물 발견과 검색의 대규모 UI fixture | local candidate | c-workspace-design |
| c-accessibility-baseline | 키보드·모바일·금액·시간 표현 품질 | local candidate | c-buyer-workspace, c-organizer-workspace, c-discovery-prototype |
| c-contract-fixture-library | 지원 화면별 정상·거절·미확정 fixture 라이브러리 | local candidate | c-receipt-explorer, c-accessibility-baseline |
| c-local-workspace-closeout | 통합 작업실 로컬 인계와 설치 안내 | local candidate | c-contract-fixture-library, c-organizer-workspace, c-discovery-prototype |
| consume-p-sdk-0 | Consume the generated TypeScript 0.x client from kix-protocol | pending |  ; kix-protocol:p-sdk-0 |
| bind-settlement-fsm | Bind the settlement desk methods to the promoted catalogue | pending | consume-p-sdk-0, consume-p-sdk-1 ; kix-protocol:openapi-catalogue-promotion ; kix-protocol:contract-compatibility-profile |
| bind-reservation-fsm | Bind the reservation desk methods to the promoted catalogue | pending | consume-p-sdk-0, consume-p-sdk-1 ; kix-protocol:openapi-catalogue-promotion ; kix-protocol:contract-compatibility-profile |
| bind-admission-fsm | Bind the admission desk methods (including authorize and consume) | pending | consume-p-sdk-0, consume-p-sdk-1 ; kix-protocol:openapi-catalogue-promotion ; kix-protocol:contract-compatibility-profile |
| bind-resale-fsm | Bind the resale desk methods to the promoted catalogue | pending | consume-p-sdk-0, consume-p-sdk-1 ; kix-protocol:openapi-catalogue-promotion ; kix-protocol:contract-compatibility-profile |
| bind-credit-fsm | Bind the credit desk methods (mock only) | pending | consume-p-sdk-0, consume-p-sdk-1 ; kix-protocol:openapi-catalogue-promotion ; kix-protocol:contract-compatibility-profile |
| bind-wave4-pointers | Rebind the Wave 4 pointer methods onto published bodies | pending | w6a-journey-map, bind-reservation-fsm, bind-resale-fsm ; kix-protocol:contract-compatibility-profile |
| bind-list-read | Bind the list and read methods to the read-model queries | pending | consume-p-sdk-1 ; kix-protocol:read-model-reference ; kix-protocol:p-sdk-1 ; kix-protocol:contract-compatibility-profile |
| browser-gate-path | Browser HTTP path to the loopback gate, as kix-protocol decided | pending | w6a-ui-skeleton, consume-p-sdk-1 ; kix-protocol:gate-browser-access ; kix-protocol:contract-compatibility-profile |
| primary-price-fee-ui | Show the contracted primary price and fee | pending | w6a-ui-skeleton ; kix-protocol:move-primary-price-fee ; kix-protocol:contract-compatibility-profile |
| api-state-distinction | UI separates reservation, payment, issuance, return and refund states | pending | bind-reservation-fsm, bind-settlement-fsm ; kix-protocol:contract-compatibility-profile |
| refund-surface | Refund and cancel flows as synthetic mocks | pending | bind-settlement-fsm ; kix-protocol:contract-compatibility-profile |
| delegation-surface | Delegation surface: query and propose only | pending | consume-p-sdk-0 ; kix-protocol:ai-delegation-contract-mock ; kix-protocol:contract-compatibility-profile |
| w7-m01-membership | Wave 7 M01: membership surface on the membership contract | pending | w7-marketing-align ; kix-protocol:wave7-marketing-contracts ; kix-protocol:contract-compatibility-profile |
| w7-m02-presale | Wave 7 M02: presale surface on the presale contract | pending | w7-marketing-align, bind-reservation-fsm ; kix-protocol:wave7-marketing-contracts ; kix-protocol:contract-compatibility-profile |
| w7-m03-coupon | Wave 7 M03: coupon surface on the coupon contract | pending | w7-marketing-align, bind-reservation-fsm ; kix-protocol:wave7-marketing-contracts ; kix-protocol:contract-compatibility-profile |
| w7-m04-referral | Wave 7 M04: referral surface on the referral contract (no payout) | pending | w7-marketing-align ; kix-protocol:wave7-marketing-contracts ; kix-protocol:contract-compatibility-profile |
| e2e-browser-journeys | Browser end-to-end journeys across all surfaces | pending | browser-gate-path, api-state-distinction, bind-list-read, organizer-admin-console, bind-admission-fsm, bind-resale-fsm, bind-credit-fsm, gift-surface, bind-wave4-pointers ; kix-protocol:contract-compatibility-profile |
| consume-p-sdk-1 | Consume the regenerated SDK and immutable compatibility tuple for reads/FSMs | pending | consume-p-sdk-0 ; kix-protocol:p-sdk-1 ; kix-protocol:contract-compatibility-profile |
| c-journey-identity | Define and implement context-bound journey identity and read observation adapters | pending | consume-p-sdk-1, bind-list-read, api-state-distinction ; kix-protocol:protocol-runtime-boundary-register ; kix-protocol:protocol-canonical-identity-conformance ; kix-protocol:protocol-read-projection-evidence ; kix-protocol:contract-compatibility-profile |
| c-async-session-fence | Implement one-attempt outcome fencing and honest session recovery | pending | c-journey-identity, bind-reservation-fsm, bind-settlement-fsm, bind-admission-fsm, bind-resale-fsm ; kix-protocol:protocol-local-recovery-conformance ; kix-protocol:protocol-read-projection-evidence ; kix-protocol:contract-compatibility-profile |
| c-cross-surface-journeys | Compose complete non-production commerce and marketing journeys with adverse branches | pending | c-async-session-fence, bind-wave4-pointers, bind-credit-fsm, gift-surface, refund-surface, delegation-surface, organizer-admin-console, w7-m01-membership, w7-m02-presale, w7-m03-coupon, w7-m04-referral, w7-m05-consent-bind ; kix-protocol:contract-compatibility-profile |
| c-finance-projection | Consume the current Finance read contract for truthful reconciliation and export views | pending | c-journey-identity, bind-list-read, bind-settlement-fsm, bind-credit-fsm, primary-price-fee-ui ; kix-protocol:fin-catalogue-read-model ; kix-protocol:contract-compatibility-profile |
| c-accessibility-acceptance | Verify accessible full journeys and prepare current-UI User acceptance evidence | pending | c-cross-surface-journeys, c-finance-projection, browser-gate-path ; kix-protocol:contract-compatibility-profile |
| c-integrated-chaos-qualification | Qualify exact-mode commerce journeys under fault and restart boundaries | pending | c-async-session-fence, c-cross-surface-journeys, c-finance-projection, c-accessibility-acceptance, e2e-browser-journeys ; kix-protocol:protocol-local-recovery-conformance ; kix-protocol:contract-compatibility-profile |
| commerce-integration-closeout | Close the complete approved non-production commerce integration evidence | pending | w6a-journey-map, w6a-journey-adapter, w6a-journey-test, w6a-ui-skeleton, w6a-evidence, organizer-admin-console, gift-surface, doc-m05-label, w7-marketing-align, w7-m05-consent-bind, consume-p-sdk-0, bind-settlement-fsm, bind-reservation-fsm, bind-admission-fsm, bind-resale-fsm, bind-credit-fsm, bind-wave4-pointers, bind-list-read, browser-gate-path, primary-price-fee-ui, api-state-distinction, refund-surface, delegation-surface, w7-m01-membership, w7-m02-presale, w7-m03-coupon, w7-m04-referral, e2e-browser-journeys, consume-p-sdk-1, c-journey-identity, c-async-session-fence, c-cross-surface-journeys, c-finance-projection, c-accessibility-acceptance, c-integrated-chaos-qualification ; kix-protocol:contract-compatibility-profile |
| c-discovery-live | 현재성 있는 공연·권리·매물 검색 연결 | pending | c-discovery-prototype, bind-list-read, c-journey-identity ; kix-protocol:ps-05-query-projections |
| c-inventory-venue | 좌석·GA·공연 입장 범위의 대규모 선택 | pending | c-discovery-live, bind-reservation-fsm, bind-admission-fsm ; kix-protocol:ps-05-query-projections ; kix-protocol:ps-06-admission-load |
| c-platform-journey | 다중 채널 구매·리셀·환불의 통합 연결 | pending | c-inventory-venue, bind-resale-fsm, refund-surface, c-async-session-fence ; kix-protocol:ps-03-resale-contract ; kix-protocol:ps-04-execution-partitions ; kix-protocol:ps-05-query-projections |
| c-merchant-operations | 주최자·판매자의 실제 매출·권리·정산 작업실 | pending | c-organizer-workspace, c-finance-projection, c-discovery-live ; kix-protocol:fin-catalogue-read-model ; kix-protocol:ps-05-query-projections |
| c-credit-origination | 여신 신청·채권 근거·심사·약정·인출 UI | pending | bind-credit-fsm, c-finance-projection, c-journey-identity ; kix-protocol:cr-08-producer-sdk |
| c-credit-servicing-journey | 지급·상환·연체·회수의 사용자/운영자 여정 | pending | c-credit-origination, c-async-session-fence, c-finance-projection ; kix-protocol:cr-08-producer-sdk |
| c-finance-operations | 정산·환불·대사·회계 export 운영 경험 | pending | c-merchant-operations, c-credit-servicing-journey, refund-surface ; kix-protocol:fin-catalogue-read-model ; kix-protocol:cr-08-producer-sdk |
| c-marketing-journey | 멤버십·선예매·쿠폰·추천·동의의 제품 연결 | pending | w7-m01-membership, w7-m02-presale, w7-m03-coupon, w7-m04-referral, w7-m05-consent-bind, c-platform-journey ; kix-protocol:wave7-marketing-contracts |
| c-delegated-assistant | 사용자 위임 범위 안의 거래 보조 에이전트 | pending | delegation-surface, c-platform-journey, c-receipt-explorer ; kix-protocol:ai-delegation-execution-decision ; kix-protocol:k-authority-qualification |
| c-tenant-permissions | 조직·역할·민감정보·감사 권한 | pending | c-merchant-operations, c-finance-operations ; kix-protocol:k-operator-contract |
| c-notification-inbox | 거래 알림·다음 행동·지원 문의 흐름 | pending | c-tenant-permissions, c-receipt-explorer ; kix-protocol:k-operator-contract |
| c-marketplace-performance | 대형 마켓플레이스 화면·경합·접근성 실측 | pending | c-platform-journey, c-marketing-journey, c-notification-inbox ; kix-protocol:ps-07-scale-qualification |
| c-provider-connected-journey | 승인 sandbox의 결제·발행·환불 연결 | pending | c-platform-journey, c-finance-operations ; kix-protocol:k-provider-sandbox ; kix-protocol:k-authority-qualification |
| c-installable-mobile | 모바일 설치·세션 복귀·연결 단절 UX | pending | c-marketplace-performance, c-provider-connected-journey |
| c-platform-operational-qualification | 플랫폼·금융·마케팅 전체 실사용 준비 검증 | pending | commerce-integration-closeout, c-local-workspace-closeout, c-credit-servicing-journey, c-finance-operations, c-marketing-journey, c-delegated-assistant, c-tenant-permissions, c-notification-inbox, c-marketplace-performance, c-provider-connected-journey, c-installable-mobile ; kix-protocol:ps-07-scale-qualification ; kix-protocol:cr-10-credit-qualification |
| c-platform-release | 커머스 제품 최종 검수·운영 인계 | pending | c-platform-operational-qualification ; kix-protocol:k-platform-release |

## 계획 검증 명령

이 검사는 계획의 구조와 해시를 확인한다. 제품 구현 테스트·독립 A3·실제 실행 자격을 대신하지 않는다.

```bash
python3 scripts/validate_program_expansion.py
# 네 레포의 이번 확대 후보를 같은 상위 디렉터리에 checkout한 경우
python3 scripts/validate_program_expansion.py --workspace /path/to/sibling-repositories
```

JSON 중복 key·ID 충돌·잘못된 선행·순환·전체 정의 해시·정본 mirror·문서 해시·Finance alias를 검사한다. 전체 workspace 검사는 외부 선행의 실제 ID와 네 레포 결합 DAG까지 확인한다. 작업 완료 사실이나 외부 승인 여부를 자동 추정하지 않는다.

