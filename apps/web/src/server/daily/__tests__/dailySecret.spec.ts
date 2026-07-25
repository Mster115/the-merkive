import { describe, it, expect } from "vitest";
import {
  resolveSecret,
  requireSecret,
  KEYCHAIN_SERVICE,
  SETUP_HINT,
} from "../../../../../../scripts/secret.mjs";

/**
 * The secret has one home. These pin the two properties that matter: the
 * resolution order callers depend on, and that nothing here ever repeats the
 * value back — an error or a hint that quotes it has leaked it into every log
 * that catches the error.
 */
describe("daily pipeline secret resolution", () => {
  const noKeychain = () => null;

  it("prefers an explicit environment variable", () => {
    const value = resolveSecret({
      env: { DAILY_PIPELINE_SECRET: "from-env" },
      runKeychain: () => "from-keychain",
    });
    expect(value).toBe("from-env");
  });

  it("falls back to the Keychain under the documented service name", () => {
    const seen: string[] = [];
    const value = resolveSecret({
      env: {},
      runKeychain: (service: string) => {
        seen.push(service);
        return "from-keychain";
      },
    });
    expect(value).toBe("from-keychain");
    expect(seen).toEqual([KEYCHAIN_SERVICE]);
  });

  it("allows the Keychain service to be overridden", () => {
    const seen: string[] = [];
    resolveSecret({
      env: { MERKY_KEYCHAIN_SERVICE: "other-service" },
      runKeychain: (service: string) => {
        seen.push(service);
        return "x";
      },
    });
    expect(seen).toEqual(["other-service"]);
  });

  it("falls back to a secret file where there is no Keychain", () => {
    const value = resolveSecret({
      env: { MERKY_SECRET_FILE: "/tmp/whatever" },
      runKeychain: noKeychain,
      readFile: () => "  from-file\n",
    });
    expect(value).toBe("from-file");
  });

  it("treats an unreadable secret file as 'not configured', not a crash", () => {
    const value = resolveSecret({
      env: { MERKY_SECRET_FILE: "/tmp/missing" },
      runKeychain: noKeychain,
      readFile: () => {
        throw new Error("ENOENT");
      },
    });
    expect(value).toBeNull();
  });

  it("returns null rather than an empty string when nothing is configured", () => {
    expect(resolveSecret({ env: {}, runKeychain: noKeychain })).toBeNull();
  });

  it("explains how to configure it without ever quoting a value", () => {
    expect(() => requireSecret({ env: {}, runKeychain: noKeychain })).toThrow(
      /not available/
    );

    try {
      requireSecret({ env: {}, runKeychain: noKeychain });
    } catch (e) {
      const message = String((e as Error).message);
      expect(message).toContain("security add-generic-password");
      expect(message).toContain(KEYCHAIN_SERVICE);
      // The hint tells you where to put it, never what it is.
      expect(message).not.toMatch(/Bearer\s+\S/);
    }

    expect(SETUP_HINT).not.toContain("DAILY_PIPELINE_SECRET=");
  });

  it("does not leak a resolved secret through the hint text", () => {
    resolveSecret({ env: { DAILY_PIPELINE_SECRET: "super-secret-value" }, runKeychain: noKeychain });
    expect(SETUP_HINT).not.toContain("super-secret-value");
  });
});
