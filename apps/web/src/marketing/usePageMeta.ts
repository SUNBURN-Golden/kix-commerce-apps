import { useEffect } from "react";
import type { DocumentMeta } from "./types.js";

function assignMeta(attr: "name" | "property", key: string, content: string): () => void {
  const selector = `meta[${attr}="${key}"]`;
  const found = document.head.querySelector(selector);
  const created = !(found instanceof HTMLMetaElement);
  const element = created ? document.createElement("meta") : found;
  if (created) {
    element.setAttribute(attr, key);
    element.dataset.kixWave7 = "1";
    document.head.append(element);
  }
  const previous = element.getAttribute("content");
  element.setAttribute("content", content);
  return () => {
    if (created) {
      element.remove();
      return;
    }
    if (previous === null) {
      element.removeAttribute("content");
      return;
    }
    element.setAttribute("content", previous);
  };
}

function assignCanonical(path: string): () => void {
  const found = document.head.querySelector('link[rel="canonical"]');
  const created = !(found instanceof HTMLLinkElement);
  const element = created ? document.createElement("link") : found;
  if (created) {
    element.rel = "canonical";
    element.dataset.kixWave7 = "1";
    document.head.append(element);
  }
  const previous = element.getAttribute("href");
  element.setAttribute("href", path);
  return () => {
    if (created) {
      element.remove();
      return;
    }
    if (previous === null) {
      element.removeAttribute("href");
      return;
    }
    element.setAttribute("href", previous);
  };
}

/** Apply demo document tags. Cleanup restores whatever the desk page had. */
export function usePageMeta(meta: DocumentMeta): void {
  const { title, description, robots, ogTitle, ogDescription, canonicalPath } = meta;
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    const restore = [
      assignMeta("name", "description", description),
      assignMeta("name", "robots", robots),
      assignMeta("property", "og:title", ogTitle),
      assignMeta("property", "og:description", ogDescription),
      assignCanonical(canonicalPath),
    ];
    return () => {
      document.title = previousTitle;
      for (const undo of restore) {
        undo();
      }
    };
  }, [title, description, robots, ogTitle, ogDescription, canonicalPath]);
}
