#!/usr/bin/env node
/**
 * Собирает эталон: копия базы (eval/lib/make-copy.mjs) + файлы фичи из eval/reference/files/.
 *
 *   node eval/reference/build.mjs [--commit <rev>] [--out <папка>] [--bare]
 *
 * `--bare` — только копия базы с полной спекой, без файлов эталона (для проверки, что приёмка на ней красная).
 * Файлы эталона не коммитятся в git копии: `git diff` / `git status` в копии показывают ровно фичу.
 * Падает, если eval/reference/files/ задевает защищённый путь.
 */
import { cpSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { makeCopy } from "../lib/make-copy.mjs";
import { isProtected } from "../lib/protected.mjs";

const FILES_DIR = join(dirname(fileURLToPath(import.meta.url)), "files");

const listFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });

const { values } = parseArgs({
  options: {
    commit: { type: "string", default: "HEAD" },
    out: { type: "string" },
    bare: { type: "boolean", default: false },
  },
});

const files = values.bare ? [] : listFiles(FILES_DIR).map((path) => relative(FILES_DIR, path).split(sep).join("/"));
const touched = files.filter(isProtected);
if (touched.length > 0) {
  throw new Error(`eval/reference/files touches protected paths: ${touched.join(", ")}`);
}

const meta = makeCopy({ spec: "full", commit: values.commit, label: values.bare ? "bare" : "reference", outDir: values.out });
for (const file of files) {
  cpSync(join(FILES_DIR, file), resolve(meta.dir, file));
}
process.stdout.write(`${JSON.stringify({ ...meta, referenceFiles: files.length }, null, 2)}\n`);
