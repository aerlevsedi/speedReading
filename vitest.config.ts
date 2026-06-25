import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig(({ mode }) => ({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
    hookTimeout: 30000,
    globalSetup: ["tests/globalSetup.ts"],
    env: loadEnv(mode, process.cwd(), ""),
  },
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "src/") + "/",
    },
  },
}));
