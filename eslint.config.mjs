import { FlatCompat } from "@eslint/eslintrc";
import eslintConfigPrettier from "eslint-config-prettier";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "next-env.d.ts",
      "node_modules/**",
      "outputs/**",
      "work/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  eslintConfigPrettier,
];

export default eslintConfig;
