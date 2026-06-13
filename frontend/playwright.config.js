import { defineConfig, devices } from "@playwright/test";

// Smoke e2e for the ORION SPA. The API is mocked at the network boundary in the spec,
// so this needs only Node + browsers — no Python backend.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
