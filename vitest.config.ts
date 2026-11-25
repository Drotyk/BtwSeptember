import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/validators.ts",
        "src/form.ts",
        "src/bot/registration-state.ts",
        "src/services/registration.service.ts",
        "src/web/auth.ts",
      ],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
    },
  },
});
