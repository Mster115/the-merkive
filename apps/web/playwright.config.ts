import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    // A production build avoids the on-demand-compile flakiness of `next
    // dev` racing a client-side route transition mid-compile. Uses the
    // default .next dir — don't run this alongside another `next dev`/build
    // in this app without setting MB_DIST_DIR for one of them, or they'll
    // corrupt each other's output (see next.config.ts).
    command: "pnpm exec next build && pnpm exec next start -p 3100",
    cwd: __dirname,
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      MB_MODE: "memory",
      NEXT_PUBLIC_MB_MODE: "memory",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
