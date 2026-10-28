import { messages as copy0 } from "../i18n/messages/pages--InstallableMobilePanels";
import { messages as copy1 } from "../i18n/messages/installable-mobile";
import { messages as copy2 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
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
  const t = useT(copy0, copy1, copy2);
  return (
    <span className="status-mark" data-status-mark="blocked">
      <span className="status-word">{deskText(t, word)}</span>
    </span>
  );
}

/** A wide table scrolls inside its own region, so the page does not scroll sideways. */
function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <div className="platform-scroll" role="region" aria-label={deskText(t, label)} tabIndex={0}>
      {deskText(t, children)}
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
  const t = useT(copy0, copy1, copy2);
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
        {deskText(t, label)}
      </ConnectivityWriteButton>
      {control.reason ? (
        <p id={reasonId} className="muted" data-blocked-reason="true">
          <WordMark word={t("status.transport.blocked")} /> {deskText(t, control.reason)}
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
  const t = useT(copy0, copy1, copy2);
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">{t("so0")}</p>
      <h2>{deskText(t, MOBILE_TITLE)}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-mobile-shell">
        SYNTHETIC. {deskText(t, MOBILE_SOURCE_LINE)}
      </p>
      <p data-environment-line="true">{deskText(t, model.environmentLine)}</p>
      <p>{deskText(t, MOBILE_BOUNDARY)}</p>
      <p data-vault-note="true">{deskText(t, MOBILE_VAULT_NOTE)}</p>
      <p data-clock-note="true">{deskText(t, MOBILE_CLOCK_NOTE)}</p>
      <p data-resume-note="true">{deskText(t, MOBILE_RESUME_NOTE)}</p>
      <p>{deskText(t, MOBILE_SESSION_NOTE)}</p>
      <p>{deskText(t, MOBILE_ORDER_NOTE)}</p>
      <p>{deskText(t, MOBILE_SUPPORT_NOTE)}</p>
      <AmountNotice />
      <p>{deskText(t, MOBILE_AMOUNT_NOTE)}</p>
      <p>{deskText(t, WORKSPACE_RULING)}</p>
      <p data-hold-record="not-bound">{deskText(t, MOBILE_HOLD_NOTE)}</p>
      <p>{deskText(t, MOBILE_FENCE_NOTE)}</p>
      <p>{deskText(t, MOBILE_READ_NOTE)}</p>
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
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mobile-controls" className="discovery-section" aria-label={t("s1o9")}>
      <div className="discovery-controls">
        <label htmlFor="mobile-scenario">
          {t("s1p5")}<select
            id="mobile-scenario"
            value={scenario}
            onChange={(event) => actions.setScenario(event.target.value as MobileScenario)}
          >
            {deskText(t, MOBILE_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {deskText(t, item)}
              </option>
            )))}
          </select>
        </label>
        <label htmlFor="mobile-clock">
          {t("s1fp")}<select
            id="mobile-clock"
            value={clockMode}
            onChange={(event) => actions.setClockMode(event.target.value as MobileClockMode)}
          >
            {deskText(t, MOBILE_CLOCK_MODES.map((item) => (
              <option key={item} value={item}>
                {deskText(t, item)}
              </option>
            )))}
          </select>
        </label>
        <button type="button" id="mobile-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          {t("s1ax")}</button>
        <button type="button" id="mobile-resume" className="discovery-action" onClick={() => actions.resume()}>
          {t("s1gm")}</button>
        <ConnectivityWriteButton type="button" id="mobile-drop" className="discovery-action" onClick={() => actions.dropConnection()}>
          {t("shi")}</ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="mobile-restore" className="discovery-action" onClick={() => actions.restoreConnection()}>
          {t("s1gk")}</ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="mobile-offer-update" className="discovery-action" onClick={() => actions.offerUpdate()}>
          {t("s13y")}</ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="mobile-expire" className="discovery-action" onClick={() => actions.expireSession()}>
          {t("ske")}</ConnectivityWriteButton>
        <button type="button" id="mobile-deliver-held" className="discovery-action" onClick={() => actions.deliverHeld()}>
          {t("sg2")}</button>
        <button type="button" id="mobile-deliver-late" className="discovery-action" onClick={() => actions.deliverLate()}>
          {t("sg4")}</button>
        <button type="button" id="mobile-switch" className="discovery-action" onClick={() => actions.switchContext()}>
          {t("s1ff")}</button>
        <ConnectivityWriteButton type="button" id="mobile-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          {t("s1m2")}</ConnectivityWriteButton>
      </div>
      <p className="muted" data-scenario-note={scenario}>
        {deskText(t, SCENARIO_NOTES[scenario])} {t("sbx")}</p>
      <p className="muted" data-clock-mode={clockMode}>
        {deskText(t, MOBILE_CLOCK_MODE_NOTES[clockMode])}
      </p>
      <p className="muted" id="mobile-deliver-note">
        {t("s1fg")}</p>
    </section>
  );
}

