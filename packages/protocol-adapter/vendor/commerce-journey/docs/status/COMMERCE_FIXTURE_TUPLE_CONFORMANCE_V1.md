# Commerce fixture tuple conformance

The [qualification table](COMMERCE_FIXTURE_TUPLE_CONFORMANCE_V1.json) records
`SEMANTIC_CONFORMANCE` for 28 actions on
`POST /x-kix-contract-only/local-call`. It applies to the listed fixture
steps and outcomes from Commerce `9a55fe4e257376f9db3f877a11b65e3ecc43c661`
against Protocol `8ba7f6c36373ac0ec49246f51f7471c164ac3a28`
(tree `d3f5412ef84f64fe83c5d3a3d3ada173921bfbf9`).

## Consumer handoff

After this evidence merges, Commerce can replay and bind manifest revision
`commerce-fixture-8ba7f6c-1` in its own consumer change. Match the producer and
file pins, then check the method, path, action, machine, operation, subject
field, schema digest, context and step in the table. The manifest carries the
full 84-command catalogue for identity verification. Its grant covers the 28
listed actions only. `bootstrap-2` continues to grant schema binding.

| Context | Qualified behavior |
| --- | --- |
| Booking resale | Primary reservation to issuance, resale adoption to payment, settlement binding, a refusal before mock commit, then transfer and mock distribution. Cancellation after primary payment is a refusal. |
| Booking admission | Primary reservation to issuance, credential adoption, authorization and one consumption. Fresh repeat consumption and cancellation after primary payment are refusals. |
| Booking refund | Confirmed unpaid reservation cancellation, separate mock settlement cancel and fail, and a captured settlement's refund binding and mock acceptance. Issuance after reservation cancellation is a refusal. |
| Resale market | Primary reservation to issuance, listing, buyer hold, payment and transfer with settlement `UNBOUND`. Listing cancellation is covered from both `LISTED` and `BUY_HELD`. After payment it is a refusal. |

An unlisted tuple or context is outside the grant. Keep unresolved `UNKNOWN`
outcomes fenced. The market, settlement and operation-recovery reads remain
`NOT_BOUND`. [PR #146 change requests](https://github.com/SUNBURN-Golden/kix-commerce-apps/blob/9a55fe4e257376f9db3f877a11b65e3ecc43c661/docs/kix-resale-journey-binding-change-requests.md)

TTLs, fees and amounts in the pack are synthetic inputs. Product TTLs, fees,
compensation, market visibility, matching, pagination and legal, accounting
and provider terms remain `UNDETERMINED`.

## Replay offline

```sh
node sdk/compat/verify_compat.mjs \
  --manifest sdk/compat/manifests/manifest.commerce-fixture-8ba7f6c-1.json \
  --expect-kind SEMANTIC_CONFORMANCE --expect-revision commerce-fixture-8ba7f6c-1
python3.12 -B -m unittest discover -s reference/booking_resale_admission \
  -p 'test_commerce_fixture_tuple_conformance.py'
npm --prefix sdk run conformance
```

Use the manifest and vectors with their referenced files. For each target,
start a fresh in-memory host, replay its `setup` vector IDs in order, then
submit its `envelope` verbatim. Keep the envelope's `operationId` separate from
its body's `idempotency_key`. `commerce_step` names an actual fixture step and
`control_vector_ids` identify additional evidence. On booking vectors,
`input_index` traces the envelope body to the prior input file's `steps` array.
[Manifest](../../sdk/compat/manifests/manifest.commerce-fixture-8ba7f6c-1.json) ·
[Vectors](../../sdk/conformance/vectors/commerce-fixture-tuple.vectors.json)

Check the exact business or schema refusal code, or compare typed
`receipt_fields` by dotted path and the full receipt at `receipt_ref` when
present. A receipt reference is a repository path followed by a JSON
Pointer. A successful first call checks the `journal_delta` by machine.
Refusals and duplicate replay preserve business state and journals.
`replay_of` identifies deliberate offline replay controls using the original
body key. The SDK test checks the shared envelopes through a recording
transport. The Python test checks producer outcomes with the pinned parser
and FSM host.

The scope is source-informed conformance for synthetic in-memory fixtures.
Production, durability, real payment, chain authority, browser enablement,
N/N−1 compatibility and consumer acceptance are outside this evidence.
