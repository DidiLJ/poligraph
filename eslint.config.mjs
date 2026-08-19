import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated files:
    "src/generated/**",
    // Scripts (not part of the app):
    "scripts/**",
    // Git worktrees (contain their own .next/build artifacts):
    ".worktrees/**",
    ".claude/worktrees/**",
    // Local Storybook output:
    "storybook-static/**",
  ]),
  {
    rules: {
      "no-console": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // React Hooks is provided by eslint-config-next only for application files.
  // Keep its rule in that same perimeter so root tooling files remain lintable.
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Allow console in server-side code (API routes, sync services, CLI utilities)
  {
    files: [
      "src/app/api/**/*.ts",
      "src/services/**/*.ts",
      "src/lib/sync/**/*.ts",
      "src/lib/api/**/*.ts",
      "src/lib/auth.ts",
    ],
    rules: {
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
