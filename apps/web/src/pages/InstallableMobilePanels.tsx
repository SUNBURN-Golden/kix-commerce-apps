import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import type { ReactNode } from "react";
import { MOBILE_SCENARIOS, type MobileScenario } from "@kix/protocol-adapter";
import { AmountNotice, StatusMark } from "../a11y/marks";
import {
  MOBILE_AMOUNT_NOTE,
  MOBILE_BOUNDARY,
  MOBILE_CLOCK_MODE_NOTES,
  MOBILE_CLOCK_MODES,
  MOBILE_CLOCK_NOTE,
  MOBILE_FENCE_NOTE,
  MOBILE_HOLD_NOTE,
  MOBILE_ORDER_NOTE,
  MOBILE_READ_NOTE,
  MOBILE_RESUME_NOTE,
  MOBILE_SESSION_NOTE,
  MOBILE_SOURCE_LINE,
  MOBILE_SUPPORT_NOTE,
  MOBILE_TITLE,
  MOBILE_VAULT_NOTE,
  SCENARIO_NOTES,
  type ControlModel,
  type DeviceModel,
  type IdentityRowModel,
  type InstallModel,
  type MobileActions,
  type MobileClockMode,
  type MobileModel,
  type OrderViewModel,
  type RecordModel,
  type SessionViewModel,
  type SupportRowModel,
  type VaultItemModel,
} from "../installable-mobile";
import { WORKSPACE_RULING } from "../workspace/registry";

/** A word, not only a color. The shared mark carries a sentence about fields that does not fit a fence. */
function WordMark({ word }: { word: string }) {
  return (
    <span className="status-mark" data-status-mark="blocked">
      <span className="status-word">{word}</span>
    </span>
  );
}

/** A wide table scrolls inside its own region, so the page does not scroll sideways. */
function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="platform-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

/**
 * A control that is off stays focusable and says why. A native disabled button is
 * skipped by the keyboard, so its reason would never be reached.
 */
function GuardedButton({
  id,
  label,
  control,
  onPress,
}: {
  id: string;
  label: string;
  control: ControlModel;
  onPress: () => void;
}) {
  const reasonId = `${id}-reason`;
  return (
    <>
      <ConnectivityWriteButton
        type="button"
        id={id}
        className="discovery-action"
        aria-disabled={control.enabled ? undefined : true}
        aria-describedby={control.reason ? reasonId : undefined}
        data-enabled={control.enabled ? "true" : "false"}
        onClick={control.enabled ? onPress : undefined}
      >
        {label}
      </ConnectivityWriteButton>
      {control.reason ? (
        <p id={reasonId} className="muted" data-blocked-reason="true">
          <WordMark word="Blocked." /> {control.reason}
        </p>
      ) : null}
    </>
  );
}

export function MobileBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: MobileScenario;
  model: MobileModel;
}) {
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">Installable mobile shell</p>
      <h2>{MOBILE_TITLE}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-mobile-shell">
        SYNTHETIC. {MOBILE_SOURCE_LINE}
      </p>
      <p data-environment-line="true">{model.environmentLine}</p>
      <p>{MOBILE_BOUNDARY}</p>
      <p data-vault-note="true">{MOBILE_VAULT_NOTE}</p>
      <p data-clock-note="true">{MOBILE_CLOCK_NOTE}</p>
      <p data-resume-note="true">{MOBILE_RESUME_NOTE}</p>
      <p>{MOBILE_SESSION_NOTE}</p>
      <p>{MOBILE_ORDER_NOTE}</p>
      <p>{MOBILE_SUPPORT_NOTE}</p>
      <AmountNotice />
      <p>{MOBILE_AMOUNT_NOTE}</p>
      <p>{WORKSPACE_RULING}</p>
      <p data-hold-record="not-bound">{MOBILE_HOLD_NOTE}</p>
      <p>{MOBILE_FENCE_NOTE}</p>
      <p>{MOBILE_READ_NOTE}</p>
    </header>
  );
}

