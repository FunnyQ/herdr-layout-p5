const TERMINALS = "p5.quick-terminal.terminals";
const VISIBLE = "p5.quick-terminal.visible";
const keyOf = (space) => `${space.machine ?? "local"}:${space.id}`;

export class QuickTerminal {
  constructor(api, viewport) {
    this.api = api;
    this.viewport = viewport;
    this.queue = Promise.resolve();
  }

  toggle() {
    const job = this.queue.then(() => this.toggleNow());
    this.queue = job.catch(() => {});
    return job;
  }

  hide(restore = true) {
    const a = this.api;
    const visible = a.shared(VISIBLE);
    if (!visible) return;
    a.setShared(VISIBLE, null);
    a.closeOverlay(visible.id);
    const space = a.spaces().find((s) => s.active);
    if (restore && space && keyOf(space) === visible.space && a.panes().some((p) => p.pane === visible.returnPane))
      a.run("pane.focus", { pane: visible.returnPane });
  }

  sync() {
    const visible = this.api.shared(VISIBLE);
    const space = this.api.spaces().find((s) => s.active);
    if (visible && (!space || keyOf(space) !== visible.space)) this.hide(false);
  }

  adopt() {
    const a = this.api;
    const space = a.spaces().find((s) => s.active);
    const pane = a.panes().find((p) => p.pane === a.focused()?.pane);
    if (!space || !pane?.terminal || !pane.program?.shell)
      throw new Error("Focus a shell pane before moving it to Quick Terminal.");
    const saved = a.shared(TERMINALS) ?? {};
    const key = keyOf(space);
    if (saved[key] && saved[key] !== pane.terminal)
      throw new Error("This space already has a quick terminal.");
    this.hide(false);
    a.setShared(TERMINALS, { ...saved, [key]: pane.terminal });
    a.run("terminal.park", { terminal: pane.terminal });
  }

  async toggleNow() {
    const a = this.api;
    const space = a.spaces().find((s) => s.active);
    if (!space) return;
    const key = keyOf(space);
    const visible = a.shared(VISIBLE);
    if (visible?.space === key) {
      this.hide();
      return;
    }
    this.hide(false);
    const saved = a.shared(TERMINALS) ?? {};
    let terminal = a.terminals().find((t) => t.state === "live" &&
      (t.address === saved[key] || t.labels?.["p5.quick-space"] === key));
    if (!terminal && saved[key]) {
      const result = await a.hc(["get", saved[key]]);
      if (result.code === 0) {
        const existing = JSON.parse(result.stdout);
        if (existing.state === "live") terminal = existing;
      } else if (result.code !== 3) {
        throw new Error(result.stderr || "Cannot reach the saved quick terminal.");
      }
    }
    if (!terminal) {
      const args = ["run", "--json", "--bg", "--no-parent", "--no-notify", "--keep", "--label", `p5.quick-space=${key}`];
      if (space.folder) args.push("--cwd", space.folder);
      if (space.machine) args.push("--on", space.machine);
      const result = await a.hc(args);
      if (result.code !== 0) throw new Error(result.stderr || "Cannot start the quick terminal.");
      terminal = JSON.parse(result.stdout);
    }
    if (space.machine && !terminal.address.includes("/")) terminal.address = `${space.machine}/${terminal.address}`;
    a.setShared(TERMINALS, { ...(a.shared(TERMINALS) ?? {}), [key]: terminal.address });
    const current = a.spaces().find((s) => s.active);
    if (!current || keyOf(current) !== key) return;
    const returnPane = a.focused()?.pane;
    const viewport = this.viewport();
    const zoom = a.settings?.()?.zoom ?? 1;
    const height = Math.min(viewport.height * 0.65, viewport.width * 0.78 * 3 / 4) / zoom;
    const width = height * 4 / 3;
    const frame = { width, height, side: Math.max(28, Math.ceil(width * 0.05)), top: Math.max(76, Math.ceil(height * 0.06)), bottom: Math.max(28, Math.ceil(height * 0.06)) };
    const framePart = (part) => ({ type: "block", size: { px: part === "bottom" ? frame.bottom : frame.side }, content: { mod: "p5-quick-terminal", props: { part, frame } } });
    const id = a.openOverlay({
      kind: "dialog",
      frame: "none",
      width,
      height,
      layout: {
        type: "column",
        resizable: false,
        children: [
          { type: "block", size: { px: frame.top }, content: { mod: "p5-quick-terminal", props: { frame } } },
          { type: "row", resizable: false, children: [framePart("left"), { type: "block", content: { terminal: terminal.address } }, framePart("right")] },
          framePart("bottom"),
        ],
      },
    });
    a.setShared(VISIBLE, { id, space: key, terminal: terminal.address, returnPane });
  }
}
