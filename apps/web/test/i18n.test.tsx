import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { AmountNotice, DeadlineLine, StatusMark, transportStatusWord } from "../src/a11y/marks";
import { LocaleProvider } from "../src/i18n/LocaleProvider";
import { LocaleSwitch } from "../src/i18n/LocaleSwitch";
import { MESSAGES, type MessageKey } from "../src/i18n/catalogue";
import { LOCALES, htmlLang, intlTag, parseLocale } from "../src/i18n/locales";
import { LOCALE_STORAGE_KEY, initialLocale, localeFromSearch, readStoredLocale, writeStoredLocale } from "../src/i18n/locale-store";
import { OUTCOME_WORDS, interpolate, makeTranslate, outcomeLabel, placeholdersOf } from "../src/i18n/translate";
import { NotFoundPage } from "../src/pages/NotFound";
import { ErrorPanel } from "../src/shell/RenderBoundary";
import { ROUTES, ROUTE_GROUPS } from "../src/shell/route-registry";
import { transportBannerText } from "../src/transport-status";
import { formatWhen } from "../src/format";

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, "..");
const root = path.resolve(web, "../..");
const read = (file: string) => readFileSync(path.join(web, file), "utf8");

const EN = MESSAGES.en as Record<MessageKey, string>;
const KO = MESSAGES.ko;
const KEYS = Object.keys(EN) as MessageKey[];

const draw = (node: React.ReactNode, locale: "en" | "ko", at = "/") =>
  renderToStaticMarkup(
    <LocaleProvider initial={locale}>
      <MemoryRouter initialEntries={[at]}>{node}</MemoryRouter>
    </LocaleProvider>,
  );

/** Keys whose Korean text may say 실패: a known screen-load or render fault, said once, never about an UNKNOWN outcome. */
const FAILURE_WORD_KEYS: MessageKey[] = ["error.load.note", "error.load.reload"];

describe("catalogue keys", () => {
  it("ko and en carry exactly the same keys", () => {
    expect(Object.keys(KO).sort()).toEqual(Object.keys(EN).sort());
  });

  it("a missing ko key is found by the same diff", () => {
    const broken: Record<string, string> = { ...KO };
    delete broken["shell.skip"];
    const missing = KEYS.filter((key) => !(key in broken));
    expect(missing).toEqual(["shell.skip"]);
  });

  it("has a label for every registry route and group, so a new route cannot ship unlabelled", () => {
    for (const route of ROUTES) {
      expect(KEYS, route.id).toContain(`route.${route.id}`);
    }
    for (const group of ROUTE_GROUPS) {
      expect(KEYS, group.id).toContain(`nav.group.${group.id}`);
    }
  });

  it("keeps the same {placeholders} in both languages", () => {
    for (const key of KEYS) {
      expect(placeholdersOf(KO[key]).sort(), key).toEqual(placeholdersOf(EN[key]).sort());
    }
  });

  it("is non-empty everywhere except the English-only blanks (notice and glosses)", () => {
    for (const key of KEYS) {
      expect(KO[key].trim(), `ko ${key}`).not.toBe("");
      if (!key.startsWith("outcome.") && key !== "locale.notice") {
        expect(EN[key].trim(), `en ${key}`).not.toBe("");
      }
    }
  });

  it("does not let a Korean string grow past a layout-safe bound", () => {
    for (const key of KEYS) {
      expect(KO[key].length, key).toBeLessThanOrEqual(Math.max(60, EN[key].length * 2));
      expect(KO[key].length, key).toBeLessThanOrEqual(260);
    }
  });
});

