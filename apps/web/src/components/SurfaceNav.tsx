import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { currentNavPath, navGroups } from "../shell/route-registry";

const MENU_ID = "surface-menu";

/**
 * The grouped surface nav. Every link is in the markup, so a screen reader and the Tab order see all of them.
 * At narrow widths CSS folds the groups behind the Menu button; the button is hidden on wide screens.
 * The current link is marked with aria-current from the route registry, one link at most.
 */
export function SurfaceNav() {
  const { pathname } = useLocation();
  const current = currentNavPath(pathname);
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  // A route change closes the menu. Focus is not moved here: the page heading takes it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      toggle.current?.focus();
    }
  };

  return (
    <nav aria-label="Surfaces" onKeyDown={onKeyDown}>
      <button type="button" className="nav-toggle" aria-expanded={open} aria-controls={MENU_ID} onClick={() => setOpen((value) => !value)} ref={toggle}>
        Menu
      </button>
      <ul id={MENU_ID} className="nav-menu" data-open={open ? "true" : "false"}>
        {navGroups().map((group) => (
          <li key={group.id} className="nav-group">
            <span id={`nav-group-${group.id}`} className="nav-group-label">
              {group.label}
            </span>
            <ul aria-labelledby={`nav-group-${group.id}`}>
              {group.links.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    aria-current={link.path === current ? "page" : undefined}
                    onClick={() => {
                      if (open) {
                        setOpen(false);
                        // Choosing the page already shown draws no route change, so focus goes back to the button.
                        if (link.path === current) {
                          toggle.current?.focus();
                        }
                      }
                    }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
