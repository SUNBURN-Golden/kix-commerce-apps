import { Link } from "react-router-dom";
import { useT } from "../i18n/locale-context";

const MAIN_PATHS = [
  { to: "/", label: "route.box-office" },
  { to: "/buyer", label: "route.buyer" },
  { to: "/discovery", label: "route.discovery" },
  { to: "/receipts", label: "route.receipts" },
  { to: "/handoff", label: "route.handoff" },
  { to: "/journeys", label: "route.journeys" },
] as const;

/** Drawn for any address no route matches. It does not echo the address. */
export function NotFoundPage() {
  const t = useT();
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <h2 id="not-found-title">{t("notFound.title")}</h2>
      <p>{t("notFound.body")}</p>
      <p>
        <Link to="/">{t("notFound.home")}</Link>
      </p>
      <nav aria-label={t("notFound.nav")}>
        <ul>
          {MAIN_PATHS.map((path) => (
            <li key={path.to}>
              <Link to={path.to}>{t(path.label)}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
