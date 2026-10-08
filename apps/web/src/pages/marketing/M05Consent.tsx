import { useState, type FormEvent } from "react";
import { formatWhen } from "../../format";
import { MARKETING_CONTRACT_ALIGNMENT } from "../../marketing/contracts";
import { marketingSession } from "../../marketing/session";
import { useMarketingSnapshot } from "../../marketing/useMarketingSnapshot";
import { MarketingChrome } from "./MarketingChrome";

export function M05Page() {
  const { snapshot, refresh } = useMarketingSnapshot();
  const [performanceNotes, setPerformanceNotes] = useState(snapshot.consent.performanceNotes);
  const [membershipNotes, setMembershipNotes] = useState(snapshot.consent.membershipNotes);
  const consent = snapshot.consent;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    marketingSession.saveConsent({ performanceNotes, membershipNotes });
    refresh();
  }

  function withdraw() {
    const next = marketingSession.withdrawConsent();
    setPerformanceNotes(next.performanceNotes);
    setMembershipNotes(next.membershipNotes);
    refresh();
  }

  return (
    <MarketingChrome id="M05">
      <form className="panel" onSubmit={onSubmit}>
        <label className="check">
          <input
            type="checkbox"
            checked={performanceNotes}
            onChange={(event) => setPerformanceNotes(event.target.checked)}
          />
          <span>
            <span lang="ko">공연 안내 플래그</span>
            <span className="muted"> Performance-note flag. No address is collected.</span>
          </span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={membershipNotes}
            onChange={(event) => setMembershipNotes(event.target.checked)}
          />
          <span>
            <span lang="ko">멤버십 소식 플래그</span>
            <span className="muted"> Membership-note flag. No address is collected.</span>
          </span>
        </label>
        <p className="muted">
          Saving writes flags on this stub. Channel send stays {consent.channelSend}. Storage is {consent.storage}.
          These flags are not the set_consent body. Missing field names:{" "}
          {MARKETING_CONTRACT_ALIGNMENT.M05.missingFromStub.join(", ")}. channelSend: {consent.channelSend}.
        </p>
        <div className="row-actions">
          <button type="submit">Save consent flags</button>
          <button type="button" className="ghost" onClick={withdraw}>
            Withdraw flags
          </button>
        </div>
      </form>
      <article className="stamp">
        <p className="stamp-word">{consent.state}</p>
        <p>
          {consent.updatedAt ? `Updated ${formatWhen(consent.updatedAt)}` : "No consent write on this session yet."}
        </p>
        <p className="muted">Outbound send: {consent.channelSend}. This screen has no sender.</p>
      </article>
    </MarketingChrome>
  );
}
