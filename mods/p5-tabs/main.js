import { View, div, svg, image, PathBuilder, Background } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, panes, run, openOverlay, theme, window as appWindow, shared, layout, settings } from "herdr";

const STRIPES_FULL = PathBuilder.fill().add_polygon([[0, 0], ["100%", 0], ["100%", "100%"], [0, "100%"]]).build();
const stripes = () => globalThis.window.paint_path(STRIPES_FULL, Background.pattern_slash("#00000040", 3, 14)).absolute().inset_0();
const SLANT = PathBuilder.fill().add_polygon([["8%", 0], ["100%", 0], ["92%", "100%"], [0, "100%"]]).build();
const slant = (color) => globalThis.window.paint_path(SLANT, color).absolute().inset_0();

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The active tab's slabs are their own views, so a frame rebuilds only them.
const MORPH_PERIOD = 2400;
const pull = (now, i) => (1 - Math.cos((now / MORPH_PERIOD) * 2 * Math.PI + i * 1.7)) / 2;
const morphed = (now) => [
  [`${4 * pull(now, 0)}%`, `${16 + 12 * pull(now, 1)}%`],
  [`${97 - 4 * pull(now, 2)}%`, `${12 * pull(now, 3)}%`],
  [`${100 - 4 * pull(now, 4)}%`, `${82 - 12 * pull(now, 5)}%`],
  [`${4 + 4 * pull(now, 6)}%`, `${100 - 12 * pull(now, 7)}%`],
];

class Morph extends View {
  init(props, cx) {
    this.fill = props.fill;
    this.edge = props.edge;
    this.lag = props.lag;
    cx.timer.every(33, (cx) => cx.notify());
  }

  render() {
    const shape = morphed(Date.now() - this.lag);
    return div()
      .size_full()
      .relative()
      .child(globalThis.window.paint_path(PathBuilder.fill().add_polygon(shape).build(), this.fill).absolute().inset_0())
      .when(Boolean(this.edge), (el) => el.child(globalThis.window.paint_path(PathBuilder.stroke(2).add_polygon(shape, true).build(), this.edge).absolute().inset_0()));
  }
}

export default class Tabs extends View {
  init(_props, cx) {
    this.morph = cx.new(Morph, { fill: "#000000", edge: "#ffffff", lag: 0 });
    this.shadow = cx.new(Morph, { fill: "#e60012", edge: null, lag: MORPH_PERIOD / 2 });
    this.pressed = null;
    this.panels = JSON.parse(localStorage.getItem("panels") ?? "{}");
  }

  // The side panel is remembered per space: switching shows that space's choice
  // (closed if it never had one), and opening or closing it records it.
  syncPanel(space, panel, body, enabled) {
    if (!space || !panel) return;
    const now = panel.hidden ? null : body?.active ?? null;
    if (space.id !== this.space) {
      const first = this.space === undefined;
      this.space = space.id; this.pending = null;
      if (!(first && !(space.id in this.panels))) {
        const stored = this.panels[space.id] ?? null, want = enabled.includes(stored) ? stored : null;
        if (want !== now) {
          this.pending = { want, until: Date.now() + 1000 };
          if (want) { run("layout.select", { stack: "panel-body", child: want }); run("layout.show", { id: "panel" }); }
          else run("layout.hide", { id: "panel" });
          return;
        }
      }
    }
    // Until the restore lands (or something else won), the old state isn't a choice.
    if (this.pending) {
      if (this.pending.want !== now && Date.now() < this.pending.until) return;
      this.pending = null;
    }
    if (this.panels[space.id] === now) return;
    this.panels[space.id] = now;
    localStorage.setItem("panels", JSON.stringify(this.panels));
  }

