import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  tearLine,
  spanOf,
  tornShape,
  sidebarTear,
  barTear,
} from "../mods/p5-chrome/torn.js";

const TREE = {
  id: "root",
  type: "row",
  children: [
    {
      id: "sidebar",
      type: "column",
      size: { px: 268 },
      children: [
        { id: "brand", size: { px: 46 } },
        {
          id: "lists",
          type: "column",
          children: [
            { id: "spaces", size: { weight: 1 } },
            { id: "agents", size: { px: 200 } },
          ],
        },
        { id: "footer", size: { px: 92 } },
      ],
    },
    {
      id: "work",
      type: "column",
      children: [
        { id: "tabs", size: { px: 46 } },
        { id: "body", size: { weight: 1 } },
        { id: "status", size: { px: 30 } },
      ],
    },
  ],
};

test("a tear line covers its stretch, ends and stops included, with depths inside the amplitude", () => {
  const line = tearLine(50, 130, 6, [61]);
  expect(line[0][0]).toBe(0);
  expect(line.at(-1)[0]).toBe(80);
  expect(line.some(([at]) => at === 11)).toBe(true);
  for (let i = 1; i < line.length; i++)
    expect(line[i][0]).toBeGreaterThan(line[i - 1][0]);
  for (const [, d] of line) {
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(6);
  }
});

test("neighbouring stretches meet at the same depth", () => {
  expect(tearLine(0, 46, 6).at(-1)[1]).toBe(tearLine(46, 300, 6)[0][1]);
});

test("the paper rim's width swings widely along the tear and matches across stretches", () => {
  const rims = tearLine(0, 2000, 6).map(([, , r]) => r);
  for (const r of rims) {
    expect(r).toBeGreaterThanOrEqual(0.5);
    expect(r).toBeLessThanOrEqual(8);
  }
  expect(Math.max(...rims) - Math.min(...rims)).toBeGreaterThan(4);
  expect(tearLine(0, 46, 6).at(-1)[2]).toBe(tearLine(46, 300, 6)[0][2]);
});

test("spanOf finds a block's top and height in nested columns", () => {
  expect(spanOf(TREE, "brand", 1000)).toEqual({ top: 0, height: 46 });
  expect(spanOf(TREE, "spaces", 1000)).toEqual({ top: 46, height: 662 });
  expect(spanOf(TREE, "agents", 1000)).toEqual({ top: 708, height: 200 });
  expect(spanOf(TREE, "footer", 1000)).toEqual({ top: 908, height: 92 });
  expect(spanOf(TREE, "status", 1000)).toEqual({ top: 970, height: 30 });
  expect(spanOf(TREE, "nope", 1000)).toBeNull();
});

test("tornShape tears the named edge and closes the far side", () => {
  const line = [[0, 2, 0], [50, 6, 4]];
  expect(tornShape(line, 50, 268, "right").fill).toEqual([[0, 0], [266, 0], [262, 50], [0, 50]]);
  expect(tornShape(line, 50, 46, "bottom").fill).toEqual([[0, 0], [0, 44], [50, 40], [50, 0]]);
  expect(tornShape(line, 50, 30, "top").fill).toEqual([[0, 30], [0, 2], [50, 6], [50, 30]]);
});

test("tornShape's rim is the band between the torn fill and the tear itself", () => {
  const line = [
    [0, 2, 0, 1],
    [50, 6, 4, 1],
  ];
  expect(tornShape(line, 50, 268, "right").rims[0].polygons).toEqual([
    [
      [266, 0],
      [262, 50],
      [264, 50],
      [268, 0],
    ],
  ]);
  expect(tornShape(line, 50, 30, "top").rims[0].polygons).toEqual([
    [
      [0, 2],
      [50, 6],
      [50, 4],
      [0, 0],
    ],
  ]);
});

