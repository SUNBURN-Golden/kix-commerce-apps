# Plan revision 2026-10-17 — consume-p-sdk-0 승격과 제품 완성도 갭 노드 8개 추가

결정: 준태님 2026-10-15 14:44 KST 위임(제품화까지 개발, 결정이 필요한 건 알아서 결정; 비용·하드웨어·메인넷·시크릿키·프로덕션 배포·결제 변경 제외)에 따른 KIX Commerce 소유자 결정. 개별 노드를 준태님이 직접 승인한 기록이 아니다.

## (a) pending 승격 검토

기준: kix-commerce-apps origin/main `a57e823`(program.json 42개 노드 전부 병합), kix-protocol(SUNBURN-Golden/kix-protocol) main `244595d`. PENDING_NODES.json 42개의 외부 선행을 kix-protocol의 merge 기록과 대조했다.

- 승격 1건: `consume-p-sdk-0`. 외부 선행은 `kix:p-sdk-0` 하나뿐이고, kix-protocol PR #123(`[KIX-P-SDK-0]`, merge `a74e7c459d3be6754ac3cf24503e43c7bc312358`, 2026-10-08)로 병합됐으며 main `244595d`의 조상이다. 이 승격은 depends_on_external 한 항목만 제거하고 spec·audit_floor·astra_auto_merge는 원문 그대로 둔다(spec 끝에 승격 근거 한 문단만 덧붙임). 원 pending 행은 이력으로 PENDING_NODES.json에 그대로 남긴다. 이 노드는 원본 p-sdk-0 tuple(BOOTSTRAP profile)만 소비하며, 이후 변경된 catalogue/SDK 소비는 범위 밖이다. contract_change=NO, 정책 C 위임, A2는 PROGRAM_ASTRA_DELEGATION.md의 기존 행 그대로다.
- 승격 보류(나머지 41개): 아래 선행이 아직 병합되지 않았거나 kix-protocol program에 노드가 없다. 계속 pending이며 depends_on_external은 그대로다.
  - 병합됨이지만 다른 외부 선행이 남아 보류: `primary-price-fee-ui`(move-primary-price-fee 병합, contract-compatibility-profile 미병합), `delegation-surface`(ai-delegation-contract-mock 병합, contract-compatibility-profile 미병합).
  - 미병합: `contract-compatibility-profile`(선행 p-sdk-1, k-stage3-schema-sdk-conformance), `p-sdk-1`, `read-model-reference`(PR #178 OPEN). 거의 모든 bind-*·w7-m0*·e2e·c-* pending 노드가 이 중 하나를 직접 또는 전이로 필요로 한다.
  - kix-protocol program.json에 아직 노드가 없음: wave7-marketing-contracts, protocol-runtime-boundary-register, protocol-canonical-identity-conformance, protocol-read-projection-evidence, protocol-local-recovery-conformance, fin-catalogue-read-model, ps-03~07, cr-08-producer-sdk, cr-10-credit-qualification, k-authority-qualification, k-operator-contract, k-provider-sandbox, k-platform-release.
- 외부 선행의 완료 근거는 kix-protocol의 실제 merge 기록(PR·merge SHA)이며, 보호된 중앙 receipt가 아니다. 이 승격은 로컬 daemon 실행 순서 판단일 뿐 중앙 DONE·qualification·release 증거가 아니다.

## (b) 두 번째 갭 분석

기준: 청사진(PROGRAM_EXPANSION_20261002_KO.md, COMMERCE_PRODUCT_EVOLUTION_KO.md §8 제품 품질, INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md)과 병합된 코드. 2026-10-16 개정은 여정·브라우저·접근성·fault·evidence matrix를 채웠다. 코드로 확인한 남은 갭:

- apps/web/src/App.tsx: error boundary·lazy 분할·Suspense가 없고 `path="*"`가 조용히 `/`로 redirect한다. 38개 화면이 한 번들이고 번들·렌더 예산이나 CI 게이트가 없다.
- Shell.tsx의 30개 평면 링크, App.tsx 라우트, apps/e2e matrix, evidence matrix 문서에 라우트 목록이 각각 복제돼 있다. 좁은 화면 내비·skip link·빵부스러기가 없다.
- UI 문구가 영어 하드코딩이고 `index.html lang=en`, 시간 표시는 `en-GB` 고정이다. 한국어 표시 계층이 없다.
- styles.css에는 720/390px 반응형뿐이고 prefers-reduced-motion·forced-colors·다크·200% 확대·인쇄 스타일이 없다.
- 비신뢰 문자열 렌더 시험, CSP, 브라우저 저장소 허용 목록 감사가 없다.
- lint 설정·커버리지 하한·의존성/라이선스·import 순환 검사가 없고 CI는 typecheck/build/test와 e2e·a11y job만 돈다.
- 구현자용 문서만 있고 사용자·운영자용 상태 용어집·화면별 읽는 법·문제 해결 문서가 없다.

제외(이 개정에서 노드를 만들지 않음): kix-protocol 변경 또는 미병합 producer가 필요한 항목(bind-*, consume-p-sdk-1, HTTP mode 브라우저 시험, gate CORS), 금지 범주(실제 provider sandbox 결제·환불, 실제 알림 발송과 외부 연동, 기기 인증·스토어 등록, 공개 배포·release, secret이 필요한 단계), 이미 병합된 stub가 덮는 항목. 미정으로 남김: session 기록 보존 기간(TTL)은 UNDETERMINED(담당 사용자/법무)이며 이 개정의 노드는 TTL을 정하지 않는다.

## 신규 stub 노드 (8)

원 pending 노드는 변경하지 않는다. 8개 모두 contract_change=NO, astra_gate=NONE, deliverable_mode=PR, astra_auto_merge=true, user_merge=false다. 새 형식은 앱 내부 전용이며 공개 계약 변경이 필요해지면 YES/A3/user_merge로 재분류한다.

| stub 노드 | depends_on | user_merge | audit_floor | 갭 |
|---|---|---|---|---|
| `c-app-shell-resilience-stub` | c-a11y-acceptance-stub, c-local-evidence-matrix-stub | false | A2 | 앱 셸 복원력(error boundary, 404, noscript, 문서 제목) |
| `c-route-registry-navigation-stub` | c-app-shell-resilience-stub | false | A2 | 라우트 registry 단일 출처·그룹 내비·skip link |
| `c-bundle-performance-budget-stub` | c-route-registry-navigation-stub | false | A2 | 코드 분할·번들/렌더 예산(성능 예산) |
| `c-locale-ko-en-stub` | c-route-registry-navigation-stub | false | A2 | 한국어/영어 표시 계층(i18n) |
| `c-display-preferences-stub` | c-a11y-acceptance-stub, c-app-shell-resilience-stub | false | A2 | 고대비·움직임 감소·다크·확대 reflow·인쇄 |
| `c-untrusted-render-csp-stub` | c-fault-injection-stub, c-app-shell-resilience-stub | false | A3 | 비신뢰 입력 렌더·CSP·저장소 감사 |
| `c-quality-gates-stub` | c-local-evidence-matrix-stub | false | A2 | ESLint·커버리지 하한·의존성/라이선스·순환 검사 |
| `c-user-guides-stub` | c-route-registry-navigation-stub, c-locale-ko-en-stub, c-local-evidence-matrix-stub | false | A1 | 사용자·운영자 안내와 상태 용어집 |

## 시험·문서 정렬 (이 PR에 포함)

- 신규 노드는 evidence matrix의 기준(base `118e8d7`) 이후에 추가되므로 matrix 문서의 NODES 표에 `NOT_STARTED`로, D14~D16 줄에 새 개수로 기록했다. `consume-p-sdk-0`은 program 행(NOT_STARTED)과 pending 이력 행(NOT_STARTED, promoted)이 둘 다 있다.
- `apps/web/test/support/local-evidence-matrix.ts`에 `PROMOTED_FROM_PENDING`, 기준 이후 노드의 `NOT_STARTED` 처리를 추가하고, 같은 파일을 쓰는 `local-evidence-matrix.test.ts`·`handoff-packet.test.tsx`의 'program과 pending은 서로소' 단정을 승격 목록 예외로 바꿨다. 시험을 약화·삭제하지 않았다.
- 코드·workflow·commerce-bindings.ts·OpenAPI pin·PINNED_ACTIONS·KIX_PROTOCOL_GATE_SHA는 바뀌지 않는다.

## digest (.aiops/program.json)

- pre file sha256: `921294fa98b2d424b758fef01a60bed0e8feb55cbd063783df8905160c00c062`
- pre definition sha256 (canonical sorted compact JSON): `3b4f493b8d50f774cec6e1e351e4279c2e0c50bef5e260120b40aa6f5a4ec041`
- post file sha256: `f6eeaf05643ff377c0347702fe104846b31af1eb60f9837fd4ba07fb60a3416a`
- post definition sha256: `e3eb0c7070ff5d2834a7aee3e153fca8ada546e6713ccb1dba03db2d2f85a016`
- 노드 수: 42 → 51 (신규 8 + 승격 1)
- 정의 digest는 JSON 전체를 `sort_keys=True`, 구분자 `(',', ':')`, `ensure_ascii=False`로 직렬화해 계산했다. pre 값은 PLAN_REVISION_20261016_KO.md의 post 값과 같다.
