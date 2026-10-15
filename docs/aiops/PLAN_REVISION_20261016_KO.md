# Plan revision 2026-10-16 — 로컬 stub 범위 갭 노드 8개 추가

결정: 준태님 2026-10-15 14:44 KST 위임(제품화까지 개발, 결정이 필요한 건 알아서 결정; 비용·하드웨어·메인넷·시크릿키·프로덕션 배포·결제 변경 제외)에 따른 KIX Commerce 소유자 결정. 개별 노드를 준태님이 직접 승인한 기록이 아니다.

## 갭 분석

기준: origin/main `d9e15fd`(program.json 34개 노드 전부 병합, PENDING_NODES.json 42개는 원본 그대로).

- pending 42개의 kix-protocol 외부 선행(p-sdk-1, contract-compatibility-profile, read-model-reference, wave7-marketing-contracts, ps-03~07, cr-08/10, fin-catalogue-read-model, k-* 등)은 kix-protocol main(`751c51b`)에서 아직 완료되지 않았다. 승격 0건이며 depends_on_external은 그대로 둔다.
- 2026-10-13 개정은 `c-*` 플랫폼 pending 16개만 stub로 만들었다. 오래된 pending 26개 중 kix-protocol 변경 없이 로컬 stub 범위로 검증 가능한 항목은 stub 노드가 없었다.
- 이 개정은 그 항목 중 청사진(PROGRAM_EXPANSION_20261002_KO.md, COMMERCE_PRODUCT_EVOLUTION_KO.md, INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md)이 요구하지만 병합된 노드와 코드 어디에도 없는 것만 8개 노드로 추가한다. 코드 확인: 실제 브라우저(Playwright) 시험, 자동 접근성 검사, session 증거 journal(SESSION_EVIDENCE_LOST), 반환 필요/환불 완료 track이 모두 없다. 기존에는 sessionStorage attempt 카운터와 vitest 시험만 있다.

제외(이 개정에서 노드를 만들지 않음):

- kix-protocol 변경 또는 미병합 producer가 필요한 항목: consume-p-sdk-0/1, bind-*-fsm, bind-list-read, bind-wave4-pointers, browser-gate-path(gate CORS), primary-price-fee-ui(move-primary-price-fee), c-finance-projection의 실제 연결, HTTP mode 브라우저 시험.
- 금지 범주: 실제 provider sandbox 결제·환불(결제), 실제 알림 발송과 외부 연동, 기기 인증·스토어 등록(하드웨어·비용), 공개 배포·release.
- 이미 병합된 stub가 덮는 항목: 발견·재고·플랫폼 여정·가맹점·여신·정산·마케팅·위임·권한·알림·성능·모바일·qualification·release.
- 미정으로 남김: session 기록 보존 기간(TTL)은 UNDETERMINED(담당 사용자/법무)이며 이 개정의 노드는 sessionStorage만 쓰고 TTL을 정하지 않는다.

## 신규 stub 노드 (8)

원 pending 노드는 변경하지 않는다. 8개 모두 contract_change=NO, astra_gate=NONE, deliverable_mode=PR, astra_auto_merge=true, user_merge=false다. 새 형식은 앱 내부 전용이며 공개 계약 변경이 필요해지면 YES/A3/user_merge로 재분류한다.

| stub 노드 | depends_on | user_merge | audit_floor | 대응 청사진/pending 항목 |
|---|---|---|---|---|
| `c-refund-return-states-stub` | c-buyer-workspace, c-platform-journey-stub, c-provider-connected-journey-stub | false | A2 | api-state-distinction, refund-surface |
| `c-journey-identity-stub` | c-platform-journey-stub, c-contract-fixture-library, c-refund-return-states-stub | false | A3 | c-journey-identity |
| `c-session-recovery-stub` | c-journey-identity-stub, c-installable-mobile-stub | false | A3 | c-async-session-fence |
| `c-cross-surface-journeys-stub` | c-session-recovery-stub, gift-surface, organizer-admin-console, c-marketing-journey-stub, c-delegated-assistant-stub, c-credit-servicing-journey-stub, c-provider-connected-journey-stub, c-refund-return-states-stub | false | A3 | c-cross-surface-journeys |
| `c-browser-e2e-stub` | c-cross-surface-journeys-stub | false | A2 | e2e-browser-journeys |
| `c-a11y-acceptance-stub` | c-browser-e2e-stub | false | A2 | c-accessibility-acceptance |
| `c-fault-injection-stub` | c-session-recovery-stub, c-cross-surface-journeys-stub, c-browser-e2e-stub | false | A3 | c-integrated-chaos-qualification |
| `c-local-evidence-matrix-stub` | c-a11y-acceptance-stub, c-fault-injection-stub, c-platform-release-stub, c-local-workspace-closeout | false | A2 | commerce-integration-closeout |

## digest (.aiops/program.json)

- pre file sha256: `3507e23ceaeca066c08afdd52c565eb24872e42dd1c27958698a3e2acd8e5116`
- pre definition sha256 (canonical sorted compact JSON): `e719981a11819092cc5e45d709dc3c1ef43920b54705e3256f60864f86be7f39`
- post file sha256: `921294fa98b2d424b758fef01a60bed0e8feb55cbd063783df8905160c00c062`
- post definition sha256: `3b4f493b8d50f774cec6e1e351e4279c2e0c50bef5e260120b40aa6f5a4ec041`
- 노드 수: 34 → 42
- 정의 digest는 JSON 전체를 `sort_keys=True`, 구분자 `(',', ':')`, `ensure_ascii=False`로 직렬화해 계산했다. pre 값은 PLAN_REVISION_20261013_KO.md의 post 값과 같다.
