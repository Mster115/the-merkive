import { describe, it, expect, afterEach } from "vitest";
import { isPipelineAuthorized, PIPELINE_SECRET_HEADER } from "../pipelineAuth";
import { getDailyStore, resetDailyStore } from "../store";
import { MemoryDailyStore } from "../store/memory";

const ORIGINAL_SECRET = process.env.DAILY_PIPELINE_SECRET;
const ORIGINAL_URL = process.env.SUPABASE_URL;
const ORIGINAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * NODE_ENV is readonly in the Next type env, but these are exactly the branches
 * that only differ by it, so the tests have to drive it directly.
 */
function setNodeEnv(value: string): void {
  (process.env as Record<string, string>).NODE_ENV = value;
}
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api/admin/daily/submit-pack", {
    method: "POST",
    headers,
  });
}

afterEach(() => {
  setNodeEnv(ORIGINAL_NODE_ENV ?? "test");
  if (ORIGINAL_SECRET === undefined) delete process.env.DAILY_PIPELINE_SECRET;
  else process.env.DAILY_PIPELINE_SECRET = ORIGINAL_SECRET;
  if (ORIGINAL_URL === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = ORIGINAL_URL;
  if (ORIGINAL_KEY === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_KEY;
  resetDailyStore();
});

describe("daily pipeline auth", () => {
  it("accepts the secret via either header when it is set", () => {
    process.env.DAILY_PIPELINE_SECRET = "s3cret";
    expect(isPipelineAuthorized(req({ [PIPELINE_SECRET_HEADER]: "s3cret" }))).toBe(true);
    expect(isPipelineAuthorized(req({ authorization: "Bearer s3cret" }))).toBe(true);
  });

  it("rejects a wrong or absent secret when one is set", () => {
    process.env.DAILY_PIPELINE_SECRET = "s3cret";
    expect(isPipelineAuthorized(req({ [PIPELINE_SECRET_HEADER]: "nope" }))).toBe(false);
    expect(isPipelineAuthorized(req({ authorization: "Bearer nope" }))).toBe(false);
    expect(isPipelineAuthorized(req())).toBe(false);
  });

  it("stays permissive with no secret outside production", () => {
    delete process.env.DAILY_PIPELINE_SECRET;
    setNodeEnv("development");
    expect(isPipelineAuthorized(req())).toBe(true);
  });

  it("fails closed with no secret in production", () => {
    // The whole point of the change: a forgotten env var on a deployment must
    // not leave the pack submit/approve routes open to anyone who finds them.
    delete process.env.DAILY_PIPELINE_SECRET;
    setNodeEnv("production");
    expect(isPipelineAuthorized(req())).toBe(false);
  });
});

describe("daily store selection", () => {
  it("falls back to the in-memory store outside production", () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    setNodeEnv("development");
    resetDailyStore();
    expect(getDailyStore()).toBeInstanceOf(MemoryDailyStore);
  });

  it("refuses the in-memory fallback in production", () => {
    // In production the memory store loses every puzzle, attempt and streak on
    // each cold start, so /daily would look permanently empty instead of
    // misconfigured. Fail loudly rather than serve an empty feature.
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    setNodeEnv("production");
    resetDailyStore();
    expect(() => getDailyStore()).toThrow(/SUPABASE_URL/);
  });
});
