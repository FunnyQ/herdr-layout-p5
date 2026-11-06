import { test, expect } from "bun:test";
import { markSelected } from "../mods/p5-agents/selected.js";

const a = (address, tab, focused = false) => ({ address, tab, focused });

test("keeps the focused agent selected", () => {
  const list = [a("t1", "tb1"), a("t2", "tb1", true)];
  expect(markSelected(list, "tb1").map((x) => x.focused)).toEqual([
    false,
    true,
  ]);
});

test("selects the tab's first agent when another pane has focus", () => {
  const list = [a("t1", "tb0"), a("t2", "tb1"), a("t3", "tb1")];
  expect(markSelected(list, "tb1").map((x) => x.focused)).toEqual([
    false,
    true,
    false,
  ]);
});

test("selects nothing when the focused tab has no agent", () => {
  const list = [a("t1", "tb0")];
  expect(markSelected(list, "tb9").map((x) => x.focused)).toEqual([false]);
  expect(markSelected(list, undefined).map((x) => x.focused)).toEqual([false]);
});
