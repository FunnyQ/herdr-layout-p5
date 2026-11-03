import { expect, test } from "bun:test";
import { closeRequest } from "../mods/p5-tabs/confirm.js";
import { readFileSync } from "node:fs";

const spaces = [
  { id: "s1", name: "Other", tabs: [{ id: "t1" }, { id: "t2" }] },
  { id: "s2", name: "Target", tabs: [{ id: "t3" }] },
];
const panes = [{ tab: "t1", terminal: "a" }, { tab: "t3", terminal: "b" }, { tab: "t3", terminal: "c" }, { tab: "t3", mod: "files" }];

test("closing a space describes only its terminals and confirms its explicit id", () => {
  expect(closeRequest(spaces, panes, "space.close", "s2")).toEqual({
    title: "Close space?",
    detail: "Target — 1 tab, 2 terminals",
    command: { name: "space.close", args: { id: "s2", confirmed: true } },
  });
});

test("closing the last tab confirms the tab and describes the containing space", () => {
  expect(closeRequest(spaces, panes, "tab.close", "t3")).toEqual({
    title: "Close space?",
    detail: "Target — 1 tab, 2 terminals",
    command: { name: "tab.close", args: { id: "t3", confirmed: true } },
  });
});

test("ordinary tab closes keep the built-in behavior", () => {
  expect(closeRequest(spaces, panes, "tab.close", "t1")).toBeNull();
});

test("missing targets never produce a confirmed close command", () => {
  expect(closeRequest(spaces, panes, "space.close", "missing")).toBeNull();
  expect(closeRequest(spaces, panes, "tab.close", "missing")).toBeNull();
});

test("both callers ship the same close request logic", () => {
  expect(readFileSync("mods/p5-menu/confirm.js", "utf8")).toBe(
    readFileSync("mods/p5-tabs/confirm.js", "utf8"),
  );
});
