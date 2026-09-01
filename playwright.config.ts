import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:5000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // The CI webServer runs NODE_ENV=production, whose session cookies are
    // Secure + proxy-trusting. Over plain-HTTP localhost express-session sees
    // an insecure connection and refuses to issue the cookie at all — which
    // made authenticated E2E flows impossible. `trust proxy` is enabled in
    // production, so presenting X-Forwarded-Proto: https marks the request
    // secure and the session cookie is issued (Chromium accepts Secure
    // cookies on the trustworthy localhost origin).
    extraHTTPHeaders: { "X-Forwarded-Proto": "https" },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
  // Start the server before running tests
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: process.env.CI ? "npm start" : "npm run dev",
        url: "http://localhost:5000",
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
      },
});
