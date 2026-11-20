# Publish the inline change requests on PR #146

The resale node requires all 13 unsupported reads in the body of PR #146. A read-only check at `80a0eceb3c81c2f530ca1c2f56468b9d92c97684` found a builder-local link and no inline `NOT_BOUND list` heading. The independent reviewer receives that hosted body. The builder's round-three instructions prohibit posting. [PR #146](https://github.com/SUNBURN-Golden/kix-commerce-apps/pull/146)

The KIX Commerce supervisor or PR owner can publish the prepared replacement description, or keep the PR blocked until an authorized publisher is available. I recommend publishing the prepared body before requesting another review. Its 13 inline rows match the change-request document, and its evidence links resolve within the repository. [Prepared PR body](docs/kix-resale-journey-binding-pr-body.md) · [Change requests](docs/kix-resale-journey-binding-change-requests.md)

After publication, the supervisor can verify the inline section on GitHub and both required CI jobs on the published round-three commit.