export function MobileControls({
  scenario,
  clockMode,
  actions,
}: {
  scenario: MobileScenario;
  clockMode: MobileClockMode;
  actions: MobileActions;
}) {
  return (
    <section id="mobile-controls" className="discovery-section" aria-label="Synthetic controls">
      <div className="discovery-controls">
        <label htmlFor="mobile-scenario">
          Synthetic scenario
          <select
            id="mobile-scenario"
            value={scenario}
            onChange={(event) => actions.setScenario(event.target.value as MobileScenario)}
          >
            {MOBILE_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="mobile-clock">
          Reported device clock
          <select
            id="mobile-clock"
            value={clockMode}
            onChange={(event) => actions.setClockMode(event.target.value as MobileClockMode)}
          >
            {MOBILE_CLOCK_MODES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button type="button" id="mobile-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          Read again
        </button>
        <button type="button" id="mobile-resume" className="discovery-action" onClick={() => actions.resume()}>
          Resume app
        </button>
        <ConnectivityWriteButton type="button" id="mobile-drop" className="discovery-action" onClick={() => actions.dropConnection()}>
          Drop connection
        </ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="mobile-restore" className="discovery-action" onClick={() => actions.restoreConnection()}>
          Restore connection
        </ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="mobile-offer-update" className="discovery-action" onClick={() => actions.offerUpdate()}>
          Offer shell update
        </ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="mobile-expire" className="discovery-action" onClick={() => actions.expireSession()}>
          Expire session
        </ConnectivityWriteButton>
        <button type="button" id="mobile-deliver-held" className="discovery-action" onClick={() => actions.deliverHeld()}>
          Deliver held response
        </button>
        <button type="button" id="mobile-deliver-late" className="discovery-action" onClick={() => actions.deliverLate()}>
          Deliver late result
        </button>
        <button type="button" id="mobile-switch" className="discovery-action" onClick={() => actions.switchContext()}>
          Re-login as another actor
        </button>
        <ConnectivityWriteButton type="button" id="mobile-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          Start a new synthetic session
        </ConnectivityWriteButton>
      </div>
      <p className="muted" data-scenario-note={scenario}>
        {SCENARIO_NOTES[scenario]} Changing the scenario starts a new synthetic session.
      </p>
      <p className="muted" data-clock-mode={clockMode}>
        {MOBILE_CLOCK_MODE_NOTES[clockMode]}
      </p>
      <p className="muted" id="mobile-deliver-note">
        Re-login moves to another actor string and a new session number. Start a new synthetic session clears every
        intent, as a reload does, and resolves nothing at the source. The link, update, session, held, and late
        controls are synthetic: a real shell offers none of them.
      </p>
    </section>
  );
}

export function MobileStatus({ model }: { model: MobileModel }) {
  return (
    <section id="mobile-status" className="discovery-section" tabIndex={-1} data-mobile-state={model.state}>
      <h3>Status</h3>
      <p role="status" data-mobile-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {model.statusLine}
        {model.detailLine ? ` ${model.detailLine}` : ""}
      </p>
      <p className="muted">{model.freshnessWord}</p>
      {model.cachedWord ? (
        <p className="muted" data-cached="true">
          {model.cachedWord}
        </p>
      ) : null}
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word="Attention." /> : null} {model.lastLine}
        </p>
      ) : null}
    </section>
  );
}

export function DeviceSection({ device }: { device: DeviceModel }) {
  return (
    <section id="mobile-device" className="discovery-section" aria-label="Link and clock">
      <h3>Link and clock</h3>
      <p data-link={device.linkWord}>{device.linkLine}</p>
      <p data-clock-verdict={device.clockWord}>{device.clockLine}</p>
    </section>
  );
}

