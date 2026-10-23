import { MESSAGES } from "./catalogue";
import type { messages as ScreenInventory } from "./generated-catalogue";
import { interpolate, type Translate } from "./translate";
import { formatNumber, formatUnits } from "../format";
import { intlTag, type Locale } from "./locales";

/** Immutable app copy loaded with screens, never with the shell. */
export interface MessageBundle {
  readonly en: Readonly<Record<string, string>>;
  readonly ko: Readonly<Record<string, string>>;
}
type DisplayKey = keyof typeof MESSAGES.en | keyof typeof ScreenInventory.en;

interface CompiledBundle {
  exact: Map<string, string>;
  patterns: { key: string; names: string[]; expression: RegExp }[];
}
const compiled = new WeakMap<MessageBundle, CompiledBundle>();
const displayResolvers = new WeakMap<Translate, (value: string) => string>();
const numberLocales = new WeakMap<Translate, ReturnType<typeof intlTag>>();
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function compile(bundle: MessageBundle): CompiledBundle {
  const cached = compiled.get(bundle);
  if (cached) return cached;
  const exact = new Map<string, string>();
  const patterns: CompiledBundle["patterns"] = [];
  for (const [key, source] of Object.entries(bundle.en)) {
    exact.set(normalize(source), key);
    if (!key.startsWith("p.")) continue;
    const names: string[] = [];
    let offset = 0;
    let expression = "^";
    for (const match of source.matchAll(/\{(v[0-9]+)\}/g)) {
      const name = match[1];
      if (name === undefined || match.index === undefined) continue;
      expression += escapePattern(source.slice(offset, match.index)) + "([\\s\\S]*?)";
      names.push(name);
      offset = match.index + match[0].length;
    }
    expression += escapePattern(source.slice(offset)) + "$";
    patterns.push({ key, names, expression: new RegExp(expression) });
  }
  patterns.sort((a, b) => (bundle.en[b.key]?.length ?? 0) - (bundle.en[a.key]?.length ?? 0));
  const result = { exact, patterns };
  compiled.set(bundle, result);
  return result;
}

/** Known app copy only. Unrecognized provider/user text and non-string children pass through. */
type DisplayValue<T> = T extends number ? string : T;
export function deskText<T>(t: Translate, value: T): DisplayValue<T> {
  const displayed = typeof value === "number" ? formatNumber(value, numberLocales.get(t))
    : typeof value === "string" ? displayResolvers.get(t)?.(value) ?? value : value;
  return displayed as DisplayValue<T>;
}

export function makeScreenTranslate(locale: Locale, ...bundles: readonly MessageBundle[]): Translate {
  const sources: readonly MessageBundle[] = [...bundles, MESSAGES];
  const tables = sources.map((bundle) => bundle[locale]);
  const translate = ((key: DisplayKey, params?: Record<string, string | number>) => {
    for (const table of tables) {
      if (Object.hasOwn(table, key)) return interpolate(table[key] ?? key, params && Object.fromEntries(Object.entries(params).map(([name, value]) => [name, typeof value === "number" ? formatNumber(value, intlTag(locale)) : value])));
    }
    return key;
  }) as Translate;
  // Compile each immutable bundle once, including when a component re-renders.
  const lookups = sources.map((bundle) => ({ bundle, ...compile(bundle) }));
  const pluralSuffixes: Readonly<Record<string, readonly string[]>> = {
    "p.t119": ["v2"], "p.t120": ["v2"], "p.t130": ["v2"], "p.t173": ["v2"],
    "p.t246": ["v7", "v8"], "p.t298": ["v2"], "p.t321": ["v2"], "p.t424": ["v2"],
  };
  const verbatimData = new Set(["open", "confirmed", "rejected", "unknown", "stale", "loading", "empty", "error", "in-flight", "not-sent", "fenced", "not-bound", "unavailable", "cancelled", "transferred", "valid", "invalid", "already-consumed", "unavailable-server", "stub", "integration-http"]);
  function display(value: string, depth = 0): string {
    if (locale === "en" || depth > 4 || verbatimData.has(value)) return value;
    const units = /^(-?(?:0|[1-9][0-9]*)) mock units$/.exec(value);
    if (units?.[1] !== undefined) return formatUnits(units[1], MESSAGES[locale]["amount.mockUnits"], intlTag(locale));
    for (const { bundle, exact } of lookups) {
      const key = exact.get(normalize(value));
      if (key !== undefined && !key.startsWith("p.")) return bundle.ko[key] ?? value;
    }
    for (const { bundle, patterns } of lookups) {
      for (const { key, names, expression } of patterns) {
        const match = expression.exec(value);
        if (!match) continue;
        const params = Object.fromEntries(names.map((name, i) => [name,
          pluralSuffixes[key]?.includes(name) ? "" : display(match[i + 1] ?? "", depth + 1),
        ]));
        return interpolate(bundle.ko[key] ?? value, params);
      }
    }
    return value;
  }
  numberLocales.set(translate, intlTag(locale));
  displayResolvers.set(translate, display);
  return translate;
}

