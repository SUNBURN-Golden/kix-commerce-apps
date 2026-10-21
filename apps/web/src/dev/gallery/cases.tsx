import type { ReactNode } from "react";
import { AmountNotice, DeadlineLine, STATUS_MARKS, StatusMark, type StatusMarkKind } from "../../a11y/marks";
import { Breadcrumb } from "../../components/Breadcrumb";
import { ScreenLoading } from "../../components/ScreenLoading";
import { Shell } from "../../components/Shell";
import { SurfaceNav } from "../../components/SurfaceNav";
import { LocaleSwitch } from "../../i18n/LocaleSwitch";
import { SafeText } from "../../safe-text";
import { ErrorPanel } from "../../shell/RenderBoundary";

/** App-internal synthetic examples. No command, source attachment, clock or generated identifier. */
export interface GalleryCase {
  id: string;
  component: string;
  state: string;
  samplePath: string;
  ownsShell?: boolean;
  render: () => ReactNode;
}
const item = (id: string, component: string, state: string, render: () => ReactNode, samplePath = "/buyer"): GalleryCase =>
  ({ id, component, state, render, samplePath });
const noop = () => undefined;
const deadline = "2026-10-01T00:00:00.000Z";

export const GALLERY_CASES: readonly GalleryCase[] = [
  { ...item("shell-stub", "Shell", "stub", () => <Shell><h2>Synthetic Shell specimen</h2><p>UNKNOWN · NOT_BOUND · STALE · UNDETERMINED</p></Shell>), ownsShell: true },
  item("nav-current", "SurfaceNav", "current link; desktop or narrow closed/open", () => <SurfaceNav />),
  item("nav-no-current", "SurfaceNav", "no current link; desktop or narrow closed/open", () => <SurfaceNav />, "/unmatched-specimen"),
  item("breadcrumb-root", "Breadcrumb", "root", () => <Breadcrumb />, "/"),
  item("breadcrumb-child", "Breadcrumb", "parent and child", () => <Breadcrumb />, "/credit/servicing"),
  item("breadcrumb-parameter", "Breadcrumb", "parameterized", () => <Breadcrumb />, "/booking/evt_gallery_synthetic"),
  item("breadcrumb-empty", "Breadcrumb", "unmatched (empty)", () => <Breadcrumb />, "/unmatched-specimen"),
  item("screen-loading", "ScreenLoading", "progress; nothing sent", () => <ScreenLoading label="Buyer" />),
  ...Object.keys(STATUS_MARKS).map((kind) => item(`status-${kind}`, "StatusMark", kind, () => <StatusMark kind={kind as StatusMarkKind} />)),
  item("amount-undetermined", "AmountNotice", "UNDETERMINED", () => <AmountNotice />),
  ...([true, false, null] as const).map((expired) => item(`deadline-${String(expired)}`, "DeadlineLine", `expired ${String(expired)}`, () => <DeadlineLine expiresAt={deadline} expired={expired} />)),
  item("locale-switch", "LocaleSwitch", "en / ko", () => <LocaleSwitch />),
  ...(["render-error", "screen-load-error"] as const).map((kind) => item(`error-${kind}`, "ErrorPanel", kind, () => <ErrorPanel
    fault={{ kind, code: null, requestId: null, correlationId: null, reference: "gallery-synthetic-fault" }}
    scope="route" screenLabel="Synthetic specimen" onAgain={noop}
  />)),
  item("safe-text", "SafeText", "untrusted text", () => <SafeText value={'<script>synthetic</script>'} />),
  item("safe-text-empty", "SafeText", "empty", () => <SafeText value="" />),
  item("safe-text-shortened", "SafeText", "shortened with copyable original", () => <SafeText value="Synthetic text with an inspectable original" maxDisplay={12} />),
];

export function galleryCaseProblems(cases: readonly GalleryCase[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const entry of cases) {
    if (ids.has(entry.id)) problems.push(`duplicate case ${entry.id}`);
    ids.add(entry.id);
  }
  for (const component of ["Shell", "SurfaceNav", "Breadcrumb", "ScreenLoading", "StatusMark", "AmountNotice", "DeadlineLine", "LocaleSwitch", "ErrorPanel", "SafeText"]) {
    if (!cases.some((entry) => entry.component === component)) problems.push(`missing component ${component}`);
  }
  return problems;
}
