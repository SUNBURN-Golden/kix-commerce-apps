import type { WorkspaceRole } from "../workspace/registry";
import { ROUTES } from "../shell/route-registry";

const starts: readonly { role: WorkspaceRole; surfaceId: string }[] = [
  { role: "buyer", surfaceId: "buyer-workspace" },
  { role: "organizer", surfaceId: "organizer-workspace" },
  { role: "operator", surfaceId: "receipt-explorer" },
];

export const ROLE_STARTS = starts.map(({ role, surfaceId }) => {
  const surface = ROUTES.find((entry) => entry.surface === surfaceId);
  if (!surface) {
    throw new Error(`Missing role start: ${surfaceId}`);
  }
  return { role, path: surface.path };
});
