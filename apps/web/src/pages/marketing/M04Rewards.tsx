import { useState, type FormEvent } from "react";
import { PARTNER_REFERRAL_CODES } from "../../marketing/desk";
import { marketingSession } from "../../marketing/session";
import { useMarketingSnapshot } from "../../marketing/useMarketingSnapshot";
import { errorText, MarketingChrome } from "./MarketingChrome";

export function M04Page() {
  const { snapshot, refresh } = useMarketingSnapshot();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      marketingSession.acceptReferral(code);
      setCode("");
      refresh();
    } catch (reason) {
      setError(errorText(reason, "Could not count the demo code."));
    }
  }

  return (
    <MarketingChrome id="M04">
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <article className="ticket">
        <p className="eyebrow">Session code</p>
        <h3>{snapshot.referralCode}</h3>
        <dl>
          <div>
            <dt>Demo markers</dt>
            <dd>{snapshot.rewardMarkers}</dd>
          </div>
          <div>
            <dt>Credit disbursement</dt>
            <dd>{snapshot.boundary.creditDisbursement}</dd>
          </div>
        </dl>
        <p className="muted">Markers are a count on this stub. They are not a balance and they are not F04 credit.</p>
      </article>
      <form className="panel" onSubmit={onSubmit}>
        <label>
          Partner demo code
          <input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" />
        </label>
        <p className="muted">Fixture codes: {PARTNER_REFERRAL_CODES.join(", ")}.</p>
        <div className="row-actions">
          <button type="submit">Count demo marker</button>
        </div>
      </form>
      {snapshot.acceptedReferrals.length > 0 ? (
        <p className="panel">Counted: {snapshot.acceptedReferrals.join(", ")}</p>
      ) : (
        <p className="empty">No partner demo code counted on this session.</p>
      )}
    </MarketingChrome>
  );
}
