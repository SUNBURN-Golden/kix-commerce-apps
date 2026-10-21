# kix-commerce-apps — 프로그램 위임 초안

상태: NON_EXECUTABLE_DRAFT / PENDING_APPROVAL_DO_NOT_DISPATCH. 범위·시작 승인과 설치/qualification은 아직 완료되지 않았다. 전체 정의 정본은 `docs/aiops/KIX_COMMERCE_PROGRAM_DRAFT.json`와 등록 manifest의 pending catalogue다. ID·spec·선행을 보존하고 계약 변경의 병합 flag/등급을 아래 판정대로 바꿨다.

## 정책 C — 대표님 결정 2026-10-01

원문: [중앙 #47 결정 기록](https://github.com/BeautifulMind-JT/ai-ops-control-plane/pull/47#issuecomment-5927605393). Fable PASS가 나온 위임 노드는 보호된 중앙 executor가 자동 병합한다. `contract_change=YES`, `RELEASE`, `user_merge=true`는 대표님이 병합한다. 계약 변경 노드는 `user_merge=true`, `audit_floor=A3`, `astra_auto_merge=false`로 기록한다. 기존 대표님 전용 노드도 유지한다. 동적 감사에서 계약 변경 YES가 나오면 정적 NO 판정에도 자동 병합하지 않는다.

공개 계약·schema·protocol·operation·capability·BUILD_ID·ruleVersion·solverVersion·SDK/manifest 형식 변경을 계약 변경으로 판정했다. 선행 설계가 있다고 해서 실제 공개 형식 변경의 대표님 병합을 면제하지 않는다. 구현·소비 노드의 NO는 채택된 의미/형식을 그대로 지키는 범위이며, 변경이 필요해지면 YES/A3/User 경계로 다시 분류한다. 비작성자 exact-HEAD 리뷰·CI·제품 gate·호스트에 결합된 보호된 PASS·정확한 병합 HEAD를 모두 요구한다. GitHub 댓글만으로 protected receipt를 만들지 않는다.

이전 위임에서 계약 변경도 자동 병합하도록 둔 flag를 아래 표의 대표님 경계로 바꿨다. DAG나 과거 전달/승인 증거를 새 승인으로 전이하지 않는다. 개발 DONE·실환경 qualification·화면/작품 acceptance·release는 각각 독립 증거가 필요하다. UNKNOWN fencing·단일 writer·금융/chain/외부 전송/과금/공개 운영 잠금은 유지한다.

## 노드별 spec 판정 (60개)


대표님 결정 2026-10-09 21:36 KST: 위 `c-*` 8개 노드는 contract_change=NO로 추가하고, 이미 병합된 #35·#36·#38은 사후 확인한다. 진행 중 계약 변경이 필요해지면 YES/A3/대표님 경계로 다시 분류한다.

대표님 결정 2026-10-14 20:24 KST: 위 `*-stub` 16개 노드는 contract_change=NO로 추가하고, 이미 병합된 #47·#48·#49·#50은 사후 확인한다. user_merge stub 4개(provider-connected-journey·installable-mobile·platform-operational-qualification·platform-release)는 대표님 병합 분류를 유지한다. 진행 중 계약 변경이 필요해지면 YES/A3/대표님 경계로 다시 분류한다.

| Node | contract_change | 병합 | audit_floor | spec 근거 |
|---|---|---|---|---|
| `w6a-journey-map` | YES | 대표님 | A3 | desk argument/API 재설계·command field binding 계약 |
| `w6a-journey-adapter` | NO | 정책 C 위임 | A3 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `w6a-journey-test` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `w6a-ui-skeleton` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `w6a-evidence` | NO | 정책 C 위임 | A1 | 기존 승인 계약의 시험·측정·증거/수용 인계; 새 계약 정의 없음 |
| `organizer-admin-console` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `gift-surface` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `doc-m05-label` | NO | 정책 C 위임 | A1 | spec의 승인된 동작 구현 또는 문서/계획 정리; 새 공개 계약 정의 없음 |
| `w7-marketing-align` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `w7-m05-consent-bind` | NO | 정책 C 위임 | A3 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `consume-p-sdk-0` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `bind-settlement-fsm` | NO | 정책 C 위임 | A3 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `bind-reservation-fsm` | NO | 정책 C 위임 | A3 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `bind-admission-fsm` | NO | 정책 C 위임 | A3 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `bind-resale-fsm` | NO | 정책 C 위임 | A3 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `bind-credit-fsm` | NO | 정책 C 위임 | A3 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `bind-wave4-pointers` | NO | 정책 C 위임 | A3 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `bind-list-read` | NO | 정책 C 위임 | A3 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `browser-gate-path` | NO | 정책 C 위임 | A3 | spec의 승인된 동작 구현 또는 문서/계획 정리; 새 공개 계약 정의 없음 |
| `primary-price-fee-ui` | NO | 정책 C 위임 | A2 | spec의 승인된 동작 구현 또는 문서/계획 정리; 새 공개 계약 정의 없음 |
| `api-state-distinction` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `refund-surface` | NO | 정책 C 위임 | A3 | spec의 승인된 동작 구현 또는 문서/계획 정리; 새 공개 계약 정의 없음 |
| `delegation-surface` | NO | 정책 C 위임 | A3 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `w7-m01-membership` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `w7-m02-presale` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `w7-m03-coupon` | NO | 정책 C 위임 | A3 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `w7-m04-referral` | NO | 정책 C 위임 | A3 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `e2e-browser-journeys` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `consume-p-sdk-1` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `c-journey-identity` | YES | 대표님 | A3 | context-bound identity·field-path binding registry 형식 |
| `c-async-session-fence` | YES | 대표님 | A3 | session intent/recovery schema·outcome/fence operation 계약 |
| `c-cross-surface-journeys` | NO | 정책 C 위임 | A3 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `c-finance-projection` | NO | 정책 C 위임 | A3 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `c-accessibility-acceptance` | NO | 정책 C 위임 | A2 | 기존 승인 계약의 시험·측정·증거/수용 인계; 새 계약 정의 없음 |
| `c-integrated-chaos-qualification` | NO | 정책 C 위임 | A3 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `commerce-integration-closeout` | NO | 정책 C 위임 | A2 | 기존 승인 계약의 시험·측정·증거/수용 인계; 새 계약 정의 없음 |
| `c-workspace-design` | NO | 대표님 (user_merge) | A3 | 로컬 워크스페이스 설계; 잠긴 바인딩만 사용, 새 공개 계약 없음 (사후 확인, 대표님이 PR #35 병합) |
| `c-buyer-workspace` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 (사후 확인) |
| `c-organizer-workspace` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 (사후 확인) |
| `c-discovery-prototype` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 (사후 확인) |
| `c-receipt-explorer` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 (사후 확인) |
| `c-accessibility-baseline` | NO | 정책 C 위임 | A2 | 기존 승인 계약의 시험·접근성 기준; 새 계약 정의 없음 (사후 확인) |
| `c-contract-fixture-library` | NO | 정책 C 위임 | A2 | 기존 승인 계약의 fixture 정리; 계약 형식 변경 없음 (사후 확인) |
| `c-local-workspace-closeout` | NO | 정책 C 위임 | A2 | 로컬 워크스페이스 마감·증거 인계; 새 계약 정의 없음 (사후 확인) |
| `c-discovery-live-stub` | NO | 정책 C 위임 | A2 | stub 범위의 선행 계약 구현·소비; 새로운 공개 의미/형식 변경은 제외 (사후 확인) |
| `c-inventory-venue-stub` | NO | 정책 C 위임 | A2 | stub 범위의 선행 계약 구현·소비; 새로운 공개 의미/형식 변경은 제외 (사후 확인) |
| `c-platform-journey-stub` | NO | 정책 C 위임 | A2 | stub 범위의 선행 계약 구현·소비; 새로운 공개 의미/형식 변경은 제외 (사후 확인) |
| `c-merchant-operations-stub` | NO | 정책 C 위임 | A2 | stub 범위의 선행 계약 구현·소비; 새로운 공개 의미/형식 변경은 제외 (사후 확인) |
| `c-credit-origination-stub` | NO | 정책 C 위임 | A2 | stub 범위의 선행 계약 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `c-credit-servicing-journey-stub` | NO | 정책 C 위임 | A2 | stub 범위의 선행 계약 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `c-finance-operations-stub` | NO | 정책 C 위임 | A2 | stub 범위의 선행 계약 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `c-marketing-journey-stub` | NO | 정책 C 위임 | A2 | stub 범위의 선행 계약 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `c-delegated-assistant-stub` | NO | 정책 C 위임 | A2 | stub 범위의 선행 계약 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `c-tenant-permissions-stub` | NO | 정책 C 위임 | A2 | stub 범위의 선행 계약 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `c-notification-inbox-stub` | NO | 정책 C 위임 | A2 | stub 범위의 선행 계약 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `c-marketplace-performance-stub` | NO | 정책 C 위임 | A2 | stub 범위의 시험·측정·증거; 새 계약 정의 없음 |
| `c-provider-connected-journey-stub` | NO | 대표님 (user_merge) | A3 | stub 범위 sandbox 연결; 잠긴 바인딩만 사용, 새 공개 계약 없음 |
| `c-installable-mobile-stub` | NO | 대표님 (user_merge) | A3 | stub 범위 모바일 UX; 잠긴 바인딩만 사용, 새 공개 계약 없음 |
| `c-platform-operational-qualification-stub` | NO | 대표님 (user_merge) | A3 | stub 범위 실사용 준비 검증; 새 공개 계약 없음 |
| `c-platform-release-stub` | NO | 대표님 (user_merge) | A3 | stub 범위 최종 검수·운영 인계; 새 공개 계약 없음 |
| `c-refund-return-states-stub` | NO | 정책 C 위임 | A2 | stub 범위의 선행 계약 구현·소비; 새로운 공개 의미/형식 변경은 제외 |
| `c-journey-identity-stub` | NO | 정책 C 위임 | A3 | stub 범위의 앱 내부 문맥 결합; 외부 공개 식별자·registry 형식 없음 |
| `c-session-recovery-stub` | NO | 정책 C 위임 | A3 | stub 범위의 tab session journal(앱 내부 형식); 공개 schema·operation 없음 |
| `c-cross-surface-journeys-stub` | NO | 정책 C 위임 | A3 | stub 범위의 선행 계약 구현·소비; 새 명령·보상 의미 없음 |
| `c-browser-e2e-stub` | NO | 정책 C 위임 | A2 | stub 범위의 시험·측정·증거; 새 계약 정의 없음 |
| `c-a11y-acceptance-stub` | NO | 정책 C 위임 | A2 | stub 범위의 시험·접근성 증거; 수용은 PENDING, 새 계약 정의 없음 |
| `c-fault-injection-stub` | NO | 정책 C 위임 | A3 | stub 범위의 시험·측정·증거; 새 계약 정의 없음 |
| `c-local-evidence-matrix-stub` | NO | 정책 C 위임 | A2 | stub 범위의 마감·증거 인계; 새 계약 정의 없음 |
| `c-app-shell-resilience-stub` | NO | 정책 C 위임 | A2 | stub 범위의 앱 셸 오류 상태·404; 새 공개 계약 없음 |
| `c-route-registry-navigation-stub` | NO | 정책 C 위임 | A2 | stub 범위의 앱 내부 라우트 registry·내비; 공개 식별자 없음 |
| `c-bundle-performance-budget-stub` | NO | 정책 C 위임 | A2 | stub 범위의 시험·측정·증거(번들 예산); 새 계약 정의 없음 |
| `c-locale-ko-en-stub` | NO | 정책 C 위임 | A2 | stub 범위의 앱 내부 표시 catalogue; protocol 단어는 번역하지 않음, 새 공개 계약 없음 |
| `c-display-preferences-stub` | NO | 정책 C 위임 | A2 | stub 범위의 표시 환경 설정·접근성 시험; 수용은 PENDING, 새 계약 정의 없음 |
| `c-untrusted-render-csp-stub` | NO | 정책 C 위임 | A3 | stub 범위의 렌더 안전·CSP·저장소 감사 시험; TTL 미정 유지, 새 계약 정의 없음 |
| `c-quality-gates-stub` | NO | 정책 C 위임 | A2 | stub 범위의 정적 품질 게이트·CI; 새 계약 정의 없음 |
| `c-user-guides-stub` | NO | 정책 C 위임 | A1 | stub 범위의 문서·도움말; 새 공개 계약 없음 |
| `c-i18n-coverage-completion-stub` | NO | 정책 C 위임 | A2 | stub 범위의 앱 내부 표시 catalogue 확장; protocol 단어 비번역, 새 공개 계약 없음 |
| `c-async-state-patterns-stub` | NO | 정책 C 위임 | A2 | stub 범위의 앱 내부 상태 표시 컴포넌트·시험; 새 계약 정의 없음 |
| `c-form-validation-ux-stub` | NO | 정책 C 위임 | A2 | stub 범위의 입력 형식 검증 UX; protocol 판정 비복제, 새 계약 정의 없음 |
| `c-offline-connectivity-ux-stub` | NO | 정책 C 위임 | A3 | stub 범위의 연결 표시·쓰기 차단; service worker·재시도 없음, 새 계약 정의 없음 |
| `c-sdk0-mock-scenario-kit-stub` | NO | 정책 C 위임 | A2 | p-sdk-0 BOOTSTRAP 타입 소비만 하는 시험 자료; pin·bindings 불변, 새 계약 정의 없음 |
| `c-component-gallery-stub` | NO | 정책 C 위임 | A2 | 개발 전용 갤러리·스냅샷 시험; 새 계약 정의 없음 |
| `c-web-coverage-uplift-stub` | NO | 정책 C 위임 | A2 | 시험 추가·커버리지 하한 상향; 새 계약 정의 없음 |
| `c-visual-regression-stub` | NO | 정책 C 위임 | A2 | stub 범위의 시각 회귀 시험; 외부 서비스·secret 없음, 새 계약 정의 없음 |
| `c-first-run-onboarding-stub` | NO | 정책 C 위임 | A1 | stub 범위의 안내·데모 표시; TTL 미정 유지, 새 공개 계약 없음 |

## 중앙 및 시작 경계

채택 검토 source는 [중앙 #47](https://github.com/BeautifulMind-JT/ai-ops-control-plane/pull/47) `09e161caa652d75e9617caf632b3b9899be35740` 하나다. source 후보로 구현됐으며 설치·독립 A3·User 채택·실제 host qualification·activation은 PENDING이다. runtime/client pin이나 host record는 이 변경으로 바꾸지 않는다. 과거 checkpoint 목록과 별도 시작 PR 절차는 [REGISTRATION_SCOPE_APPROVAL_KO.md](REGISTRATION_SCOPE_APPROVAL_KO.md)를 따른다.

외부 선행은 pending catalogue에 둔다. 실제 저장소/program/node·plan/definition·delivery HEAD·merge SHA·필요한 post-merge 검증의 보호된 완료를 확인한 뒤, 별도 대표님 병합 plan revision에서 변환 전/후 digest와 근거를 기록해 승격한다. 현 schema v1은 빈 `depends_on_external`도 거부한다. 미완료·UNKNOWN·wrong-revision을 삭제해서 실행하지 않는다. bootstrap/범위/시작 PR은 자동 병합할 program delivery가 아니다.

대표님 위임 결정 2026-10-15 (감리 3, 소유자 판단 위임 "알아서 결정"): audit_floor 불일치 3건은 program.json 값에 맞춰 위임표를 정렬한다(옵션 a). c-workspace-design A3, c-accessibility-baseline A2, c-local-workspace-closeout A2. program.json은 바꾸지 않는다.

대표님 위임 결정 2026-10-15 14:44 KST ("제품화까지 개발, 결정이 필요한 건 알아서 결정"; 비용·하드웨어·메인넷·시크릿키·프로덕션 배포·결제 변경 제외)에 따라 KIX Commerce가 2026-10-16 plan revision으로 `*-stub` 로컬 갭 노드 8개를 추가했다. 8개 모두 contract_change=NO, 병합은 정책 C 위임(user_merge=false)이다. 원 pending 노드 c-journey-identity·c-async-session-fence는 contract_change=YES/대표님이지만, stub 범위 노드는 앱 내부 전용 형식만 쓰고 공개 schema·operation·ID를 만들지 않는다. 진행 중 공개 계약 변경이 필요해지면 YES/A3/대표님 경계로 다시 분류한다. 상세와 digest는 [PLAN_REVISION_20261016_KO.md](PLAN_REVISION_20261016_KO.md)를 본다.

대표님 위임 결정 2026-10-15 14:44 KST("제품화까지 개발, 결정이 필요한 건 알아서 결정"; 비용·하드웨어·메인넷·시크릿키·프로덕션 배포·결제 변경 제외)에 따라 KIX Commerce가 2026-10-17 plan revision으로 (1) 외부 선행 kix-protocol:p-sdk-0(PR #123, merge a74e7c4)이 병합된 pending 노드 `consume-p-sdk-0`을 승격하고(depends_on_external 제거, 나머지 원문 유지; 위 표의 기존 행 NO/정책 C/A2 유지) (2) 위 `*-stub` 제품 완성도 노드 8개를 추가했다. 8개 모두 contract_change=NO, 병합은 정책 C 위임(user_merge=false)이다. 진행 중 공개 계약 변경이 필요해지면 YES/A3/대표님 경계로 다시 분류한다. 상세와 digest는 [PLAN_REVISION_20261017_KO.md](PLAN_REVISION_20261017_KO.md)를 본다.

대표님 위임 결정 2026-10-15 14:44 KST("제품화까지 개발, 결정이 필요한 건 알아서 결정"; 비용·하드웨어·메인넷·시크릿키·프로덕션 배포·결제 변경 제외)에 따라 KIX Commerce가 2026-10-21 plan revision(세 번째 제품 완성도 갭 분석)으로 위 `*-stub` 노드 9개를 추가했다. 9개 모두 contract_change=NO, 병합은 정책 C 위임(user_merge=false)이다. pending 승격은 0건이다(남은 외부 선행 미병합). 진행 중 공개 계약 변경이 필요해지면 YES/A3/대표님 경계로 다시 분류한다. 상세와 digest는 [PLAN_REVISION_20261021_KO.md](PLAN_REVISION_20261021_KO.md)를 본다.