describe("interpolation", () => {
  it("fills named values in both languages", () => {
    expect(makeTranslate("en")("screen.loading", { label: "Gift" })).toBe("Loading Gift…");
    expect(makeTranslate("ko")("screen.loading", { label: "선물" })).toBe("선물 불러오는 중…");
  });

  it("leaves an unresolved placeholder visible and never throws", () => {
    expect(interpolate("a {x} b")).toBe("a {x} b");
    expect(interpolate("a {x} b", {})).toBe("a {x} b");
    expect(interpolate("a {x} b", { y: 1 })).toBe("a {x} b");
    expect(interpolate("a {x} b {x}", { x: 2 })).toBe("a 2 b 2");
  });

  it("leaves no brace in any rendered page, in either language", () => {
    for (const locale of ["en", "ko"] as const) {
      for (const at of ["/", "/no-such-screen", "/receipts", "/marketing/m01"]) {
        const html = draw(<App />, locale, at);
        const text = html.replace(/<style[\s\S]*?<\/style>/g, "");
        expect(/\{[A-Za-z]+\}/.test(text), `${locale} ${at}`).toBe(false);
      }
    }
  });
});

describe("outcome words keep their meaning", () => {
  it("every protocol token and field name in an English message is copied verbatim into the Korean one", () => {
    for (const key of KEYS) {
      const tokens = EN[key].match(/\b[A-Z][A-Z0-9_]{2,}\b|\b[a-z]+[A-Z][A-Za-z]*\b|\b[A-Z_]{3,}\b/g) ?? [];
      for (const token of tokens) {
        expect(KO[key], `${key} must keep ${token}`).toContain(token);
      }
    }
  });

  it("the outcome word is shown verbatim, with a gloss beside it in Korean only", () => {
    const en = makeTranslate("en");
    const ko = makeTranslate("ko");
    for (const word of OUTCOME_WORDS) {
      expect(outcomeLabel(en, word)).toBe(word);
      expect(outcomeLabel(ko, word)).toMatch(new RegExp(`^${word} \\(.+\\)$`));
    }
    expect(outcomeLabel(ko, "UNKNOWN")).toBe("UNKNOWN (결과 미확인)");
  });

  it("never turns UNKNOWN into a failure, a success or an approval", () => {
    for (const key of KEYS) {
      const text = KO[key];
      for (const banned of ["성공", "완료", "승인"]) {
        expect(text.includes(banned), `${key} says ${banned}`).toBe(false);
      }
      if (text.includes("실패")) {
        expect(FAILURE_WORD_KEYS, `${key} says 실패`).toContain(key);
      }
    }
    for (const gloss of OUTCOME_WORDS.map((word) => KO[`outcome.${word}.gloss`])) {
      expect(gloss).not.toMatch(/실패|성공|오류/);
    }
    // The load-failure message states that it is not an UNKNOWN outcome, and keeps the English word beside the gloss.
    expect(KO["error.load.note"]).toContain("UNKNOWN(결과 미확인) 결과가 아닙니다");
  });

  it("keeps binding words and codes verbatim and adds no real currency sign in Korean", () => {
    const html = draw(<App />, "ko", "/");
    expect(html).toContain("<strong>stub-only</strong>");
    for (const text of Object.values(KO)) {
      expect(/[$₩]|KRW|USD|원\b/.test(text), text).toBe(false);
    }
    expect(KO["amount.notice"]).toContain("UNDETERMINED");
  });
});

describe("locales", () => {
  it("accepts the exact strings only", () => {
    expect(LOCALES).toEqual(["en", "ko"]);
    expect(parseLocale("ko")).toBe("ko");
    expect(parseLocale("en")).toBe("en");
    for (const bad of ["KO", "ko-KR", "en-GB", "", null, undefined, 1, "ko "]) {
      expect(parseLocale(bad)).toBeNull();
    }
    expect(htmlLang("ko")).toBe("ko");
    expect(intlTag("ko")).toBe("ko-KR");
    expect(intlTag("en")).toBe("en-GB");
  });

  it("reads the URL parameter first, then the tab's stored choice, then the English default", () => {
    const memory = new Map<string, string>();
    const fake = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => void memory.set(key, value) };
    const previous = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
    Object.defineProperty(globalThis, "sessionStorage", { value: fake, configurable: true });
    try {
      expect(initialLocale("")).toBe("en");
      writeStoredLocale("ko");
      expect(memory.get(LOCALE_STORAGE_KEY)).toBe("ko");
      expect(readStoredLocale()).toBe("ko");
      expect(initialLocale("")).toBe("ko");
      expect(initialLocale("?lang=en")).toBe("en");
      expect(initialLocale("?lang=fr")).toBe("ko");
      expect(localeFromSearch("?x=1&lang=ko")).toBe("ko");
    } finally {
      if (previous) {
        Object.defineProperty(globalThis, "sessionStorage", previous);
      } else {
        delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
      }
    }
  });

  it("a blocked store means the in-memory default, and never throws", () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
    Object.defineProperty(globalThis, "sessionStorage", {
      get() {
        throw new Error("blocked");
      },
      configurable: true,
    });
    try {
      expect(readStoredLocale()).toBeNull();
      expect(() => writeStoredLocale("ko")).not.toThrow();
      expect(initialLocale("")).toBe("en");
    } finally {
      if (previous) {
        Object.defineProperty(globalThis, "sessionStorage", previous);
      } else {
        delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
      }
    }
  });
});

