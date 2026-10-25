import { useReadState } from "../shell/read-state-params";
import { readSettled, ReadView, ReadFilter } from "./ReadState";
import { messages as copy0 } from "../i18n/messages/pages--Platform";
import { messages as copy1 } from "../i18n/messages/platform-journey";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { useRestoreFocus } from "../a11y/focus";
import { usePlatformJourney } from "../platform-journey";
import {
  IdentitySection,
  PlatformBanner,
  PlatformControls,
  PlatformStatus,
  RightsSection,
  SessionSection,
  TradesSection,
} from "./PlatformPanels";

export function PlatformPage() {
  return <PlatformScreen live={usePlatformJourney()} />;
}

export function PlatformScreen({ live }: { live: ReturnType<typeof usePlatformJourney> }) {
  const t = useT(copy0, copy1);
  const model = live.model;
  const channels = model.rights.flatMap((right) => right.listings.map((listing) => listing.channel));
  const channelWords = new Map(model.rights.flatMap((right) => right.listings.map((listing) => [listing.channel, listing.channelWord] as const)));
  const tradesFor = (channel?: string) => model.trades.filter((trade) => !channel || trade.channelWord === channelWords.get(channel as "web-board" | "partner-board"));
  const read = useReadState("platform", {
    channel:  !readSettled(model.state) ? null : channels,
    trade: (values) =>  !readSettled(model.state) ? null : tradesFor(values.channel).map((trade) => trade.tradeRef),
  });
  const view = { ...model, rights: model.rights.map((right) => ({ ...right, listings: right.listings.filter((listing) => !read.values.channel || listing.channel === read.values.channel) })), trades: tradesFor(read.values.channel) };
  // A block, a rejection, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "platform-status");

  return (
    <ReadView state={read}>
    <ReadFilter state={read} name="channel" options={channels} />
    <div className="discovery platform" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label={t("s18j")}>
        <a href="#platform-controls">{t("sed")}</a>
        <a href="#platform-status">{t("s1mj")}</a>
        <a href="#platform-rights">{t("s1hb")}</a>
        <a href="#platform-trades">{t("s24g")}</a>
        <a href="#platform-session">{t("s1js")}</a>
        <a href="#platform-identity">{t("snr")}</a>
      </nav>
      <div className="discovery-body">
        <PlatformBanner environment={live.environment} scenario={live.scenario} model={model} />
        <PlatformControls
          scenario={live.scenario}
          heldSupported={live.heldSupported}
          lateSupported={live.lateSupported}
          actions={live.actions}
        />
        <PlatformStatus model={model} />
        {model.actionLabel ? (
          <button
            type="button"
            id="platform-return-action"
            className="discovery-action"
            onClick={() => (model.state === "tuple-changed" ? live.actions.newSession() : live.actions.refresh())}
          >
            {deskText(t, model.actionLabel)}
          </button>
        ) : null}
        <RightsSection model={view} actions={live.actions} />
        <TradesSection model={view} actions={live.actions} />
        <SessionSection session={model.session} />
        <IdentitySection rows={model.identity} />
      </div>
    </div>
    </ReadView>
  );
}
