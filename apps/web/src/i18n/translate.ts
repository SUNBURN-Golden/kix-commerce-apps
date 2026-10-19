import { MESSAGES, type MessageKey } from "./catalogue";
import type { Locale } from "./locales";

/** Names of the `{name}` placeholders in a message, as a union. */
type Placeholders<S extends string> = S extends `${string}{${infer P}}${infer R}` ? P | Placeholders<R> : never;

type EnMessages = typeof MESSAGES.en;

export type Params<K extends MessageKey> = Placeholders<EnMessages[K]>;

type ParamArgs<K extends MessageKey> = [Params<K>] extends [never] ? [] : [params: Record<Params<K>, string | number>];

export type Translate = <K extends MessageKey>(key: K, ...args: ParamArgs<K>) => string;

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/** The placeholder names in a template. A test compares them between en and ko. */
export function placeholdersOf(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((match) => match[1]!);
}

/** Fills `{name}` from params. A placeholder with no value stays visible as written; nothing throws. */
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }
  return template.replace(PLACEHOLDER, (whole, name: string) => (Object.hasOwn(params, name) ? String(params[name]) : whole));
}

/** Pure: no storage, no DOM. */
export function makeTranslate(locale: Locale): Translate {
  const table: Record<string, string> = MESSAGES[locale];
  return ((key: MessageKey, params?: Record<string, string | number>) => interpolate(table[key] ?? MESSAGES.en[key], params)) as Translate;
}

/** The outcome words. They are shown verbatim in every locale; a locale may add a gloss beside them. */
export const OUTCOME_WORDS = ["UNKNOWN", "NOT_BOUND", "STALE"] as const;
export type OutcomeWord = (typeof OUTCOME_WORDS)[number];

/** `UNKNOWN` in English, `UNKNOWN (결과 미확인)` in Korean. The word itself is never replaced. */
export function outcomeLabel(t: Translate, word: OutcomeWord): string {
  const gloss = t(`outcome.${word}.gloss`);
  return gloss === "" ? word : `${word} (${gloss})`;
}
