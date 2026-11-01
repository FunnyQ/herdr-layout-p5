import { test, expect } from "bun:test";
import { QuickTerminal } from "../mods/p5-chrome/quick-terminal.js";

function terminalIn(node) {
  if (node.content?.terminal) return node.content.terminal;
  return node.children?.map(terminalIn).find(Boolean);
}

function fixture() {
  const state = {
    space: { id: "a", name: "Project A", folder: "/projects/a", machine: null },
    terminals: [],
    shared: {},
    calls: [],
    requests: [],
    created: 0,
    viewport: { width: 1440, height: 900 },
    zoom: 1,
    lookup: { code: 3, stdout: "", stderr: "not found" },
  };
  const api = {
    spaces: () => [state.space],
    terminals: () => state.terminals,
    panes: () => [{ pane: "editor" }],
    focused: () => ({ pane: "editor" }),
    settings: () => ({ zoom: state.zoom }),
    shared: (key) => state.shared[key],
    setShared: (key, value) => { state.shared[key] = value; },
    run: (...args) => state.calls.push(args),
    closeOverlay: (id) => state.calls.push(["close", id]),
    openOverlay: (spec) => {
      state.calls.push(["open", spec]);
      return `overlay-${state.calls.length}`;
    },
    hc: async (args) => {
      state.requests.push(args);
      if (args[0] === "get") return state.lookup;
      const terminal = { address: `t${++state.created}`, state: "live", labels: {} };
      const label = args[args.indexOf("--label") + 1];
      const split = label.indexOf("=");
      terminal.labels[label.slice(0, split)] = label.slice(split + 1);
      state.terminals.push(terminal);
      return { code: 0, stdout: JSON.stringify(terminal), stderr: "" };
    },
  };
  state.space.active = true;
  return { state, api, quick: new QuickTerminal(api, () => state.viewport) };
}

test("show, hide and reopen reuse the same shell without killing it", async () => {
  const { state, quick } = fixture();
  await quick.toggle();
  const first = state.calls.find(([name]) => name === "open")[1];
  expect(first.kind).toBe("dialog");
  await quick.toggle();
  expect(state.calls.some(([name]) => name === "close")).toBe(true);
  expect(state.calls).toContainEqual(["pane.focus", { pane: "editor" }]);
  await quick.toggle();
  const opens = state.calls.filter(([name]) => name === "open");
  expect(terminalIn(opens[1][1].layout)).toBe(terminalIn(first.layout));
  expect(state.created).toBe(1);
  expect(state.requests[0]).toContain("/projects/a");
  expect(state.requests[0]).toContain("--no-parent");
  expect(state.calls.some(([name]) => name === "terminal.kill")).toBe(false);
});

test("the 4:3 dialog sizes against the current viewport each time it opens", async () => {
  const { state, quick } = fixture();
  await quick.toggle();
  const first = state.calls.find(([name]) => name === "open")[1];
  expect(first.width).toBeCloseTo(780);
  expect(first.width / first.height).toBeCloseTo(4 / 3);
  expect(first.height).toBeCloseTo(585);
  await quick.toggle();
  state.viewport = { width: 1000, height: 600 };
  await quick.toggle();
  const second = state.calls.filter(([name]) => name === "open").at(-1)[1];
  expect(second.width).toBeCloseTo(520);
  expect(second.width / second.height).toBeCloseTo(4 / 3);
  expect(second.height).toBeCloseTo(390);
  expect(state.created).toBe(1);
});

test("space changes hide the window and keep separate shells", async () => {
  const { state, quick } = fixture();
  await quick.toggle();
  state.space = { id: "b", name: "B", folder: "/projects/b", machine: null, active: true };
  quick.sync();
  expect(state.shared["p5.quick-terminal.visible"]).toBeNull();
  await quick.toggle();
  expect(state.created).toBe(2);
  state.space = { id: "a", folder: "/projects/a", machine: null, active: true };
  quick.sync();
  await quick.toggle();
  expect(state.created).toBe(2);
  expect(terminalIn(state.calls.at(-1)[1].layout)).toBe("t1");
});

