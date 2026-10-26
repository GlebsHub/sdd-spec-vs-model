import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeCopy } from "../../lib/make-copy.mjs";
import { BASE_COMMIT } from "../config.mjs";

const CONTOUR_BLOCK = /\n?<!-- contour:start -->[\s\S]*?<!-- contour:end -->\n?/;

/** Инструменты автоматических проверок; в конфигурациях «без контура» подменяются заглушкой. */
export const CHECK_BINS = ["tsc", "eslint", "vitest", "playwright"];

const git = (cwd, ...args) =>
  execFileSync("git", ["-c", "user.name=sdd-eval", "-c", "user.email=sdd-eval@localhost", ...args], {
    cwd,
    encoding: "utf8",
  });

/**
 * Копия базы для прогона. Для «без контура» вырезает блок проверок из CLAUDE.md
 * и переписывает базовый коммит копии, чтобы дифф агента считался от того, что он увидел.
 */
export const prepareCopy = ({ config, dir }) => {
  const meta = makeCopy({ spec: config.spec, commit: BASE_COMMIT, label: config.id, outDir: dir });
  if (!config.contour) {
    const path = join(dir, "CLAUDE.md");
    const original = readFileSync(path, "utf8");
    if (!CONTOUR_BLOCK.test(original)) {
      throw new Error("CLAUDE.md: contour markers not found");
    }
    writeFileSync(path, original.replace(CONTOUR_BLOCK, "\n"));
    git(dir, "add", "CLAUDE.md");
    git(dir, "commit", "-q", "--amend", "-m", `base ${BASE_COMMIT} + ${meta.specPath} + contour:off`);
  }
  const baseSha = git(dir, "rev-parse", "HEAD").trim();
  return { ...meta, baseSha };
};

/** Подменяет node_modules/.bin/<инструмент> заглушкой. Возвращает исходные цели ссылок для восстановления. */
export const installCheckStubs = ({ dir, blockLog }) => {
  const originals = {};
  for (const name of CHECK_BINS) {
    const link = join(dir, "node_modules", ".bin", name);
    if (!existsSync(link) && !isSymlink(link)) {
      continue;
    }
    originals[name] = readlinkSync(link);
    rmSync(link);
    writeFileSync(
      link,
      [
        "#!/bin/sh",
        `printf '%s %s %s\\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${name}" "$*" >> '${blockLog}'`,
        `echo "${name}: команда недоступна в этой конфигурации" >&2`,
        "exit 1",
        "",
      ].join("\n"),
    );
    chmodSync(link, 0o755);
  }
  return originals;
};

export const restoreCheckStubs = ({ dir, originals }) => {
  for (const [name, target] of Object.entries(originals)) {
    const link = join(dir, "node_modules", ".bin", name);
    rmSync(link, { force: true });
    symlinkSync(target, link);
  }
};

const isSymlink = (path) => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};
