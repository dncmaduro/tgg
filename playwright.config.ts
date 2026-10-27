import { defineConfig, devices } from "@playwright/test";

const debugWebSocket = process.env.MINIPLAY_E2E_WS_DEBUG === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `MINIPLAY_ALLOW_MEMORY=true MINIPLAY_LOCAL_E2E=true${debugWebSocket ? " MINIPLAY_WS_DEBUG=1" : ""} pnpm start`,
    url: "http://localhost:3000",
    reuseExistingServer: false,
    env: {
      MINIPLAY_ALLOW_MEMORY: "true",
      MINIPLAY_LOCAL_E2E: "true",
      MINIPLAY_WS_DEBUG: debugWebSocket ? "1" : "0",
    },
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
