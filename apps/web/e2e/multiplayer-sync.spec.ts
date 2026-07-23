import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * Regression coverage for the real-time multiplayer sync issues reported in
 * production: lobby/room state must propagate live to every connected
 * client without a manual page refresh, and a turn action must not be
 * double-submittable by a fast/impatient click.
 *
 * Each "player" gets its own isolated BrowserContext (own cookie jar), the
 * same way two different phones would — this is what actually exercises the
 * SSE/websocket fanout path, not just the initial REST snapshot.
 */

/** Next.js dev-mode hydration can lag the initial paint — fill and confirm
 * the controlled input actually picked it up before moving on, since a
 * `fill()` that lands before React attaches its listeners is silently lost. */
async function fillAndConfirm(page: Page, placeholder: string, value: string): Promise<void> {
  const field = page.getByPlaceholder(placeholder);
  await expect(field).toBeVisible();
  await expect(async () => {
    await field.fill(value);
    await expect(field).toHaveValue(value);
  }).toPass({ timeout: 15_000 });
}

async function createRoomAs(page: Page, name: string): Promise<string> {
  await page.goto("/", { waitUntil: "networkidle" });
  await fillAndConfirm(page, "e.g. Turbo", name);
  const createButton = page.getByRole("button", { name: "Create room" });
  await expect(createButton).toBeEnabled();
  await createButton.click();
  await expect(page).toHaveURL(/\/play\//);
  const code = page.url().split("/play/")[1]?.split(/[?#]/)[0];
  if (!code) throw new Error("room code missing from URL after create");
  return code;
}

async function joinRoomAs(page: Page, name: string, code: string): Promise<void> {
  await page.goto("/", { waitUntil: "networkidle" });
  await fillAndConfirm(page, "e.g. Turbo", name);
  await fillAndConfirm(page, "ABCD", code);
  const joinButton = page.getByRole("button", { name: "Join", exact: true });
  await expect(joinButton).toBeEnabled();
  await joinButton.click();
  await expect(page).toHaveURL(/\/play\//);
}

async function startEightstorm(hostPage: Page): Promise<void> {
  await hostPage.locator("button", { hasText: "Eightstorm" }).first().click();
  await hostPage.getByRole("button", { name: "Start game" }).click();
}

/** Waits for the match-start update to land on *either* page, then reports
 * which one is actually active — a one-shot `.isVisible()` right after
 * clicking "Start game" races the server round-trip and reads stale. */
async function determineActivePage(a: Page, b: Page): Promise<[active: Page, waiting: Page]> {
  await Promise.race([
    a.getByText("Your Turn!", { exact: true }).waitFor({ state: "visible", timeout: 10_000 }),
    b.getByText("Your Turn!", { exact: true }).waitFor({ state: "visible", timeout: 10_000 }),
  ]);
  const aActive = await a.getByText("Your Turn!", { exact: true }).isVisible();
  return aActive ? [a, b] : [b, a];
}

/** Drives one full turn (draw, then pass if the draw didn't already end it).
 * A drawn card that's playable leaves the turn open (a "Pass Turn" button
 * appears) instead of auto-advancing — wait for the response to actually
 * land before deciding whether a follow-up pass is needed. */
async function drawAndMaybePass(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Draw Card/i }).click();
  const passButton = page.getByRole("button", { name: /Pass Turn/i });
  const gotPassButton = await passButton
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (gotPassButton) {
    await passButton.click();
  }
}

test.describe("lobby realtime sync", () => {
  test("a second player joining shows up in the host's lobby without a reload", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    const code = await createRoomAs(host, "Ana");
    await expect(host.getByText("Players 1/12")).toBeVisible();

    await joinRoomAs(guest, "Bo", code);

    // No host.reload() here — this is the exact behavior the bug report
    // described as broken ("need to refresh to see updates").
    await expect(host.getByText("Players 2/12")).toBeVisible();
    await expect(host.getByText("Bo", { exact: true })).toBeVisible();

    await hostCtx.close();
    await guestCtx.close();
  });

  test("joining from a browser that already holds a room cookie for that code still creates a distinct seat", async ({
    browser,
  }) => {
    // Regression for the identity-hijack bug: a second "join" from the same
    // browser/cookie-jar (e.g. two tabs on one laptop, or a stale per-room
    // cookie) must never silently take over the first player's seat.
    const ctx: BrowserContext = await browser.newContext();
    const tab1 = await ctx.newPage();
    const code = await createRoomAs(tab1, "Ana");

    const tab2 = await ctx.newPage();
    await joinRoomAs(tab2, "Bo", code);

    await expect(tab1.getByText("Players 2/12")).toBeVisible();
    // Each tab must see itself as its own seat, not both resolving to "Ana".
    // (Your own seat renders with a trailing "✦" marker, hence the regex.)
    await expect(tab2.getByText(/^Bo/)).toBeVisible();
    const tab1Players = await tab1.getByRole("listitem").allTextContents();
    expect(tab1Players.some((t) => t.includes("Ana"))).toBe(true);
    expect(tab1Players.some((t) => t.includes("Bo"))).toBe(true);

    await ctx.close();
  });
});

test.describe("eightstorm turn sync", () => {
  test("a turn played by one seat updates the other seat's screen without a reload", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    const code = await createRoomAs(host, "Ana");
    await joinRoomAs(guest, "Bo", code);
    await expect(host.getByText("Players 2/12")).toBeVisible();

    await startEightstorm(host);
    await expect(host.getByText("Eightstorm", { exact: true }).first()).toBeVisible();
    await expect(guest.getByText("Eightstorm", { exact: true }).first()).toBeVisible();

    const [activePage, waitingPage] = await determineActivePage(host, guest);

    // The visible waiting banner is emoji-prefixed; the sr-only live region
    // carries the same words without it — match the visible one specifically.
    await expect(waitingPage.getByText(/⏳ Waiting for/)).toBeVisible();

    await drawAndMaybePass(activePage);

    // waitingPage is never reloaded — this proves the transport (SSE or
    // PartyKit websocket) delivered the turn change live.
    await expect(waitingPage.getByText("Your Turn!", { exact: true })).toBeVisible({ timeout: 10_000 });

    await hostCtx.close();
    await guestCtx.close();
  });

  test("a slow network round-trip does not let a double-click draw two cards", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    const code = await createRoomAs(host, "Ana");
    await joinRoomAs(guest, "Bo", code);
    await expect(host.getByText("Players 2/12")).toBeVisible();

    await startEightstorm(host);

    const [activePage] = await determineActivePage(host, guest);

    const handCountBefore = await activePage
      .locator("h3", { hasText: "Your Hand" })
      .first()
      .textContent();
    const before = Number(handCountBefore?.match(/\((\d+)\)/)?.[1]);
    expect(Number.isFinite(before)).toBe(true);

    // Artificially slow the action endpoint so a fast double-click has a real
    // chance to fire a second request before the first one resolves — this
    // is exactly the window the client-side pending guard must close.
    let actionRequests = 0;
    await activePage.route("**/api/rooms/*/action", async (route) => {
      actionRequests += 1;
      await new Promise((r) => setTimeout(r, 500));
      await route.continue();
    });

    const drawButton = activePage.getByRole("button", { name: /Draw Card/i });
    await drawButton.click();
    await drawButton.click({ force: true }).catch(() => undefined);
    await drawButton.click({ force: true }).catch(() => undefined);

    await activePage.waitForTimeout(1_200);
    await activePage.unroute("**/api/rooms/*/action");

    const handCountAfter = await activePage
      .locator("h3", { hasText: "Your Hand" })
      .first()
      .textContent();
    const after = Number(handCountAfter?.match(/\((\d+)\)/)?.[1]);

    expect(actionRequests).toBe(1);
    expect(after).toBe((before as number) + 1);

    await hostCtx.close();
    await guestCtx.close();
  });
});
