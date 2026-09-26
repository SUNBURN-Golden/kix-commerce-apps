import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { CREDIT_BOUNDARY, ProtocolError, type TransportObservation } from "@kix/protocol-adapter";
import { protocol } from "../protocol";
import { preferFresh, transportBannerText, type HeldObservation } from "../transport-status";

const links = [
  { to: "/", label: "Box office", end: true },
  { to: "/admission", label: "Admission", end: false },
  { to: "/resale", label: "Resale", end: false },
  { to: "/credit", label: "Credit", end: false },
  { to: "/marketing", label: "Marketing", end: false },
];

export function Shell({ children }: { children: ReactNode }) {
  const meta = protocol.describe();
  const location = useLocation();
  const onMarketing = location.pathname === "/marketing" || location.pathname.startsWith("/marketing/");
  const [held, setHeld] = useState<HeldObservation | null>(null);

  useEffect(() => {
    document.title = onMarketing ? "KIX Marketing · 설계중" : "KIX Box Office";
  }, [onMarketing]);

  useEffect(() => {
    let generation = 0;
    let cancelled = false;
    const ticket = ++generation;
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
      });
    return () => {
      cancelled = true;
    };
  }, [meta.environment]);

  const transport = transportBannerText(meta.environment, held?.observation ?? null);

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="mark">KIX</span>
          <div>
            <p className="eyebrow">{onMarketing ? "Marketing desk · 설계중" : "Commerce desk"}</p>
            <h1>{onMarketing ? "Marketing" : "Box office"}</h1>
          </div>
        </div>
        <nav aria-label="Surfaces">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <p className="banner" role="status">
        Adapter <strong>{meta.adapter}</strong>. Environment <strong>{meta.environment}</strong>. No live chain and no
        funds movement. Public production deployment is not selected. {CREDIT_BOUNDARY.note}
      </p>
      <p className="banner transport" role="status" data-transport-state={transport.state}>
        {transport.text}
      </p>
      <main>{children}</main>
    </div>
  );
}
