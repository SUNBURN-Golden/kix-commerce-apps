import { VERBATIM_MESSAGES } from "../src/i18n/verbatim";
import { sourceMessage } from "../src/i18n/source-message";
import { formatNumber, formatUnits, formatWhen } from "../src/format";
import { describe, expect, it } from "vitest";
import { auditSource, auditTree, VERBATIM } from "../../../scripts/i18n-audit.mjs";
import { messages as screenMessages, BUNDLES } from "../src/i18n/generated-catalogue";
import { MESSAGES } from "../src/i18n/catalogue";
import { DESK_EN, DESK_KO } from "../src/i18n/desk-catalogue";
import { deskText, makeScreenTranslate as makeTranslate } from "../src/i18n/desk-translate";
import { placeholdersOf } from "../src/i18n/translate";

describe("display literal audit", () => {
  it("detects text, accessible attributes, custom labels and expression-wrapped copy", () => {
    const findings = auditSource('<section title="Heading"><h2>Heading</h2><button aria-label={"Open"}>{ready ? "Go" : `Wait ${count}`}</button><Panel label="Name" /><p>{error ?? "Read error"}</p></section>');
    expect(findings.map((finding) => finding.text)).toEqual(["Heading", "Heading", "Open", "Go", "Wait {value}", "Name", "Read error"]);
  });

  it("does not confuse identifiers, conditions, references, or machine attributes with copy", () => {
    expect(auditSource('<p data-state="loading" id="status">{state === "loading" && <span>{t("status.loading.word")}</span>} {row.operationId} {42} ·</p>')).toEqual([]);
  });

  it("has an explicit, reasoned verbatim allowlist, not an uppercase or English wildcard", () => {
    for (const [word, reason] of VERBATIM) {
      expect(reason.length).toBeGreaterThan(5);
      expect(auditSource(`<p>${word}</p>`)).toEqual([]);
    }
    expect(auditSource("<p>UNREVIEWED_NEW_WORD</p>")).toHaveLength(1);
    expect(auditSource("<p>UNKNOWN is not failure</p>")).toHaveLength(1);
    expect(auditSource('<p title="새 문구">새 문구</p>')).toHaveLength(2);
    expect(auditSource('<p>{identity("Hidden English")}</p>')).toHaveLength(1);
    expect(auditSource('<p>{deskText(t, "Hidden English")}</p>')).toHaveLength(1);
  });

  it("has no direct display literals anywhere in the screen tree, including shared UI and accessibility attributes", () => {
    expect(auditTree(new URL("../src", import.meta.url).pathname)).toEqual([]);
  });
});

describe("desk messages", () => {
  it("has equal keys, nonempty translations, and identical placeholder multisets", () => {
    expect(Object.keys(DESK_KO).sort()).toEqual(Object.keys(DESK_EN).sort());
    for (const key of Object.keys(DESK_EN) as (keyof typeof DESK_EN)[]) {
      expect(DESK_EN[key].trim(), key).not.toBe("");
      expect(DESK_KO[key].trim(), key).not.toBe("");
      expect(placeholdersOf(DESK_KO[key]).sort(), key).toEqual(placeholdersOf(DESK_EN[key]).sort());
    }
  });

  it("translates known stored display messages at render time without altering unknown source text", () => {
    const english = makeTranslate("en", { en: DESK_EN, ko: DESK_KO });
    const korean = makeTranslate("ko", { en: DESK_EN, ko: DESK_KO });
    for (const key of Object.keys(DESK_EN) as (keyof typeof DESK_EN)[]) {
      const source = DESK_EN[key];
      expect(deskText(english, source)).toBe(source);
      expect(deskText(korean, source)).toBe(DESK_KO[key]);
    }
    for (const source of ["UNKNOWN", "NOT_BOUND", "STALE", "operationId: operation-001", "<script>untrusted</script>"]) {
      expect(deskText(korean, source)).toBe(source);
    }
  });
});

const en = { ...MESSAGES.en, ...screenMessages.en };
const ko = { ...MESSAGES.ko, ...screenMessages.ko };

