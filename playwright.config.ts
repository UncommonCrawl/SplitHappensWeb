import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "webkit-tablet",
      grep: /@cross-browser/,
      use: { ...devices["iPad Pro 11"] },
    },
    {
      name: "firefox-mobile",
      grep: /@cross-browser/,
      use: { ...devices["Desktop Firefox"], viewport: { width: 390, height: 844 } },
    },
  ],
});
