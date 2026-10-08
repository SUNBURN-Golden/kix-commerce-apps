import { useState } from "react";
import { GIFT_DEFAULT_RECIPIENT, GIFT_DONOR, emptyDraft, useGiftDesk, type GiftDraft } from "../gift-desk";
import { GiftPanel } from "./GiftPanel";

export function GiftPage() {
  const [giftId, setGiftId] = useState("");
  const [draft, setDraft] = useState<GiftDraft>(emptyDraft());
  const model = useGiftDesk(giftId, draft);
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
        <label>
          Gift id
          <input value={giftId} onChange={(event) => setGiftId(event.target.value)} autoComplete="off" />
        </label>
        <label>
          Ticket id
          <input
            value={draft.ticketId}
            disabled={offerLocked}
            onChange={(event) => patch({ ticketId: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          Expected version
          <input
            value={draft.expectedVersion}
            disabled={offerLocked}
            inputMode="numeric"
            placeholder="Caller-supplied integer"
            onChange={(event) => patch({ expectedVersion: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          Expires at
          <input
            value={draft.expiresAt}
            disabled={offerLocked}
            inputMode="numeric"
            placeholder="Caller-supplied integer"
            onChange={(event) => patch({ expiresAt: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          Recipient
          <input
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
