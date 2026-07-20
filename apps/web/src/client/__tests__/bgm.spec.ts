import { describe, it, expect, beforeEach, vi } from "vitest";
import { BgmEngine, DEFAULT_BGM_TRACKS } from "@merky/ui";

describe("BgmEngine", () => {
  let engine: BgmEngine;

  beforeEach(() => {
    engine = new BgmEngine(DEFAULT_BGM_TRACKS);
  });

  it("has default tracks configured correctly", () => {
    expect(engine.getPlaylist()).toEqual([
      "/audio/merkive-lobby-1.mp3",
      "/audio/merkive-lobby-2.mp3",
    ]);
  });

  it("selects a random initial track index within bounds", () => {
    const mockRng = () => 0.75; // 0.75 * 2 = 1.5 -> Math.floor = 1
    expect(engine.selectInitialTrack(mockRng)).toBe(1);

    const mockRngZero = () => 0.1; // 0.1 * 2 = 0.2 -> Math.floor = 0
    expect(engine.selectInitialTrack(mockRngZero)).toBe(0);
  });

  it("rotates sequentially to the next track in the playlist", () => {
    // Track 0 -> Track 1
    expect(engine.getNextTrackIndex(0)).toBe(1);

    // Track 1 -> Track 0 (loops back)
    expect(engine.getNextTrackIndex(1)).toBe(0);
  });

  it("notifies subscribers when mute state changes", () => {
    const listener = vi.fn();
    const unsub = engine.subscribe(listener);

    expect(engine.isMuted()).toBe(true);

    engine.setMuted(false);
    expect(listener).toHaveBeenCalledWith(false);

    engine.setMuted(true);
    expect(listener).toHaveBeenCalledWith(true);

    unsub();
    engine.setMuted(false);
    expect(listener).toHaveBeenCalledTimes(2); // no new calls after unsub
  });

  it("toggles mute state", () => {
    expect(engine.isMuted()).toBe(true);
    expect(engine.toggleMute()).toBe(false);
    expect(engine.isMuted()).toBe(false);
    expect(engine.toggleMute()).toBe(true);
    expect(engine.isMuted()).toBe(true);
  });

  it("clamps volume between 0 and 1", () => {
    engine.setVolume(0.5);
    expect(engine.getVolume()).toBe(0.5);

    engine.setVolume(1.5);
    expect(engine.getVolume()).toBe(1);

    engine.setVolume(-0.2);
    expect(engine.getVolume()).toBe(0);
  });

  it("updates playlist dynamically", () => {
    const custom = ["/audio/custom-1.mp3", "/audio/custom-2.mp3", "/audio/custom-3.mp3"];
    engine.setPlaylist(custom);
    expect(engine.getPlaylist()).toEqual(custom);
    expect(engine.getNextTrackIndex(0)).toBe(1);
    expect(engine.getNextTrackIndex(1)).toBe(2);
    expect(engine.getNextTrackIndex(2)).toBe(0);
  });
});
