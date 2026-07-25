import { describe, it, expect, beforeEach } from "vitest";
import { resetDailyStore } from "../store";
import { MemoryDailyStore } from "../store/memory";
import * as service from "../service";
import { ServiceError } from "../../errors";

let store: MemoryDailyStore;

beforeEach(() => {
  store = new MemoryDailyStore();
  resetDailyStore(store);
});

describe("effectiveTimezone (travel)", () => {
  // Tokyo and Los Angeles share a local date for 8 hours out of every 24, so
  // the instant has to be pinned or these assertions flip a third of the day.
  const TOKYO_AHEAD = Date.parse("2026-07-25T01:00:00Z"); // Tokyo 07-25, LA 07-24
  const SAME_DATE = Date.parse("2026-07-24T10:00:00Z"); // both 07-24

  it("takes the request zone for a device with no row yet", async () => {
    expect(await service.effectiveTimezone("new-device", "Asia/Tokyo", TOKYO_AHEAD)).toBe(
      "Asia/Tokyo"
    );
  });

  it("adopts a zone that moves the local date forward", async () => {
    // Los Angeles -> Tokyo is a jump forward; nothing is replayed by taking it.
    await store.upsertDevice("d1", "America/Los_Angeles");
    expect(await service.effectiveTimezone("d1", "Asia/Tokyo", TOKYO_AHEAD)).toBe("Asia/Tokyo");
  });

  it("keeps the stored zone when the new one would rewind the local date", async () => {
    // Tokyo -> Los Angeles moves the local date back a day, which would
    // re-serve a puzzle this device already played and let it score twice.
    await store.upsertDevice("d2", "Asia/Tokyo");
    expect(await service.effectiveTimezone("d2", "America/Los_Angeles", TOKYO_AHEAD)).toBe(
      "Asia/Tokyo"
    );
  });

  it("adopts the new zone once it has caught up to the same date", async () => {
    // Same wall-clock date in both: no rewind, so the move is safe to take.
    await store.upsertDevice("d2b", "Asia/Tokyo");
    expect(await service.effectiveTimezone("d2b", "America/Los_Angeles", SAME_DATE)).toBe(
      "America/Los_Angeles"
    );
  });

  it("is a no-op when the zone has not changed", async () => {
    await store.upsertDevice("d3", "Europe/Berlin");
    expect(await service.effectiveTimezone("d3", "Europe/Berlin", TOKYO_AHEAD)).toBe(
      "Europe/Berlin"
    );
  });
});

describe("recovery codes", () => {
  it("issues a stable, unambiguous code and resolves it back to the device", async () => {
    await store.upsertDevice("device-a", "UTC");
    const { code } = await service.getOrCreateRecoveryCode("device-a", "UTC");

    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    // No I/L/O/U — a code read off one screen must survive being typed into another.
    expect(code).not.toMatch(/[ILOU]/);

    // Stable: asking again returns the same code rather than orphaning the first.
    const again = await service.getOrCreateRecoveryCode("device-a", "UTC");
    expect(again.code).toBe(code);

    expect(await service.redeemRecoveryCode(code)).toEqual({ deviceId: "device-a" });
  });

  it("accepts a code however it was typed", async () => {
    await store.upsertDevice("device-b", "UTC");
    const { code } = await service.getOrCreateRecoveryCode("device-b", "UTC");

    const sloppy = code.toLowerCase().replace(/-/g, " ");
    expect(await service.redeemRecoveryCode(sloppy)).toEqual({ deviceId: "device-b" });
  });

  it("stays redeemable more than once", async () => {
    // A player restoring onto a third device, or retyping after a typo, must
    // not be locked out by their own earlier redemption.
    await store.upsertDevice("device-c", "UTC");
    const { code } = await service.getOrCreateRecoveryCode("device-c", "UTC");
    await service.redeemRecoveryCode(code);
    expect(await service.redeemRecoveryCode(code)).toEqual({ deviceId: "device-c" });
  });

  it("rejects an empty or unknown code", async () => {
    await expect(service.redeemRecoveryCode("   ")).rejects.toThrow(ServiceError);
    await expect(service.redeemRecoveryCode("ZZZZ-ZZZZ-ZZZZ-ZZZZ")).rejects.toThrow(ServiceError);
  });

  it("gives different devices different codes", async () => {
    await store.upsertDevice("d-x", "UTC");
    await store.upsertDevice("d-y", "UTC");
    const x = await service.getOrCreateRecoveryCode("d-x", "UTC");
    const y = await service.getOrCreateRecoveryCode("d-y", "UTC");
    expect(x.code).not.toBe(y.code);
  });
});
