import { LocaleContext, stateFor } from "../src/i18n/locale-context";
import { CachedReadNotice } from "../src/components/CachedReadNotice";
import { registerReadGroup } from "../src/connectivity/write-guard";
import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { StubProtocolAdapter } from "@kix/protocol-adapter";
import { App } from "../src/App";
import { ConnectivityBanner } from "../src/components/ConnectivityBanner";
import { ConnectivityWriteButton } from "../src/components/ConnectivityWriteButton";
import { browserConnectivity, connectivity, createConnectivityStore } from "../src/connectivity/store";
import { SCREENS } from "../../e2e/src/a11y-matrix";
import { ROUTES } from "../src/shell/route-registry";

afterEach(() => { connectivity.configure("stub"); connectivity.setBrowserOnline(true); });

describe("global connectivity", () => {
  it("separates missing browser information, stub locality and loopback availability", async () => {
    const observation = await new StubProtocolAdapter().observeTransport();
    const store = createConnectivityStore("integration-http", null);
    expect(store.getSnapshot().writesBlocked).toBe(true);
    store.setBrowserOnline(true);
    expect(store.getSnapshot().state).toBe("checking");
    store.observeTransport({ epoch: store.getSnapshot().epoch, held: { generation: 1, observation: { ...observation, environment: "integration-http", state: "up" } } });
    expect(store.getSnapshot().state).toBe("online");
    const read = store.stamp();
    store.observeTransport({ epoch: store.getSnapshot().epoch, held: { generation: 2, observation: { ...observation, state: "degraded" } } });
    expect(store.getSnapshot().writesBlocked).toBe(true);
    store.observeTransport({ epoch: store.getSnapshot().epoch, held: { generation: 1, observation: { ...observation, state: "up" } } });
    expect(store.getSnapshot().state).toBe("degraded");
    expect(store.accepts(read)).toBe(false);
    store.setBrowserOnline(false);
    expect(store.getSnapshot().state).toBe("offline");
    store.configure("stub");
    expect(store.getSnapshot().writesBlocked).toBe(true);
    store.setBrowserOnline(true);
    expect(store.getSnapshot().state).toBe("local");
  });

  it("rejects old successful probes after offline then online, even with a higher probe sequence", async () => {
    const observation = await new StubProtocolAdapter().observeTransport();
    const store = createConnectivityStore("integration-http", true);
    const startedEpoch = store.getSnapshot().epoch;
    store.setBrowserOnline(false);
    store.setBrowserOnline(true);
    expect(store.observeTransport({ epoch: startedEpoch, held: { generation: 99, observation: { ...observation, state: "up" } } })).toBe(false);
    expect(store.getSnapshot().writesBlocked).toBe(true);
    store.observeTransport({ epoch: store.getSnapshot().epoch, held: { generation: 100, observation: { ...observation, state: "up" } } });
    expect(store.getSnapshot().writesBlocked).toBe(false);
  });

  it("installs and cleans browser listeners and initializes from navigator.onLine", () => {
    const events = new EventTarget();
    const navigator = { onLine: false };
    const store = createConnectivityStore("stub", true);
    const off = browserConnectivity(store, { navigator, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) } as Parameters<typeof browserConnectivity>[1]);
    expect(store.getSnapshot().state).toBe("offline");
    navigator.onLine = true;
    events.dispatchEvent(new Event("online"));
    expect(store.getSnapshot().state).toBe("local");
    off();
    navigator.onLine = false;
    events.dispatchEvent(new Event("offline"));
    expect(store.getSnapshot().state).toBe("local");
  });

  it("keeps a polite persistent banner and honest cached notice on every independent screen and 404", () => {
    connectivity.setBrowserOnline(false);
    const paths = [...SCREENS.map((screen) => screen.path), "/missing-offline-route"];
    expect(SCREENS.every((screen) => ROUTES.some((route) => route.id === screen.screenId))).toBe(true);
    for (const path of paths) {
      const html = renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><ConnectivityBanner /><App /></MemoryRouter>);
      expect(html, path).toContain('data-connectivity-state="offline"');
      expect(html, path).toContain('aria-live="polite"');
      expect(html, path).toContain('data-cached-read="true"');
      expect(html, path).toContain("UNKNOWN");
    }
  });

  it("keeps HTTP unavailability, unknown browser state and reachable transport distinct in the banner", async () => {
    connectivity.configure("integration-http");
    const render = () => renderToStaticMarkup(<ConnectivityBanner />);
    expect(render()).toContain('data-connectivity-state="checking"');
    const observation = await new StubProtocolAdapter().observeTransport();
    connectivity.observeTransport({ epoch: connectivity.getSnapshot().epoch, held: { generation: 1, observation: { ...observation, state: "unavailable" } } });
    expect(connectivity.getSnapshot().state).toBe("unavailable");
    connectivity.observeTransport({ epoch: connectivity.getSnapshot().epoch, held: { generation: 2, observation: { ...observation, state: "up" } } });
    expect(render()).toContain('data-connectivity-state="online"');
    connectivity.configure("stub");
    expect(render()).toContain('data-connectivity-state="local"');
  });

  it("localizes blocked and cached-read reasons in Korean without changing status words", () => {
    const group = registerReadGroup("offline-ko-reader");
    group.stamp = connectivity.stamp();
    connectivity.setBrowserOnline(false);
    const html = renderToStaticMarkup(<LocaleContext.Provider value={stateFor("ko", () => {})}>
      <ConnectivityBanner /><CachedReadNotice path="" /><ConnectivityWriteButton>Write</ConnectivityWriteButton>
    </LocaleContext.Provider>);
    expect(html).toContain("연결 상태");
    expect(html).toContain("STALE");
    expect(html).toContain("offline-ko-reader");
    expect(html).toContain("전송하지 않음");
  });

  it("composes connectivity and domain button restrictions and gives a visible reason", () => {
    connectivity.setBrowserOnline(false);
    const html = renderToStaticMarkup(<ConnectivityWriteButton id="offline-action" disabled={false} aria-describedby="domain-reason">Write</ConnectivityWriteButton>);
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('aria-describedby="domain-reason connectivity-write-reason"');
    expect(html).toContain("nothing sent");
    connectivity.setBrowserOnline(true);
    expect(renderToStaticMarkup(<ConnectivityWriteButton disabled>Write</ConnectivityWriteButton>)).toContain('disabled=""');
  });
});
