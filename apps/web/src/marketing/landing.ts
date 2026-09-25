import type { CampaignFixture, CreativeVariant, DocumentMeta, LandingShell } from "./types.js";
import { MARKETING_SURFACES } from "./types.js";

/** SEO-shaped document tags for a demo page. robots stays noindex. No host is invented. */
export function documentMeta(input: {
  title: string;
  description: string;
  canonicalPath: string;
}): DocumentMeta {
  return {
    title: input.title,
    description: input.description,
    canonicalPath: input.canonicalPath,
    robots: "noindex, nofollow",
    ogTitle: input.title,
    ogDescription: input.description,
  };
}

/**
 * Landing shell for one campaign variant.
 * `canonicalPath` is an app path, not an absolute production URL.
 */
export function buildLandingShell(campaign: CampaignFixture, variant: CreativeVariant): LandingShell {
  return {
    ...documentMeta({
      title: `${campaign.title} — ${variant.label}`,
      description: campaign.summary,
      canonicalPath: campaign.path,
    }),
    surface: MARKETING_SURFACES.landingShells,
    host: null,
    indexed: false,
  };
}