  render() {
    const t = { ...theme(), chrome: "#b3000e", raised: "#000000", muted: "#ffffff", foreground: "#ffffff", dim: "#ffb8bd", hover: "#00000033", selected: "#000000" };
    const space = spaces().find(p => p.active);
    const shown = space?.tabs ?? [];
    const stop = (_e, cx) => cx.stop_propagation();
    const button = (id, label, action) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop).on_click(action).child(label);
    const item = (c, i) => {
      const program = panes().find(p => p.tab === c.id && p.program?.agent)?.program ?? panes().find(p => p.tab === c.id)?.program;
      const name = /^tb\d+$/.test(c.name) ? program?.name ?? "Terminal" : c.name;
      return h_flex().id(`tab-${c.id}`).relative().h(30).px(18).gap(7).items_center().flex_none().text_size(13).font_weight(800).italic()
        .text_color(c.active ? "#ffffff" : "#ffb8bd")
        .when(c.active, el => el.h(32).px(20)
          .child(div().absolute().top(4).left(5).w_full().h_full().child(this.shadow))
          .child(div().absolute().inset_0().child(this.morph)))
        .when(!c.active, el => el.child(slant("#7a0009")))
        .hover(s => s.text_color("#ffffff"))
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
        .on_mouse_up("left", () => {
          const from = this.pressed; this.pressed = null;
          if (from !== null && from !== i) run("tab.move", { id: shown[from].id, index: space.tabs.findIndex(x => x.id === c.id) + 1 });
          else run("tab.select", { id: c.id });
        })
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: space.id } } }); })
        .when(Boolean(program?.icon), el => el.child(program.tint ? svg(program.icon).size(14).text_color(t.muted) : image(program.icon).size(14)))
        .child(div().max_w(170).truncate().child((c.zoomed ? `${name} Z` : name).toUpperCase()))
        .when(c.status === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(1800)))
        .when(c.status === "blocked" || c.status === "done", el => el.child(div().size(6).rounded(3).bg(t[c.status])))
        .when(c.active, el => el.child(div().id(`close-${c.id}`).text_color("#ffffff").on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: c.id }); }).child(svg("mods/pane/close.svg").size(12))));
    };
    const root = layout(), sidebar = find(root, "sidebar"), w = appWindow();
    // Old saved rails and a dragged-narrow sidebar can be smaller than the window buttons.
    const lightsPadding = w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
      ? Math.max(10, (root.traffic_lights[0] + 64) / settings().zoom - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
      : 10;
    const panel = find(root, "panel"), body = find(root, "panel-body");
    const enabled = shared("workspace.panels") ?? ["files", "changes"];
    this.syncPanel(space, panel, body, enabled);
    const panelButton = (id, label, icon) => {
      const on = panel && !panel.hidden && body?.active === id;
      return h_flex().id(`panel-${id}`).h(26).px(8).gap(5).flex_none().items_center().rounded(6)
        .text_size(12).bg(on ? t.selected : t.chrome).text_color(on ? t.foreground : t.muted)
        .hover(s => s.bg(t.hover)).on_mouse_down("left", stop)
        .on_click(() => {
          if (on) run("layout.hide", { id: "panel" });
          else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
        }).child(svg(icon).size(14)).child(label);
    };
    return h_flex().size_full().min_w(0).px(10).pl(lightsPadding).gap(3).items_center().bg(t.chrome).relative().child(stripes())
      .on_mouse_up("left", () => { this.pressed = null; })
      .on_scroll_wheel(e => { if (Math.abs(e.delta.y) >= 1) run(e.delta.y > 0 ? "tab.prev" : "tab.next"); })
      .child(h_flex().id("tab-scroll").flex_1().min_w(0).h_full().items_center().gap(10).overflow_x_scrollbar().children(shown.map(item)))
      .child(button("tab-new", "+", () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 })))
      .when(enabled.includes("files"), el => el.child(panelButton("files", "Files", "mods/files/file.svg")))
      .when(enabled.includes("changes"), el => el.child(panelButton("changes", "Changes", "mods/changes/changes.svg")))
      .when(w?.buttons, el => el.child(button("minimize", w.platform === "windows" ? svg("mods/tabs/win-min.svg").size(16) : "−", () => run("window.minimize")))
        .child(button("maximize", w.platform === "windows" ? svg(`mods/tabs/${w.maximized ? "win-restore" : "win-max"}.svg`).size(16) : "□", () => run("window.maximize")))
        .child(button("close-window", w.platform === "windows" ? svg("mods/tabs/win-close.svg").size(16) : svg("mods/pane/close.svg").size(13), () => run("window.close"))));
  }
}
