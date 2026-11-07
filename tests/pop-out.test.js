import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const calls = [];
let whichResult;
const source = readFileSync("mods/p5-pane/main.js", "utf8")
  .replace(/^import .*;\n/gm, "")
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
  source,
)(
  class {},
  { fill: () => path },
  () => [],
  () => ({ fill: [], rims: [] }),
  async (command, args) => {
    calls.push(["exec", command, args]);
    return command === "which"
      ? whichResult
      : { code: 0, stdout: "", stderr: "" };
  },
  (name, args) => calls.push(["run", name, args]),
);

function setup(
  which = { code: 0, stdout: "/Users/q/.local/bin/hc\n", stderr: "" },
) {
  calls.length = 0;
  whichResult = which;
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
