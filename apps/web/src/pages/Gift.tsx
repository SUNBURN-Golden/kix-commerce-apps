import { useState } from "react";
import { useRestoreFocus } from "../a11y/focus";
import { GIFT_DEFAULT_RECIPIENT, GIFT_DONOR, emptyDraft, useGiftDesk, type GiftDraft } from "../gift-desk";
import { GiftPanel } from "./GiftPanel";

export function GiftPage() {
  const [giftId, setGiftId] = useState("");
  const [draft, setDraft] = useState<GiftDraft>(emptyDraft());
  const model = useGiftDesk(giftId, draft);
  const fault = model.rows.find(
    (row) => row.status === "rejected" || row.status === "not-sent" || row.status === "unconfirmed",
  );
  useRestoreFocus(fault ? `${fault.step}:${fault.status}:${fault.note}` : null, "gift-ticket-id");
  const offer = model.rows.find((row) => row.step === "offer_gift");
  const offerLocked = offer !== undefined && offer.status !== "ready" && offer.status !== "not-started";

  function patch(partial: Partial<GiftDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  return (
    <section>
      <header className="section-head">
        <p className="eyebrow">Gift · P02 transfer</p>
        <h2>Gift transfer</h2>
        <p className="muted">
          Offer a right the caller already holds, then accept or cancel that offer. Gift offer is not a credit draw.
          No funds.
        </p>
      </header>
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label htmlFor="gift-id">
          Gift id
          <input id="gift-id" value={giftId} onChange={(event) => setGiftId(event.target.value)} autoComplete="off" />
        </label>
        <label htmlFor="gift-ticket-id">
          Ticket id
          <input
            id="gift-ticket-id"
            value={draft.ticketId}
            disabled={offerLocked && fault === undefined}
            readOnly={fault !== undefined}
            aria-invalid={fault !== undefined}
            onChange={(event) => patch({ ticketId: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label htmlFor="gift-expected-version">
          Expected version
          <input
            id="gift-expected-version"
            value={draft.expectedVersion}
            disabled={offerLocked}
            inputMode="numeric"
            placeholder="Caller-supplied integer"
            onChange={(event) => patch({ expectedVersion: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label htmlFor="gift-expires-at">
          Expires at
          <input
            id="gift-expires-at"
            value={draft.expiresAt}
            disabled={offerLocked}
            inputMode="numeric"
            placeholder="Caller-supplied integer"
            onChange={(event) => patch({ expiresAt: event.target.value })}
            autoComplete="off"
          />
        </label>
        <p className="muted">
          expiresAt is a caller-supplied integer. This page does not turn that integer into an expiry decision. Display
          locale does not decide expiry.
        </p>
        <label htmlFor="gift-recipient">
          Recipient
          <input
            id="gift-recipient"
            value={draft.recipient}
            disabled={offerLocked}
            onChange={(event) => patch({ recipient: event.target.value })}
            autoComplete="off"
          />
        </label>
        <p className="muted">Donor {GIFT_DONOR}. Default recipient {GIFT_DEFAULT_RECIPIENT}.</p>
      </form>
      <GiftPanel model={model} />
    </section>
  );
}
