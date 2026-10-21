import { readFileSync, readdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ErrorSummary } from "../src/components/ErrorSummary";
import { useFormValidation } from "../src/forms/useFormValidation";
import { ValidatedForm } from "../src/forms/ValidatedForm";
import { FORM_MESSAGES, type FormMessageKey } from "../src/forms/catalogue";
import { placeholdersOf } from "../src/i18n/translate";
import { field, validateValue } from "../src/forms/validation";
import { LocaleProvider } from "../src/i18n/LocaleProvider";

const integer = field("version", "validation.label.version", { kind: "integer" });
describe("app-local input syntax", () => {
  it.each(["", " ", "-1", "1.5", "1e3", "01", "+1", " 1", "9007199254740992"])("rejects noncanonical caller integer %j", (raw) => {
    expect(validateValue(integer, raw)).not.toBeNull();
  });
  it.each(["0", "1", "4102444800", "9007199254740991"])("accepts %j without deciding expiry or version", (raw) => {
    expect(validateValue(integer, raw)).toBeNull();
  });
  it("preserves blank optional integers, but refuses whitespace and malformed nonblank input", () => {
    const optional = { ...integer, optional: true };
    expect(validateValue(optional, "")).toBeNull();
    expect(validateValue(optional, " ")).not.toBeNull();
    expect(validateValue(optional, "1.5")).not.toBeNull();
  });
  it("reuses the booking count format and does not invent identifier syntax or eligibility", () => {
    const quantity = field("quantity", "validation.label.quantity", { kind: "bookingQuantity" });
    for (const value of ["1", "2", "3", "4", "5", "6"]) expect(validateValue(quantity, value)).toBeNull();
    for (const value of ["0", "7", "1.5", "01", "1e0"]) expect(validateValue(quantity, value)).not.toBeNull();
    for (const value of ["arbitrary caller ID 한글", "UNKNOWN", "NOT_BOUND", "STALE"]) {
      expect(validateValue(field("id", "validation.label.eventId"), value)).toBeNull();
    }
    expect(validateValue(field("allowed", "validation.label.allowed"), "false")).toBeNull();
  });
  it("checks seat-list syntax without making duplicate or capacity decisions", () => {
    const seats = field("seats", "validation.label.seats", { kind: "seats" });
    for (const value of ["", " ", ",,", " , , "]) expect(validateValue(seats, value)).not.toBeNull();
    for (const value of ["A1", "A1,A2", "A1,A1", ", A1, "]) expect(validateValue(seats, value)).toBeNull();
  });
  it("checks positive GA syntax while leaving the source's range authority intact", () => {
    const quantity = field("ga", "validation.label.quantity", { kind: "positiveInteger" });
    for (const value of ["0", "-1", "1.5", "01"]) expect(validateValue(quantity, value)).not.toBeNull();
    for (const value of ["1", "100"]) expect(validateValue(quantity, value)).toBeNull();
  });
  it("only checks existing display-name and ask-label length constraints", () => {
    const name = field("name", "validation.label.displayName", { maxLength: 40 });
    expect(validateValue(name, "a".repeat(40))).toBeNull();
    expect(validateValue(name, "a".repeat(41))?.messageKey).toBe("validation.maxLength");
  });
});

