// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "p5-pane" } } } }
// Shows the program's icon (the app's program table), the agent's name or
// the terminal's title, the folder, and the agent's status; buttons split, zoom and close
// this pane. Props from the app: { pane, terminal }. Click: focus the pane.

import { View, div, svg, image, PathBuilder, Background } from "gpui-kit";

const SLAB = PathBuilder.fill().add_polygon([[0, "20%"], ["100%", 0], ["100%", "100%"], [0, "100%"]]).build();
const SLAB_TOP = PathBuilder.stroke(2).move_to(0, "20%").line_to("100%", 0).build();
const TAG_SHAPE = [[0, "14%"], ["96%", 0], ["100%", "86%"], ["3%", "100%"]];
const TAG = PathBuilder.fill().add_polygon(TAG_SHAPE).build();
const SLANT = PathBuilder.fill().add_polygon([[0, 0], ["100%", 0], ["88%", "100%"], [0, "100%"]]).build();
import { h_flex } from "gpui-base";
import { panes, spaces, props, run, theme, home } from "herdr";

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class Pane extends View {
  init() { this.hovered = false; }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .size(26)
      .flex_none()
      .flex()
      .items_center()
      .justify_center()
      .rounded(5)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/pane/${icon}.svg`).size(14));
  }

  render(cx) {
    const t = { ...theme(), raised: "#000000", muted: "#ffffff", foreground: "#ffffff", dim: "#ffb8bd", hover: "#00000033", selected: "#000000" };
    const p = this.me();
    if (!p) return div();
    const name = p.program?.shell ? "terminal" : (p.program && p.program.key !== "program" && p.program.name) || p.title || p.program?.name || "shell";
    const pic = icon(p.program, 14, p.focused ? "#000000" : t.dim);
    const root = spaces().find((space) => space.active)?.folder?.replace(/\/+$/, "");
    const location = root && p.cwd === root ? root.split("/").pop()
      : root && p.cwd?.startsWith(root + "/") ? p.cwd.slice(root.length + 1) : folder(p.cwd);
    const st = p.status;
    const pane = p.pane;
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .min_w(0)
      .pr(10)
      .pt(6)
      .gap(8)
      .items_center()
      .relative()
      .child(window.paint_path(SLAB, p.focused ? "#2a0b10cc" : "#1b1115cc").absolute().inset_0())
      .child(window.paint_path(SLAB, Background.pattern_slash("#00000018", 3, 14)).absolute().inset_0())
      .when(p.focused, el => el.child(window.paint_path(SLAB_TOP, "#e60012").absolute().top(3).left(0).right(0).bottom(-3)).child(window.paint_path(SLAB_TOP, "#ffffff").absolute().inset_0()))
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .child(h_flex().relative().h(24).pl(10).pr(16).gap(6).items_center().flex_none()
        .when(p.focused, el => el.child(window.paint_path(TAG, "#e60012").absolute().top(2).left(2).right(-4).bottom(-3)).child(window.paint_path(TAG, "#ffffff").absolute().inset_0()))
        .when(!p.focused, el => el.child(window.paint_path(SLANT, "#00000055").absolute().inset_0()))
        .when(Boolean(pic), (el) => el.child(pic))
        .child(div().truncate().max_w(140).tooltip(name).font_weight(800).italic().text_size(13).text_color(p.focused ? "#000000" : "#d6b6bc").child(name.toUpperCase())))
      .child(div().flex_1().min_w(0).truncate().text_color("#c9a8af").tooltip(folder(p.cwd)).child(location))
      .when(st === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(1800)))
      .when(st === "blocked", el => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you")))
      .when(st === "done", el => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      .when(this.hovered, el => el
        .child(this.button(t, `ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane })));
  }
}
