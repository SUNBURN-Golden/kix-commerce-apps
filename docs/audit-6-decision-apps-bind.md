# Audit 6 consumption evidence decision

## Recorded decision

audit-6-decision ruling — 2026-10-23 KST, KIX Commerce under the 2026-10-15 standing delegation: option (b).

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The supplied owner record authorizes fixture catalogue v2 to include the already-consumed p-sdk-0 digests. `state/audit-6-decision.decision_answer.md` is absent; the supplied ruling is the authority, and no replacement source record is fabricated. The program-count discrepancy is informational: program dispatch and metadata reconciliation are outside this implementation.

## Current v2 tuple

`KIX_SDK_0_CONSUMPTION_DIGESTS` derives catalogue and manifest sha256s from `requireSdkPin()`, and vectors from the manifest bytes already verified by `assertSdkPin()` at module load. Vectors retain manifest order and the existing handoff representation, with one space between name:digest pairs; there is no new aggregate hash.

| Field | Current value |
| --- | --- |
| catalogueVersion | `2` |
| sdkDigest | `891ddd65f29262603bd0f76746a9308c810a71d4afd717b0f4d2e3f7d46dbaa2` |
| manifestDigest | `1cce4ee5a9aa64ef40825c0e6dedf920050e594cf20ea0aaf087ecbde46f0cca` |
| vectorDigest | `canonical-encoding:3446c13847bb153df06c1d5d3b7f09cd3b1648ac10bb0cc76d7b65c7014e99c2 mixed-input:9e2441ddefc22a2f8c7be230436620908b735b128b9445b7a5a916e4d86a2e19` |

The independently recorded `FIXTURE_TUPLE_LITERALS` and discovery literals must equal the verified live pins, including all three digests. `tupleKeyFrom()` retains its field order: catalogueVersion, contractOpenApiSha256, contractInfoVersion, contractMainSha, gateOpenApiSha256, protocolMergeSha, protocolFeatureSha, sourceProtocolContractSha256, domain, pinnedActions, sdkDigest, manifestDigest, vectorDigest. Each digest participates in identity.

No producer catalogue or gate update is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` remain unchanged.

## Historical v1 tuple

`FIXTURE_V1_TUPLE_LITERALS` retains the complete original tuple with literal version `1` and null SDK/manifest/vector digests. Its original serialization is preserved as `FIXTURE_V1_TUPLE_KEY` (sha256 of the key: `74e2d30c3fd115eb74cb9309dafda79c72d92cc7df75a9fc0947a71216dda1aa`). It is history only: recorded-pass acceptance, fixture classification, and release packet validation refuse it as current evidence. Existing historical delivery and run records remain historical; none is upgraded into a current pass.

## Consumer mapping

| Consumer | Current evidence |
| --- | --- |
| Fixture classification and SDK0 mock scenarios | v2 literals and `liveTupleKey()`, unchanged case identities and BOOTSTRAP provenance |
| Discovery and every synthetic port using `checkDiscoveryReadTuple()` | verified consumption digests; drift or legacy nulls return `tuple-changed` with field `sdkTuple` before source work |
| `/release` | candidate producer digests and `consumedProducerChange: true`, current fixture version; consumed SDK removed from unresolved items |
| `/qualification` | packet pin digests and `consumedProducerChange: true`, UI review material version derived from the fixture constant |
| `/handoff` and local evidence matrix | shared verified digests, byte-identical vector formatting |

`ORIGINATION_PRODUCER_TUPLE`, `SERVICING_PRODUCER_TUPLE`, `FINANCE_PRODUCER_TUPLE`, `TENANT_PRODUCER_TUPLE`, and `NOTIFY_PRODUCER_TUPLE` still describe unavailable domain producers: null digests, `bound: false`, and the existing waiting reasons. Their discovery checks describe consumed app evidence, not an available domain producer. Marketplace follows the same distinction.

## Verification

The SDK consumption tuple test independently hashes vendored catalogue, manifest, and vector bytes, checks the historical key, refuses historical evidence, and checks cross-consumer equality. Discovery and inventory tests count zero materialized rows after each digest mismatch or legacy null; release and qualification runners refuse those tuples before producing packets. Web tests verify rendered digests, catalogue v2, and handoff/evidence-matrix agreement. Existing transport, payload, SDK pin, journey, and controller tests remain required.

Actual local commands and outcomes are recorded in [audit-6-decision-verification.md](audit-6-decision-verification.md). The supervisor must commit and verify CI at that exact head; an uncommitted local check is not exact-head CI evidence. A skipped live gate is not a pass.

## Remaining boundaries

BOOTSTRAP grants `catalogue-schema-binding only`. Semantic conformance, production qualification, real release, and unavailable producer bindings remain unsupported. Release stays `STUB_CANDIDATE_RECORDED`; qualification stays `STUB_RUN_RECORDED`; the synthetic artifact digest stays null. Product policy values, including prices, fees, and retention, remain `UNDETERMINED`.

The locked `commerce-bindings.ts`, SDK pin, vendor artifacts, CI, `.aiops/`, and `docs/aiops/` remain unchanged. Stub default, explicit loopback-only HTTP, one attempt, no retries, no Idempotency-Key, no redirects, no fallback, no proxy, no UI fetch, and false production/truth flags remain enforced. The journey still composes only create_event → prepare_trade → accept_trade; no capture, settle_capture, new placeHold mapping, or remapped desk body is introduced.

Bundle gates remain strict. The supplied bilingual-copy ruling alone permits a documented totalGrowth baseline adjustment up to 790,000 gzip bytes if needed for dual locales; initial JS must remain at 290,000 bytes and route budgets stay strict. This node grants no broader exemption.
