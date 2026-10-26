#!/usr/bin/env node
/**
 * Копия base/ из git-коммита во временную папку вне репозитория.
 *
 *   node eval/lib/make-copy.mjs [--spec full|brief] [--commit <rev>] [--label <имя>] [--out <папка>]
 *
 * Что делает:
 * 1. Распаковывает base/ из коммита (`git archive`), поэтому копия совпадает с коммитом байт в байт.
 * 2. Кладёт выбранную спеку из того же коммита как SPEC.md.
 * 3. node_modules: если package-lock.json совпадает с base/, клонирует base/node_modules (`cp -c`, APFS),
 *    иначе `npm ci`.
 * 4. Делает в копии git-репозиторий с одним коммитом «base», чтобы потом получить дифф изменений.
 * Печатает JSON с путём копии и хэшем базы. Метаданные пишет рядом с копией: `<папка>.json`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const SPECS = {
  full: "spec/clients-table-full.md",
  brief: "spec/clients-table-brief.md",
};

const run = (command, args, options = {}) =>
  execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...options });

const timestamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");

/**
 * @param {{ spec?: "full" | "brief", commit?: string, label?: string, outDir?: string, install?: boolean }} options
 */
export const makeCopy = ({ spec = "full", commit = "HEAD", label = "copy", outDir, install = true } = {}) => {
  const specPath = SPECS[spec];
  if (!specPath) {
    throw new Error(`Unknown spec "${spec}", expected: ${Object.keys(SPECS).join(", ")}`);
  }
  const baseCommit = run("git", ["rev-parse", `${commit}^{commit}`], { cwd: REPO_ROOT }).trim();
  const dir = resolve(outDir ?? join(tmpdir(), "sdd-eval", `${label}-${timestamp()}`));
  if (existsSync(dir)) {
    throw new Error(`Target already exists: ${dir}`);
  }
  mkdirSync(dir, { recursive: true });

  const archive = execFileSync("git", ["archive", "--format=tar", baseCommit, "base"], { cwd: REPO_ROOT });
  execFileSync("tar", ["-x", "-C", dir, "--strip-components=1"], { input: archive });
  writeFileSync(join(dir, "SPEC.md"), execFileSync("git", ["show", `${baseCommit}:${specPath}`], { cwd: REPO_ROOT }));

  if (install) {
    const baseModules = join(REPO_ROOT, "base", "node_modules");
    const sameLock =
      existsSync(baseModules) &&
      readFileSync(join(REPO_ROOT, "base", "package-lock.json"), "utf8") ===
        readFileSync(join(dir, "package-lock.json"), "utf8");
    if (sameLock) {
      run("cp", ["-cR", baseModules, join(dir, "node_modules")]);
    } else {
      run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: dir, stdio: ["ignore", "inherit", "inherit"] });
    }
  }

  const git = (...args) =>
    run("git", ["-c", "user.name=sdd-eval", "-c", "user.email=sdd-eval@localhost", ...args], { cwd: dir });
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "-m", `base ${baseCommit} + ${specPath}`);

  const meta = { dir, baseCommit, spec, specPath, createdAt: new Date().toISOString() };
  writeFileSync(`${dir}.json`, `${JSON.stringify(meta, null, 2)}\n`);
  return meta;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { values } = parseArgs({
    options: {
      spec: { type: "string", default: "full" },
      commit: { type: "string", default: "HEAD" },
      label: { type: "string", default: "copy" },
      out: { type: "string" },
      "no-install": { type: "boolean", default: false },
    },
  });
  const meta = makeCopy({
    spec: values.spec,
    commit: values.commit,
    label: values.label,
    outDir: values.out,
    install: !values["no-install"],
  });
  process.stdout.write(`${JSON.stringify(meta, null, 2)}\n`);
}
