# Plan revision 2026-10-21 — 세 번째 제품 완성도 갭 분석과 stub 노드 9개 추가

결정: 준태님 2026-10-15 14:44 KST 위임(제품화까지 개발, 결정이 필요한 건 알아서 결정; 비용·하드웨어·메인넷·시크릿키·프로덕션 배포·결제 변경 제외)에 따른 KIX Commerce 소유자 결정. 개별 노드를 준태님이 직접 승인한 기록이 아니다.

배경: origin/main `e13bb73`에서 program.json 51개 노드가 모두 병합됐고(최근 PR #86 `consume-p-sdk-0`, #87 `c-user-guides-stub`), 로컬 daemon은 2026-10-20 10:44 KST부터 "no runnable node" 상태다. 남은 pending 41개는 모두 kix-protocol 선행을 기다린다.

## (a) pending 승격 검토

기준: kix-commerce-apps origin/main `e13bb73`, kix-protocol(SUNBURN-Golden/kix-protocol) main `059410c`. PENDING_NODES.json의 외부 선행 26개를 kix-protocol program.json과 merge 기록에 대조했다.

- 병합됨: p-sdk-0(#123), move-primary-price-fee(#129), ai-delegation-contract-mock(#130), gate-browser-access(#135), openapi-catalogue-promotion(#152), ai-delegation-execution-decision(#193).
- 노드는 있으나 미병합: contract-compatibility-profile, p-sdk-1, read-model-reference(PR #178 OPEN).
- kix-protocol program에 노드가 없음: wave7-marketing-contracts, protocol-runtime-boundary-register, protocol-canonical-identity-conformance, protocol-read-projection-evidence, protocol-local-recovery-conformance, fin-catalogue-read-model, ps-03~07, cr-08-producer-sdk, cr-10-credit-qualification, k-authority-qualification, k-operator-contract, k-provider-sandbox, k-platform-release.
- 결과: 승격 0건. 외부 선행이 모두 병합된 pending 노드는 `c-installable-mobile` 하나뿐인데(외부 선행 없음), 이 노드는 pending 노드 c-provider-connected-journey·c-marketplace-performance에 의존하고 그 둘이 미병합 외부 선행을 전이로 필요로 하므로 보류한다. `primary-price-fee-ui`·`delegation-surface`는 여전히 contract-compatibility-profile을 기다린다.
- 외부 선행 완료 근거는 kix-protocol의 실제 merge 기록이며 보호된 중앙 receipt가 아니다. 이 판단은 로컬 daemon 실행 순서 판단일 뿐 중앙 DONE·qualification·release 증거가 아니다.

## (b) 세 번째 갭 분석

기준: 청사진(PROGRAM_EXPANSION_20261002_KO.md, COMMERCE_PRODUCT_EVOLUTION_KO.md §8, INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md)과 `e13bb73`의 코드. 2026-10-17 개정 노드 8개(셸 복원력·route registry·번들 예산·ko/en·표시 설정·CSP·품질 게이트·안내 문서)는 모두 병합됐다. 코드로 확인한 남은 갭:

- i18n catalogue는 셸·일부 화면만 덮고 pages/*·workspace/registry.ts 설명문 등 대부분 문구가 영어 하드코딩이다.
- 진행 중·빈 값·오류·UNKNOWN·STALE 표시가 화면마다 다르고 화면×상태 행렬 시험이 없다.
- 약 30개 양식에 aria-invalid·오류 요약·필드 오류 연결이 일관되지 않다.
- 연결 끊김(offline) 의미는 installable-mobile 화면에만 있고 앱 전역 표시·쓰기 차단 안내가 없다.
- consume-p-sdk-0 병합 후에도 합성 응답이 화면별 fixture로 흩어져 있고 SDK 0.x 형태와의 정합을 한 곳에서 검사하지 않는다.
- 공통 컴포넌트를 상태별로 한 번에 보는 갤러리가 없다.
- coverage-floors.json의 @kix/web functions 하한이 60.4%로 낮다.
- 시각 회귀(레이아웃 깨짐) 기준선이 없다.
- 첫 실행 안내와 "합성 데모 데이터" 표시가 화면 안에 없다.

제외: kix-protocol 변경이나 미병합 producer가 필요한 항목(bind-*, consume-p-sdk-1, HTTP mode 브라우저 시험), 금지 범주(실제 provider 결제·환불, 실제 알림 발송, 기기 인증·스토어 등록, 공개 배포·release, service worker 등 배포 설정, runtime_enabled, secret이 필요한 단계), 이미 병합된 stub가 덮는 항목. session 기록 보존 기간(TTL)은 UNDETERMINED(담당 사용자/법무)이며 이 개정의 노드는 TTL을 정하지 않는다.

## 신규 stub 노드 (9)

원 pending 노드는 변경하지 않는다. 9개 모두 contract_change=NO, astra_gate=NONE, deliverable_mode=PR, astra_auto_merge=true, user_merge=false다. protocol은 mock·합성 stub으로만 다룬다. 새 형식은 앱 내부 전용이며 공개 계약 변경이 필요해지면 YES/A3/user_merge로 재분류한다.

| stub 노드 | depends_on (모두 병합됨) | user_merge | audit_floor | 갭 |
|---|---|---|---|---|
| `c-i18n-coverage-completion-stub` | c-locale-ko-en-stub, c-user-guides-stub | false | A2 | 전 화면 ko/en catalogue·하드코딩 검사 |
| `c-async-state-patterns-stub` | c-app-shell-resilience-stub, c-display-preferences-stub | false | A2 | 로딩·빈 값·오류·UNKNOWN·STALE 공통 표시 |
| `c-form-validation-ux-stub` | c-a11y-acceptance-stub, c-locale-ko-en-stub | false | A2 | 양식 검증·오류 요약 접근성 |
| `c-offline-connectivity-ux-stub` | c-session-recovery-stub, c-app-shell-resilience-stub | false | A3 | 앱 전역 연결 끊김 표시(service worker 없음) |
| `c-sdk0-mock-scenario-kit-stub` | consume-p-sdk-0, c-contract-fixture-library | false | A2 | p-sdk-0 형태 결정적 mock 시나리오 |
| `c-component-gallery-stub` | c-route-registry-navigation-stub, c-display-preferences-stub, c-bundle-performance-budget-stub | false | A2 | 개발 전용 컴포넌트 갤러리 |
| `c-web-coverage-uplift-stub` | c-quality-gates-stub | false | A2 | @kix/web 커버리지 하한 상향 |
| `c-visual-regression-stub` | c-browser-e2e-stub, c-display-preferences-stub, c-locale-ko-en-stub | false | A2 | 시각 회귀 기준선 |
| `c-first-run-onboarding-stub` | c-user-guides-stub, c-locale-ko-en-stub | false | A1 | 첫 실행 안내·데모 표시 |

모든 depends_on이 이미 병합된 노드라 9개 모두 즉시 실행 가능하다.

## 문서 정렬 (이 PR에 포함)

- evidence matrix 문서 NODES 표에 신규 9개를 `NOT_STARTED`로 추가하고 D14(nodes 102 of 102), D15(60; MERGED_RECORDED 45, NOT_STARTED 15)를 맞췄다. 승격이 없으므로 PROMOTED_FROM_PENDING과 시험 코드는 바꾸지 않았다.
- PROGRAM_ASTRA_DELEGATION.md에 9개 행(모두 NO/정책 C 위임)과 근거 문단을 추가했다.
- 코드·workflow·commerce-bindings.ts·OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA는 바뀌지 않는다.

## digest (.aiops/program.json)

- pre file sha256: `f6eeaf05643ff377c0347702fe104846b31af1eb60f9837fd4ba07fb60a3416a`
- pre definition sha256: `e3eb0c7070ff5d2834a7aee3e153fca8ada546e6713ccb1dba03db2d2f85a016` (PLAN_REVISION_20261017_KO.md의 post 값과 같음)
- post file sha256: `afbc97dff512f2029d3b7225195ec7d7ec84eb2ebe69d97836a88701df61fb6e`
- post definition sha256: `a695978386bd0b23431a15e603c6743b097223bc8cb545f1b45d0b7a56378dff`
- 노드 수: 51 → 60 (신규 9, 승격 0)
- 정의 digest는 JSON 전체를 `sort_keys=True`, 구분자 `(',', ':')`, `ensure_ascii=False`로 직렬화해 계산했다.