export function InstallSection({ install, actions }: { install: InstallModel | null; actions: MobileActions }) {
  if (install === null) {
    return (
      <section id="mobile-install" className="discovery-section" aria-label="Install and update">
        <h3>Install and update</h3>
        <p data-state="empty">No install record in this read.</p>
      </section>
    );
  }
  return (
    <section id="mobile-install" className="discovery-section" aria-label="Install and update" data-install={install.stateWord}>
      <h3>Install and update</h3>
      <p>{install.installLine}</p>
      <p>{install.shellLine}</p>
      {install.updateLine ? <p data-update-offer="true">{install.updateLine}</p> : null}
      <GuardedButton
        id="mobile-install-action"
        label="Install the shell"
        control={install.install}
        onPress={() => actions.install()}
      />
      <GuardedButton
        id="mobile-update-action"
        label="Apply the offered update"
        control={install.update}
        onPress={() => actions.update()}
      />
    </section>
  );
}

export function SessionSection({ session, actions }: { session: SessionViewModel | null; actions: MobileActions }) {
  if (session === null) {
    return (
      <section id="mobile-session" className="discovery-section" aria-label="Session">
        <h3>Session</h3>
        <p data-state="empty">No session in this read.</p>
      </section>
    );
  }
  return (
    <section id="mobile-session" className="discovery-section" aria-label="Session" data-session={session.stateWord}>
      <h3>Session</h3>
      <p>{session.sessionRef === null ? "No session reference." : `Session ${session.sessionRef}.`}</p>
      <p>{session.actorLine}</p>
      <p data-session-verdict={session.stateWord}>{session.verdictLine}</p>
      <GuardedButton
        id="mobile-reconnect-action"
        label="Reconnect session"
        control={session.reconnect}
        onPress={() => actions.reconnect()}
      />
    </section>
  );
}

function VaultCard({ item, actions }: { item: VaultItemModel; actions: MobileActions }) {
  return (
    <li
      className="discovery-row"
      data-vault={item.vaultRef}
      data-kind={item.kind}
      data-currency={item.currencyWord}
      data-verdict={item.verdictWord}
      data-provenance="synthetic"
      data-source="synthetic-mobile-shell"
    >
      <p>
        <span className="discovery-badge" data-provenance="synthetic">
          SYNTHETIC
        </span>{" "}
        <span className="discovery-badge">{item.currencyLabel}</span>
      </p>
      <h4>
        {item.label} — {item.vaultRef}
      </h4>
      <p>{item.ownerLine}</p>
      <p>{item.storedLine}</p>
      <p>{item.verdictLine}</p>
      <p data-copy-note="true">
        A stored copy. It grants no admission, offline or online, and it is never sent as authority.
      </p>
      <p data-present-line="true">{item.presentLine}</p>
      <GuardedButton
        id={`mobile-present-${item.vaultRef}`}
        label="Present this pass"
        control={item.present}
        onPress={() => actions.present(item.vaultRef)}
      />
    </li>
  );
}

