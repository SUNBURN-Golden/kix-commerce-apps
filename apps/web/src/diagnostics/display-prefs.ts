import { useSyncExternalStore } from "react";
export interface DisplayPreferences { colorScheme: string; forcedColors: string; reducedMotion: string }
const queries = ["(prefers-color-scheme: dark)", "(forced-colors: active)", "(prefers-reduced-motion: reduce)"];
const server = () => "not-read,not-read,not-read";
function snapshot() {
  if (typeof matchMedia !== "function") return server();
  return queries.map((query) => matchMedia(query).matches ? "yes" : "no").join(",");
}
function subscribe(listener: () => void) {
  if (typeof matchMedia !== "function") return () => {};
  const media = queries.map((query) => matchMedia(query));
  media.forEach((item) => item.addEventListener("change", listener));
  return () => media.forEach((item) => item.removeEventListener("change", listener));
}
export function useDisplayPreferences(): DisplayPreferences {
  const [dark, forcedColors, reducedMotion] = useSyncExternalStore(subscribe, snapshot, server).split(",");
  return { colorScheme: dark === "not-read" ? dark : dark === "yes" ? "dark" : "light", forcedColors, reducedMotion };
}
