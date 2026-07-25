import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The scrolling marquee is a *lobby* affordance: it sets context before you
 * commit to a puzzle. Mid-game it competes with the board and, being `fixed`,
 * covers the bottom row of Nutshell's on-screen keyboard on short viewports.
 * Multiplayer already draws this line — StageApp mounts the Ticker inside
 * StageLobby only, never in the in-game Stage branch — and Daily now matches.
 *
 * This is a source-level assertion rather than a render test on purpose:
 * apps/web runs vitest under `environment: "node"` with no jsdom or RTL, and
 * standing that up to guard one JSX element would cost far more than the
 * invariant is worth. The check is deliberately narrow — it asks only "does
 * this file mount a Ticker", which is exactly the thing that regressed.
 */
function readComponent(file: string): string {
  return readFileSync(path.resolve(__dirname, "..", file), "utf8");
}

const mountsTicker = (src: string) => /<Ticker[\s/>]/.test(src);

describe("Ticker placement across Daily screens", () => {
  it("does not mount the marquee on the in-game play shell", () => {
    const src = readComponent("DailyPlayShell.tsx");
    expect(mountsTicker(src)).toBe(false);
  });

  it("leaves no dead Ticker wiring behind on the play shell", () => {
    const src = readComponent("DailyPlayShell.tsx");
    expect(src).not.toContain("useDailyTickerItems");
    expect(src).not.toContain("components/Ticker");
  });

  it("still mounts the marquee on the Daily hub", () => {
    const src = readComponent("DailyHomeScreen.tsx");
    expect(mountsTicker(src)).toBe(true);
  });
});
