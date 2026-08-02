import { describe, it, expect } from "vitest";
import { createDailyTestRun, act, actErr, ctxOf } from "../../testing";
import { chipshot } from "../index";
import { validatePack } from "../pack";
import type { ChipShotPublicState, ChipShotSecretState } from "../types";
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
