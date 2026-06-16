import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist", "node_modules", "lucid-report"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["tsconfig.json"],
        },
      },
    },
    rules: {
      "no-console": "off",
    },
  },
];

