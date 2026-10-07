# Commerce PR26: synthetic issuance/admission and independent Astra A3

## User decision and provenance

This is a faithful relay of the User's direct approval from source thread
`01a0f57c-0df9-72ce-bb48-d1aaf753d004`, received on 2026-10-07. It is not an
independently signed host observation or a claim that the User wrote this file.

Parent question `Sentinel_a0929fd81dd48191b96994ee6174aa96`:

> Commerce 권한 복구는 맥의 GitHub 로그인이 필요해 멈췄어. 맥 잠금을 풀고 열려 있는 GitHub 페이지에 직접 로그인해줘. 비밀번호나 토큰은 채팅에 보내지 마
> 제품 흐름은 ‘기존 합성 결제로 발권·입장까지 연결하고, 홀드 API는 아직 연결하지 않기’를 권고해. 이 선택과 작성자가 아닌 독립 Astra의 A3 결과를 Commerce #26의 감사로 수용하는 것도 승인할까?

User answer `Sentinel_a8ef1e17bbe481918c073a7998b17bb0`:

> 승인해

Scope: [Commerce PR26](https://github.com/SUNBURN-Golden/kix-commerce-apps/pull/26),
branch `astra/kixc-product-journey-workspace`, continuing reviewed checkpoint
`e10a2fe572a64a33db71978d8f6bdc879322b5e6`. The approved revision is this decision
and the cumulative PR26 implementation; every audit names its exact final HEAD.
The inherited task boundary is `KIXC-W6A-JOURNEY-ADAPTER` and the Wave6-A map in
[PR23](https://github.com/SUNBURN-Golden/kix-commerce-apps/pull/23) at
`0a940df885b70edce0db577d9783921609f71dfe`. Original task inputs and launch records
remain intact; this later User decision supplies the previously missing choice.

## Product choice

Adopt the map's M1 composition with H1: `create_event → prepare_trade →
accept_trade → capture → commit_trade → open_admission → admit`, using only
published bodies at Protocol pin `52a9b5cbf7777df55d2d2062cb8d99d862b423bb`.
`capture` always has synthetic provenance and the fixed reference fixture scope.
Optional `settle_capture` is omitted from this implementation: the reference
permits issuance without settlement, and capture does not make cash available.

All existing desk methods stay not-bound. In particular, `placeHold` retains
`consideredAction=reserve_listing`; its eventId/quantity arguments are not
converted into prepare_trade. The composer is a separate explicit catalogue path.
Later bodies copy verified receipt identity plus the invocation's immutable input.
Unconfirmed, invalid, stale or rejected outcomes stop later writes. No retries,
replacement operation IDs, read-based success inference or UNKNOWN recovery API.

Browser execution remains an isolated labelled fixture. Actual contract tests use
the reviewed Node loopback gate. No browser HTTP opening, real payment/account,
venue scan, external provider connection, deployment, producer change or pin move.
Wave7 still requires the separate `w6a-evidence` merge under roadmap R-7.

## Narrow audit exception

For this cumulative Commerce PR26 source change only, the User accepts a **fresh,
non-author internal Astra ARCHITECTURE/A3** audit. This is the explicit exception
to the default designated Fable source-audit requirement linked by the Commerce
delegation document. It follows the central AGENTS §8 requirement that only User
may designate a non-author architecture auditor when Astra authored the change.

The audit must independently inspect the cumulative diff and relevant contracts,
record the exact HEAD, actual available model/session execution evidence, verified
depth, contract-change classification, findings, verdict and any blockers. No
writer or previous implementation session is eligible. A new relevant HEAD needs
a new audit/re-audit. Negative findings remain blocking until resolved and reviewed.

Use a distinct internal identity, never `ASTRA_FABLE`, `MAC_GLM53` or a protected
host receipt marker. This permission accepts the source audit for User review; it
does not change a central receipt consumer, bypass a machine gate, rewrite a ledger,
transfer design authority, authorize merge/deploy or expand to another PR/product.
Exact-head CI remains required. An audit may distinguish source correctness from
the separate blocked CI credential check, but cannot label that check successful.

The earlier independent review at e10a2fe remains historical review evidence,
not a retroactive A3. No new external audit provider is authorized by this decision.
The login-dependent credential repair remains separate; approval is not proof of
login or restored repository access.
