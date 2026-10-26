/**
 * Защищённые пути копии базы. Источник для людей — раздел «Защищённые файлы» в base/CLAUDE.md;
 * список здесь должен с ним совпадать. `dir/**` — всё внутри папки, иначе точный путь.
 */
export const PROTECTED_PATHS = [
  "SPEC.md",
  "CLAUDE.md",
  "conventions.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "eslint.config.js",
  "vite.config.ts",
  "vitest.config.ts",
  "playwright.config.ts",
  "public/mockServiceWorker.js",
  "src/main.tsx",
  "src/mocks/**",
  "src/test/**",
  "src/shared/api/clients/**",
  "src/shared/api/http.ts",
  "src/shared/api/errors.ts",
  "src/shared/lib/money/**",
  "src/shared/lib/session/**",
  "e2e/smoke.spec.ts",
];

/** @param {string} path путь относительно корня копии, через `/` */
export const isProtected = (path) =>
  PROTECTED_PATHS.some((pattern) =>
    pattern.endsWith("/**") ? path.startsWith(pattern.slice(0, -2)) : path === pattern,
  );
