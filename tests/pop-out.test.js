import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const calls = [];
let whichResult;
let hyprctlResult;
let platform;
const source = readFileSync("mods/p5-pane/main.js", "utf8")
  .replace(/^import [^;]*;\n/gm, "")
  .replace("export default class", "return class");
const path = {
  add_polygon() {
    return this;
  },
  build() {
    return {};
  },
};
const Pane = new Function(
  "View",
  "PathBuilder",
  "tearLine",
  "tornShape",
  "exec",
  "run",
  "win",
  source,
)(
  class {},
  { fill: () => path },
  () => [],
  () => ({ fill: [], rims: [] }),
  async (command, args) => {
    calls.push(["exec", command, args]);
    if (command === "which") return whichResult;
    if (command === "hyprctl" && args[0] === "version") {
      if (!hyprctlResult) throw new Error("hyprctl: not found");
      return hyprctlResult;
    }
    return { code: 0, stdout: "", stderr: "" };
  },
  (name, args) => calls.push(["run", name, args]),
  () => ({ platform }),
);

function setup(
  which = { code: 0, stdout: "/Users/q/.local/bin/hc\n", stderr: "" },
  os = "macos",
  hyprctl = { code: 0, stdout: "Hyprland\n", stderr: "" },
) {
  calls.length = 0;
  whichResult = which;
  hyprctlResult = hyprctl;
  platform = os;
  const pane = new Pane();
  pane.init();
  return pane;
}

const settle = () => new Promise((resolve) => setTimeout(resolve));

test("pop out attaches a new Ghostty window to the terminal by hc's absolute path, then hides Herdr in the same click", async () => {
  const pane = setup();
  await settle();
  pane.popOut("vps/t7");
  expect(calls).toEqual([
    ["exec", "which", ["hc"]],
    [
      "exec",
      "osascript",
      [
        "-e",
        expect.stringContaining("new window with configuration"),
        "/Users/q/.local/bin/hc",
        "vps/t7",
      ],
    ],
    [
      "exec",
      "osascript",
      [
        "-e",
        'tell application "System Events" to set visible of process "Herdr" to false',
      ],
    ],
  ]);
});

test("pop out keeps Herdr visible when hc is not on PATH", async () => {
  const pane = setup({ code: 1, stdout: "", stderr: "" });
  await settle();
  pane.popOut("t7");
  expect(calls).toEqual([["exec", "which", ["hc"]]]);
});

test("pop out on Linux has Hyprland open a floating, work-area-sized Ghostty attached to the terminal over Herdr", async () => {
  const pane = setup({ code: 0, stdout: "/usr/bin/hc\n", stderr: "" }, "linux");
  await settle();
  pane.popOut("it's t7");
  expect(calls).toEqual([
    ["exec", "which", ["hc"]],
    ["exec", "hyprctl", ["version"]],
    [
      "exec",
      "hyprctl",
      [
        "dispatch",
        `hl.dsp.exec_cmd("ghostty --gtk-single-instance=false -e '/usr/bin/hc' attach 'it'\\\\''s t7'", { float = true, size = { "(monitor_w-20)", "(monitor_h-46)" }, center = true })`,
      ],
    ],
  ]);
});

test("pop out does nothing on Linux when hyprctl is not installed", async () => {
  const pane = setup(undefined, "linux", null);
  await settle();
  pane.popOut("t7");
  expect(calls).toEqual([
    ["exec", "which", ["hc"]],
    ["exec", "hyprctl", ["version"]],
  ]);
});

test("pop out does nothing on Linux when no Hyprland instance is running", async () => {
  const pane = setup(undefined, "linux", {
    code: 1,
    stdout: "",
    stderr: "HYPRLAND_INSTANCE_SIGNATURE not set",
  });
  await settle();
  pane.popOut("t7");
  expect(calls).toEqual([
    ["exec", "which", ["hc"]],
    ["exec", "hyprctl", ["version"]],
  ]);
});

test("pop out does nothing on Windows", async () => {
  const pane = setup(undefined, "windows");
  await settle();
  pane.popOut("t7");
  expect(calls).toEqual([["exec", "which", ["hc"]]]);
});
