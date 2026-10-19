import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const html = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../index.html"), "utf8");
const policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

describe("app shell policy", () => {
  it("declares the production CSP and privacy headers", () => {
    expect(html).toContain(`http-equiv="Content-Security-Policy" content="${policy}"`);
    expect(html).toContain('name="referrer-policy" content="same-origin"');
    expect(html).toContain('http-equiv="X-Content-Type-Options" content="nosniff"');
  });

  it("loads no external or inline script", () => {
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.[1]).toContain('src="/src/main.tsx"');
    expect(scripts[0]?.[2].trim()).toBe("");
    expect(html).not.toMatch(/(?:src|href)=["']https?:\/\//i);
  });
});
