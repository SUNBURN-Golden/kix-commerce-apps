import { describe, it } from "vitest";
import { useBrowser } from "../../src/suite";
import { VISUAL_SESSION, idOf, visualShots } from "../../src/visual-matrix";
import { checkShot, useVisual } from "./helpers";

describe("visual baselines: key screens at 390px and 1280px, English and Korean (stub, headless Chrome)", () => {
  const suite = useBrowser(VISUAL_SESSION);
  const visual = useVisual(suite);

  for (const shot of visualShots().filter((item) => item.scheme === "light")) {
    it(idOf(shot), async () => {
      await checkShot(suite, visual, shot);
    });
  }
});
