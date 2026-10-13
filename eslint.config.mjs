import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["src/**/*.{ts,tsx}"], ...reactHooks.configs.flat.recommended },
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "artifacts/**"]),
]);