export function VaultSection({ model, actions }: { model: MobileModel; actions: MobileActions }) {
  return (
    <section id="mobile-vault" className="discovery-section" aria-label="Stored items">
      <h3>Stored items</h3>
      <p className="muted">{MOBILE_VAULT_NOTE}</p>
      {model.vault.length === 0 ? <p data-state="empty">No stored item in this read.</p> : null}
      {model.vault.length > 0 ? (
        <ul className="discovery-list" aria-label="Stored items in the last read">
          {model.vault.map((item) => (
            <VaultCard key={item.vaultRef} item={item} actions={actions} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function OrderSection({ order, actions }: { order: OrderViewModel | null; actions: MobileActions }) {
  if (order === null) {
    return (
      <section id="mobile-order" className="discovery-section" aria-label="Pending order">
        <h3>Pending order</h3>
        <p data-state="empty">No order in this read.</p>
      </section>
    );
  }
  return (
    <section id="mobile-order" className="discovery-section" aria-label="Pending order" data-order-state={order.stateWord}>
      <h3>Pending order {order.orderRef}</h3>
      <p>{order.amountWord}</p>
      <p>{order.versionLine}</p>
      <p data-confirm-line="true">{order.confirmLine}</p>
      <p data-withdraw-line="true">{order.withdrawLine}</p>
      <GuardedButton
        id={`mobile-confirm-${order.orderRef}`}
        label="Confirm the order"
        control={order.confirm}
        onPress={() => actions.confirm(order.orderRef)}
      />
      <GuardedButton
        id={`mobile-withdraw-${order.orderRef}`}
        label="Withdraw the order"
        control={order.withdraw}
        onPress={() => actions.withdraw(order.orderRef)}
      />
      <p className="muted">{MOBILE_ORDER_NOTE}</p>
    </section>
  );
}

export function SupportSection({ support }: { support: SupportRowModel[] }) {
  return (
    <section id="mobile-support" className="discovery-section" aria-label="Support range">
      <h3>Support range</h3>
      <p className="muted">{MOBILE_SUPPORT_NOTE}</p>
      {support.length === 0 ? <p data-state="empty">No support range is read.</p> : null}
      {support.length > 0 ? (
        <ScrollTable label="Decided support range">
          <table className="platform-register">
            <caption>The support range this stub decides</caption>
            <thead>
              <tr>
                <th scope="col">Capability</th>
                <th scope="col">Verdict</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {support.map((row) => (
                <tr key={row.id} data-support={row.id} data-verdict={row.verdict}>
                  <th scope="row">{row.id}</th>
                  <td>{row.verdict}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      ) : null}
    </section>
  );
}

export function RecordSection({ record }: { record: RecordModel }) {
  return (
    <section id="mobile-record" className="discovery-section" aria-label="Session record">
      <h3>Session record</h3>
      <p>{record.contextLine}</p>
      <p data-counters="true">{record.countersLine}</p>
      {record.intents.length === 0 ? (
        <p data-state="empty">No write has been sent in this session.</p>
      ) : (
        <ScrollTable label="Writes in this session">
          <table className="platform-intents">
            <caption>Writes in this session</caption>
            <thead>
              <tr>
                <th scope="col">Intent</th>
                <th scope="col">Write</th>
                <th scope="col">Target</th>
                <th scope="col">Outcome</th>
                <th scope="col">Code</th>
                <th scope="col">Late</th>
              </tr>
            </thead>
            <tbody>
              {record.intents.map((intent) => (
                <tr key={intent.intentRef} data-intent={intent.intentRef} data-outcome={intent.outcome}>
                  <th scope="row">{intent.intentRef}</th>
                  <td>{intent.stepWord}</td>
                  <td>{intent.targetRef}</td>
                  <td>{intent.outcome}</td>
                  <td>{intent.code}</td>
                  <td>{intent.lateLine}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      )}
      {record.unlinkedLines.map((line) => (
        <p key={line} data-unlinked="true">
          {line}
        </p>
      ))}
      {record.quarantineLines.map((line) => (
        <p key={line} data-quarantined="true">
          {line}
        </p>
      ))}
    </section>
  );
}

export function IdentitySection({ rows }: { rows: IdentityRowModel[] }) {
  return (
    <section id="mobile-identity" className="discovery-section" aria-label="Identity links">
      <h3>Identity links</h3>
      <p className="muted">
        Naming a field in the pin is not binding it. The values on this page are synthetic references, and no body is
        built from them.
      </p>
      <ScrollTable label="Identity links">
        <table className="platform-register">
          <caption>Which identity has a named field in the pinned catalogue</caption>
          <thead>
            <tr>
              <th scope="col">Identity</th>
              <th scope="col">Field here</th>
              <th scope="col">Status</th>
              <th scope="col">Pinned fields</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-identity-row={row.id} data-status={row.status}>
                <th scope="row">{row.id}</th>
                <td>{row.shellField}</td>
                <td>{row.statusWord}</td>
                <td>{row.bodyFields}</td>
                <td>{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
    </section>
  );
}
