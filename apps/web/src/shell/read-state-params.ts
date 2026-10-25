import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { UNSAFE_LocationContext, UNSAFE_NavigationContext } from "react-router-dom";
import { LOCALE_PARAM, parseLocale } from "../i18n/locales";

type Param = { name: string; nav: "replace" | "push"; dependsOn?: string };
const selection = (name: string, dependsOn?: string): Param => ({ name, nav: "replace", dependsOn });
const filter = (name: string): Param => ({ name, nav: "push" });
export const READ_STATE_PARAMS = {
  buyer: [selection("receipt")],
  platform: [filter("channel"), selection("trade", "channel")],
  merchant: [filter("cut"), selection("row", "cut")],
  finance: [filter("queue"), selection("case", "queue")],
  "credit-origination": [filter("lane"), selection("application")],
  "credit-servicing": [filter("lane"), selection("obligation")],
  "marketing-journey": [selection("benefit")],
  assistant: [selection("grant")],
  permissions: [filter("workspace")],
  notifications: [filter("filter"), selection("item", "filter")],
  identity: [selection("item")],
  session: [selection("item")],
  journeys: [selection("row")],
  provider: [selection("step")],
} as const;
export type ReadStateScreen = keyof typeof READ_STATE_PARAMS;
export type ReadValues = Partial<Record<string, string>>;
export type ReadDomain = Record<string, readonly string[] | null | ((values: ReadValues) => readonly string[] | null)>;
export const READ_STATE_VALUE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;

/** Only exact, single, nonempty values are accepted. Unknown domains never expose a value. */
export function parseReadState(screen: ReadStateScreen, search: string, domain: ReadDomain) {
  const params = new URLSearchParams(search);
  const values: ReadValues = {};
  const dropped = new Set<string>();
  const pending: string[] = [];
  const allowed = READ_STATE_PARAMS[screen];
  for (const name of params.keys()) {
    if (name === LOCALE_PARAM) {
      if (params.getAll(name).length !== 1 || !parseLocale(params.get(name))) dropped.add(name);
    } else if (!allowed.some((param) => param.name === name)) dropped.add(name);
  }
  for (const { name, dependsOn } of allowed) {
    const entries = params.getAll(name);
    if (!entries.length) continue;
    const value = entries[0] ?? "";
    if (entries.length !== 1 || !READ_STATE_VALUE.test(value) || (dependsOn && dropped.has(dependsOn))) {
      dropped.add(name);
      continue;
    }
    const entry = domain[name];
    const options = typeof entry === "function" ? entry(values) : entry;
    if (options == null || (dependsOn && pending.includes(dependsOn))) pending.push(name);
    else if (options.includes(value)) values[name] = value;
    else dropped.add(name);
  }
  return { values, dropped: [...dropped], pending };
}

/** Serialization uses the same validation as opening a link; keys outside the screen are omitted. */
export function serialiseReadState(screen: ReadStateScreen, current: URLSearchParams, next: Record<string, string | null>, domain: ReadDomain) {
  const params = new URLSearchParams(current);
  for (const { name, dependsOn } of READ_STATE_PARAMS[screen]) {
    if (dependsOn && Object.hasOwn(next, dependsOn) && next[dependsOn] !== current.get(dependsOn)) params.delete(name);
    if (Object.hasOwn(next, name)) {
      params.delete(name);
      if (next[name] !== null) params.set(name, next[name] ?? "");
    }
  }
  const { dropped } = parseReadState(screen, params.toString(), domain);
  for (const name of dropped) params.delete(name);
  // A new value must have an available source domain.
  for (const name of parseReadState(screen, params.toString(), domain).pending) {
    if (Object.hasOwn(next, name)) params.delete(name);
  }
  return params;
}

export interface ReadState {
  values: ReadValues;
  notice: boolean;
  set(name: string, value: string | null): void;
}

export function useReadState(screen: ReadStateScreen, domain: ReadDomain): ReadState {
  const routedLocation = useContext(UNSAFE_LocationContext)?.location;
  const navigation = useContext(UNSAFE_NavigationContext);
  const [local, setLocal] = useState({ key: "0", pathname: "", search: "", hash: "" });
  const location = routedLocation ?? local;
  const move = useCallback((search: string, replace: boolean) => {
    if (navigation === null) {
      setLocal((previous) => ({ ...previous, key: String(Number(previous.key) + 1), search }));
    } else {
      const pathname = navigation.basename === "/" ? location.pathname : navigation.basename + location.pathname;
      navigation.navigator[replace ? "replace" : "push"]({ pathname, search, hash: location.hash });
    }
  }, [navigation, location.pathname, location.hash]);
  const parsed = parseReadState(screen, location.search, domain);
  const visit = useRef({ key: location.key, checked: new Set<string>(), notice: false, cleaning: null as string | null });
  if (visit.current.key !== location.key) {
    const carry = visit.current.cleaning !== null && visit.current.cleaning === location.search;
    visit.current = { key: location.key, checked: carry ? visit.current.checked : new Set(), notice: carry && visit.current.notice, cleaning: null as string | null };
  }
  const state = visit.current;
  useEffect(() => {
    const invalid = parsed.dropped.filter((name) => !state.checked.has(name));
    for (const { name } of READ_STATE_PARAMS[screen]) {
      if (!parsed.pending.includes(name)) state.checked.add(name);
    }
    for (const name of parsed.dropped) state.checked.add(name);
    if (!invalid.length) return;
    state.notice = true;
    const params = new URLSearchParams(location.search);
    for (const name of invalid) params.delete(name);
    state.cleaning = params.size ? `?${params}` : "";
    move(state.cleaning, true);
  }, [location, move, parsed.dropped, parsed.pending, screen, state]);
  return {
    values: parsed.values,
    notice: state.notice || parsed.dropped.some((name) => !state.checked.has(name)),
    set(name, value) {
      const param = READ_STATE_PARAMS[screen].find((entry) => entry.name === name);
      if (!param) return;
      const params = serialiseReadState(screen, new URLSearchParams(location.search), { [name]: value }, domain);
      if (params.toString() === location.search.slice(1)) return;
      move(params.size ? `?${params}` : "", param.nav === "replace");
    },
  };
}
