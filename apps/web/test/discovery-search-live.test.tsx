// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import * as adapter from "@kix/protocol-adapter";
import { protocol } from "../src/connectivity/desk-protocol";
import { DiscoveryPage } from "../src/pages/Discovery";
import { LocaleProvider } from "../src/i18n/LocaleProvider";
import { LocaleSwitch } from "../src/i18n/LocaleSwitch";
import { change, click, element, renderDom } from "./support/render-dom";

describe("localized fixture search stays local", () => {
  it("retains catalogue and projection reads across search, filters, and locale changes without writes", async () => {
    const port = adapter.createStubDiscoveryRead({ stream: "clean" });
    const readPage = vi.spyOn(port, "readPage");
    const readRow = vi.spyOn(port, "readRow");
    vi.spyOn(adapter, "discoveryReadPortFor").mockReturnValue(port);
    const catalogue = vi.spyOn(protocol, "listPerformances");
    const confirm = vi.spyOn(protocol, "confirmBooking");
    const hold = vi.spyOn(protocol, "placeHold");
    const { container } = await renderDom(<LocaleProvider initial="ko"><LocaleSwitch />
      <MemoryRouter initialEntries={["/discovery"]}><DiscoveryPage /></MemoryRouter>
    </LocaleProvider>);
    expect(catalogue).toHaveBeenCalledTimes(1);
    expect(readPage).toHaveBeenCalledTimes(1);
    const input = element<HTMLInputElement>(container, "#discovery-q");
    await change(input, "등불");
    const ids = () => Array.from(container.querySelectorAll("#discovery-results [role=option]"), (row) => row.id);
    const expected = ids();
    expect(expected).toHaveLength(5);
    expect(container.querySelector("#discovery-results")?.textContent).toContain("등불 합성 공연");
    await click(element(container, '[data-locale="en"]'));
    expect(ids()).toEqual(expected);
    expect(container.querySelector("#discovery-results")?.textContent).toContain("Lanterns synthetic show");
    await change(input, "Lanterns");
    expect(ids()).toEqual(expected);
    await click(element(container, '[data-locale="ko"]'));
    await change(input, "등불".normalize("NFD"));
    expect(ids()).toEqual(expected);
    expect(input.value).toBe("등불".normalize("NFD"));
    await change(input, "북쪽 별관");
    await change(element<HTMLSelectElement>(container, "#discovery-page-size"), "10");
    expect(ids()).toHaveLength(10);
    expect(catalogue).toHaveBeenCalledTimes(1);
    expect(readPage).toHaveBeenCalledTimes(1);
    expect(readRow).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(hold).not.toHaveBeenCalled();
  });
});
