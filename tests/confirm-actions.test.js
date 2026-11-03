import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

let current;
const calls = [];
const source = readFileSync("mods/p5-confirm/main.js", "utf8")
  .replace(/^import .*;\n/gm, "")
  .replace("export default class", "return class");
const Confirm = new Function("View", "run", "props", "closeOverlay", "Frame", source)(
  class {},
  (name, args) => calls.push(["run", name, args]),
  () => current,
  (id) => calls.push(["close", id]),
  class {},
);
const dialog = (command) => {
  calls.length = 0;
  current = { overlay: "test-overlay", command };
  const view = new Confirm();
  view.init({}, { focus_handle: () => ({ focus() {} }), new: () => ({}) });
  return view;
};

test("confirm dismisses the overlay then executes the exact command once", () => {
  const view = dialog({ name: "space.close", args: { id: "s2", confirmed: true } });
  view.yes();
  view.yes();
  expect(calls).toEqual([
    ["close", "test-overlay"],
    ["run", "space.close", { id: "s2", confirmed: true }],
  ]);
});

test("cancel never executes the command, even after a queued confirm", () => {
  const view = dialog({ name: "space.close", args: { id: "s2", confirmed: true } });
  view.cancel();
  view.yes();
  expect(calls).toEqual([["close", "test-overlay"]]);
});

test("preview confirmation only dismisses its own overlay", () => {
  dialog().yes();
  expect(calls).toEqual([["close", "test-overlay"]]);
});
