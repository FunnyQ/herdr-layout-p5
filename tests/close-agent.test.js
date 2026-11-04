import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const calls = [];
const state = new Map();
let focus, allPanes, allSpaces;
const source = readFileSync("mods/p5-tabs/main.js", "utf8")
  .replace(/^import .*;\n/gm, "")
  .replace("export default class", "return class");
const path = { add_polygon() { return this; }, build() { return {}; } };
const Tabs = new Function("View", "PathBuilder", "focused", "panes", "spaces", "run", "openOverlay", "shared", "setShared", source)(
  class {},
  { fill: () => path },
  () => focus,
  () => allPanes,
  () => allSpaces,
  (name, args) => calls.push(["run", name, args]),
  (spec) => { calls.push(["overlay", spec]); return "agent-close-overlay"; },
  (key) => state.get(key),
  (key, value) => state.set(key, value),
);

function setup({ agent = true, split = false, lastTab = false } = {}) {
  calls.length = 0;
  state.clear();
  focus = { pane: "p1" };
  allPanes = [{ pane: "p1", tab: "t1", title: "Fix login", program: { agent, name: "Codex" } }];
  if (split) allPanes.push({ pane: "p2", tab: "t1", program: { agent: false } });
  allSpaces = [{ id: "s1", tabs: lastTab ? [{ id: "t1" }] : [{ id: "t1" }, { id: "t2" }] }];
  return new Tabs();
}

test("Cmd-W routes to the P5 close command only in the Persona 5 layout", () => {
  const keys = JSON.parse(readFileSync("keys.json", "utf8"));
  expect(keys["layout:persona5"]["cmd-w"]).toBe("p5-tabs.close-pane");
  expect(keys.global).toBeUndefined();
});

test("an agent tab asks before closing its captured target", () => {
  setup().closePane();
  expect(calls).toHaveLength(1);
  const [kind, spec] = calls[0];
  expect(kind).toBe("overlay");
  expect(spec.mod).toBe("p5-confirm");
  expect(spec.modal).toBe(true);
  expect(spec.props.title).toBe("Close agent?");
  expect(spec.props.detail).toBe("Codex — Fix login");
  expect(spec.props.command).toEqual({ name: "tab.close", args: { id: "t1", confirmed: true } });
  focus = { pane: "p2" };
  expect(spec.props.command.args.id).toBe("t1");
});

test("an agent split closes only its own pane after confirmation", () => {
  setup({ split: true }).closePane();
  expect(calls[0][1].props.command).toEqual({ name: "pane.close", args: { pane: "p1" } });
});

test("the final agent tab needs only one confirmation", () => {
  setup({ lastTab: true }).closePane();
  expect(calls[0][1].props.command).toEqual({ name: "tab.close", args: { id: "t1", confirmed: true } });
});

test("a shell retains its pane close behavior", () => {
  setup({ agent: false }).closePane();
  expect(calls).toEqual([["run", "pane.close", { pane: "p1" }]]);
});

test("a layout terminal or missing pane never closes another pane", () => {
  const view = setup();
  focus = { pane: null };
  view.closePane();
  focus = { pane: "missing" };
  view.closePane();
  expect(calls).toEqual([]);
});

test("repeated Cmd-W opens only one confirmation, including after a tabs reload", () => {
  const view = setup();
  view.closePane();
  view.closePane();
  new Tabs().closePane();
  expect(calls).toHaveLength(1);
  expect(state.get("p5.agentCloseOverlay")).toBe("agent-close-overlay");
});

test("Cmd-W can open another confirmation after the previous one closes", () => {
  const view = setup();
  view.closePane();
  state.set("p5.agentCloseOverlay", null);
  view.closePane();
  expect(calls).toHaveLength(2);
});
