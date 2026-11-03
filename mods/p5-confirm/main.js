import { View, div, PathBuilder, Background } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay } from "herdr";
import { Frame } from "./frame.js";
import { sprite } from "./sprite.js";

const BUTTON = [["7%", 0], ["100%", "6%"], ["93%", "100%"], [0, "90%"]];
const shape = (points, color, stroke = 0) => globalThis.window
  .paint_path((stroke ? PathBuilder.stroke(stroke) : PathBuilder.fill()).add_polygon(points, true).build(), color)
  .absolute().inset_0();

export default class Confirm extends View {
  init(_props, cx) {
    this.frame = cx.new(Frame, {});
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.closed = false;
  }

  cancel() {
    this.closed = true;
    closeOverlay(props().overlay);
  }

  yes() {
    if (this.closed) return;
    const command = props().command;
    this.cancel();
    if (command) run(command.name, command.args ?? {});
  }

  render() {
    const p = props() ?? {};
    const button = (id, label, key, primary, click) => h_flex()
      .id(id).relative().w(primary ? 188 : 150).h(48).justify_center().items_center().gap(12)
      .cursor_pointer().text_color(primary ? "#ffffff" : "#000000")
      .hover((s) => s.opacity(0.8)).on_click(click)
      .child(shape(BUTTON, primary ? "#e60012" : "#ffffff"))
      .when(primary, (el) => el.child(shape(BUTTON, "#ffffff", 2)))
      .child(div().relative().text_size(21).font_weight(900).italic().child(label))
      .child(div().relative().text_size(10).font_weight(700).child(key));
    return div().id("p5-confirm").relative().size_full().p(16).pl(36).pt(76)
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "enter") this.yes();
        else if (e.key === "escape") this.cancel();
        else return;
        cx.stop_propagation();
      })
      .child(div().absolute().top(48).left(20).right(0).bottom(0).child(this.frame))
      .child(div().relative().size_full()
        .child(v_flex().relative().size_full().px(32).pt(28).pb(22).gap(12)
          .child(h_flex().items_center().justify_end()
            .child(div().text_size(10).text_color("#8b8b8b").child("ESC / CANCEL")))
          .child(div().text_size(22).line_height(1.05).font_weight(900).italic().text_color("#ffffff").child((p.title ?? "Close space?").toUpperCase()))
          .child(div().flex_1().min_h(0).overflow_y_scrollbar().text_size(14).text_color("#d5d5d5").child(p.detail ?? "herdr-layout-p5 — 1 tab, 2 terminals"))
          .child(div().relative().h(3).w_full().child(shape([[0, 0], ["100%", 0], ["100%", "100%"], [0, "100%"]], Background.pattern_slash("#e60012", 3, 7))))
          .child(div().text_size(10).font_weight(700).text_color("#ffb8bd").child(p.command ? "THIS ENDS THE TERMINALS IN THIS SPACE." : "PREVIEW / NO TERMINALS WILL BE CLOSED."))
          .child(h_flex().justify_end().gap(12)
            .child(button("cancel", "CANCEL", "ESC", false, () => this.cancel()))
            .child(button("confirm", "CONFIRM", "ENTER", true, () => this.yes())))))
      .child(sprite("confirm", 260).absolute().left(0).top(0));
  }
}
