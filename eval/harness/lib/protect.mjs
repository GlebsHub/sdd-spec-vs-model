import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PROTECTED_PATHS, isProtected } from "../../lib/protected.mjs";

const listFiles = (root, relative) => {
  const path = join(root, relative);
  if (!existsSync(path)) {
    return [];
  }
  if (!statSync(path).isDirectory()) {
    return [relative];
  }
  return readdirSync(path).flatMap((name) => listFiles(root, `${relative}/${name}`));
};

/** sha256 всех защищённых файлов копии: { путь: хэш }. */
export const hashProtected = (dir) => {
  const hashes = {};
  for (const pattern of PROTECTED_PATHS) {
    const base = pattern.endsWith("/**") ? pattern.slice(0, -3) : pattern;
    for (const file of listFiles(dir, base)) {
      hashes[file] = createHash("sha256").update(readFileSync(join(dir, file))).digest("hex");
    }
  }
  return hashes;
};

/** То же по содержимому коммита копии: для доводки прогона, когда хэши «до» не сохранились. */
export const hashProtectedAtCommit = (dir, sha) => {
  const hashes = {};
  const files = execFileSync("git", ["ls-tree", "-r", "--name-only", sha], { cwd: dir, encoding: "utf8" }).split("\n").filter(Boolean);
  for (const file of files.filter(isProtected)) {
    const content = execFileSync("git", ["show", `${sha}:${file}`], { cwd: dir, maxBuffer: 64 * 1024 * 1024 });
    hashes[file] = createHash("sha256").update(content).digest("hex");
  }
  return hashes;
};

/** Изменённые, удалённые и добавленные защищённые файлы. */
export const compareProtected = (before, after) => {
  const changed = [];
  for (const [file, hash] of Object.entries(before)) {
    if (!(file in after)) {
      changed.push({ file, change: "deleted" });
    } else if (after[file] !== hash) {
      changed.push({ file, change: "modified" });
    }
  }
  for (const file of Object.keys(after)) {
    if (!(file in before)) {
      changed.push({ file, change: "added" });
    }
  }
  return changed;
};