test("tornShape splits the rim into one run per stretch of equal shade, cut at 45 degrees, each in its own see-through paper", () => {
  const line = [
    [0, 4, 0, 0],
    [10, 4, 0, 0],
    [20, 4, 0, 3],
    [30, 4, 0, 0],
    [40, 4, 0, 0],
  ];
  const { rims } = tornShape(line, 40, 30, "top");
  const shade0 = rims.find((r) => r.polygons.length === 2);
  const shade3 = rims.find((r) => r.polygons.length === 1);
  expect(shade0.polygons).toEqual([
    [
      [0, 4],
      [10, 4],
      [20, 4],
      [16, 0],
      [10, 0],
      [0, 0],
    ],
    [
      [30, 4],
      [40, 4],
      [40, 0],
      [30, 0],
      [26, 0],
    ],
  ]);
  expect(shade3.polygons).toEqual([
    [
      [20, 4],
      [30, 4],
      [26, 0],
      [20, 0],
      [16, 0],
    ],
  ]);
  expect(shade0.color).toMatch(/^#f2e6d6[0-9a-f]{2}$/);
  expect(shade3.color).not.toBe(shade0.color);
});

test("a 45 degree cut interpolates the paper edge between vertices", () => {
  const line = [
    [0, 3, 1, 0],
    [10, 3, 1, 0],
    [20, 3, 1, 2],
    [30, 3, 1, 2],
  ];
  const [first] = tornShape(line, 30, 50, "right").rims.find(
    (r) => r.polygons[0][0][1] === 0,
  ).polygons;
  expect(first).toEqual([
    [47, 0],
    [47, 10],
    [47, 20],
    [49, 18],
    [49, 10],
    [49, 0],
  ]);
});

test("the paper's shade varies along the tear and matches across stretches", () => {
  const shades = new Set(tearLine(0, 2000, 6).map(([, , , s]) => s));
  expect(shades.size).toBeGreaterThanOrEqual(4);
  for (const s of shades)
    expect(Number.isInteger(s) && s >= 0 && s < 5).toBe(true);
  expect(tearLine(0, 46, 6).at(-1)[3]).toBe(tearLine(46, 300, 6)[0][3]);
});

test("sidebarTear stays flush beside the tab bar and the status bar", () => {
  const brand = sidebarTear(TREE, "brand", 1000);
  for (const [x] of brand.fill.slice(1, -1)) expect(x).toBe(268);
  for (const [x] of brand.rims.flatMap((r) => r.polygons.flat()))
    expect(x).toBe(268);
  const footer = sidebarTear(TREE, "footer", 1000);
  for (const [x, y] of footer.fill.slice(1, -1))
    if (908 + y >= 970) expect(x).toBe(268);
  const spaces = sidebarTear(TREE, "spaces", 1000);
  expect(spaces.fill.some(([x]) => x < 262)).toBe(true);
});

test("barTear tears the tab bar's bottom and the status bar's top, flush where they meet the sidebar", () => {
  const tabs = barTear(TREE, "tabs", 1500, "bottom");
  expect(tabs.fill[0]).toEqual([0, 0]);
  expect(tabs.fill[1]).toEqual([0, 46]);
  expect(tabs.fill.at(-1)).toEqual([1232, 0]);
  expect(tabs.fill.some(([, y]) => y < 42)).toBe(true);
  const status = barTear(TREE, "status", 1500, "top");
  expect(status.fill[1]).toEqual([0, 0]);
  expect(status.fill.at(-1)).toEqual([1232, 30]);
  expect(
    status.rims
      .flatMap((r) => r.polygons.flat())
      .every(([, y]) => y >= 0 && y <= 30),
  ).toBe(true);
});

test("sidebarTear gives up on a block outside the sidebar", () => {
  expect(sidebarTear(TREE, "status", 1000)).toBeNull();
});

test("every mod that tears carries the same torn.js, since mods can't import across folders", () => {
  const source = readFileSync("mods/p5-chrome/torn.js", "utf8");
  for (const m of ["p5-spaces", "p5-agents", "p5-pane", "p5-tabs", "p5-status"])
    expect(readFileSync(`mods/${m}/torn.js`, "utf8")).toBe(source);
});

test("a lean tilts the tear's baseline without leaving its bounds", () => {
  const flat = tearLine(0, 2000, 6);
  const leaning = tearLine(0, 2000, 6, [], 12);
  for (const [, d] of leaning) {
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(18);
  }
  const mean = (l, a, b) => {
    const part = l.filter(([p]) => p >= a && p < b);
    return part.reduce((s, [, d]) => s + d, 0) / part.length;
  };
  const drift = (l) => {
    const means = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => mean(l, i * 250, i * 250 + 250));
    return Math.max(...means) - Math.min(...means);
  };
  expect(drift(leaning)).toBeGreaterThan(drift(flat) + 4);
});
