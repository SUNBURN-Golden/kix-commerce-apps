import http from "node:http";
import { describe, expect, it, inject } from "vitest";
import { openSession } from "../src/browser";
import { findSensitive } from "../src/redact";
import { LOOPBACK } from "../src/static-server";
import { expectStubBanner } from "../src/desk";
import { assertNoLeaks } from "../src/lifecycle";
import { recordTiming, relativeTestFile, startMeasure, testFullName } from "../src/timing";
import { recordCheck } from "../src/run-record";

function raw(method: string, path: string): Promise<{ status: number; headers: http.IncomingHttpHeaders }> {
  const origin = new URL(inject("origin"));
  return new Promise((resolve, reject) => {
    const request = http.request({ host: origin.hostname, port: origin.port, method, path }, (response) => {
      response.resume();
      response.on("end", () => resolve({ status: response.statusCode ?? 0, headers: response.headers }));
    });
    request.on("error", reject);
    request.end();
  });
}

describe("harness guards", () => {
  it("serves the production build on 127.0.0.1 only, GET and HEAD only, with no CORS header", async () => {
    const origin = new URL(inject("origin"));
    expect(origin.hostname).toBe(LOOPBACK);
    expect((await raw("GET", "/")).status).toBe(200);
    expect((await raw("HEAD", "/")).status).toBe(200);
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      expect((await raw(method, "/")).status, method).toBe(405);
    }
    const page = await raw("GET", "/");
    expect(page.headers["access-control-allow-origin"]).toBeUndefined();
    expect(page.headers["cache-control"]).toBe("no-store");
    expect(page.headers["content-security-policy"]).toBe("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    expect(page.headers["referrer-policy"]).toBe("same-origin");
    expect(page.headers["x-content-type-options"]).toBe("nosniff");
    recordCheck("harness.server");
  });

  it("refuses path traversal and a missing asset, and falls back to the app shell only for a route", async () => {
    expect((await raw("GET", "/..%2f..%2fpackage.json")).status).toBe(404);
    expect((await raw("GET", "/%2e%2e/%2e%2e/package.json")).status).toBe(404);
    // A dot-dot path with no extension is clamped under the root and gets the app shell, never a file outside it.
    const clamped = await raw("GET", "/%2e%2e/%2e%2e/etc/passwd");
    expect(clamped.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect((await raw("GET", "/assets/not-there.js")).status).toBe(404);
    expect((await raw("GET", "/booking/evt_lanterns")).status).toBe(200);
    recordCheck("harness.paths");
  });

  it("blocks a request to any other origin and records it in the ledger", async (ctx) => {
    const session = await openSession(inject("origin"));
    session.tracker.file = relativeTestFile(ctx.task.file.filepath);
    session.tracker.beginTest();
    const stop = startMeasure(session.tracker.file, testFullName(ctx.task));
    try {
      const page = await session.context.newPage();
      await page.goto(inject("origin") + "/");
      await expectStubBanner(page);
      await page.goto("http://10.255.255.1:9/").catch(() => undefined);
      await page.goto("http://example.invalid/").catch(() => undefined);
      expect(session.ledger.nonLoopback.length).toBeGreaterThanOrEqual(1);
      expect(session.ledger.nonLoopback.every((entry) => !entry.includes("127.0.0.1"))).toBe(true);
      await page.close();
    } finally {
      try {
        const timing = stop();
        const life = await session.tracker.endTest();
        recordTiming(timing);
        session.tracker.recordTest(timing.name, (ctx.task.result?.errors?.length ?? 0) > 0, life);
        assertNoLeaks(life, (ctx.task.result?.errors?.length ?? 0) > 0);
      } finally {
        await session.close();
      }
    }
    recordCheck("harness.external-blocked");
  });

  it("redaction scan finds an email, a bearer string, a token, a JWT and a long digit run, and passes ids", () => {
    expect(findSensitive("contact jane.doe@example.com")).toContain("email");
    expect(findSensitive("Authorization: Bearer abcdefgh12345678")).toContain("bearer");
    expect(findSensitive("ghp_abcdefghijklmnop1234")).toContain("token");
    expect(findSensitive("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.sig")).toContain("jwt");
    expect(findSensitive("card 4111111111111111")).toContain("long-digits");
    expect(findSensitive("jrn:evt_lanterns:1:create_event gft:gift_ok:1:offer_gift org:evt_org_1:1:create_event")).toEqual([]);
    recordCheck("harness.redaction");
  });
});
