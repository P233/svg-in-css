import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: { baseURL: "http://127.0.0.1:4317" },
  webServer: {
    command: "pnpm exec vite preview --host 127.0.0.1 --port 4317 --strictPort",
    url: "http://127.0.0.1:4317"
  }
});
