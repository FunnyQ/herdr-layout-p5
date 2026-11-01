import { View, div, image, svg, PathBuilder, Background } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, run, props, window, shared, setShared, updates, layout } from "herdr";

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
const TILT = [[0, "14%"], ["100%", 0], ["95%", "100%"], ["2%", "86%"]];
const TAG = PathBuilder.fill().add_polygon(TILT).build();
const TAG_EDGE = PathBuilder.stroke(2).add_polygon(TILT, true).build();
const ransom = (label, ink, size) => h_flex().items_end().italic().font_weight(900).text_color(ink)
  .child(div().text_size(size * 1.45).line_height(1).child(label[0]))
  .child(div().text_size(size).line_height(1.1).child(label.slice(1)));
const tag = (label) => h_flex().relative().h(30).pl(12).pr(24).items_center()
  .child(globalThis.window.paint_path(TAG, "#e60012").absolute().top(4).left(6).right(-6).bottom(-4))
  .child(globalThis.window.paint_path(TAG, "#000000").absolute().inset_0())
  .child(globalThis.window.paint_path(TAG_EDGE, "#ffffff").absolute().inset_0())
  .child(ransom(label, "#ffffff", 16));
const FOOTER = PathBuilder.fill().add_polygon([[0, "22%"], ["100%", 0], ["100%", "100%"], [0, "100%"]]).build();
const stripes = () => globalThis.window.paint_path(FULL, Background.pattern_slash("#00000040", 3, 14)).absolute().inset_0();

export default class WorkspaceChrome extends View {
  button(id, label, action) {
    const t = theme();
    return div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action).child(label);
  }
  render() {
    const t = { ...theme(), chrome: "#b3000ecc", foreground: "#ffffff", muted: "#ffffff", dim: "#ffb8bd", hover: "#00000033" };
    const collapsed = narrow();
    if (props()?.footer) {
      const row = (id, icon, label, dim, action) => h_flex().id(id).h(28).px(8).gap(9).items_center().font_weight(800).italic()
        .text_color(dim ? t.dim : t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
        .on_click(action).child(svg(`mods/workspace-chrome/${icon}.svg`).size(14))
        .when(!collapsed, el => el.child(label.toUpperCase()));
      return v_flex().size_full().relative().bg(t.chrome).child(stripes()).child(globalThis.window.paint_path(FOOTER, "#000000").absolute().inset_0()).px(8).pt(26).pb(10).text_size(13)
        .child(row("settings", "settings", "Settings", false, () => run("app.settings"))
          .when(Boolean(updates().app.ready), el => el.child(div().size(6).rounded_full().bg("#ffffff"))))
        .child(row("machine", "plus", "Add machine", true, () => run("mod.open", { name: "machine-add" })));
    }
    return h_flex().size_full().relative().bg(t.chrome).child(stripes()).pl(collapsed ? 6 : 14).pr(10).gap(4).items_center().text_size(13.5)
      .when(window()?.platform === "macos" && !collapsed, el => el.pl(76))
      .when(!collapsed, el => el.child(h_flex().flex_1().gap(8).items_center().child(image("frame/welcome/herdr.png").size(20).rounded(5)).child(tag("HERDR"))))
      .when(!collapsed, el => el.child(this.button("search", svg("mods/workspace-chrome/search.svg").size(15), () => run("mod.open", { name: "picker" }))))
      // On the macOS rail the traffic lights fill the row; the agents list's » unfolds it.
      .when(!(collapsed && window()?.platform === "macos"), el => el.child(this.button("sidebar-toggle", svg("mods/workspace-chrome/sidebar.svg").size(15), toggleSidebar)));
  }
}
