import { useState, type FormEvent } from "react";
import type { MemberTier } from "../../marketing/desk";
import { marketingSession } from "../../marketing/session";
import { useMarketingSnapshot } from "../../marketing/useMarketingSnapshot";
import { errorText, MarketingChrome } from "./MarketingChrome";

export function M01Page() {
  const { snapshot, refresh } = useMarketingSnapshot();
  const [displayName, setDisplayName] = useState(snapshot.membership?.displayName ?? "");
  const [tier, setTier] = useState<MemberTier>(snapshot.membership?.tier ?? "fan");
  const [error, setError] = useState<string | null>(null);
  const card = snapshot.membership;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      marketingSession.join({ displayName, tier });
      refresh();
    } catch (reason) {
      setError(errorText(reason, "Could not issue the demo card."));
    }
  }

  function leave() {
    setError(null);
    marketingSession.leave();
    refresh();
  }

  return (
    <MarketingChrome id="M01">
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <form className="panel" onSubmit={onSubmit}>
        <label>
          Display name
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="off"
            maxLength={40}
          />
        </label>
        <label>
          Demo tier
          <select value={tier} onChange={(event) => setTier(event.target.value as MemberTier)}>
            <option value="fan">팬 · Fan</option>
            <option value="member">멤버 · Member</option>
          </select>
        </label>
        <p className="muted">The card reference starts with mbr_stub_. It is not a rights reference.</p>
        <div className="row-actions">
          <button type="submit">Issue demo card</button>
          <button type="button" className="ghost" onClick={leave} disabled={!card}>
            Clear demo card
          </button>
        </div>
      </form>
      {card ? (
        <article className="ticket">
          <p className="eyebrow">Session card · {card.status}</p>
          <h3>{card.displayName}</h3>
          <dl>
            <div>
              <dt>Local ref</dt>
              <dd>{card.memberRef}</dd>
            </div>
            <div>
              <dt>Tier</dt>
              <dd>{card.tier === "fan" ? "팬 · Fan" : "멤버 · Member"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{card.status}</dd>
            </div>
          </dl>
          <p className="muted">{card.note}</p>
        </article>
      ) : (
        <p className="empty">No demo card on this session. The presale window stays closed until one exists.</p>
      )}
    </MarketingChrome>
  );
}