test("the 4:3 dialog fits narrow windows when zoomed", async () => {
  const { state, quick } = fixture();
  state.viewport = { width: 500, height: 1600 };
  state.zoom = 2;
  await quick.toggle();
  const popup = state.calls.find(([name]) => name === "open")[1];
  expect(popup.width / popup.height).toBeCloseTo(4 / 3);
  expect(popup.width * state.zoom).toBeCloseTo(390);
  expect(popup.height * state.zoom).toBeCloseTo(292.5);
});

test("rapid toggles create only one shell and end hidden", async () => {
  const { state, quick } = fixture();
  await Promise.all([quick.toggle(), quick.toggle()]);
  expect(state.created).toBe(1);
  expect(state.shared["p5.quick-terminal.visible"]).toBeNull();
});

test("an exited shell is replaced on the next open", async () => {
  const { state, quick } = fixture();
  await quick.toggle();
  await quick.toggle();
  state.terminals[0].state = "finished";
  state.lookup = { code: 0, stdout: JSON.stringify(state.terminals[0]), stderr: "" };
  await quick.toggle();
  expect(state.created).toBe(2);
});

test("label discovery reuses an existing shell without saved state", async () => {
  const { state, quick } = fixture();
  state.terminals.push({ address: "existing", state: "live", labels: { "p5.quick-space": "local:a" } });
  await quick.toggle();
  expect(state.created).toBe(0);
  expect(terminalIn(state.calls.at(-1)[1].layout)).toBe("existing");
});

test("remote spaces launch on their machine", async () => {
  const { state, quick } = fixture();
  state.space.machine = "server";
  await quick.toggle();
  expect(state.requests[0]).toContain("--on");
  expect(state.requests[0]).toContain("server");
});

test("a pending launch cannot open in a different space", async () => {
  const { state, api, quick } = fixture();
  const launch = api.hc;
  api.hc = async (args) => {
    const result = await launch(args);
    state.space = { id: "b", folder: "/b", machine: null, active: true };
    return result;
  };
  await quick.toggle();
  expect(state.created).toBe(1);
  expect(state.calls.some(([name]) => name === "open")).toBe(false);
});

test("a temporarily missing terminal is looked up before creating another", async () => {
  const { state, quick } = fixture();
  state.shared["p5.quick-terminal.terminals"] = { "local:a": "existing" };
  state.lookup = { code: 0, stdout: JSON.stringify({ address: "existing", state: "live" }), stderr: "" };
  await quick.toggle();
  expect(state.created).toBe(0);
  expect(terminalIn(state.calls.at(-1)[1].layout)).toBe("existing");
});

test("lookup failure does not duplicate a disconnected shell", async () => {
  const { state, quick } = fixture();
  state.shared["p5.quick-terminal.terminals"] = { "local:a": "server/t1" };
  state.lookup = { code: 1, stdout: "", stderr: "machine disconnected" };
  await expect(quick.toggle()).rejects.toThrow("machine disconnected");
  expect(state.created).toBe(0);
});

test("remote lookups retain the machine-qualified address", async () => {
  const { state, quick } = fixture();
  state.space.machine = "server";
  state.shared["p5.quick-terminal.terminals"] = { "server:a": "server/t1" };
  state.lookup = { code: 0, stdout: JSON.stringify({ address: "t1", state: "live" }), stderr: "" };
  await quick.toggle();
  expect(state.created).toBe(0);
  expect(state.shared["p5.quick-terminal.terminals"]["server:a"]).toBe("server/t1");
});

test("adopting an existing shell removes its pane without terminating it", () => {
  const { state, api, quick } = fixture();
  api.panes = () => [{ pane: "editor", terminal: "existing", program: { shell: true } }];
  quick.adopt();
  expect(state.shared["p5.quick-terminal.terminals"]["local:a"]).toBe("existing");
  expect(state.calls).toContainEqual(["terminal.park", { terminal: "existing" }]);
  expect(state.created).toBe(0);
  expect(state.calls.some(([name]) => name === "terminal.kill")).toBe(false);
});

test("adoption refuses an agent or other foreground program", () => {
  const { state, api, quick } = fixture();
  api.panes = () => [{ pane: "editor", terminal: "agent", program: { shell: false, agent: true } }];
  expect(() => quick.adopt()).toThrow("Focus a shell pane");
  expect(state.calls).toHaveLength(0);
});
