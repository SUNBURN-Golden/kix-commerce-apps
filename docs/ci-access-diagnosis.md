# Protocol checkout 403: read-only diagnosis

Observed 2026-10-07 for PR #26. No secret value, local credential content, token
fingerprint or authentication header was read or printed. No credential or policy
was changed.

## Evidence

- `KIX_PROTOCOL_READ_TOKEN` exists as a **repository Actions secret** on
  `SUNBURN-Golden/kix-commerce-apps`; last updated `2026-09-29T09:18:33Z`.
- No repository environments exist, and the workflow has no `environment` binding.
  Thus this run uses the repository secret. A same-named organization secret would
  not override it ([GitHub secret precedence](https://docs.github.com/en/actions/reference/security/secrets)).
- Workflow `permissions: contents: read`; repository default workflow permission
  `read`; `can_approve_pull_request_reviews: false`; Actions enabled, allowed actions
  `all`. Checkout receives the existing named secret explicitly and uses
  `persist-credentials: false`.
- Both old and current protocol names resolve to repository ID `1365416872`,
  `SUNBURN-Golden/kix-protocol`, private. Local CLI read succeeds. This proves access
  for the CLI identity only, not for the opaque CI secret.
- Run [37579917832](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/37579917832)
  at `ddc781997dea173aa2b4ed673cfbc8b97b2c0c9e`: token presence and stub/browser PASS;
  protocol fetch fails HTTP 403 before adapter tests. Updating the old owner name
  did not restore access. The generic “Write access” error is from a read fetch;
  adding write permission is not a justified remedy.
- Organization Actions-policy lookup is unavailable to the current CLI identity
  (403, missing org-admin/actions-policy permission). No permission refresh was run.
- Protocol Actions sharing access is `none`. This setting concerns reusable
  workflows/actions, not the explicit PAT-authenticated Git checkout; changing it
  is not proposed.

The default `GITHUB_TOKEN` covers the current repository. Replacing this secret
with it does not grant private cross-repository access ([checkout documentation](https://github.com/actions/checkout#checkout-multiple-repos-private)).

## Minimal recovery, requiring separate authorization

The credential owner or organization administrator should inspect the **existing
credential's settings**, without sending its value to this task: validity/expiry,
resource owner, selected access to `SUNBURN-Golden/kix-protocol`, Contents read, and
any pending organization authorization/SSO requirement. The metadata available here
cannot identify the token type, owner or precise failed condition. Transfer-related
scope loss is a hypothesis, not a confirmed cause.

If the existing credential can be repaired, approve only that repository's read
access and required organization authorization. If it cannot, approve replacement
of only the existing Commerce repository secret with a credential restricted to
protocol read access. Creating a token, replacing the secret, changing repository
selection or organization authorization are **not performed or pre-approved here**.
Do not grant write/admin scopes, change branch protection, expand the workflow's
`GITHUB_TOKEN`, copy a personal CLI credential into CI, or bypass the gate job.

After an authorized repair, re-run the failed gate job on the current PR HEAD and
inspect the actual adapter tests. Token-presence PASS is never checkout-access PASS.
