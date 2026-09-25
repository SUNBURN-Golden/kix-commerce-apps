import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { CREDIT_BOUNDARY } from "@kix/protocol-adapter";
import { protocol } from "../protocol";

const links = [
  { to: "/", label: "Box office", end: true },
  { to: "/admission", label: "Admission", end: false },
  { to: "/resale", label: "Resale", end: false },
];

export function Shell({ children }: { children: ReactNode }) {
  const meta = protocol.describe();

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="mark">KIX</span>
          <div>
            <p className="eyebrow">Commerce desk</p>
            <h1>Box office</h1>
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
        Adapter <strong>{meta.adapter}</strong>. No live chain and no funds movement.{" "}
        {CREDIT_BOUNDARY.note}
      </p>
      <main>{children}</main>
    </div>
  );
}
