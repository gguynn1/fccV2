import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import { flatConfigs } from "eslint-plugin-import-x";
import unusedImports from "eslint-plugin-unused-imports";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["dist/**", "node_modules/**", "_seed/**", "eslint.config.js", "prettier.config.js"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.ts"],
    plugins: {
      ...flatConfigs.recommended.plugins,
      "unused-imports": unusedImports,
    },
    settings: flatConfigs.typescript.settings,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...flatConfigs.recommended.rules,
      ...flatConfigs.typescript.rules,
      eqeqeq: ["error", "always", { null: "always" }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],
      "import-x/no-cycle": [
        "error",
        {
          maxDepth: 50,
          ignoreExternal: true,
        },
      ],
    },
  },
  eslintConfigPrettier,
);
