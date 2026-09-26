import { beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { App } from "../src/App";
import { marketingSession } from "../src/marketing/session";

function renderAt(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("marketing routes", () => {
  beforeEach(() => {
    marketingSession.reset();
  });

  it("renders the hub with the five ORIGINAL_32 labels", () => {
    const html = renderAt("/marketing");
    expect(html).toContain("팬 자격 / 멤버십");
    expect(html).toContain("선예매");
    expect(html).toContain("쿠폰 / 프로모션");
    expect(html).toContain("추천 / 리워드");
    expect(html).toContain("CRM / 데이터 활용");
    expect(html).toContain("설계중");
    expect(html).toContain("not protocol law");
    expect(html).toContain("adapter pin is not this desk");
    expect(html).toContain("makes no contract claim");
    expect(html).toContain("Box office");
    expect(html).toContain("Admission");
    expect(html).toContain("Resale");
  });

  it.each(["/marketing/m01", "/marketing/m02", "/marketing/m03", "/marketing/m04", "/marketing/m05"])(
    "renders %s as a stub demo",
    (path) => {
      const html = renderAt(path);
      expect(html).toContain("설계중");
      expect(html).toContain("not protocol law");
      expect(html).toContain("adapter pin is not this desk");
      expect(html).toContain("No live chain");
    },
  );

  it("still renders the box office desk", () => {
    const html = renderAt("/");
    expect(html).toContain("Box office");
    expect(html).toContain("Tonight");
    expect(html).not.toContain("not protocol law");
    expect(html).not.toContain("adapter pin is not this desk");
  });
});
