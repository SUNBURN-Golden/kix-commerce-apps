import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  applyVariant,
  buildLandingShell,
  documentMeta,
  getCampaign,
  slotBody,
  track,
  updateSlot,
  usePageMeta,
  type ContentSlot,
} from "../../marketing";
import { protocol } from "../../protocol";

export function CampaignPage() {
  const { campaignId = "" } = useParams();
  return <CampaignBody key={campaignId} campaignId={campaignId} />;
}

function CampaignBody({ campaignId }: { campaignId: string }) {
  const campaign = getCampaign(campaignId);
  const [variantId, setVariantId] = useState(campaign?.variants[0]?.variantId ?? "");
  const variant = campaign?.variants.find((item) => item.variantId === variantId) ?? campaign?.variants[0];
  const [slots, setSlots] = useState<ContentSlot[]>(() =>
    campaign && variant ? applyVariant(campaign.slots, variant) : [],
  );
  const [catalog, setCatalog] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [catalogTitle, setCatalogTitle] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const shell =
    campaign && variant
      ? buildLandingShell(campaign, variant)
      : documentMeta({
          title: "KIX marketing demo · missing campaign",
          description: "No local campaign fixture for that id.",
          canonicalPath: "/marketing",
        });
  usePageMeta(shell);

  useEffect(() => {
    if (!campaign) {
      return;
    }
    const timer = window.setTimeout(() => {
      track({ name: "page_view", campaignId: campaign.campaignId, detail: campaign.path });
      track({
        name: "slot_impression",
        campaignId: campaign.campaignId,
        detail: campaign.slots.map((slot) => slot.slotId).join(","),
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [campaign]);

  useEffect(() => {
    if (!campaign) {
      return;
    }
    let cancelled = false;
    protocol
      .listPerformances()
      .then((rows) => {
        if (cancelled) {
          return;
        }
        // eventId is the desk adapter's view-model field. Matching it is a demo join, not a protocol binding.
        const row = rows.find((item) => item.eventId === campaign.deskFixtureKey);
        setCatalogTitle(row?.title ?? null);
        setCatalog(row ? "ready" : "missing");
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setCatalog("error");
          setCatalogError(reason instanceof Error ? reason.message : "Could not read the desk catalog.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaign]);

  if (!campaign || !variant) {
    return (
      <section>
        <header className="section-head">
          <p className="eyebrow">M01</p>
          <h2>No campaign fixture</h2>
        </header>
        <p className="empty">Campaign ids on this demo are local fixtures, not protocol identifiers.</p>
        <p>
          <Link className="button" to="/marketing">
            All campaigns
          </Link>
        </p>
      </section>
    );
  }

  const hero = slotBody(slots, "hero");
  const detail = slotBody(slots, "detail");

  function selectVariant(nextId: string) {
    const next = campaign?.variants.find((item) => item.variantId === nextId);
    if (!campaign || !next) {
      return;
    }
    setVariantId(next.variantId);
    setSlots(applyVariant(campaign.slots, next));
    track({ name: "variant_select", campaignId: campaign.campaignId, detail: next.variantId });
  }

  return (
    <article>
      <div className="mkt-hero">
        <div className="mkt-poster">
          <p className="eyebrow">M01 · campaign page</p>
          <h2>{campaign.title}</h2>
          <p className="muted">{campaign.summary}</p>
          <div className="mkt-variants" role="group" aria-label="Creative variants M04">
            {campaign.variants.map((item) => (
              <button
                key={item.variantId}
                type="button"
                aria-pressed={item.variantId === variant.variantId}
                onClick={() => selectVariant(item.variantId)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {hero.trim() ? <p className="mkt-lead">{hero}</p> : <p className="empty">Hero slot is empty.</p>}
          {detail.trim() ? <p>{detail}</p> : <p className="empty">Detail slot is empty.</p>}
        </div>
        <aside className="panel mkt-shell" aria-label="Landing shell M02">
          <p className="eyebrow">M02 · landing shell</p>
          <h3>Document tags</h3>
          <dl>
            <dt>title</dt>
            <dd>{shell.title}</dd>
            <dt>description</dt>
            <dd>{shell.description}</dd>
            <dt>canonical</dt>
            <dd>{shell.canonicalPath}</dd>
            <dt>robots</dt>
            <dd>{shell.robots}</dd>
            <dt>host</dt>
            <dd>none</dd>
          </dl>
          <p className="muted">
            The canonical value is a path. No production host is configured, and the page is marked noindex.
          </p>
        </aside>
      </div>

      <section className="mkt-slots" aria-label="Content slots M03">
        <header className="section-head">
          <p className="eyebrow">M03 · content slots</p>
          <h3>Copy on this page</h3>
        </header>
        {slots.map((slot) =>
          slot.editable ? (
            <label key={slot.slotId} className="mkt-slot">
              <span>
                {slot.label} <span className="mkt-code">Editable fixture</span>
              </span>
              <textarea
                value={slot.body}
                maxLength={600}
                rows={slot.slotId === "faq" ? 3 : 4}
                onChange={(event) => setSlots((current) => updateSlot(current, slot.slotId, event.target.value))}
              />
            </label>
          ) : (
            <div key={slot.slotId} className="mkt-slot">
              <span>
                {slot.label} <span className="mkt-code">Fixed disclaimer</span>
              </span>
              <p className="mkt-fixed">{slot.body}</p>
            </div>
          ),
        )}
      </section>

      <section className="panel" aria-label="Desk catalog link">
        <p className="eyebrow">Desk fixture</p>
        <h3>Simulated booking, when the catalog has this key</h3>
        <p className="muted">
          Desk fixture key <span className="codes">{campaign.deskFixtureKey}</span>. That key matches the Wave 6
          stub seed. It is not a protocol identifier, and this page does not take payment.
        </p>
        {catalog === "loading" ? <p className="muted">Checking the adapter catalog.</p> : null}
        {catalog === "error" ? (
          <p className="alert" role="alert">
            {catalogError}
          </p>
        ) : null}
        {catalog === "missing" ? (
          <p className="empty">
            This adapter catalog has no row for that desk fixture key, so the campaign does not open the booking
            desk.
          </p>
        ) : null}
        {catalog === "ready" ? (
          <>
            <p>Catalog title on this adapter: {catalogTitle}.</p>
            <Link
              className="button"
              to={`/booking/${campaign.deskFixtureKey}`}
              onClick={() => track({ name: "cta_click", campaignId: campaign.campaignId, detail: "booking-desk" })}
            >
              Open booking desk
            </Link>
          </>
        ) : null}
      </section>
    </article>
  );
}
