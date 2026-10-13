# Plan revision 2026-10-13 — pending 승격 검토와 stub 범위 노드 추가

승인: 준태님 2026-10-13 13:52 KST (채팅 결정 (a)+(b)).

## (a) 승격

kix-commerce-apps 내부만으로 선행이 해소되는 pending 노드는 **없다**. PENDING_NODES.json의 42개 모두 kix-protocol 외부 선행을 직접 또는 전이적으로 가진다(예: consume-p-sdk-0 → kix-protocol:p-sdk-0; c-installable-mobile → c-provider-connected-journey → k-provider-sandbox). 따라서 승격 0건, depends_on_external은 그대로 유지한다.

## (b) stub 범위 신규 로컬 노드 (16)

원 pending 노드는 변경하지 않는다. 각 `<id>-stub`은 합성/stub 범위만 다루는 별도 노드이며, 실제 연결은 외부 선행 merge 후 후속 노드로 승격한다.

| stub 노드 | depends_on | user_merge | 원 노드 외부 선행 |
|---|---|---|---|
| `c-discovery-live-stub` | c-discovery-prototype | false | kix-protocol:ps-05-query-projections |
| `c-inventory-venue-stub` | c-discovery-live-stub | false | kix-protocol:ps-05-query-projections; kix-protocol:ps-06-admission-load |
| `c-platform-journey-stub` | c-inventory-venue-stub | false | kix-protocol:ps-03-resale-contract; kix-protocol:ps-04-execution-partitions; kix-protocol:ps-05-query-projections |
| `c-merchant-operations-stub` | c-organizer-workspace, c-discovery-live-stub | false | kix-protocol:fin-catalogue-read-model; kix-protocol:ps-05-query-projections |
| `c-credit-origination-stub` | c-local-workspace-closeout | false | kix-protocol:cr-08-producer-sdk |
| `c-credit-servicing-journey-stub` | c-credit-origination-stub | false | kix-protocol:cr-08-producer-sdk |
| `c-finance-operations-stub` | c-merchant-operations-stub, c-credit-servicing-journey-stub | false | kix-protocol:fin-catalogue-read-model; kix-protocol:cr-08-producer-sdk |
| `c-marketing-journey-stub` | w7-m05-consent-bind, c-platform-journey-stub | false | kix-protocol:wave7-marketing-contracts |
| `c-delegated-assistant-stub` | c-platform-journey-stub, c-receipt-explorer | false | kix-protocol:ai-delegation-execution-decision; kix-protocol:k-authority-qualification |
| `c-tenant-permissions-stub` | c-merchant-operations-stub, c-finance-operations-stub | false | kix-protocol:k-operator-contract |
| `c-notification-inbox-stub` | c-tenant-permissions-stub, c-receipt-explorer | false | kix-protocol:k-operator-contract |
| `c-marketplace-performance-stub` | c-platform-journey-stub, c-marketing-journey-stub, c-notification-inbox-stub | false | kix-protocol:ps-07-scale-qualification |
| `c-provider-connected-journey-stub` | c-platform-journey-stub, c-finance-operations-stub | true | kix-protocol:k-provider-sandbox; kix-protocol:k-authority-qualification |
| `c-installable-mobile-stub` | c-marketplace-performance-stub, c-provider-connected-journey-stub | true | (전이적) |
| `c-platform-operational-qualification-stub` | c-local-workspace-closeout, c-credit-servicing-journey-stub, c-finance-operations-stub, c-marketing-journey-stub, c-delegated-assistant-stub, c-tenant-permissions-stub, c-notification-inbox-stub, c-marketplace-performance-stub, c-provider-connected-journey-stub, c-installable-mobile-stub | true | kix-protocol:ps-07-scale-qualification; kix-protocol:cr-10-credit-qualification |
| `c-platform-release-stub` | c-platform-operational-qualification-stub | true | kix-protocol:k-platform-release |

## digest (.aiops/program.json)

- pre file sha256: `1b68062ad09a0c2c2519743de0bf78f28f37b819dc91073384f8caae327e8188`
- pre definition sha256 (canonical sorted compact JSON): `bd865a611f7c6cc33196452f76c5a93c32b43bbabaf674b8d48f4c3e37d27b3f`
- post file sha256: `3507e23ceaeca066c08afdd52c565eb24872e42dd1c27958698a3e2acd8e5116`
- post definition sha256: `e719981a11819092cc5e45d709dc3c1ef43920b54705e3256f60864f86be7f39`
- 노드 수: 18 → 34
