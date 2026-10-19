import { Component, useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useT } from "../i18n/locale-context";
import { classifyFault, type RenderFault } from "./render-fault";
import { forgetFailedScreens } from "./screen-loader";

export type BoundaryScope = "route" | "app";

interface BoundaryProps {
  scope: BoundaryScope;
  /** Changes when the user moves to another screen. A changed key clears the fault. */
  resetKey: string;
  screenLabel: string;
  children: ReactNode;
}

interface BoundaryState {
  fault: RenderFault | null;
  keyAtFault: string | null;
}

/** The state after the "Show this screen again" button. Only the fault is cleared; nothing else is touched. */
export function stateAfterReset(): BoundaryState {
  return { fault: null, keyAtFault: null };
}

/**
 * Catches errors thrown while rendering its children. It stores the classified fault only.
 * It sends nothing, reads nothing and clears no desk state: it holds no reference to a desk or the adapter.
 * Errors in event handlers and async work are not caught by React boundaries.
 */
export class RenderBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = stateAfterReset();

  static getDerivedStateFromError(thrown: unknown): Partial<BoundaryState> {
    return { fault: classifyFault(thrown) };
  }

  componentDidCatch(): void {
    // The key is read here, after the fault is set, so a later key change can clear it.
    this.setState({ keyAtFault: this.props.resetKey });
  }

  componentDidUpdate(): void {
    if (this.state.fault && this.state.keyAtFault !== null && this.state.keyAtFault !== this.props.resetKey) {
      forgetFailedScreens();
      this.setState(stateAfterReset());
    }
  }

  render(): ReactNode {
    if (!this.state.fault) {
      return this.props.children;
    }
    return (
      <ErrorPanel
        fault={this.state.fault}
        scope={this.props.scope}
        screenLabel={this.props.screenLabel}
        onAgain={() => {
          // A failed screen load is kept until now, so drawing again does not import again by itself.
          forgetFailedScreens();
          this.setState(stateAfterReset());
        }}
      />
    );
  }
}

export function ErrorPanel({
  fault,
  scope,
  screenLabel,
  onAgain,
}: {
  fault: RenderFault;
  scope: BoundaryScope;
  screenLabel: string;
  onAgain: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const t = useT();
  const request = fault.requestId ?? fault.correlationId;
  const shownScreen = scope === "app" ? t("error.appShell") : screenLabel;
  const home = scope === "app" ? <a href="/">{t("error.home")}</a> : <Link to="/">{t("error.home")}</Link>;
  if (fault.kind === "screen-load-error") {
    return (
      <section className="shell-error" role="alert" aria-labelledby="shell-error-title" data-scope={scope} data-cause={fault.kind}>
        <h2 id="shell-error-title" ref={heading} tabIndex={-1}>
          {t("error.load.title")}
        </h2>
        <dl className="shell-error-facts">
          <dt>{t("error.fact.cause")}</dt>
          <dd>{t("error.load.cause")}</dd>
          <dt>{t("error.fact.screen")}</dt>
          <dd>{shownScreen}</dd>
          <dt>{t("error.fact.reference")}</dt>
          <dd data-testid="shell-error-reference">{fault.reference}</dd>
          <dt>{t("error.fact.request")}</dt>
          <dd>{t("error.load.noRequest")}</dd>
          <dt>{t("error.fact.code")}</dt>
          <dd>{fault.code ?? "SCREEN_LOAD_FAILED"}</dd>
        </dl>
        <p>
          {t("error.load.note")}
        </p>
        <p>{t("error.load.reload")}</p>
        <p className="shell-error-actions">
          <button type="button" id="shell-error-again" onClick={onAgain}>
            {t("error.load.again")}
          </button>{" "}
          {home}
        </p>
      </section>
    );
  }
  return (
    <section className="shell-error" role="alert" aria-labelledby="shell-error-title" data-scope={scope} data-cause={fault.kind}>
      <h2 id="shell-error-title" ref={heading} tabIndex={-1}>
        {t("error.render.title")}
      </h2>
      <dl className="shell-error-facts">
        <dt>{t("error.fact.cause")}</dt>
        <dd>{t("error.render.cause")}</dd>
        <dt>{t("error.fact.screen")}</dt>
        <dd>{shownScreen}</dd>
        <dt>{t("error.fact.reference")}</dt>
        <dd data-testid="shell-error-reference">{fault.reference}</dd>
        <dt>{t("error.fact.request")}</dt>
        <dd>{request ?? t("error.render.noRequest")}</dd>
        {fault.code ? (
          <>
            <dt>{t("error.fact.code")}</dt>
            <dd>{fault.code}</dd>
          </>
        ) : null}
      </dl>
      <p>
        {t("error.render.note")}
      </p>
      <p className="shell-error-actions">
        <button type="button" id="shell-error-again" onClick={onAgain}>
          {t("error.render.again")}
        </button>{" "}
        {home}
      </p>
    </section>
  );
}

/** Route-level boundary. A move to another screen clears it. */
export function RouteBoundary({ children, screenKey, screenLabel }: { children: ReactNode; screenKey: string; screenLabel: string }) {
  const location = useLocation();
  return (
    <RenderBoundary scope="route" resetKey={`${screenKey}${location.key}`} screenLabel={screenLabel}>
      {children}
    </RenderBoundary>
  );
}

/** App-level boundary. The shell itself is suspect here, so its Home action is a plain link. */
export function AppBoundary({ children }: { children: ReactNode }) {
  return (
    <RenderBoundary scope="app" resetKey="app" screenLabel="The app shell">
      {children}
    </RenderBoundary>
  );
}
