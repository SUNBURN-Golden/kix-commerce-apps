import { describe, it } from "vitest";
import { useBrowser } from "../../src/suite";
import { VISUAL_SESSION, idOf, visualShots } from "../../src/visual-matrix";
import { checkShot, useVisual } from "./helpers";

describe("visual baselines: dark scheme and forced colours (stub, headless Chrome)", () => {
  const suite = useBrowser(VISUAL_SESSION);
  const visual = useVisual(suite);

  for (const shot of visualShots().filter((item) => item.scheme !== "light")) {
    it(idOf(shot), async () => {
      await checkShot(suite, visual, shot);
    });
  }
});
