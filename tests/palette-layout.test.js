import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

function element() {
  const node = { style: {}, childNodes: [] };
  let el;
  el = new Proxy(node, {
    get(target, name) {
      if (name in target) return target[name];
      return (...args) => {
        if (name === "child") target.childNodes.push(args[0]);
        else if (name === "children") target.childNodes.push(...args[0]);
        else if (name === "when") {
          if (args[0]) return args[1](el);
        } else if (name === "relative" || name === "absolute") target.style.position = name;
        else target.style[name] = args[0];
        return el;
      };
    },
  });
  return el;
}

const source = readFileSync("mods/p5-palette/main.js", "utf8")
  .replace(/^import .*;\n/gm, "")
  .replace(/globalThis\.window/g, "drawWindow")
  .replace("export default class", "return class");
const dependencies = {
  View: class {},
  div: element,
  svg: element,
  v_flex: element,
  h_flex: element,
  PathBuilder: { fill: element, stroke: element },
  drawWindow: { paint_path: element },
  Input: { new: element },
  theme: () => ({}),
  keys: () => [],
  isP5: () => true,
  modal: (el) => el,
  heading: element,
  searchField: (el) => el,
  footer: (el) => el,
  keycap: element,
};
const Palette = new Function(...Object.keys(dependencies), source)(...Object.values(dependencies));

function renderRows(count, at) {
  const palette = new Palette();
  Object.assign(palette, { query: "command", at, scroll: 0 });
  palette.rows = () => Array.from({ length: count }, (_, i) => ({
    e: { id: `command-${i}`, title: `Command ${i}`, args: {}, group: "Tab" },
  }));
  const rendered = palette.render();
  const rows = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.style?.id?.startsWith("pl-")) rows.push(node);
    node.childNodes?.forEach(visit);
  }
  visit(rendered);
  return rows;
}

test("scrolling palette rows retain their absolute 32px placement, including the selection", () => {
  const rows = renderRows(30, 25);
  expect(rows.some((row) => row.style.id === "pl-25")).toBe(true);
  for (const row of rows) {
    expect(row.style.position).toBe("absolute");
    expect(320 - row.style.top - row.style.bottom).toBe(32);
  }
});

test("short palette lists keep relative 32px rows in normal flow", () => {
  const rows = renderRows(3, 1);
  expect(rows).toHaveLength(3);
  for (const row of rows) {
    expect(row.style.position).toBe("relative");
    expect(row.style.h).toBe(32);
  }
});
