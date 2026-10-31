// eslint.config.mjs
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
// If you’re using TypeScript, also:
// import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  // Next.js core-web-vitals rules
  ...nextVitals,

  // If TS:
  // ...nextTs,

  // Default ignores (from Next docs – safe to keep)
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

