import { messages as copy0 } from "../i18n/messages/pages--Assistant";
import { messages as copy1 } from "../i18n/messages/delegated-assistant";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { useRestoreFocus } from "../a11y/focus";
import { useDelegationAssistant } from "../delegated-assistant";
import {
  AssistantBanner,
  AssistantControls,
  AssistantRequest,
  AssistantStatus,
  BoardSection,
  GrantsSection,
  LanesSection,
  ProposalsSection,
  RegisterSection,
  RejectionsSection,
  SessionSection,
  TurnsSection,
} from "./AssistantPanels";

export function AssistantPage() {
  const t = useT(copy0, copy1);
  const live = useDelegationAssistant();
  const model = live.model;
  // A refusal, a block, a rejection, an unknown result, or a refused read takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "dlg-status");

  return (
    <div className="discovery dlg" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label={t("sfu")}>
        <a href="#dlg-controls">{t("sed")}</a>
        <a href="#dlg-request">{t("s1fq")}</a>
        <a href="#dlg-status">{t("s1mj")}</a>
        <a href="#dlg-lanes">{t("spz")}</a>
        <a href="#dlg-grants">{t("smt")}</a>
        <a href="#dlg-board">{t("sab")}</a>
        <a href="#dlg-proposals">{t("s19i")}</a>
        <a href="#dlg-turns">{t("s24t")}</a>
        <a href="#dlg-rejections">{t("s1ew")}</a>
        <a href="#dlg-session">{t("s1js")}</a>
        <a href="#dlg-register">{t("sec")}</a>
      </nav>
      <div className="discovery-body">
        <AssistantBanner environment={live.environment} scenario={live.scenario} model={model} />
        <AssistantControls
          environment={live.environment}
          scenario={live.scenario}
          heldSupported={live.heldSupported}
          principalRef={model.principalRef}
          actions={live.actions}
        />
        <AssistantRequest actions={live.actions} />
        <AssistantStatus model={model} />
        {model.actionLabel ? (
          <button
            type="button"
            id="dlg-return-action"
            className="discovery-action"
            onClick={() => (model.state === "tuple-changed" ? live.actions.newSession() : live.actions.refresh())}
          >
            {deskText(t, model.actionLabel)}
          </button>
        ) : null}
        <LanesSection model={model} />
        <GrantsSection model={model} />
        <BoardSection model={model} />
        <ProposalsSection model={model} actions={live.actions} />
        <TurnsSection model={model} />
        <RejectionsSection model={model} actions={live.actions} />
        <SessionSection session={model.session} />
        <RegisterSection model={model} />
      </div>
    </div>
  );
}
