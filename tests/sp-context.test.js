import { test, expect, mock } from "bun:test";

const host = {
  terminals: [],
  exec: async () => ({ code: 1, stdout: "", stderr: "" }),
  files: {},
};

mock.module("herdr", () => ({
  terminals: () => host.terminals,
  exec: (...args) => host.exec(...args),
  home: () => "/home/q",
  readTextFile: async (path) => host.files[path] ?? null,
}));

const { claudeLeft, codexLeft, sp, poll } =
  await import("../mods/p5-agents/sp-context.js");

const jsonl = (...rows) => rows.map((r) => JSON.stringify(r)).join("\n");
const assistant = (model, usage, extra = {}) => ({
  type: "assistant",
  message: { model, usage },
  ...extra,
});
const tokenCount = (input, cached, window) => ({
  type: "event_msg",
  payload: {
    type: "token_count",
    info: {
      last_token_usage: { input_tokens: input, cached_input_tokens: cached },
      model_context_window: window,
    },
  },
});

test("codex: cached input is part of input_tokens, not added again", () => {
  const text = jsonl(tokenCount(100000, 90000, 400000));
  expect(codexLeft(text)).toBe(75);
});

test("codex: the last token_count with info wins", () => {
  const text = jsonl(
    tokenCount(40000, 0, 400000),
    tokenCount(200000, 0, 400000),
    { type: "event_msg", payload: { type: "token_count", info: null } },
  );
  expect(codexLeft(text)).toBe(50);
});

test("claude: used is input plus cache read plus cache creation", () => {
  const text = jsonl(
    assistant("claude-opus-5-5", {
      input_tokens: 10000,
      cache_read_input_tokens: 80000,
      cache_creation_input_tokens: 10000,
    }),
  );
  expect(claudeLeft(text, {})).toBe(90);
});

test("claude: the model's autoCompactWindow sets the window", () => {
  const text = jsonl(
    assistant("claude-opus-5-5", {
      input_tokens: 100000,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    }),
  );
  const settings = {
    modelSettings: { "claude-opus-5-5": { autoCompactWindow: 400000 } },
  };
  expect(claudeLeft(text, settings)).toBe(75);
});

test("claude: a top-level autoCompactWindow sets the window when the model has none", () => {
  const text = jsonl(
    assistant("claude-sonnet-5-5", {
      input_tokens: 100000,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    }),
  );
  const settings = {
    autoCompactWindow: 200000,
    modelSettings: { "claude-opus-5-5": { autoCompactWindow: 400000 } },
  };
  expect(claudeLeft(text, settings)).toBe(50);
});

test("claude: synthetic and sidechain messages are skipped", () => {
  const text = jsonl(
    assistant("claude-opus-5-5", {
      input_tokens: 500000,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    }),
    assistant(
      "claude-opus-5-5",
      {
        input_tokens: 1,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
      { isSidechain: true },
    ),
    assistant("<synthetic>", {
      input_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    }),
  );
  expect(claudeLeft(text, {})).toBe(50);
});

test("no usage yet gives null", () => {
  expect(claudeLeft("", {})).toBeNull();
  expect(codexLeft("not json")).toBeNull();
});

test("sp falls back to 100 minus turns when nothing was read", () => {
  expect(sp("t1", 7)).toBe(93);
  expect(sp("t1", 140)).toBe(0);
});

test("poll reads a Claude agent found by program.key and its shell pid", async () => {
  const usage = assistant("claude-opus-5-5", {
    input_tokens: 250000,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  });
  host.terminals = [
    { address: "t9", pid: 100, turn: 3, program: { key: "claude" } },
    { address: "t8", pid: 200, turn: 3, program: { key: "shell" } },
  ];
  host.files = {
    "/home/q/.claude/sessions/101.json": JSON.stringify({
      sessionId: "abc",
      cwd: "/home/q/my.app",
    }),
  };
  const ran = [];
  host.exec = async (command, args) => {
    ran.push([command, ...args].join(" "));
    if (command === "pgrep" && args.join(" ") === "-P 100")
      return { code: 0, stdout: "101\n", stderr: "" };
    if (command === "sh" && args.at(-1) === "/home/q/.claude/projects/-home-q-my-app/abc.jsonl")
      return { code: 0, stdout: jsonl(usage), stderr: "" };
    return { code: 1, stdout: "", stderr: "" };
  };
  await poll();
  expect(sp("t9", 3)).toBe(75);
  expect(sp("t8", 3)).toBe(97);
  expect(ran.some((r) => r.includes("200"))).toBe(false);
});
