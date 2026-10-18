import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { CREDIT_BOUNDARY, ProtocolError, type TransportObservation } from "@kix/protocol-adapter";
import { transportStatusWord } from "../a11y/marks";
import { marketingChromeLabel } from "../marketing/labels";
import { identifyPage } from "../shell/page-identity";
import { Breadcrumb } from "./Breadcrumb";
import { SurfaceNav } from "./SurfaceNav";
import { useRouteFocus } from "../shell/route-focus";
import { protocol } from "../protocol";
import { preferFresh, transportBannerText, type HeldObservation } from "../transport-status";

/** How often integration HTTP reads the loopback probes again. The stub is not polled. */
const TRANSPORT_PROBE_MS = 15_000;

export function Shell({ children }: { children: ReactNode }) {
  const meta = protocol.describe();
  const location = useLocation();
  const onMarketing = location.pathname === "/marketing" || location.pathname.startsWith("/marketing/");
  const marketingLabel = marketingChromeLabel(location.pathname);
  const [held, setHeld] = useState<HeldObservation | null>(null);
  const generation = useRef(0);
  const probing = useRef(false);

  const identity = identifyPage(location.pathname);
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
    if (meta.environment === "stub") {
      return () => {
        cancelled = true;
      };
    }
    const timer = setInterval(() => probe(true), TRANSPORT_PROBE_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [meta.environment, location.pathname]);

  const transport = transportBannerText(meta.environment, held?.observation ?? null);

  const transportWord = transportStatusWord(transport.state);

  return (
    <div className="shell">
      <a className="skip" href="#desk-main">
        Skip to content
      </a>
      <header className="top">
        <div className="brand">
          <span className="mark">KIX</span>
          <div>
            <p className="eyebrow">{marketingLabel?.eyebrow ?? "Commerce desk"}</p>
            <h1>{onMarketing ? "Marketing" : "Box office"}</h1>
          </div>
        </div>
        <SurfaceNav />
      </header>
      <Breadcrumb />
      <p className="banner" role="status">
        Adapter <strong>{meta.adapter}</strong>. Environment <strong>{meta.environment}</strong>. No live chain and no
        funds movement. Public production deployment is not selected. {CREDIT_BOUNDARY.note}
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