export function MobileStatus({ model }: { model: MobileModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mobile-status" className="discovery-section" tabIndex={-1} aria-live="polite" aria-busy={model.state === "loading"} data-mobile-state={model.state}>
      <h3>{t("s1mj")}</h3>
      <p data-mobile-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {deskText(t, model.statusLine)}
        {model.detailLine ? t("sgg", { detailLine: model.detailLine }) : ""}
      </p>
      <p className="muted" aria-live="off">{deskText(t, model.freshnessWord)}</p>
      {model.cachedWord ? (
        <p className="muted" aria-live="off" data-cached="true">
          {deskText(t, model.cachedWord)}
        </p>
      ) : null}
      {model.lastLine ? (
        <p data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word={t("s91")} /> : null} {deskText(t, model.lastLine)}
        </p>
      ) : null}
    </section>
  );
}

export function DeviceSection({ device }: { device: DeviceModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mobile-device" className="discovery-section" aria-label={t("sqv")}>
      <h3>{t("sqv")}</h3>
      <p data-link={device.linkWord}>{deskText(t, device.linkLine)}</p>
      <p data-clock-verdict={device.clockWord}>{deskText(t, device.clockLine)}</p>
    </section>
  );
}

export function InstallSection({ install, actions }: { install: InstallModel | null; actions: MobileActions }) {
  const t = useT(copy0, copy1, copy2);
  if (install === null) {
    return (
      <section id="mobile-install" className="discovery-section" aria-label={t("so2")}>
        <h3>{t("so2")}</h3>
        <p data-state="empty">{t("svr")}</p>
      </section>
    );
  }
  return (
    <section id="mobile-install" className="discovery-section" aria-label={t("so2")} data-install={install.stateWord}>
      <h3>{t("so2")}</h3>
      <p>{deskText(t, install.installLine)}</p>
      <p>{deskText(t, install.shellLine)}</p>
      {install.updateLine ? <p data-update-offer="true">{deskText(t, install.updateLine)}</p> : null}
      <GuardedButton
        id="mobile-install-action"
        label={t("so6")}
        control={install.install}
        onPress={() => actions.install()}
      />
      <GuardedButton
        id="mobile-update-action"
        label={t("s5p")}
        control={install.update}
        onPress={() => actions.update()}
      />
    </section>
  );
}

export function SessionSection({ session, actions }: { session: SessionViewModel | null; actions: MobileActions }) {
  const t = useT(copy0, copy1, copy2);
  if (session === null) {
    return (
      <section id="mobile-session" className="discovery-section" aria-label={t("s1jl")}>
        <h3>{t("s1jl")}</h3>
        <p data-state="empty">{t("syj")}</p>
      </section>
    );
  }
  return (
    <section id="mobile-session" className="discovery-section" aria-label={t("s1jl")} data-session={session.stateWord}>
      <h3>{t("s1jl")}</h3>
      <p>{session.sessionRef === null ? t("syl") : t("s1ju", { sessionRef: session.sessionRef })}</p>
      <p>{deskText(t, session.actorLine)}</p>
      <p data-session-verdict={session.stateWord}>{deskText(t, session.verdictLine)}</p>
      <GuardedButton
        id="mobile-reconnect-action"
        label={t("s1do")}
        control={session.reconnect}
        onPress={() => actions.reconnect()}
      />
    </section>
  );
}

function VaultCard({ item, actions }: { item: VaultItemModel; actions: MobileActions }) {
  const t = useT(copy0, copy1, copy2);
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
        <span className="discovery-badge">{deskText(t, item.currencyLabel)}</span>
      </p>
      <h4>
        {deskText(t, item.label)} — {deskText(t, item.vaultRef)}
      </h4>
      <p>{deskText(t, item.ownerLine)}</p>
      <p>{deskText(t, item.storedLine)}</p>
      <p>{deskText(t, item.verdictLine)}</p>
      <p data-copy-note="true">
        {t("s8h")}</p>
      <p data-present-line="true">{deskText(t, item.presentLine)}</p>
      <GuardedButton
        id={`mobile-present-${item.vaultRef}`}
        label={t("s18z")}
        control={item.present}
        onPress={() => actions.present(item.vaultRef)}
      />
    </li>
  );
}

export function VaultSection({ model, actions }: { model: MobileModel; actions: MobileActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mobile-vault" className="discovery-section" aria-label={t("s1ms")}>
      <h3>{t("s1ms")}</h3>
      <p className="muted">{deskText(t, MOBILE_VAULT_NOTE)}</p>
      {model.vault.length === 0 ? <p data-state="empty">{t("syt")}</p> : null}
      {model.vault.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s1mt")}>
          {deskText(t, model.vault.map((item) => (
            <VaultCard key={item.vaultRef} item={item} actions={actions} />
          )))}
        </ul>
      ) : null}
    </section>
  );
}

