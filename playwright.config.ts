import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "MINIPLAY_ALLOW_MEMORY=true pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    env: { MINIPLAY_ALLOW_MEMORY: "true" },
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
