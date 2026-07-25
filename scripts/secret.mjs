/**
 * Where the daily pipeline secret comes from.
 *
 * The point of this indirection is that the secret has exactly one home and
 * nothing else ever holds a copy: not the MCP config file, not a prompt, not a
 * `.env` that gets committed by accident, not a shell history line, and not a
 * transcript. Callers ask for it by name and get it at the moment of use.
 *
 * Resolution order:
 *   1. DAILY_PIPELINE_SECRET in the environment — CI, containers, one-offs.
 *   2. The macOS Keychain, under the service name below. This is the intended
 *      home on a developer machine: the value is stored once, interactively,
 *      and never appears in a file anyone can read by accident.
 *   3. MERKY_SECRET_FILE — a path to a file containing only the secret, for
 *      Linux boxes with no Keychain. Permissions are the caller's problem.
 *
 * Nothing here logs the value, and callers must not either: an error message
 * that quotes the secret has leaked it to every log that catches the error.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";

export const KEYCHAIN_SERVICE = "merkive-daily-pipeline";

/** Cached per process so a long-lived MCP server prompts the Keychain once. */
let cached;

/**
 * `-U` is not optional. Without it, `add-generic-password` refuses when an entry
 * already exists and leaves the old value in place — so a correcting re-run
 * appears to fail for a reason that reads like a duplicate warning, and the
 * wrong secret silently survives. With `-U` the command is idempotent.
 */
export const SETUP_HINT =
  `Store it in the macOS Keychain. The command prompts for the value, so it never\n` +
  `lands in your shell history, and -U overwrites any entry already there:\n\n` +
  `  security add-generic-password -U -a "$USER" -s ${KEYCHAIN_SERVICE} -w\n\n` +
  `Paste the secret at the prompt (it is not echoed). Then check it with:\n\n` +
  `  pnpm daily secret`;

/**
 * @param {{ env?: Record<string, string | undefined>,
 *           runKeychain?: (service: string) => string | null,
 *           readFile?: (path: string) => string }} [deps] injected for tests
 * @returns {string | null}
 */
export function resolveSecret(deps = {}) {
  const env = deps.env ?? process.env;
  const isInjected = Boolean(deps.env || deps.runKeychain || deps.readFile);
  if (!isInjected && cached !== undefined) return cached;

  const fromEnv = env.DAILY_PIPELINE_SECRET;
  if (fromEnv) {
    if (!isInjected) cached = fromEnv;
    return fromEnv;
  }

  const runKeychain = deps.runKeychain ?? defaultKeychainLookup;
  const fromKeychain = runKeychain(env.MERKY_KEYCHAIN_SERVICE ?? KEYCHAIN_SERVICE);
  if (fromKeychain) {
    if (!isInjected) cached = fromKeychain;
    return fromKeychain;
  }

  const file = env.MERKY_SECRET_FILE;
  if (file) {
    try {
      const read = deps.readFile ?? ((p) => readFileSync(p, "utf8"));
      const value = read(file).trim();
      if (value) {
        if (!isInjected) cached = value;
        return value;
      }
    } catch {
      // A missing or unreadable file is "not configured here", not a crash —
      // the caller reports one clear message covering every source.
    }
  }

  if (!isInjected) cached = null;
  return null;
}

function defaultKeychainLookup(service) {
  if (process.platform !== "darwin") return null;
  try {
    // Absolute path, not `security`: an MCP server is spawned by the host app
    // with a minimal environment, and there is no guarantee /usr/bin is on its
    // PATH. `-w` prints only the password. stderr is swallowed — a miss is exit
    // 44 with "could not be found", a normal outcome here rather than an error.
    return execFileSync("/usr/bin/security", ["find-generic-password", "-s", service, "-w"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || null;
  } catch {
    return null;
  }
}

/** Resolve or explain. Never includes the value in the thrown message. */
export function requireSecret(deps) {
  const secret = resolveSecret(deps);
  if (secret) return secret;
  throw new Error(
    `The daily pipeline secret is not available.\n\n${SETUP_HINT}\n\n` +
      `Alternatively set DAILY_PIPELINE_SECRET in the environment, or point ` +
      `MERKY_SECRET_FILE at a file containing it.`
  );
}

/** Test hook: forget the process-lifetime cache. */
export function resetSecretCache() {
  cached = undefined;
}