describe("complete route catalogue", () => {
  it("validates every lazy bundle independently, including duplicate-key consistency", () => {
    const seen = new Map<string, readonly [string, string]>();
    for (const bundle of BUNDLES) {
      expect(Object.keys(bundle.en).sort()).toEqual(Object.keys(bundle.ko).sort());
      for (const [key, value] of Object.entries(bundle.en)) {
        const local = (bundle.ko as Record<string, string>)[key] ?? "";
        expect(value.trim(), key).not.toBe("");
        expect(local.trim(), key).not.toBe("");
        expect(placeholdersOf(local).sort(), key).toEqual(placeholdersOf(value).sort());
        if (seen.has(key)) expect([value, local], key).toEqual(seen.get(key));
        seen.set(key, [value, local]);
      }
    }
  });

  it("has identical keys, nonempty translations and identical placeholder multisets", () => {
    expect(Object.keys(ko).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(screenMessages.en) as (keyof typeof screenMessages.en)[]) {
      expect(en[key].trim(), key).not.toBe("");
      expect(ko[key].trim(), key).not.toBe("");
      expect(placeholdersOf(ko[key]).sort(), key).toEqual(placeholdersOf(en[key]).sort());
    }
  });

  it("requires an exact reason for every untranslated catalogue message", () => {
    for (const [key, value] of Object.entries(screenMessages.en)) {
      if (value === (screenMessages.ko as Record<string, string>)[key]) {
        expect(VERBATIM_MESSAGES[key]?.length, key).toBeGreaterThan(5);
      }
    }
  });

  it("copies operations, field names and protocol codes verbatim", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const tokens = en[key].match(/\b[A-Z][A-Z0-9_]{2,}\b|\b[a-z]+[A-Z][A-Za-z]*\b|\b[a-z]+_[a-z_]+\b/g) ?? [];
      for (const token of tokens) expect(ko[key], `${key}: ${token}`).toContain(token);
    }
  });

  it("localizes stored messages and templates while retaining untrusted values and enums", () => {
    const t = makeTranslate("ko", screenMessages);
    expect(deskText(t, "Request 4 (submit) has an unknown outcome and may have applied. Nothing is sent again from here. Start a new synthetic session to clear it.")).toContain("미확인");
    expect(deskText(t, "Watermark 2026-10-13T00:00:00.000Z. Read 1 on this port.")).toBe("워터마크 2026-10-13T00:00:00.000Z. 이 포트의 조회 1.");
    for (const value of ["UNKNOWN", "NOT_BOUND", "STALE", "open", "confirmed", "create_event", "<script>untrusted</script>"]) {
      expect(deskText(t, value)).toBe(value);
    }
    expect(deskText(t, null)).toBeNull();
    expect(deskText(t, 1000)).toBe("1000");
    const child = { type: "span" };
    expect(deskText(t, child)).toBe(child);
    expect(deskText(makeTranslate("en", screenMessages), "No flag.")).toBe("No flag.");
  });
});


describe("locale presentation keeps source quantities and clock authority", () => {
  it("formats copied integers and units without rounding, scaling or currency conversion", () => {
    for (const locale of ["en-GB", "ko-KR"] as const) {
      expect(formatNumber(20000, locale)).toBe("20000");
      expect(formatUnits("900719925474099300000", "mock-unit", locale)).toBe("900719925474099300000 mock-unit");
      expect(formatUnits("1.2", "mock-unit", locale)).toContain("Amount refused");
    }
    const ko = makeTranslate("ko", screenMessages);
    expect(deskText(ko, "20000 mock units")).toBe("20000 모의 단위");
    expect(formatWhen("2099-01-01T12:30:00Z", "ko-KR")).not.toBe(formatWhen("2099-01-01T12:30:00Z", "en-GB"));
  });

  it("constructs source messages with template coercion and keeps unresolved parameters visible", () => {
    expect(sourceMessage("{v1} / {v2} / {v3}", { v1: null, v2: undefined })).toBe("null / undefined / {v3}");
  });
});
