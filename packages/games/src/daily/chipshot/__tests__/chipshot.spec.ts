import { describe, it, expect } from "vitest";
import { createDailyTestRun, act, actErr, ctxOf } from "../../testing";
import { chipshot } from "../index";
import { validatePack } from "../pack";
import type { ChipShotPublicState, ChipShotSecretState, HoleLayout } from "../types";
import { simulateShot, wallCollision, bumperCollision, pointInPolygon } from "../physics";

describe("chipshot daily game module", () => {
  const validPayload = {
    seed: "2026-08-03-chipshot",
    holeCount: 3,
    difficulty: 2 as const,
    maxStrokesPerHole: 8,
  };

  const validEnvelope = {
    gameId: "chipshot",
    puzzleDate: "2026-08-03",
    payload: validPayload,
    sourceRefs: [],
  };

  describe("pack validation", () => {
    it("validates correct envelope and bare payload", () => {
      const res1 = validatePack(validEnvelope, "2026-08-03");
      expect(res1.ok).toBe(true);
      if (res1.ok) {
        expect(res1.pack.gameId).toBe("chipshot");
        expect(res1.pack.puzzleDate).toBe("2026-08-03");
      }

      const res2 = validatePack(validPayload, "2026-08-03");
      expect(res2.ok).toBe(true);
    });

    it("rejects invalid pack parameters", () => {
      expect(validatePack({ ...validPayload, seed: "" }, "2026-08-03").ok).toBe(false);
      expect(validatePack({ ...validPayload, holeCount: 0 }, "2026-08-03").ok).toBe(false);
      expect(validatePack({ ...validPayload, difficulty: 4 }, "2026-08-03").ok).toBe(false);
      expect(validatePack({ ...validPayload, maxStrokesPerHole: 2 }, "2026-08-03").ok).toBe(false);
    });
  });

  describe("initialization", () => {
    it("initializes public and secret state cleanly", () => {
      const run = createDailyTestRun(chipshot, {
        puzzleDate: "2026-08-03",
        pack: {
          gameId: "chipshot",
          puzzleDate: "2026-08-03",
          payload: validPayload,
          sourceRefs: [],
        },
      });

      const pub = run.state.publicState as ChipShotPublicState;
      const sec = run.state.secretState as ChipShotSecretState;

      expect(pub.phase).toBe("aiming");
      expect(pub.holeIndex).toBe(0);
      expect(pub.holes.length).toBe(3);
      expect(pub.pars.length).toBe(3);
      expect(pub.strokes.length).toBe(0);
      expect(pub.currentHoleStrokes).toBe(0);
      expect(pub.ball.pos).toEqual(pub.holes[0]?.tee);

      expect(sec.seed).toBe("2026-08-03-chipshot");
      expect(sec.maxStrokesPerHole).toBe(8);
    });
  });

  describe("gameplay flow and physics reduction", () => {
    it("rejects invalid actions or payloads", () => {
      const run = createDailyTestRun(chipshot, {
        puzzleDate: "2026-08-03",
        pack: {
          gameId: "chipshot",
          puzzleDate: "2026-08-03",
          payload: validPayload,
          sourceRefs: [],
        },
      });

      // invalid power
      const err1 = actErr(run, "shoot", { angle: 0, power: 1.5 });
      expect(err1.code).toBe("invalid_power");

      // next_hole while aiming
      const err2 = actErr(run, "next_hole");
      expect(err2.code).toBe("invalid_phase");
    });

    it("executes a shot and updates strokes", () => {
      const run = createDailyTestRun(chipshot, {
        puzzleDate: "2026-08-03",
        pack: {
          gameId: "chipshot",
          puzzleDate: "2026-08-03",
          payload: validPayload,
          sourceRefs: [],
        },
      });

      act(run, "shoot", { angle: 0, power: 0.5 });
      const pub = run.state.publicState as ChipShotPublicState;
      expect(pub.currentHoleStrokes).toBe(1);
      expect(pub.lastShot).not.toBeNull();
      expect(pub.lastShot?.frames.length).toBeGreaterThan(0);
    });

    it("handles hole completion and round summarization", () => {
      const run = createDailyTestRun(chipshot, {
        puzzleDate: "2026-08-03",
        pack: {
          gameId: "chipshot",
          puzzleDate: "2026-08-03",
          payload: validPayload,
          sourceRefs: [],
        },
      });

      // Force state into scored phase for hole 0
      run.state.publicState = {
        ...(run.state.publicState as ChipShotPublicState),
        phase: "scored",
        currentHoleStrokes: 2,
      };
      run.phase = "scored";

      act(run, "next_hole");
      let pub = run.state.publicState as ChipShotPublicState;
      expect(pub.holeIndex).toBe(1);
      expect(pub.strokes).toEqual([2]);
      expect(pub.phase).toBe("aiming");

      // Hole 1 to 2
      run.state.publicState = {
        ...pub,
        phase: "scored",
        currentHoleStrokes: 3,
      };
      run.phase = "scored";
      act(run, "next_hole");
      pub = run.state.publicState as ChipShotPublicState;
      expect(pub.holeIndex).toBe(2);
      expect(pub.strokes).toEqual([2, 3]);

      // Hole 2 to done
      run.state.publicState = {
        ...pub,
        phase: "scored",
        currentHoleStrokes: 1,
      };
      run.phase = "scored";
      act(run, "next_hole");
      pub = run.state.publicState as ChipShotPublicState;
      expect(pub.phase).toBe("done");
      expect(pub.strokes).toEqual([2, 3, 1]);
      expect(run.over).toBe(true);

      const summary = chipshot.summarize(ctxOf(run), run.state);
      expect(summary.status).toBe("solved");
      expect(summary.stats.completed).toBe(true);
      expect(summary.stats.score).toBe(6);
      expect(summary.shareText).toContain("Chip Shot");
    });

    it("charges a stroke-and-distance penalty for water hazards and still enforces the stroke cap", () => {
      const run = createDailyTestRun(chipshot, {
        puzzleDate: "2026-08-03",
        pack: {
          gameId: "chipshot",
          puzzleDate: "2026-08-03",
          payload: { ...validPayload, maxStrokesPerHole: 3 },
          sourceRefs: [],
        },
      });

      // Swap hole 0 for a hand-built layout: a straight shot from tee to cup
      // that must pass through a water zone, so the outcome is deterministic
      // regardless of the procedurally generated course for this seed.
      const pub = run.state.publicState as ChipShotPublicState;
      const waterHole: HoleLayout = {
        ...pub.holes[0]!,
        walls: [],
        obstacles: [
          {
            kind: "water",
            zone: {
              kind: "water",
              points: [
                { x: 170, y: 170 },
                { x: 230, y: 170 },
                { x: 230, y: 230 },
                { x: 170, y: 230 },
              ],
            },
          },
        ],
        tee: { x: 200, y: 300 },
        cup: { x: 200, y: 100 },
      };
      run.state.publicState = {
        ...pub,
        holes: [waterHole, ...pub.holes.slice(1)],
        ball: { pos: { ...waterHole.tee }, vel: { x: 0, y: 0 }, moving: false },
      };

      const shotIntoWater = { angle: -Math.PI / 2, power: 0.6 };

      // First water hazard: the shot itself is 1 stroke, the hazard adds 1
      // more — 2 total, under the cap of 3, so the hole stays open.
      const r1 = act(run, "shoot", shotIntoWater);
      expect(r1.publicState).toBeDefined();
      let after = run.state.publicState as ChipShotPublicState;
      expect(after.lastShot?.outcome).toBe("water");
      expect(after.currentHoleStrokes).toBe(2);
      expect(after.phase).toBe("penalty");

      act(run, "reset_after_penalty");
      after = run.state.publicState as ChipShotPublicState;
      expect(after.phase).toBe("aiming");
      expect(after.ball.pos).toEqual(waterHole.tee);
      expect(after.currentHoleStrokes).toBe(2); // reset doesn't re-charge the penalty

      // Second water hazard: 2 + 1 (shot) + 1 (penalty) = 4, over the cap of
      // 3 — the hole must end instead of looping back to "penalty" forever.
      act(run, "shoot", shotIntoWater);
      after = run.state.publicState as ChipShotPublicState;
      expect(after.currentHoleStrokes).toBe(4);
      expect(after.phase).toBe("scored");
    });
  });

  describe("physics calculations", () => {
    it("pointInPolygon checks point containment", () => {
      const square = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];
      expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
      expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    });

    it("handles bumper collision", () => {
      const res = bumperCollision(
        { x: 5, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 0 },
        5,
        1.5,
        2
      );
      expect(res).not.toBeNull();
      if (res) {
        expect(res.vel.x).toBeLessThan(0); // bounced backwards
      }
    });

    it("handles wall collision", () => {
      const wall = { a: { x: 10, y: -10 }, b: { x: 10, y: 10 } };
      const res = wallCollision(
        { x: 8, y: 0 },
        { x: 5, y: 0 },
        wall,
        3
      );
      expect(res).not.toBeNull();
      if (res) {
        expect(res.vel.x).toBeLessThan(0); // reflected off vertical wall
      }
    });
  });
});
