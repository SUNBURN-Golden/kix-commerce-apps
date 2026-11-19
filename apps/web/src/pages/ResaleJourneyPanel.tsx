import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PARTIAL_REFUND_EXAMPLE, SETTLEMENT_EXAMPLE } from "../../../../packages/protocol-adapter/src/resale-journey";
import { MARKET_FIXTURE, marketPreview, type MarketStep } from "../../../../packages/protocol-adapter/src/resale-journey-fixture";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { protocol } from "../connectivity/desk-protocol";
import { useT } from "../i18n/desk-context";
import { messages } from "../i18n/messages/resale-market";
import { MarketJourneySession } from "../resale-journey-session";
import { pageSessionStore } from "../session-store";
import { MarketReadBoundary } from "./ResaleMarketPanels";

let active: MarketJourneySession | undefined;
function current() {
  return active ??= new MarketJourneySession(protocol, pageSessionStore(), protocol.describe().environment);
}

export function ResaleJourneySection({ startOpen }: { startOpen: boolean }) {
  const t = useT(messages);
  const session = current();
  useSyncExternalStore(session.subscribe, session.version, session.version);
  const uncertain = !!session.history || session.journey.state().last?.kind === "UNKNOWN";
  return <details open={startOpen || uncertain}>
    <summary>{t("market.journey")}</summary><ResaleJourneyPanel session={session} />
  </details>;
}

export function ResaleJourneyPanel({ session = current() }) {
  const t = useT(messages);
  useSyncExternalStore(session.subscribe, session.version, session.version);
  const { facts, next, decline: cancel, pending, confirmed, last, fenced } = session.journey.state();
  const [review, setReview] = useState<MarketStep | null>(null);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (review) reviewTitle.current?.focus(); }, [review]);
  const preview = review && marketPreview(review);
  const history = session.history;
  const intent = history && history !== "SESSION_EVIDENCE_LOST" ? history : null;
  const http = session.mode === "integration-http";
  const blocked = http || !!history || !!pending || fenced;
  const settlement = facts.acceptedTransferred.state === "TRANSFERRED" ? facts.acceptedTransferred.proof : facts.listed.state === "LISTED" ? facts.listed.proof : null;
  const listing = MARKET_FIXTURE["market-list"][1];
  const example = SETTLEMENT_EXAMPLE;
  return <section className="panel" aria-labelledby="market-journey-title">
    <h3 id="market-journey-title">{t("market.journey")}</h3>
    <p>{t("market.fixture")} · {listing.right_id} / {listing.listing_id}</p>
    {intent && <p>{t("market.previousFacts")}</p>}
    <dl className="facts">{(["listed", "paid", "acceptedTransferred", "settled"] as const).map(name => <div key={name}>
      <dt>{t(`market.${name}`)}</dt><dd data-market-fact={name}>{intent && (name === "listed" || name === "paid") ? intent[name] : facts[name].state}</dd></div>)}</dl>
    <p>{t("market.confirmedStep")} <code>{intent?.confirmed ?? confirmed ?? "—"}</code></p>
    <p role="status">{intent ? <><strong>UNKNOWN</strong> · {t("market.historyIntent")} {intent.step} · {intent.operationId}</> : history === "SESSION_EVIDENCE_LOST" ? history :
      pending ? pending : last ? <>{last.kind} · {last.kind === "CONFIRMED" ? last.proof["listing.phase"] : <>{last.code} · {last.operationId}</>}</> : null}
      {(fenced || history) && <> · {t("market.blocked")} {intent?.step ?? pending ?? last?.step ?? next}</>}
    </p>
    {http && <p>{t("market.browserUnavailable")}</p>}
    {review && preview ? <div className="market-journey-review">
      <h4 ref={reviewTitle} tabIndex={-1}>{t("market.reviewStep")} · {t(`market.${review}`)}</h4><p><code>{preview.action}</code></p>
      <dl className="facts">{preview.fields.map(([field, value]) => <div key={field}><dt>{field}</dt><dd>{String(value)}</dd></div>)}</dl>
      <button type="button" onClick={() => setReview(null)}>{t("market.back")}</button>
      <ConnectivityWriteButton requiresFresh={false} disabled={blocked} data-market-send={review} onClick={() => {
        setReview(null); void session.run(review);
      }}>{t("market.sendStep")}</ConnectivityWriteButton></div> :
      <div className="actions">{[intent?.step ?? next, history ? undefined : cancel].map(step => step && <button key={step} type="button" data-market-step={step}
        disabled={blocked} onClick={() => setReview(step)}>{t(`market.${step}`)}</button>)}</div>}
    <MarketReadBoundary queries={["get_right", "get_presentation", "operation recovery"]} />
    <h4>{t("market.settled")}</h4>
    <p>{listing.listing_id} · {settlement?.["listing.settlement_gate"] ?? facts.settled.state}</p>
    <MarketReadBoundary queries={["get_settlement"]} />
    <p>{t("market.reference")} · {example.settlement_id} · {example.phase} · {example.provenance} · {t("market.funds", { value: String(example.funds_executed) })}</p>
    <p>{PARTIAL_REFUND_EXAMPLE.claim_id} · {t("market.b5")} · {PARTIAL_REFUND_EXAMPLE.refund_bearer_policy}</p>
  </section>;
}
