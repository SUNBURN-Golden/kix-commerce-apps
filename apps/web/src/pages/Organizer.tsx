import { useState } from "react";
import {
  ORGANIZER_DEFAULT_ID,
  ORGANIZER_OPERATOR,
  emptyDraft,
  useOrganizerDesk,
  type OrganizerDraft,
} from "../organizer-desk";
import { OrganizerPanel } from "./OrganizerPanel";

export function OrganizerPage() {
  const [eventId, setEventId] = useState("");
  const [draft, setDraft] = useState<OrganizerDraft>(emptyDraft());
  const model = useOrganizerDesk(eventId, draft);
  const created = model.rows.find((row) => row.step === "create_event");
  const createLocked = created !== undefined && created.status !== "ready" && created.status !== "not-started";

  function patch(partial: Partial<OrganizerDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  return (
    <section>
      <header className="section-head">
        <p className="eyebrow">Organizer · event lifecycle</p>
        <h2>Organizer console</h2>
        <p className="muted">
          Send create, close sales, open admission, complete, cancel, and issue invitation for an event id the caller
          types. No funds.
        </p>
      </header>
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label>
          Event id
          <input value={eventId} onChange={(event) => setEventId(event.target.value)} autoComplete="off" />
        </label>
        <label>
          Seats
          <input
            value={draft.seats}
            disabled={createLocked}
            placeholder="Comma-separated seat ids"
            onChange={(event) => patch({ seats: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          Invitation quota
          <input
            value={draft.invitationQuota}
            disabled={createLocked}
            inputMode="numeric"
            placeholder="Caller-supplied integer, or leave blank"
            onChange={(event) => patch({ invitationQuota: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          Inventory id
          <input
            value={draft.inventoryId}
            placeholder="Caller-supplied inventory id"
            onChange={(event) => patch({ inventoryId: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          Expected inventory version
          <input
            value={draft.expectedInventoryVersion}
            inputMode="numeric"
            placeholder="Caller-supplied integer"
            onChange={(event) => patch({ expectedInventoryVersion: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          Recipient
          <input
            value={draft.recipient}
            onChange={(event) => patch({ recipient: event.target.value })}
            autoComplete="off"
          />
        </label>
        <p className="muted">
          Operator {ORGANIZER_OPERATOR}. Organizer {ORGANIZER_DEFAULT_ID}. The synthetic show policy is a fixture, not a
          policy. It is not shown.
        </p>
      </form>
      <OrganizerPanel model={model} />
    </section>
  );
}
