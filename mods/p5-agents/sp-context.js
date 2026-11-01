// SP as the context window left, read from each agent's own session files.
// Copy this file to sp.js to use it; sp-turns.js is the alternative.

import { terminals, exec, home, readTextFile } from "herdr";

const POLL = 15000;
const CLAUDE_WINDOW = 1000000;

const left = new Map();

const rows = (text) =>
  text.split("\n").flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });

const percent = (used, window) =>
  Math.max(0, Math.round(100 - (used / window) * 100));

export function claudeLeft(text, settings) {
  const last = rows(text)
    .filter(
      (r) =>
        r.type === "assistant" &&
        r.message?.usage &&
        r.message.model !== "<synthetic>" &&
        !r.isSidechain,
    )
    .at(-1);
  if (!last) return null;
  const { model, usage } = last.message;
  const used =
    usage.input_tokens +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0);
  const window =
    settings?.modelSettings?.[model]?.autoCompactWindow ??
    settings?.autoCompactWindow ??
    CLAUDE_WINDOW;
  return percent(used, window);
}

export function codexLeft(text) {
  const info = rows(text)
    .filter((r) => r.payload?.type === "token_count" && r.payload.info)
    .at(-1)?.payload.info;
  if (!info) return null;
  return percent(info.last_token_usage.input_tokens, info.model_context_window);
}

export const sp = (address, turn) =>
  left.get(address) ?? Math.max(0, 100 - turn);

const run = async (command, args) => (await exec(command, args)).stdout.trim();

const lastMatching = (file, needle) =>
  run("sh", ["-c", 'grep -F -- "$1" "$2" | tail -n 20', "sh", needle, file]);

const agentPid = async (shell) =>
  (await run("pgrep", ["-P", String(shell)])).split("\n")[0];

async function claude(pid) {
  const session = JSON.parse(
    (await readTextFile(`${home()}/.claude/sessions/${pid}.json`)) ?? "null",
  );
  if (!session) return null;
  const folder = session.cwd.replace(/[^A-Za-z0-9]/g, "-");
  const file = `${home()}/.claude/projects/${folder}/${session.sessionId}.jsonl`;
  const settings = JSON.parse(
    (await readTextFile(`${home()}/.claude/settings.json`)) ?? "{}",
  );
  return claudeLeft(await lastMatching(file, '"usage"'), settings);
}

// Codex sessions are written by a shared app-server, not the codex process, so
// the thread is found by its resume id, else the newest interactive thread in its folder.
async function codex(pid) {
  const argv = await run("ps", ["-o", "command=", "-p", pid]);
  const id = argv.match(/\bresume\s+([0-9a-f-]{36})\b/)?.[1];
  const cwd = id
    ? null
    : (await run("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"]))
        .split("\n")
        .find((l) => l.startsWith("n"))
        ?.slice(1);
  if (!id && !cwd) return null;
  const where = id
    ? `id = '${id}'`
    : `cwd = '${cwd.replaceAll("'", "''")}' and source in ('cli', 'vscode')`;
  const file = await run("sh", [
    "-c",
    'sqlite3 "$(ls "$HOME"/.codex/state_*.sqlite | tail -n 1)" "$1"',
    "sh",
    `select rollout_path from threads where ${where} order by updated_at_ms desc limit 1`,
  ]);
  if (!file) return null;
  return codexLeft(await lastMatching(file, '"token_count"'));
}

const READERS = { claude, codex };

export async function poll() {
  const live = terminals().filter(
    (t) => READERS[t.program?.key] && !t.address.includes("/"),
  );
  for (const t of live) {
    try {
      const pid = await agentPid(t.pid);
      const value = pid ? await READERS[t.program.key](pid) : null;
      value == null ? left.delete(t.address) : left.set(t.address, value);
    } catch {
      left.delete(t.address);
    }
  }
  const alive = new Set(live.map((t) => t.address));
  for (const address of left.keys())
    if (!alive.has(address)) left.delete(address);
}

export function startSp(cx) {
  cx.spawn(async (cx) => {
    for (;;) {
      await poll();
      cx.notify();
      await cx.sleep(POLL);
    }
  });
}
