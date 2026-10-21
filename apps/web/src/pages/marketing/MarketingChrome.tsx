import { messages as copy0 } from "../../i18n/messages/pages--marketing--MarketingChrome";
import { messages as copy1 } from "../../i18n/messages/marketing--contracts";
import { messages as copy2 } from "../../i18n/messages/marketing--labels";
import { deskText } from "../../i18n/desk-translate";
import { useT } from "../../i18n/desk-context";
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
  const t = useT(copy0, copy1, copy2);
  const surface = id ? marketingSurface(id) : null;

  return (
    <section>
      <p className="banner" role="status">
        {t("s1mw", { v1: surface ? ` · ${surface.status}` : "" })}
      </p>
      <nav className="tabs" aria-label={t("srx")}>
        <NavLink to="/marketing" end>
          {t("snk")}</NavLink>
        {deskText(t, MARKETING_SURFACES.map((item) => (
          <NavLink key={item.id} to={item.path}>
            {deskText(t, item.id)} · <span lang="ko">{deskText(t, item.titleKo)}</span>
          </NavLink>
        )))}
      </nav>
      {surface ? (
        <header className="section-head">
          <p className="eyebrow">
            {surface.id} · <span lang="ko">{deskText(t, surface.titleKo)}</span> · {surface.status}
          </p>
          <h2>{deskText(t, surface.titleEn)}</h2>
          <p lang="ko">{deskText(t, surface.blurbKo)}</p>
          <p className="muted">{deskText(t, surface.blurbEn)}</p>
          <p className="muted">{deskText(t, marketingPublishedLine(surface.id))}</p>
        </header>
      ) : null}
      {deskText(t, children)}
    </section>
  );
}

export function errorText(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}
