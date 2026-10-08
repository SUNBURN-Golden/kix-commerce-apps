import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { marketingPublishedLine } from "../../marketing/contracts";
import { MARKETING_SURFACES, marketingSurface, type MarketingId } from "../../marketing/labels";

export function MarketingChrome({
  id,
  children,
}: {
  id?: MarketingId;
  children: ReactNode;
}) {
  const surface = id ? marketingSurface(id) : null;

  return (
    <section>
      <p className="banner" role="status">
        {`Stub demo${surface ? ` · ${surface.status}` : ""} · not protocol law. The adapter pin is not this desk. No live chain, no funds, and no outbound message.`}
      </p>
      <nav className="tabs" aria-label="Marketing labels">
        <NavLink to="/marketing" end>
          Hub
        </NavLink>
        {MARKETING_SURFACES.map((item) => (
          <NavLink key={item.id} to={item.path}>
            {item.id} · <span lang="ko">{item.titleKo}</span>
          </NavLink>
        ))}
      </nav>
      {surface ? (
        <header className="section-head">
          <p className="eyebrow">
            {surface.id} · <span lang="ko">{surface.titleKo}</span> · {surface.status}
          </p>
          <h2>{surface.titleEn}</h2>
          <p lang="ko">{surface.blurbKo}</p>
          <p className="muted">{surface.blurbEn}</p>
          <p className="muted">{marketingPublishedLine(surface.id)}</p>
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function errorText(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}
