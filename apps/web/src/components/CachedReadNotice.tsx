import { useConnectivity } from "../connectivity/ConnectivityProvider";
import { cachedGroups } from "../connectivity/write-guard";
import { useConnectivityCopy } from "../connectivity/copy";

/** History has no supported freshness promotion. Each supported reader has its own stamp. */
export function CachedReadNotice({ path }: { path: string }) {
  const state = useConnectivity();
  const copy = useConnectivityCopy();
  const cached = cachedGroups(path);
  if (!state.disconnected && !state.writesBlocked) return null;
  return (
    <div className="banner cached-read" role="note" data-cached-read="true">
      <p>{copy.cached}</p>
      {cached.length > 0 ? <p>{copy.readers} {cached.map((group) => group.label).join(", ")}</p> : null}
    </div>
  );
}