describe("shared accessible markup", () => {
  it("the hook guards an action using only that action's mounted, enabled fields", () => {
    let validation!: ReturnType<typeof useFormValidation>;
    function Harness() {
      validation = useFormValidation([integer, field("recipient", "validation.label.recipient")]);
      return null;
    }
    renderToStaticMarkup(<Harness />);
    const version = { value: "1.5", matches: () => false };
    const recipient = { value: "", matches: () => false };
    validation.formRef.current = {
      querySelector: (selector: string) => selector.includes('"version"') ? version : recipient,
    } as unknown as HTMLFormElement;
    const action = vi.fn();
    if (validation.validate(["version"])) action();
    expect(action).not.toHaveBeenCalled();
    version.value = "1";
    if (validation.validate(["version"])) action();
    expect(action).toHaveBeenCalledTimes(1);
    expect(validation.validate()).toBe(false); // relevant recipient is still empty
    recipient.matches = () => true; // disabled controls are not caller input for this action
    expect(validation.validate()).toBe(true);
    validation.formRef.current = { querySelector: () => null } as unknown as HTMLFormElement;
    expect(validation.validate()).toBe(true); // fields hidden by the selected editor action
  });
  it("keeps the form catalogue complete, nonempty and placeholder-compatible in ko/en", () => {
    expect(Object.keys(FORM_MESSAGES.ko).sort()).toEqual(Object.keys(FORM_MESSAGES.en).sort());
    for (const key of Object.keys(FORM_MESSAGES.en) as FormMessageKey[]) {
      expect(FORM_MESSAGES.ko[key].trim()).not.toBe("");
      expect(placeholdersOf(FORM_MESSAGES.ko[key])).toEqual(placeholdersOf(FORM_MESSAGES.en[key]));
      expect(FORM_MESSAGES.ko[key]).not.toMatch(/성공|완료|승인/);
    }
  });
  it.each(["en", "ko"] as const)("renders a focus target and ordered field links in %s", (locale) => {
    const issues = [validateValue(integer, "bad")!, validateValue(field("ticket", "validation.label.ticketId"), "")!];
    const markup = renderToStaticMarkup(<LocaleProvider initial={locale}><ErrorSummary id="summary" issues={issues} summaryRef={null} /></LocaleProvider>);
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('aria-labelledby="summary-heading"');
    expect(markup.indexOf('href="#version"')).toBeLessThan(markup.indexOf('href="#ticket"'));
    expect(markup).toContain(locale === "ko" ? "다음 입력 항목을 확인하세요" : "Check the following fields");
  });
  it("connects an existing source diagnostic without dropping its hint or changing the typed value", () => {
    const issue = { ...validateValue(integer, "bad")!, messageKey: "validation.filter" as const };
    const markup = renderToStaticMarkup(
      <ValidatedForm fields={[]} reportedIssues={[issue]}>
        <label htmlFor="version">Version<input id="version" defaultValue="caller-value" aria-describedby="hint" /></label>
        <p id="hint">Source-owned diagnostic detail</p>
      </ValidatedForm>,
    );
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="hint version-format-error"');
    expect(markup).toContain('id="version-format-error"');
    expect(markup).toContain('href="#version"');
    expect(markup).toContain('value="caller-value"');
    expect(markup).toContain("Source-owned diagnostic detail");
  });
  it("starts without errors, retaining existing hints and input values", () => {
    const markup = renderToStaticMarkup(<ValidatedForm fields={[integer]}><label htmlFor="version">Version<input id="version" defaultValue="1" aria-describedby="hint" /></label><p id="hint">Caller input</p></ValidatedForm>);
    expect(markup).toContain('noValidate=""');
    expect(markup).toContain('aria-invalid="false"');
    expect(markup).toContain('aria-describedby="hint"');
    expect(markup).not.toContain('class="error-summary"');
  });
  it("migrates every native page form and has no transport or outcome implementation in validation", () => {
    const pages = new URL("../src/pages/", import.meta.url);
    const files = readdirSync(pages, { recursive: true }).filter((name) => String(name).endsWith(".tsx"));
    let count = 0;
    const doc = readFileSync(new URL("../../../docs/c-form-validation-ux-stub-apps-bind.md", import.meta.url), "utf8");
    for (const file of files) {
      const source = readFileSync(new URL(String(file), pages), "utf8");
      expect(source).not.toMatch(/<form\b/);
      for (const match of source.matchAll(/<ValidatedForm\b[\s\S]*?\bid="([^"]+)"/g)) {
        expect(doc, `documented form ${match[1]}`).toContain(`| ${match[1]} |`);
      }
      count += (source.match(/<ValidatedForm\b/g) ?? []).length;
    }
    expect(count).toBe(16);
    for (const file of ["validation.ts", "useFormValidation.ts", "ValidatedForm.tsx"]) {
      const source = readFileSync(new URL(`../src/forms/${file}`, import.meta.url), "utf8");
      expect(source).not.toMatch(/fetch\(|invokeLocalCall|sessionStorage|localStorage|capture|settle_capture|Idempotency-Key/);
    }
  });
});
