import { Link } from "react-router-dom";

const MAIN_PATHS = [
  { to: "/", label: "Box office" },
  { to: "/buyer", label: "Buyer" },
  { to: "/discovery", label: "Discover" },
  { to: "/receipts", label: "Receipts" },
  { to: "/handoff", label: "Local handoff" },
  { to: "/journeys", label: "Journeys" },
] as const;

/** Drawn for any address no route matches. It does not echo the address. */
export function NotFoundPage() {
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <h2 id="not-found-title">Page not found</h2>
      <p>No screen exists at this address. Nothing was sent and nothing was changed.</p>
      <p>
        <Link to="/">Go to Box office</Link>
      </p>
      <nav aria-label="Main screens">
        <ul>
          {MAIN_PATHS.map((path) => (
            <li key={path.to}>
              <Link to={path.to}>{path.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
