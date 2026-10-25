import { ORIGINATION_LANES } from "@kix/protocol-adapter";
import { useReadState } from "../shell/read-state-params";
import { readSettled, ReadView, ReadFilter } from "./ReadState";
import { messages as copy0 } from "../i18n/messages/pages--CreditOrigination";
import { messages as copy1 } from "../i18n/messages/credit-origination";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { useRestoreFocus } from "../a11y/focus";
import { useCreditOrigination } from "../credit-origination";
import {
  ApplicationSection,
  BasisSection,
  CommitmentSection,
  OriginationBanner,
  OriginationControls,
  OriginationSessionSection,
  OriginationStatus,
  PolicySection,
  ReasonsSection,
  RequestsSection,
} from "./CreditOriginationPanels";

export function CreditOriginationPage() {
  const t = useT(copy0, copy1);
  const live = useCreditOrigination();
  const model = live.model;
  const read = useReadState("credit-origination", { lane: ORIGINATION_LANES, application:  !readSettled(model.state) ? null : model.application ? [model.application.applicationRef] : [] });
  // A block, a refusal, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "origination-status");

  return (
    <ReadView state={read}>
    <ReadFilter state={read} name="lane" options={ORIGINATION_LANES} />
    <div className="discovery origination" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label={t("s16d")}>
        <a href="#origination-controls">{t("sed")}</a>
        <a href="#origination-status">{t("s1mj")}</a>
        <a href="#origination-application">{t("s58")}</a>
        <a href="#origination-basis">{t("scg")}</a>
        <a href="#origination-policy">{t("s18l")}</a>
        <a href="#origination-reasons">{t("s1d7")}</a>
        <a href="#origination-commitment">{t("sdb")}</a>
        <a href="#origination-requests">{t("s1fv")}</a>
        <a href="#origination-session">{t("s1js")}</a>
      </nav>
      <div className="discovery-body">
        <OriginationBanner environment={live.environment} scenario={live.scenario} model={model} />
        <OriginationControls scenario={live.scenario} actions={live.actions} />
        <OriginationStatus model={model} />
        {model.actionLabel ? (
          <button
            type="button"
            id="origination-return-action"
            className="discovery-action"
            onClick={() => (model.state === "tuple-changed" ? live.actions.newSession() : live.actions.refresh())}
          >
            {deskText(t, model.actionLabel)}
          </button>
        ) : null}
        <ApplicationSection model={model} />
        <BasisSection model={model} />
        <PolicySection model={model} actions={live.actions} />
        <ReasonsSection model={model} />
        <CommitmentSection model={model} />
        <RequestsSection model={model} actions={live.actions} />
        <OriginationSessionSection session={model.session} />
      </div>
    </div>
    </ReadView>
  );
}
