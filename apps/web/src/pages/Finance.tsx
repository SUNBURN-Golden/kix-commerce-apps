import { useReadState } from "../shell/read-state-params";
import { readSettled, ReadView, ReadFilter } from "./ReadState";
import { messages as copy0 } from "../i18n/messages/pages--Finance";
import { messages as copy1 } from "../i18n/messages/finance-operations";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { useRestoreFocus } from "../a11y/focus";
import { useFinanceOperations } from "../finance-operations";
import {
  AuthoritySection,
  CutsSection,
  ExportSection,
  FinanceBanner,
  FinanceControls,
  FinanceSessionSection,
  FinanceStatus,
  FiguresSection,
  QueueSection,
  RequestsSection,
} from "./FinancePanels";

export function FinancePage() {
  const t = useT(copy0, copy1);
  const live = useFinanceOperations();
  const model = live.model;
  const casesFor = (queue?: string) => model.cases.filter((row) => !queue || row.category === queue);
  const read = useReadState("finance", { queue:  !readSettled(model.state) ? null : model.cases.map((row) => row.category), case: (values) =>  !readSettled(model.state) ? null : casesFor(values.queue).map((row) => row.caseRef) });
  const view = { ...model, cases: casesFor(read.values.queue) };
  // A block, a refusal, a denial, a read that did not answer, or an unknown result takes focus to the status region.
  useRestoreFocus(model.focusToken, "finance-status");

  return (
    <ReadView state={read}>
    <ReadFilter state={read} name="queue" options={model.cases.map((row) => row.category)} />
    <div className="discovery platform finance" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label={t("sle")}>
        <a href="#finance-controls">{t("sed")}</a>
        <a href="#finance-status">{t("s1mj")}</a>
        <a href="#finance-authority">{t("s26m")}</a>
        <a href="#finance-cuts">{t("s1l7")}</a>
        <a href="#finance-queue">{t("sjz")}</a>
        <a href="#finance-figures">{t("s1la")}</a>
        <a href="#finance-export-panel">{t("sl")}</a>
        <a href="#finance-requests">{t("s1fv")}</a>
        <a href="#finance-session">{t("s1js")}</a>
      </nav>
      <div className="discovery-body">
        <FinanceBanner environment={live.environment} scenario={live.scenario} model={model} />
        <FinanceControls scenario={live.scenario} actorRef={live.actorRef} model={model} actions={live.actions} />
        <FinanceStatus model={model} />
        {model.actionLabel ? (
          <button
            type="button"
            id="finance-return-action"
            className="discovery-action"
            onClick={() => (model.state === "tuple-changed" ? live.actions.newSession() : live.actions.refresh())}
          >
            {deskText(t, model.actionLabel)}
          </button>
        ) : null}
        <AuthoritySection model={model} />
        <CutsSection model={model} />
        <QueueSection model={view} actions={live.actions} />
        <FiguresSection model={model} />
        <ExportSection model={model} />
        <RequestsSection model={model} />
        <FinanceSessionSection session={model.session} />
      </div>
    </div>
    </ReadView>
  );
}
