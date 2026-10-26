import js from "@eslint/js";
import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import pluginQuery from "@tanstack/eslint-plugin-query";
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Слои FSD сверху вниз. Слой может импортировать только слои ниже себя. */
const LAYERS = ["app", "pages", "widgets", "features", "entities"];
const SHARED = ["shared", "shared-lib"];
const ENTRY = "index.{ts,tsx}";

/** Слайс другого элемента импортируется только через его index.ts. */
const publicApi = (types) => ({ to: { element: { type: types, fileInternalPath: ENTRY } } });

const layerPolicies = LAYERS.map((layer, index) => ({
  from: { element: { type: layer } },
  allow: publicApi([...LAYERS.slice(index + 1), ...SHARED]),
}));

const basePolicies = [
  ...layerPolicies,
  // Сущность может импортировать типы другой сущности.
  { from: { element: { type: "entities" } }, dependency: { kind: "type" }, allow: publicApi(["entities"]) },
  // Сегменты shared без предметной логики и могут опираться друг на друга.
  { from: { element: { type: SHARED } }, allow: publicApi(SHARED) },
  // Мок-бэкенд и тестовая инфраструктура не являются слоями FSD.
  { from: { element: { type: "mocks" } }, allow: publicApi(SHARED) },
  { from: { element: { type: "test" } }, allow: [publicApi(["app", ...SHARED]), { to: { element: { type: "mocks" } } }] },
];

/** Тестам дополнительно доступны мок-бэкенд и тестовая инфраструктура. */
const testPolicies = [
  ...basePolicies,
  { from: { element: { type: [...LAYERS, ...SHARED, "mocks"] } }, allow: { to: { element: { type: ["mocks", "test"] } } } },
];

const boundariesRule = (policies) => ["error", { default: "disallow", policies }];

export default tseslint.config(
  { ignores: ["dist", "node_modules", "public", "test-results", "playwright-report"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  comments.recommended,
  ...pluginQuery.configs["flat/recommended"],
  {
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      boundaries,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
      },
      "boundaries/include": ["src/**/*", "e2e/**/*"],
      "boundaries/elements": [
        { type: "app", pattern: "src/app" },
        { type: "pages", pattern: "src/pages/*", capture: ["slice"] },
        { type: "widgets", pattern: "src/widgets/*", capture: ["slice"] },
        { type: "features", pattern: "src/features/*", capture: ["slice"] },
        { type: "entities", pattern: "src/entities/*", capture: ["slice"] },
        { type: "shared-lib", pattern: "src/shared/lib/*", capture: ["slice"] },
        { type: "shared", pattern: "src/shared/*", capture: ["slice"] },
        { type: "mocks", pattern: "src/mocks" },
        { type: "test", pattern: "src/test" },
        { type: "e2e", pattern: "e2e" },
      ],
    },
    rules: {
      "boundaries/dependencies": boundariesRule(basePolicies),
      "boundaries/no-unknown-files": "error",

      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "react-refresh/only-export-components": "warn",

      "@tanstack/query/exhaustive-deps": "error",
      "@tanstack/query/no-rest-destructuring": "error",
      "@tanstack/query/stable-query-client": "error",

      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports", fixStyle: "separate-type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-deprecated": "warn",

      "@eslint-community/eslint-comments/require-description": ["error", { ignore: [] }],
      "@eslint-community/eslint-comments/no-unlimited-disable": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": "allow-with-description", "ts-expect-error": "allow-with-description", minimumDescriptionLength: 10 },
      ],
    },
  },
  {
    files: ["src/**/*.test.{ts,tsx}"],
    rules: {
      "boundaries/dependencies": boundariesRule(testPolicies),
    },
  },
  {
    // Точка входа src/main.tsx — файл, а не папка-элемент: её импорты (app, mocks) проверяются ревью.
    files: ["*.config.{js,ts}", "src/main.tsx"],
    rules: {
      "boundaries/no-unknown-files": "off",
    },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
);
