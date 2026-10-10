# kix-commerce-apps — 프로그램 위임 초안

상태: NON_EXECUTABLE_DRAFT / PENDING_APPROVAL_DO_NOT_DISPATCH. 범위·시작 승인과 설치/qualification은 아직 완료되지 않았다. 전체 정의 정본은 `docs/aiops/KIX_COMMERCE_PROGRAM_DRAFT.json`와 등록 manifest의 pending catalogue다. ID·spec·선행을 보존하고 계약 변경의 병합 flag/등급을 아래 판정대로 바꿨다.

## 정책 C — 대표님 결정 2026-10-01

원문: [중앙 #47 결정 기록](https://github.com/BeautifulMind-JT/ai-ops-control-plane/pull/47#issuecomment-5927605393). Fable PASS가 나온 위임 노드는 보호된 중앙 executor가 자동 병합한다. `contract_change=YES`, `RELEASE`, `user_merge=true`는 대표님이 병합한다. 계약 변경 노드는 `user_merge=true`, `audit_floor=A3`, `astra_auto_merge=false`로 기록한다. 기존 대표님 전용 노드도 유지한다. 동적 감사에서 계약 변경 YES가 나오면 정적 NO 판정에도 자동 병합하지 않는다.

공개 계약·schema·protocol·operation·capability·BUILD_ID·ruleVersion·solverVersion·SDK/manifest 형식 변경을 계약 변경으로 판정했다. 선행 설계가 있다고 해서 실제 공개 형식 변경의 대표님 병합을 면제하지 않는다. 구현·소비 노드의 NO는 채택된 의미/형식을 그대로 지키는 범위이며, 변경이 필요해지면 YES/A3/User 경계로 다시 분류한다. 비작성자 exact-HEAD 리뷰·CI·제품 gate·호스트에 결합된 보호된 PASS·정확한 병합 HEAD를 모두 요구한다. GitHub 댓글만으로 protected receipt를 만들지 않는다.

이전 위임에서 계약 변경도 자동 병합하도록 둔 flag를 아래 표의 대표님 경계로 바꿨다. DAG나 과거 전달/승인 증거를 새 승인으로 전이하지 않는다. 개발 DONE·실환경 qualification·화면/작품 acceptance·release는 각각 독립 증거가 필요하다. UNKNOWN fencing·단일 writer·금융/chain/외부 전송/과금/공개 운영 잠금은 유지한다.

## 노드별 spec 판정 (44개)


대표님 결정 2026-10-09 21:36 KST: 위 `c-*` 8개 노드는 contract_change=NO로 추가하고, 이미 병합된 #35·#36·#38은 사후 확인한다. 진행 중 계약 변경이 필요해지면 YES/A3/대표님 경계로 다시 분류한다.

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
| `c-workspace-design` | NO | 대표님 (user_merge) | A2 | 로컬 워크스페이스 설계; 잠긴 바인딩만 사용, 새 공개 계약 없음 (사후 확인, 대표님이 PR #35 병합) |
| `c-buyer-workspace` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 (사후 확인) |
| `c-organizer-workspace` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 (사후 확인) |
| `c-discovery-prototype` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 (사후 확인) |
| `c-receipt-explorer` | NO | 정책 C 위임 | A2 | 선행에서 채택한 계약의 구현·소비; 새로운 공개 의미/형식 변경은 제외 (사후 확인) |
| `c-accessibility-baseline` | NO | 정책 C 위임 | A1 | 기존 승인 계약의 시험·접근성 기준; 새 계약 정의 없음 (사후 확인) |
| `c-contract-fixture-library` | NO | 정책 C 위임 | A2 | 기존 승인 계약의 fixture 정리; 계약 형식 변경 없음 (사후 확인) |
| `c-local-workspace-closeout` | NO | 정책 C 위임 | A1 | 로컬 워크스페이스 마감·증거 인계; 새 계약 정의 없음 (사후 확인) |

## 중앙 및 시작 경계

채택 검토 source는 [중앙 #47](https://github.com/BeautifulMind-JT/ai-ops-control-plane/pull/47) `09e161caa652d75e9617caf632b3b9899be35740` 하나다. source 후보로 구현됐으며 설치·독립 A3·User 채택·실제 host qualification·activation은 PENDING이다. runtime/client pin이나 host record는 이 변경으로 바꾸지 않는다. 과거 checkpoint 목록과 별도 시작 PR 절차는 [REGISTRATION_SCOPE_APPROVAL_KO.md](REGISTRATION_SCOPE_APPROVAL_KO.md)를 따른다.

외부 선행은 pending catalogue에 둔다. 실제 저장소/program/node·plan/definition·delivery HEAD·merge SHA·필요한 post-merge 검증의 보호된 완료를 확인한 뒤, 별도 대표님 병합 plan revision에서 변환 전/후 digest와 근거를 기록해 승격한다. 현 schema v1은 빈 `depends_on_external`도 거부한다. 미완료·UNKNOWN·wrong-revision을 삭제해서 실행하지 않는다. bootstrap/범위/시작 PR은 자동 병합할 program delivery가 아니다.
