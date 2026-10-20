import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { STATUS_MARKS } from "../src/a11y/marks";
import { FEATURE_STATUSES } from "../src/handoff/packet";
import { LocaleProvider } from "../src/i18n/LocaleProvider";
import { OUTCOME_WORDS } from "../src/i18n/translate";
import { GUIDE_KIND_LABELS, STATUS_WORD_GUIDE } from "../src/guide/status-words";
import { ROUTE_BINDINGS, ROUTES } from "../src/shell/route-registry";
import {
  ACCEPTANCE_STATES,
  COVERAGE_STATES,
  NODE_STATES,
  QUALIFICATION_STATES,
  RELEASE_STATES,
} from "./support/local-evidence-matrix";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const guideDir = path.join(root, "docs/guide");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const glossary = read("docs/guide/status-glossary-ko.md");
const screensDoc = read("docs/guide/screens-ko.md");
const localRun = read("docs/guide/local-run-ko.md");

const page = (pathname: string, locale: "en" | "ko" = "en") =>
  renderToStaticMarkup(
    <LocaleProvider initial={locale}>
      <MemoryRouter initialEntries={[pathname]}>
        <App />
      </MemoryRouter>
    </LocaleProvider>,
  );

/** `| \`WORD\` | …` rows of the glossary table, first cell only. */
const glossaryWords = () =>
  glossary
    .split("\n")
    .filter((line) => line.startsWith("| `"))
    .map((line) => (line.split("|")[1] ?? "").trim().replaceAll("`", ""));

/** `## \`/path\`` headings of the screens document. */
const screenHeadings = () =>
  screensDoc
    .split("\n")
    .filter((line) => line.startsWith("## `"))
    .map((line) => line.slice(4, -1));

describe("guide word list", () => {
  it("has one entry per word, a known kind, and no empty field", () => {
    const words = STATUS_WORD_GUIDE.map((item) => item.word);
    expect(new Set(words).size).toBe(words.length);
    for (const item of STATUS_WORD_GUIDE) {
      expect(GUIDE_KIND_LABELS[item.kind], item.word).toBeDefined();
      for (const field of [item.meaning, item.doText, item.dontText]) {
        expect(field.trim(), item.word).not.toBe("");
      }
    }
  });

  it("derives its outcome, mark, binding and feature subsets from the live lists, both ways", () => {
    const wordsOf = (kind: string) => STATUS_WORD_GUIDE.filter((item) => item.kind === kind).map((item) => item.word);
    expect(wordsOf("outcome")).toEqual([...OUTCOME_WORDS]);
    expect(wordsOf("status-mark")).toEqual(Object.values(STATUS_MARKS).map((mark) => mark.word));
    expect(wordsOf("binding")).toEqual([...ROUTE_BINDINGS]);
    expect(wordsOf("feature")).toEqual([...FEATURE_STATUSES]);
  });

  it("keeps every facet word inside the evidence matrix's own cell vocabularies", () => {
    const allowed = new Set<string>([
      ...NODE_STATES,
      ...QUALIFICATION_STATES,
      ...ACCEPTANCE_STATES,
      ...RELEASE_STATES,
      ...COVERAGE_STATES,
      'NOT_EVALUATED', // the centralDone column word in the node table
    ]);
    for (const item of STATUS_WORD_GUIDE.filter((entry) => entry.kind === "facet")) {
      expect(allowed.has(item.word), item.word).toBe(true);
    }
  });
});

describe("glossary document", () => {
  it("carries exactly the guide words, in the same order", () => {
    expect(glossaryWords()).toEqual(STATUS_WORD_GUIDE.map((item) => item.word));
  });

  it("fills all five columns on every row", () => {
    const rows = glossary.split("\n").filter((line) => line.startsWith("| `"));
    for (const row of rows) {
      const cells = row.split("|").slice(1, -1);
      expect(cells.length, row).toBe(5);
      for (const cell of cells.slice(1)) {
        expect(cell.trim(), row).not.toBe("");
      }
    }
  });

  it("never reads UNKNOWN as a failure or a success, and never as 'did not happen'", () => {
    const row = glossary.split("\n").find((line) => line.startsWith("| `UNKNOWN`"))!;
    expect(row).toContain("실패도");
    expect(row).toContain("성공도");
    const words = STATUS_WORD_GUIDE.find((item) => item.word === "UNKNOWN")!;
    expect(words.dontText).toContain("may have applied");
    // Outside the UNKNOWN row and its own negations, no row may call a status word a success or an approval.
    const stripped = glossary
      .split("\n")
      .filter((line) => line.startsWith("| `") && !line.startsWith("| `UNKNOWN`") && !line.startsWith("| `REJECT`") && !line.startsWith("| `SUCCESS`"))
      .join("\n");
    expect(stripped).not.toMatch(/성공|승인|실패/);
  });
});

describe("screens document", () => {
  it("has one `## `path`` entry per registry route, in registry order", () => {
    expect(screenHeadings()).toEqual(ROUTES.map((route) => route.path));
  });
});

describe("guide documents keep the hygiene rules", () => {
  it("holds no secret, credential shape, private path or personal data", () => {
    for (const file of readdirSync(guideDir).filter((name) => name.endsWith(".md"))) {
      // Backticked spans are verbatim identifiers (env vars, commands), not secret values.
      const text = readFileSync(path.join(guideDir, file), "utf8").replace(/`[^`]*`/g, "");
      for (const pattern of [
        /token|bearer|secret|password|api[-_ ]?key/i,
        /\/(home|Users|root)\//,
        /\.env\b/,
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
        /\b\d{1,3}(\.\d{1,3}){3}\b(?<!127\.0\.0\.1)/,
      ]) {
        expect(pattern.test(text), `${file}: ${pattern}`).toBe(false);
      }
    }
  });

  it("claims nothing it does not do: no integration, qualification, acceptance or release claim", () => {
    for (const text of [glossary, screensDoc, localRun]) {
      const stripped = text.replace(/`[^`]*`/g, "");
      expect(stripped).not.toMatch(/\b(is|are|was|were) (now )?(released|accepted|qualified)\b/i);
      // Korean negations ("...되지 않음") contain these stems legitimately, so only the affirmative forms are banned.
      expect(stripped).not.toMatch(/실결제|실서비스/);
    }
  });
});

describe("in-app help", () => {
  it("draws the help line with a link to /help on every registry sample and the not-found screen", () => {
    for (const item of [...ROUTES.map((route) => route.sample), "/no-such-screen"]) {
      const html = page(item);
      expect(html, item).toContain('href="/help"');
      expect(html, item).toContain("Help — status words");
    }
  });

  it("says the same in Korean chrome", () => {
    const html = page("/receipts", "ko");
    expect(html).toContain('href="/help"');
    expect(html).toContain("도움말 — 상태 단어");
    expect(html).toContain("UNKNOWN(결과 미확인)");
  });

  it("renders every guide word on /help, verbatim", () => {
    const html = page("/help");
    for (const item of STATUS_WORD_GUIDE) {
      expect(html, item.word).toContain(`data-word="${item.word}"`);
      expect(html, item.word).toContain(`<code>${item.word}</code>`);
    }
    expect(html).toContain("glossary");
  });

  it("the help page states it is a glossary, not a status surface", () => {
    const html = page("/help");
    expect(html).toContain("no request is sent");
    expect(html).not.toMatch(/\b(is|are) (released|accepted|qualified)\b/i);
  });
});