export function OrderSection({ order, actions }: { order: OrderViewModel | null; actions: MobileActions }) {
  const t = useT(copy0, copy1, copy2);
  if (order === null) {
    return (
      <section id="mobile-order" className="discovery-section" aria-label={t("s17r")}>
        <h3>{t("s17r")}</h3>
        <p data-state="empty">{t("swj")}</p>
      </section>
    );
  }
  return (
    <section id="mobile-order" className="discovery-section" aria-label={t("s17r")} data-order-state={order.stateWord}>
      <h3>{t("s17r")}{" "}{order.orderRef}</h3>
      <p>{deskText(t, order.amountWord)}</p>
      <p>{deskText(t, order.versionLine)}</p>
      <p data-confirm-line="true">{deskText(t, order.confirmLine)}</p>
      <p data-withdraw-line="true">{deskText(t, order.withdrawLine)}</p>
      <GuardedButton
        id={`mobile-confirm-${order.orderRef}`}
        label={t("sdm")}
        control={order.confirm}
        onPress={() => actions.confirm(order.orderRef)}
      />
      <GuardedButton
        id={`mobile-withdraw-${order.orderRef}`}
        label={t("s26u")}
        control={order.withdraw}
        onPress={() => actions.withdraw(order.orderRef)}
      />
      <p className="muted">{deskText(t, MOBILE_ORDER_NOTE)}</p>
    </section>
  );
}

export function SupportSection({ support }: { support: SupportRowModel[] }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mobile-support" className="discovery-section" aria-label={t("s1no")}>
      <h3>{t("s1no")}</h3>
      <p className="muted">{deskText(t, MOBILE_SUPPORT_NOTE)}</p>
      {support.length === 0 ? <p data-state="empty">{t("syy")}</p> : null}
      {support.length > 0 ? (
        <ScrollTable label={t("sfi")}>
          <table className="platform-register">
            <caption>{t("s21m")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("sbb")}</th>
                <th scope="col">{t("s25y")}</th>
                <th scope="col">{t("s10r")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, support.map((row) => (
                <tr key={row.id} data-support={row.id} data-verdict={row.verdict}>
                  <th scope="row">{deskText(t, row.id)}</th>
                  <td>{deskText(t, row.verdict)}</td>
                  <td>{deskText(t, row.note)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </ScrollTable>
      ) : null}
    </section>
  );
}

export function RecordSection({ record }: { record: RecordModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mobile-record" className="discovery-section" aria-label={t("s1js")}>
      <h3>{t("s1js")}</h3>
      <p>{deskText(t, record.contextLine)}</p>
      <p data-counters="true">{deskText(t, record.countersLine)}</p>
      {record.intents.length === 0 ? (
        <p data-state="empty">{t("s137")}</p>
      ) : (
        <ScrollTable label={t("s272")}>
          <table className="platform-intents">
            <caption>{t("s272")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("soe")}</th>
                <th scope="col">{t("s270")}</th>
                <th scope="col">{t("s1pe")}</th>
                <th scope="col">{t("s16g")}</th>
                <th scope="col">{t("error.fact.code")}</th>
                <th scope="col">{t("sqg")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, record.intents.map((intent) => (
                <tr key={intent.intentRef} data-intent={intent.intentRef} data-outcome={intent.outcome}>
                  <th scope="row">{deskText(t, intent.intentRef)}</th>
                  <td>{deskText(t, intent.stepWord)}</td>
                  <td>{deskText(t, intent.targetRef)}</td>
                  <td>{deskText(t, intent.outcome)}</td>
                  <td>{deskText(t, intent.code)}</td>
                  <td>{deskText(t, intent.lateLine)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </ScrollTable>
      )}
      {deskText(t, record.unlinkedLines.map((line) => (
        <p key={line} data-unlinked="true">
          {deskText(t, line)}
        </p>
      )))}
      {deskText(t, record.quarantineLines.map((line) => (
        <p key={line} data-quarantined="true">
          {deskText(t, line)}
        </p>
      )))}
    </section>
  );
}

export function IdentitySection({ rows }: { rows: IdentityRowModel[] }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mobile-identity" className="discovery-section" aria-label={t("snr")}>
      <h3>{t("snr")}</h3>
      <p className="muted">
        {t("sth")}</p>
      <ScrollTable label={t("snr")}>
        <table className="platform-register">
          <caption>{t("s26l")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("snq")}</th>
              <th scope="col">{t("sl2")}</th>
              <th scope="col">{t("s1mj")}</th>
              <th scope="col">{t("s186")}</th>
              <th scope="col">{t("s10r")}</th>
            </tr>
          </thead>
          <tbody>
            {deskText(t, rows.map((row) => (
              <tr key={row.id} data-identity-row={row.id} data-status={row.status}>
                <th scope="row">{deskText(t, row.id)}</th>
                <td>{deskText(t, row.shellField)}</td>
                <td>{deskText(t, row.statusWord)}</td>
                <td>{deskText(t, row.bodyFields)}</td>
                <td>{deskText(t, row.reason)}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </ScrollTable>
    </section>
  );
}
