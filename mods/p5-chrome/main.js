import { View, div, svg, PathBuilder, Background } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, run, props, window, shared, setShared, updates, layout, nextCommand, notify } from "herdr";
import * as herdr from "herdr";
import { QuickTerminal } from "./quick-terminal.js";
import { sidebarTear, PAPER } from "./torn.js";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// To the rail (on macOS wide enough for the traffic lights), or back to the width it had.
function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  // Mods edited before the rail went by width still read the flag.
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? 268) : window()?.platform === "macos" ? 76 : 44 });
}

const FULL = PathBuilder.fill().add_polygon([[0, 0], ["100%", 0], ["100%", "100%"], [0, "100%"]]).build();
const FOOTER = PathBuilder.fill().add_polygon([[0, "22%"], ["100%", 0], ["100%", "100%"], [0, "100%"]]).build();
const stripes = (path = FULL) => globalThis.window.paint_path(path, Background.pattern_slash("#00000020", 3, 14)).absolute().inset_0();

// Paints `color` over a torn fill with paper showing at the tear, or untorn without a tear.
function paintTear(el, tear, color) {
  if (!tear) return el.bg(color).child(stripes());
  const fill = PathBuilder.fill().add_polygon(tear.fill).build();
  return el
    .child(globalThis.window.paint_path(fill, color).absolute().inset_0())
    .child(stripes(fill))
    .child(globalThis.window.paint_path(PathBuilder.fill().add_polygon(tear.rim).build(), PAPER).absolute().inset_0());
}

export default class WorkspaceChrome extends View {
  init(_props, cx) {
    if (props()?.footer) return;
    this.quick = new QuickTerminal(herdr, () => globalThis.window.viewport_size());
    this.quick.hide(false);
    cx.spawn(async (cx) => {
      for (;;) {
        const command = await nextCommand();
        if (command !== "quick-terminal" && command !== "adopt-quick-terminal") continue;
        try {
          if (command === "adopt-quick-terminal") this.quick.adopt();
          else await this.quick.toggle();
        } catch (error) {
          notify({ title: "Quick terminal", body: String(error.message ?? error), level: "error" });
        }
        cx.notify();
      }
    });
  }

  close() {
    this.quick?.hide(false);
  }

  button(id, label, action) {
    const t = theme();
    return div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action).child(label);
  }
  render() {
    this.quick?.sync();
    const t = { ...theme(), chrome: "#93000be6", foreground: "#ffffff", muted: "#ffffff", dim: "#ffb8bd", hover: "#00000033" };
    const collapsed = narrow();
    if (props()?.footer) {
      const row = (id, icon, label, dim, action) => h_flex().id(id).h(28).px(8).gap(9).items_center().font_weight(800).italic()
        .text_color(dim ? t.dim : t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
        .on_click(action).child(svg(`mods/workspace-chrome/${icon}.svg`).size(14))
        .when(!collapsed, el => el.child(label.toUpperCase()));
      const tear = sidebarTear(layout(), "sidebar-footer", globalThis.window.viewport_size().height);
      const ink = tear ? PathBuilder.fill().add_polygon([[0, "22%"], ...tear.fill.slice(1)]).build() : FOOTER;
      return paintTear(v_flex().size_full().relative(), tear, t.chrome).child(globalThis.window.paint_path(ink, "#000000").absolute().inset_0()).px(8).pt(26).pb(10).text_size(13)
        .child(row("settings", "settings", "Settings", false, () => run("app.settings"))
          .when(Boolean(updates().app.ready), el => el.child(div().size(6).rounded_full().bg("#ffffff"))))
        .child(row("machine", "plus", "Add machine", true, () => run("mod.open", { name: "machine-add" })));
    }
    return paintTear(h_flex().size_full().relative(), sidebarTear(layout(), "brand", globalThis.window.viewport_size().height), t.chrome).pl(collapsed ? 6 : 14).pr(10).gap(4).items_center().text_size(13.5)
      .when(window()?.platform === "macos" && !collapsed, el => el.pl(76))
      .when(!collapsed, el => el.child(div().flex_1()))
      .when(!collapsed, el => el.child(this.button("quick-terminal", svg("mods/workspace-chrome/monitor.svg").size(15), () => run("p5-chrome.quick-terminal")).tooltip("Terminal (Ctrl+`)")))
      .when(!collapsed, el => el.child(this.button("search", svg("mods/workspace-chrome/search.svg").size(15), () => run("mod.open", { name: "picker" }))))
      // On the macOS rail the traffic lights fill the row; the agents list's » unfolds it.
      .when(!(collapsed && window()?.platform === "macos"), el => el.child(this.button("sidebar-toggle", svg("mods/workspace-chrome/sidebar.svg").size(15), toggleSidebar)));
  }
}
