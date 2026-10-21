import type { ValidationHandle } from "../forms/useFormValidation";
import { ValidatedForm } from "../forms/ValidatedForm";
import { field } from "../forms/validation";
import { useRef, useState } from "react";
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
  const validation = useRef<ValidationHandle>(null);
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
      <ValidatedForm id="organizer-form" validationRef={validation} submitFields={["organizer-event", "organizer-seats", "organizer-quota"]} fields={[
          field("organizer-event", "validation.label.eventId"),
          field("organizer-seats", "validation.label.seats", { kind: "seats" }),
          field("organizer-quota", "validation.label.quota", { kind: "integer", optional: true }),
          field("organizer-inventory", "validation.label.inventoryId"),
          field("organizer-version", "validation.label.version", { kind: "integer" }),
          field("organizer-recipient", "validation.label.recipient"),
        ]}
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label>
          Event id
          <input id="organizer-event" value={eventId} onChange={(event) => setEventId(event.target.value)} autoComplete="off" />
        </label>
        <label>
          Seats
          <input id="organizer-seats"
            value={draft.seats}
            disabled={createLocked}
            placeholder="Comma-separated seat ids"
            onChange={(event) => patch({ seats: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          Invitation quota
          <input id="organizer-quota"
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
          <input id="organizer-inventory"
            value={draft.inventoryId}
            placeholder="Caller-supplied inventory id"
            onChange={(event) => patch({ inventoryId: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          Expected inventory version
          <input id="organizer-version"
            value={draft.expectedInventoryVersion}
            inputMode="numeric"
            placeholder="Caller-supplied integer"
            onChange={(event) => patch({ expectedInventoryVersion: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          Recipient
          <input id="organizer-recipient"
            value={draft.recipient}
            onChange={(event) => patch({ recipient: event.target.value })}
            autoComplete="off"
          />
        </label>
        <p className="muted">
          Operator {ORGANIZER_OPERATOR}. Organizer {ORGANIZER_DEFAULT_ID}. The synthetic show policy is a fixture, not a
          policy. It is not shown.
        </p>
      </ValidatedForm>
      <OrganizerPanel model={{ ...model, send: (step) => {
        const ids = step === "create_event" ? ["organizer-event", "organizer-seats", "organizer-quota"]
          : step === "issue_invitation" ? ["organizer-event", "organizer-inventory", "organizer-version", "organizer-recipient"]
          : ["organizer-event"];
        if (validation.current?.validate(ids)) model.send(step);
      } }} />
    </section>
  );
}
