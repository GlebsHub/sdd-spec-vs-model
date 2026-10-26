#!/usr/bin/env node
/**
 * docs/result.png из eval/results/summary.json: по каждой конфигурации выполненные AC и стоимость прогона.
 * Две панели с общими строками вместо двух осей на одном графике. Рендер — Chromium из base/node_modules.
 *
 *   node eval/harness/summarize.mjs && node docs/make-result-png.mjs
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DOCS = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DOCS, "..");
const { chromium } = createRequire(join(ROOT, "base", "package.json"))("@playwright/test");

const summary = JSON.parse(readFileSync(join(ROOT, "eval", "results", "summary.json"), "utf8"));
const byId = Object.fromEntries(summary.configs.map((config) => [config.id, config]));

const GROUPS = [
  { title: "Краткая спека", ids: ["H-brief-off", "H-brief-on", "S-brief-off"] },
  { title: "Полная спека", ids: ["H-full-off", "H-full-on", "S-full-off"] },
];
const COLOR = { "claude-haiku-5-5": "#2a78d6", "claude-sonnet-5-5": "#eb6834" };
const NAME = { "claude-haiku-5-5": "Haiku", "claude-sonnet-5-5": "Sonnet" };
const INK = { primary: "#0b0b0b", secondary: "#52514e", grid: "#e1e0d9", surface: "#fcfcfb" };

const W = 1200;
const LABEL_W = 250;
const PANEL_W = 380;
const GAP = 90;
const ROW_H = 40;
const BAR_H = 22;
const GROUP_GAP = 22;
const TOP = 150;
const MAX_COST = 3.5;

const panels = [
  { x: LABEL_W, title: "Выполнено критериев приёмки, из 15", max: 15, ticks: [0, 5, 10, 15], value: (c) => c.acPerRun[0], label: (v) => `${String(v)} из 15`, tick: String },
  { x: LABEL_W + PANEL_W + GAP, title: "Стоимость прогона, $", max: MAX_COST, ticks: [0, 1, 2, 3], value: (c) => c.costUsd.meanPerRun, label: (v) => `$${v.toFixed(2)}`, tick: (v) => `$${String(v)}` },
];

/** Полоса с закруглённым концом на 4 px и прямым у базовой линии. */
const bar = (x, y, w, h, fill) => {
  const r = Math.min(4, w / 2);
  return `<path d="M${x},${y} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - r)} z" fill="${fill}"/>`;
};

let y = TOP;
const rows = [];
for (const group of GROUPS) {
  rows.push(`<text x="24" y="${y + 18}" font-size="17" font-weight="600" fill="${INK.primary}">${group.title}</text>`);
  y += 30;
  for (const id of group.ids) {
    const config = byId[id];
    const contour = config.contour ? "с контуром" : "без контура";
    const barY = y + (ROW_H - BAR_H) / 2;
    rows.push(`<text x="40" y="${barY + 16}" font-size="16" fill="${INK.primary}">${NAME[config.model]}, ${contour}</text>`);
    for (const panel of panels) {
      const value = panel.value(config);
      const w = Math.max(2, (value / panel.max) * PANEL_W);
      rows.push(bar(panel.x, barY, w, BAR_H, COLOR[config.model]));
      rows.push(`<text x="${panel.x + w + 8}" y="${barY + 16}" font-size="15" fill="${INK.secondary}">${panel.label(value)}</text>`);
    }
    y += ROW_H;
  }
  y += GROUP_GAP;
}
const plotBottom = y - GROUP_GAP + 4;

const chrome = panels.flatMap((panel) => [
  `<text x="${panel.x}" y="${TOP - 18}" font-size="15" font-weight="600" fill="${INK.secondary}">${panel.title}</text>`,
  ...panel.ticks.map((tick) => {
    const x = panel.x + (tick / panel.max) * PANEL_W;
    return `<line x1="${x}" y1="${TOP - 6}" x2="${x}" y2="${plotBottom}" stroke="${INK.grid}" stroke-width="1"/><text x="${x}" y="${plotBottom + 20}" font-size="13" text-anchor="middle" fill="${INK.secondary}">${panel.tick(tick)}</text>`;
  }),
]);

const H = plotBottom + 50;
const legend = Object.entries(NAME)
  .map(([model, name], index) => {
    const x = 24 + index * 120;
    return `<rect x="${x}" y="88" width="14" height="14" rx="3" fill="${COLOR[model]}"/><text x="${x + 22}" y="100" font-size="15" fill="${INK.primary}">${name}</text>`;
  })
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
<rect width="${W}" height="${H}" fill="${INK.surface}"/>
<text x="24" y="40" font-size="24" font-weight="700" fill="${INK.primary}">Полнота спеки важнее модели</text>
<text x="24" y="68" font-size="15" fill="${INK.secondary}">Один прогон на конфигурацию. Стоимость — токены из лога × публичные цены API.</text>
${legend}
${chrome.join("\n")}
${rows.join("\n")}
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
await page.locator("svg").screenshot({ path: join(DOCS, "result.png") });
await browser.close();
console.log(`docs/result.png ${String(W)}×${String(H)} @2x`);