describe("migrated surfaces", () => {
  it("the default render has no provider and equals the English render", () => {
    const bare = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(bare).toContain("Skip to content");
    expect(bare).toContain('<nav aria-label="Surfaces">');
    expect(bare).toContain("Public production deployment is not selected.");
    // The switch is present; its notice is Korean-only.
    expect(bare).not.toContain("locale-notice");
  });

  it("draws the Korean chrome: skip link, nav, breadcrumb, banner and the notice", () => {
    const html = draw(<App />, "ko", "/credit/origination");
    expect(html).toContain("본문으로 건너뛰기");
    expect(html).toContain('<nav aria-label="화면 목록">');
    expect(html).toContain('<nav aria-label="현재 위치">');
    expect(html).toContain("크레딧 개설");
    expect(html).toContain("연결 상태 <strong>stub-only</strong>");
    expect(html).toContain("locale-notice");
    expect(html).toContain("어댑터 <strong>");
  });

  it("the focus key and the page title come from the registry in both languages, and the key never depends on the locale", async () => {
    const { identifyPage } = await import("../src/shell/page-identity");
    const text = (locale: "en" | "ko") => {
      const t = makeTranslate(locale);
      return { label: (entry: { id: string }) => t(`route.${entry.id}` as never), notFound: t("notFound.title"), marketingHubTitle: t("shell.title.marketingHub") };
    };
    for (const route of ROUTES) {
      const plain = identifyPage(route.sample);
      expect(identifyPage(route.sample, ROUTES, text("ko")).key).toBe(plain.key);
      expect(identifyPage(route.sample, ROUTES, text("en")).title).toBe(plain.title);
    }
    expect(identifyPage("/buyer", ROUTES, text("ko")).title).toBe("구매자 · KIX Box Office");
    expect(identifyPage("/nope", ROUTES, text("ko")).key).toBe("*");
  });

  it("not-found and both error panels follow the locale and keep codes and references verbatim", () => {
    const koNotFound = draw(<NotFoundPage />, "ko");
    expect(koNotFound).toContain("페이지를 찾을 수 없음");
    expect(koNotFound).toContain('aria-label="주요 화면"');
    const fault = { kind: "screen-load-error", reference: "shell-fault-0007", requestId: null, correlationId: null, code: null } as never;
    const load = draw(<ErrorPanel fault={fault} scope="route" screenLabel="선물" onAgain={() => {}} />, "ko");
    expect(load).toContain("이 화면을 불러오지 못했습니다");
    expect(load).toContain("shell-fault-0007");
    expect(load).toContain("SCREEN_LOAD_FAILED");
    expect(load).toContain("UNKNOWN(결과 미확인)");
    const render = draw(<ErrorPanel fault={{ ...(fault as object), kind: "render-error", code: "E_X" } as never} scope="app" screenLabel="x" onAgain={() => {}} />, "ko");
    expect(render).toContain("이 화면을 그리지 못했습니다");
    expect(render).toContain("앱 셸");
    expect(render).toContain("E_X");
  });

  it("status marks, amount notice and transport text follow the locale; the English words are unchanged", () => {
    expect(renderToStaticMarkup(<StatusMark kind="loading" />)).toContain("Loading");
    expect(draw(<StatusMark kind="blocked" />, "ko")).toContain("차단됨");
    expect(draw(<AmountNotice />, "ko")).toContain("UNDETERMINED(미정)");
    expect(transportStatusWord("checking")).toBe("Loading.");
    expect(transportStatusWord("checking", makeTranslate("ko"))).toBe("불러오는 중.");
    expect(transportBannerText("stub", null).text).toContain("Integration HTTP is not selected.");
    expect(transportBannerText("stub", null, makeTranslate("ko")).text).toContain("Integration HTTP는 선택되지 않았습니다");
  });

  it("the clock follows the locale and expiry does not: the same authority in ko and en", () => {
    const props = { expiresAt: "2030-01-01T00:00:00.000Z", expired: false as boolean | null };
    const en = draw(<DeadlineLine {...props} />, "en");
    const ko = draw(<DeadlineLine {...props} />, "ko");
    for (const html of [en, ko]) {
      expect(html).toContain('data-expires-at="2030-01-01T00:00:00.000Z"');
      expect(html).toContain('data-expired="false"');
    }
    expect(en).toContain("Display locale does not decide expiry.");
    expect(ko).toContain("expiresAt 2030-01-01T00:00:00.000Z");
    expect(ko).toContain("표시 언어는 만료 판단에 쓰이지 않습니다.");
    expect(formatWhen(props.expiresAt)).not.toBe(formatWhen(props.expiresAt, "ko-KR"));
    expect(formatWhen(props.expiresAt, "ko-KR")).toContain("UTC");
    expect(draw(<DeadlineLine expiresAt={props.expiresAt} expired={null} />, "ko")).toContain('data-expired="unspecified"');
  });

  it("the switch is two labelled buttons, each in its own language, with a non-colour mark on the chosen one", () => {
    const html = draw(<LocaleSwitch />, "ko");
    expect(html).toContain('lang="ko" aria-pressed="true"');
    expect(html).toContain('lang="en" aria-pressed="false"');
    expect(html).toContain("✓ 한국어");
    expect(html).toContain(">English<");
    // No status text before the user acts.
    expect(html).toMatch(/<span class="locale-status" role="status"><\/span>/);
  });
});

