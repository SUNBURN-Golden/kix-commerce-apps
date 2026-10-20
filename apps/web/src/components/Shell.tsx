import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { CREDIT_BOUNDARY, ProtocolError, type TransportObservation } from "@kix/protocol-adapter";
import { transportStatusWord } from "../a11y/marks";
import { motionReduced, REDUCED_MOTION_QUERY } from "../a11y/motion";
import { marketingChromeLabel } from "../marketing/labels";
import { LocaleSwitch } from "../i18n/LocaleSwitch";
import { useLocale } from "../i18n/locale-context";
import { usePageIdentity } from "../i18n/use-page-identity";
import { Breadcrumb } from "./Breadcrumb";
import { SurfaceNav } from "./SurfaceNav";
import { useRouteFocus } from "../shell/route-focus";
import type { Translate } from "../i18n/translate";
import { protocol } from "../protocol";
import { preferFresh, transportBannerText, type HeldObservation } from "../transport-status";

/** How often integration HTTP reads the loopback probes again. The stub is not polled. */
const TRANSPORT_PROBE_MS = 15_000;

/** The eyebrow. A charter surface label ("M01 · 설계중") is copied; only the hub and the default follow the locale. */
function marketingEyebrow(label: { eyebrow: string } | null, t: Translate): string {
  if (!label) {
    return t("shell.eyebrow.default");
  }
  return label.eyebrow === "Marketing desk" ? t("shell.eyebrow.marketing") : label.eyebrow;
}

export function Shell({ children }: { children: ReactNode }) {
  const meta = protocol.describe();
  const { t } = useLocale();
  const location = useLocation();
  const onMarketing = location.pathname === "/marketing" || location.pathname.startsWith("/marketing/");
  const marketingLabel = marketingChromeLabel(location.pathname);
  const [held, setHeld] = useState<HeldObservation | null>(null);
  // The user's stop control for the one timed update on this desk.
  const [motionPaused, setMotionPaused] = useState(motionReduced);
  const generation = useRef(0);
  const probing = useRef(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const list = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setMotionPaused(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, []);

  const identity = usePageIdentity(location.pathname);
  const documentTitle = identity.title;
  useRouteFocus(identity.key);
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  useEffect(() => {
    let cancelled = false;
    // Each probe gets a newer generation than the last, so a late reply from an
    // older probe cannot replace a newer state. A timed probe waits while one
    // is still in flight or the tab is hidden.
    const probe = (timed: boolean) => {
      if (timed && (probing.current || document.hidden)) {
        return;
      }
      probing.current = true;
      const ticket = ++generation.current;
      protocol
        .observeTransport()
        .then((observation) => {
          if (cancelled) {
            return;
          }
          setHeld((current) => preferFresh(current, { generation: ticket, observation }));
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }
          const code = error instanceof ProtocolError && error.code ? error.code : "GATE_UNAVAILABLE";
          const observation: TransportObservation = {
            environment: meta.environment,
            state: meta.environment === "stub" ? "local" : "unavailable",
            productionReadiness: false,
            productionConformance: false,
            protocolTruth: false,
            publicDeploy: false,
            durable: false,
            localFileJournal: null,
            fallbackToStub: false,
            retry: false,
            requestId: error instanceof ProtocolError ? (error.requestId ?? null) : null,
            correlationId: error instanceof ProtocolError ? (error.correlationId ?? null) : null,
            code,
            detail: "Integration HTTP stayed selected. The desk did not fall back to the stub.",
          };
          setHeld((current) => preferFresh(current, { generation: ticket, observation }));
        })
        .finally(() => {
          // Only the newest probe clears the flag. An older one finishing
          // late must not open the way while a newer one is in flight.
          if (generation.current === ticket) {
            probing.current = false;
          }
        });
    };
    probe(false);
    // Stub mode never polls, and a reduced-motion preference stops the one
    // timed update this desk has. The load probe above still ran once.
    if (meta.environment === "stub" || motionPaused) {
      return () => {
        cancelled = true;
      };
    }
    const timer = setInterval(() => probe(true), TRANSPORT_PROBE_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [meta.environment, location.pathname, motionPaused]);

  const transport = transportBannerText(meta.environment, held?.observation ?? null, t, motionPaused);

  const transportWord = transportStatusWord(transport.state, t);

  return (
    <div className="shell">
      <a className="skip" href="#desk-main">
        {t("shell.skip")}
      </a>
      <header className="top">
        <div className="brand">
          <span className="mark">KIX</span>
          <div>
            <p className="eyebrow">{marketingEyebrow(marketingLabel, t)}</p>
            <h1>{onMarketing ? t("shell.title.marketing") : t("shell.title.boxOffice")}</h1>
          </div>
        </div>
        <SurfaceNav />
        <LocaleSwitch />
        <p className="help-line">
          {t("guide.hint")} <Link to="/help">{t("guide.link")}</Link>
        </p>
      </header>
      <Breadcrumb />
      <p className="banner" role="status">
        {t("shell.banner.adapter")} <strong>{meta.adapter}</strong>. {t("shell.banner.environment")}{" "}
        <strong>{meta.environment}</strong>. {t("shell.banner.rest")} {CREDIT_BOUNDARY.note}
      </p>
      <p className="banner transport" role="status" data-transport-state={transport.state} data-status-mark={transport.state}>
        <span className="status-word">{transportWord}</span> {transport.text}
      </p>
      <main id="desk-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
