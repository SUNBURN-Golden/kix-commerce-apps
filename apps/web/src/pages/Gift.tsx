import { messages as copy0 } from "../i18n/messages/pages--Gift";
import { messages as copy1 } from "../i18n/messages/gift-desk";
import { messages as copy2 } from "../i18n/messages/storage-allow-list";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { useState } from "react";
import { useRestoreFocus } from "../a11y/focus";
import { GIFT_DEFAULT_RECIPIENT, GIFT_DONOR, emptyDraft, useGiftDesk, type GiftDraft } from "../gift-desk";
import { GiftPanel } from "./GiftPanel";

export function GiftPage() {
  const t = useT(copy0, copy1, copy2);
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
        <p className="eyebrow">{t("smi")}</p>
        <h2>{t("smm")}</h2>
        <p className="muted">
          {t("s13v")}</p>
      </header>
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label htmlFor="gift-id">
          {t("smf")}<input id="gift-id" value={giftId} onChange={(event) => setGiftId(event.target.value)} autoComplete="off" />
        </label>
        <label htmlFor="gift-ticket-id">
          {t("s242")}<input
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
          {t("sk8")}<input
            id="gift-expected-version"
            value={draft.expectedVersion}
            disabled={offerLocked}
            inputMode="numeric"
            placeholder={t("sas")}
            onChange={(event) => patch({ expectedVersion: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label htmlFor="gift-expires-at">
          {t("skb")}<input
            id="gift-expires-at"
            value={draft.expiresAt}
            disabled={offerLocked}
            inputMode="numeric"
            placeholder={t("sas")}
            onChange={(event) => patch({ expiresAt: event.target.value })}
            autoComplete="off"
          />
        </label>
        <p className="muted">
          {t("skd")}</p>
        <label htmlFor="gift-recipient">
          {t("s1di")}<input
            id="gift-recipient"
            value={draft.recipient}
            disabled={offerLocked}
            onChange={(event) => patch({ recipient: event.target.value })}
            autoComplete="off"
          />
        </label>
        <p className="muted">{t("sh5")}{" "}{deskText(t, GIFT_DONOR)}{t("sfr")}{" "}{deskText(t, GIFT_DEFAULT_RECIPIENT)}.</p>
      </form>
      <GiftPanel model={model} />
    </section>
  );
}
