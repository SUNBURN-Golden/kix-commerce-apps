import { Link } from "react-router-dom";
import { MARKETING_SURFACES } from "../../marketing/labels";
import { marketingSession } from "../../marketing/session";
import { useMarketingSnapshot } from "../../marketing/useMarketingSnapshot";
import { MarketingChrome } from "./MarketingChrome";

export function MarketingHubPage() {
  const { snapshot, refresh } = useMarketingSnapshot();
  const boundary = snapshot.boundary;
  const tier = snapshot.membership?.tier ?? "guest";

  return (
    <MarketingChrome>
      <header className="section-head">
        <p className="eyebrow">Wave 7 · ORIGINAL_32 · 설계중</p>
        <h2>Marketing desk</h2>
        <p lang="ko">팬 자격, 선예매, 쿠폰, 추천, 데이터 동의의 스텁 데모입니다.</p>
        <p className="muted">
          Fixtures stay in this browser session. They are not kix-protocol types. This desk stays on the marketing
          stub and makes no contract claim.
        </p>
      </header>
      <article className="ticket" aria-label="Marketing session">
        <p className="eyebrow">Session stub</p>
        <h3>This page load</h3>
        <dl>
          <div>
            <dt>Status</dt>
            <dd>{boundary.status}</dd>
          </div>
          <div>
            <dt>Protocol binding</dt>
            <dd>{boundary.protocolBinding}</dd>
          </div>
          <div>
            <dt>OpenAPI bound</dt>
            <dd>{boundary.openApiBound ? "yes" : "no"}</dd>
          </div>
          <div>
            <dt>Tier</dt>
            <dd>{tier}</dd>
          </div>
          <div>
            <dt>Presale notes</dt>
            <dd>{snapshot.interests.length}</dd>
          </div>
          <div>
            <dt>Coupon markers</dt>
            <dd>{snapshot.coupons.length}</dd>
          </div>
          <div>
            <dt>Reward markers</dt>
            <dd>{snapshot.rewardMarkers}</dd>
          </div>
          <div>
            <dt>Consent</dt>
            <dd>{snapshot.consent.state}</dd>
          </div>
          <div>
            <dt>Funds</dt>
            <dd>{boundary.fundsMovement}</dd>
          </div>
          <div>
            <dt>Outbound send</dt>
            <dd>{boundary.outboundSend}</dd>
          </div>
        </dl>
        <div className="row-actions">
          <button
            type="button"
            className="ghost"
            onClick={() => {
              marketingSession.reset();
              refresh();
            }}
          >
            Reset marketing session
          </button>
        </div>
      </article>
      <ul className="hub">
        {MARKETING_SURFACES.map((item) => (
          <li key={item.id}>
            <Link className="panel hub-card" to={item.path}>
              <p className="eyebrow">
                {item.id} · {boundary.status}
              </p>
              <h3 lang="ko">{item.titleKo}</h3>
              <p>{item.titleEn}</p>
              <p className="muted">{item.blurbEn}</p>
            </Link>
          </li>
        ))}
      </ul>
    </MarketingChrome>
  );
}