describe("source", () => {
  it("only locale-store.ts names the storage; no fetch, no browser-language sniffing, no real currency", () => {
    const dir = path.join(web, "src/i18n");
    for (const file of readdirSync(dir)) {
      const source = readFileSync(path.join(dir, file), "utf8");
      for (const word of ["fetch(", "localStorage", "navigator", "invokeLocalCall", "capture", "settle_capture", "placeHold", "Date.now(", "Math.random(", "127.0.0.1"]) {
        expect(source.includes(word), `${file} contains ${word}`).toBe(false);
      }
      expect(source.includes("sessionStorage"), file).toBe(file === "locale-store.ts");
    }
    const html = readFileSync(path.join(web, "index.html"), "utf8");
    expect(html).toContain('<html lang="en">');
  });

  it("the html lang follows the locale", () => {
    expect(read("src/i18n/LocaleProvider.tsx")).toContain("document.documentElement.lang = htmlLang(locale)");
  });
});

describe("migration table in the bind doc", () => {
  it("names every registry route once, as chrome-only or not migrated", () => {
    const doc = readFileSync(path.join(root, "docs/c-locale-ko-en-stub-apps-bind.md"), "utf8");
    const table = doc.split("## Migration table")[1]?.split("\n## ")[0] ?? "";
    const rows = table
      .split("\n")
      .filter((line) => line.startsWith("| `"))
      .map((line) => line.split("|").map((cell) => cell.trim()));
    expect(rows.map((cells) => cells[1]!.replaceAll("`", ""))).toEqual(ROUTES.map((route) => route.path));
    for (const cells of rows) {
      expect(["chrome only", "not migrated"], cells[1]).toContain(cells[2]);
    }
    expect(doc).toContain("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect(doc).toContain("contract_change=NO");
  });
});
