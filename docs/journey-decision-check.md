# Remaining journey decision check

Checked against protocol main `7481b0e16ce9b903abbffa62249bb91cd9e63cfe` on
2026-10-07. Runtime consumption remains at the original reviewed gate
`52a9b5cbf7777df55d2d2062cb8d99d862b423bb`; no newer contract is consumed.

## Already resolved; no new product decision needed

- Wave 6 permits contract consumption and mock backend; real payments, public
  deployment and real KYC remain outside scope. Source: protocol
  `docs/decisions/PROGRAM_DECISIONS_20260928.md` §3.
- Explicit `invokeLocalCall` bodies for synthetic capture/settlement exist in the
  pinned catalogue and already run in the pre-existing Node integration test.
  No new producer command or payment-provider connection is required to test those
  existing bodies. This does not itself authorize their journey composition.
- Keep `placeHold` not-bound and its existing nearest-name note `reserve_listing`
  (H1). The supported prefix separately calls `prepare_trade`. H2 changes a note,
  adds no capability, and need not block this product candidate.
- Browser HTTP remains unavailable; this work does not need a CORS/proxy decision.
- Request identity snapshotting and existing-boundary expiry/failure tests are
  implementation corrections within the current prefix, not a new session schema.

## One composition ruling remains

The Commerce `.aiops/program.json` journey-map specification explicitly says to
record options and stop for an **Astra ruling** before the adapter uses them.
PR #23 lists M1 and M2 without choosing. PR #25 implements the prefix conservatively;
neither PR has a subsequent ruling/review comment as of this check. The current
program decisions/roadmap contain broad mock authorization, but no explicit choice
between these two composition options.

Concrete recommendation for the authorized architecture decision-maker: **M1**,
compose the already published synthetic `capture → commit_trade → open_admission →
admit` bodies after successful accept, with `settle_capture` an explicit optional
step. Keep all existing desk methods not-bound, copy causal receipt fields, retain
one attempt and UNKNOWN fencing, and use only the fixed local fixture provenance.
M2 instead retains the current stop at accept. This is one scope/authority ruling,
not a request to redesign payment fields or approve real funds. No M1 implementation
is represented as adopted until that ruling is recorded. The builder model's name
alone is not evidence that an architecture gate has passed.

Wave 7 still waits for `w6a-evidence` merge under protocol
`docs/decisions/PROGRAM_ROADMAP_20260930.md` §2 R-7. Independent review, protected
A3 audit and predecessor/completion evidence remain distinct from this assessment.
