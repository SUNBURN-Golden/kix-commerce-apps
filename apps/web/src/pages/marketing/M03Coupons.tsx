import { useState, type FormEvent } from "react";
import { COUPON_FIXTURES } from "../../marketing/desk";
import { marketingSession } from "../../marketing/session";
import { useMarketingSnapshot } from "../../marketing/useMarketingSnapshot";
import { formatWhen } from "../../format";
import { errorText, MarketingChrome } from "./MarketingChrome";

export function M03Page() {
  const { snapshot, refresh } = useMarketingSnapshot();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      marketingSession.applyCoupon(code);
      setCode("");
      refresh();
    } catch (reason) {
      setError(errorText(reason, "Could not apply the demo code."));
    }
  }

  return (
    <MarketingChrome id="M03">
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <form className="panel" onSubmit={onSubmit}>
        <label>
          Demo code
          <input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" />
        </label>
        <p className="muted">A marker is a session label. It has no price, no balance, and no tender.</p>
        <div className="row-actions">
          <button type="submit">Apply demo code</button>
        </div>
      </form>
      <ul className="program">
        {COUPON_FIXTURES.map((item) => {
          const applied = snapshot.coupons.find((row) => row.code === item.code);
          return (
            <li key={item.code}>
              <article className="row">
                <div>
                  <p className="eyebrow">{item.code}</p>
                  <h3 lang="ko">{item.titleKo}</h3>
                  <p className="muted">{item.titleEn}</p>
                </div>
                <p className="muted">{applied ? `Attached ${formatWhen(applied.appliedAt)}` : item.marker}</p>
              </article>
            </li>
          );
        })}
      </ul>
    </MarketingChrome>
  );
}
