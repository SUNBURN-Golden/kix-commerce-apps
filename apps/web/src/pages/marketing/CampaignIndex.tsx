import { useEffect } from "react";
import { Link } from "react-router-dom";
import { CAMPAIGNS, documentMeta, MARKETING_SURFACES, track, usePageMeta } from "../../marketing";

const SURFACES = [
  {
    code: MARKETING_SURFACES.campaigns,
    name: "Campaign pages",
    note: "This index and each campaign notice.",
  },
  {
    code: MARKETING_SURFACES.landingShells,
    name: "Landing shells",
    note: "Title, description, and a path-only canonical. robots is noindex. No host.",
  },
  {
    code: MARKETING_SURFACES.contentSlots,
    name: "Content slots",
    note: "Hero, detail, FAQ, and a fixed disclaimer.",
  },
  {
    code: MARKETING_SURFACES.creativeVariants,
    name: "Creative variants",
    note: "Local copy switch. No experiment and no reported result.",
  },
  {
    code: MARKETING_SURFACES.trackingStub,
    name: "Tracking stub",
    note: "Session log only. Nothing is transmitted.",
  },
];

export function CampaignIndexPage() {
  usePageMeta(
    documentMeta({
      title: "KIX marketing demo",
      description: "Campaign pages, landing shells, content slots, and a tracking stub. Not a production site.",
      canonicalPath: "/marketing",
    }),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      track({ name: "page_view", campaignId: null, detail: "/marketing" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section>
      <header className="section-head">
        <p className="eyebrow">M01 · campaign pages</p>
        <h2>Notices beside the desk</h2>
        <p className="muted">
          These fixtures are local copy. They do not define booking, resale, admission, or settlement. Open a
          notice, then the desk, when you want the simulated hold flow.
        </p>
      </header>
      <ul className="mkt-legend">
        {SURFACES.map((item) => (
          <li key={item.code}>
            <p className="mkt-code">{item.code}</p>
            <h3>{item.name}</h3>
            <p className="muted">{item.note}</p>
          </li>
        ))}
      </ul>
      <ul className="mkt-grid">
        {CAMPAIGNS.map((campaign) => (
          <li key={campaign.campaignId}>
            <Link className="mkt-card" to={campaign.path}>
              <p className="mkt-code">M01</p>
              <h3>{campaign.title}</h3>
              <p>{campaign.summary}</p>
              <p className="muted">Desk fixture key {campaign.deskFixtureKey}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MarketingMissingPage() {
  usePageMeta(
    documentMeta({
      title: "KIX marketing demo · missing page",
      description: "That path is not a Wave 7 campaign fixture.",
      canonicalPath: "/marketing",
    }),
  );

  return (
    <section>
      <header className="section-head">
        <p className="eyebrow">M01</p>
        <h2>No page on this demo</h2>
      </header>
      <p className="empty">That path is not one of the campaign fixtures.</p>
      <p>
        <Link className="button" to="/marketing">
          All campaigns
        </Link>
      </p>
    </section>
  );
}
