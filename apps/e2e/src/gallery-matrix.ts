/** Development coverage is separate from production screens and business outcomes. App-internal only. */
export const DEV_SCREENS = [{ screenId: "component-gallery", path: "/dev/gallery", label: "Component gallery" }] as const;
export const GALLERY_CHECK_IDS = ["gallery.production-absent", "gallery.cases-axe", "gallery.keyboard-states", "gallery.locale-preferences"] as const;
export const GALLERY_CASE_IDS = [
  "shell-stub", "nav-current", "nav-no-current", "breadcrumb-root", "breadcrumb-child", "breadcrumb-parameter", "breadcrumb-empty", "screen-loading",
  "status-loading", "status-blocked", "status-selected", "status-review", "amount-undetermined", "deadline-true", "deadline-false", "deadline-null",
  "locale-switch", "error-render-error", "error-screen-load-error", "safe-text", "safe-text-empty", "safe-text-shortened",
  "async-loading", "async-empty", "async-error", "async-unknown", "async-stale", "async-not-bound", "async-parent",
  "connectivity-banner", "cached-read", "connectivity-write", "form-errors-empty", "form-errors",
] as const;
