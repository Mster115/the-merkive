declare global {
  // eslint-disable-next-line no-var
  var __mbLocks: Map<string, Promise<unknown>> | undefined;
}

const locks = (globalThis.__mbLocks ??= new Map<string, Promise<unknown>>());

/**
 * Serialize all mutations of a room behind a promise chain, keyed by room
 * code. In-process only — single-server serialization.
 */
export function withRoomLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
  const key = code.toUpperCase();
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(
    key,
    next.catch(() => undefined)
  );
  return next;
}
