import { View, div, svg, PathBuilder, Background } from "gpui-kit";

const STRIPES_FULL = PathBuilder.fill().add_polygon([[0, 0], ["100%", 0], ["100%", "100%"], [0, "100%"]]).build();
const stripes = () => globalThis.window.paint_path(STRIPES_FULL, Background.pattern_slash("#00000020", 3, 14)).absolute().inset_0();

// This bar's red fill torn along its top edge, with paper showing at the tear.
function tornBar(el, color) {
  const tear = barTear(layout(), "status", globalThis.window.viewport_size().width, "top");
  if (!tear) return el.bg(color).child(stripes());
  const fill = PathBuilder.fill().add_polygon(tear.fill).build();
  return el
    .child(globalThis.window.paint_path(fill, color).absolute().inset_0())
    .child(globalThis.window.paint_path(fill, Background.pattern_slash("#00000020", 3, 14)).absolute().inset_0())
    .child(globalThis.window.paint_path(PathBuilder.fill().add_polygon(tear.rim).build(), "#ffffff").absolute().inset_0());
}
const TILT_A_SHAPE = [[0, "14%"], ["97%", 0], ["100%", "86%"], ["4%", "100%"]];
const TILT_A = PathBuilder.fill().add_polygon(TILT_A_SHAPE).build();
const TILT_B = PathBuilder.fill().add_polygon([["3%", 0], ["100%", "12%"], ["96%", "100%"], [0, "88%"]]).build();
import { h_flex } from "gpui-base";
import { barTear } from "./torn.js";
import { spaces, agents, theme, run, window, shared, setShared, layout } from "herdr";

export default class WorkspaceStatus extends View {
  render() {
    const t = theme();
    const space = spaces().find(s => s.active);
    const list = agents();
    const needs = list.filter(a => a.status === "blocked").length;
    // Opaque, over a hard offset shadow, so chips sit on top of the torn bar rather than in it.
    const chip = (shape, fill, ink, shadow = "#000000") => h_flex().relative().h(22).px(12).gap(6).items_center().text_color(ink)
      .child(globalThis.window.paint_path(shape, shadow).absolute().top(3).left(3).w_full().h_full())
      .child(globalThis.window.paint_path(shape, fill).absolute().inset_0());
    const label = (icon, text, shape, fill = "#5c0008", ink = "#e6c7cb") => chip(shape, fill, ink)
      .child(svg(`mods/workspace-chrome/${icon}.svg`).size(13)).child(String(text).toUpperCase());
    const mod = window()?.platform === "macos" ? "⌘" : "CTRL";
    const motion = shared("p5.motion") !== false;
    return tornBar(h_flex().size_full().px(12).gap(8).items_center().relative(), "#93000be6").text_size(11.5).font_weight(700).italic().text_color("#ffffff")
      .child(label(space?.machine ? "server" : "monitor", space?.machine ?? "This computer", TILT_A))
      .when(Boolean(space?.branch), el => el.child(label("branch", space.branch, TILT_B)))
      .child(h_flex().relative().h(24).pl(12).pr(18).gap(5).items_end()
        .child(globalThis.window.paint_path(TILT_A, "#e60012").absolute().top(3).left(3).w_full().h_full())
        .child(globalThis.window.paint_path(TILT_A, "#000000").absolute().inset_0())
        .child(div().text_size(10).text_color("#ffffff").child("AGENTS"))
        .child(div().text_size(15).line_height(1).text_color("#5ef2ff").child(String(list.length)))
        .when(needs > 0, el => el.child(div().text_size(15).line_height(1).text_color("#ff5fb4").child(`/${needs}`))))
      .when(needs > 0, el => el.child(label("circle-check", `${needs} needs you!`, TILT_B, "#ffd400", "#000000")))
      .child(div().flex_1())
      .child(h_flex().id("motion").mr(12).gap(6).items_center().cursor_pointer().on_click(() => setShared("p5.motion", !motion))
        .child(chip(TILT_B, motion ? "#a82a35" : "#5c0008", motion ? "#ffffff" : "#c9a8af").px(8).child(motion ? "ON" : "OFF"))
        .child(div().text_color("#ffffff").child("ANIMATION")))
      .child(h_flex().id("palette").gap(6).items_center().cursor_pointer().on_click(() => run("app.palette"))
        .child(chip(TILT_B, "#a82a35", "#ffffff").px(8).child(`${mod} ⇧ P`))
        .child(div().text_color("#ffffff").child("COMMANDS")));
  }
}
