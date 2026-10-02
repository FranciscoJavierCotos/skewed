import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm build && pnpm start -p 3100",
    port: 3100,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Supabase RPCs are mocked from fixtures/content (e2e/fixture-api.ts); this host is never reached.
    env: { NEXT_PUBLIC_SUPABASE_URL: "http://supabase.e2e.test", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "e2e-placeholder" },
  },
});
