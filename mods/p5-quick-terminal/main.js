import { View, div, svg, image, PathBuilder } from "gpui-kit";
import { props, spaces, panes, run, shared, setShared } from "herdr";

const QUAD = [
  ["2%", "4%"],
  ["96%", 0],
  ["100%", "96%"],
  ["3%", "100%"],
];
const FILL = PathBuilder.fill().add_polygon(QUAD).build();
const OUTLINE = PathBuilder.stroke(3).add_polygon(QUAD, true).build();

export default class QuickTerminalHeader extends View {
  outline(frame, part) {
    const x = part === "right" ? frame.width - frame.side : 0;
    const y =
      part === "bottom" ? frame.height - frame.bottom : part ? frame.top : 0;
    return div()
      .size_full()
      .relative()
      .child(
        window
          .paint_path(FILL, "#000000cc")
          .absolute()
          .w(frame.width - 10)
          .h(frame.height - 10)
          .left(3 - x)
          .top(3 - y),
      )
      .child(
        window
          .paint_path(OUTLINE, "#e60012")
          .absolute()
          .w(frame.width - 10)
          .h(frame.height - 10)
          .left(7 - x)
          .top(7 - y),
      )
      .child(
        window
          .paint_path(OUTLINE, "#ffffff")
          .absolute()
          .w(frame.width - 10)
          .h(frame.height - 10)
          .left(3 - x)
          .top(3 - y),
      );
  }

  render() {
    const { frame, part } = props() ?? {};
    if (!frame) return div();
    if (part) return this.outline(frame, part);
    return div()
      .size_full()
      .relative()
      .child(this.outline(frame).absolute().inset_0())
      .child(
        image("mods/p5-quick-terminal/title-shadow.png")
          .w(196)
          .h(196 / 3)
          .absolute()
          .left(3)
          .top(3),
      )
      .child(
        image("mods/p5-quick-terminal/title.png")
          .w(196)
          .h(196 / 3)
          .absolute()
          .left(0)
          .top(0),
      )
      .child(
        div()
          .id("quick-terminal-hide")
          .size(26)
          .absolute()
          .right(frame.side)
          .top(28)
          .flex()
          .items_center()
          .justify_center()
          .rounded(5)
          .text_color("#ffb8bd")
          .hover((s) => s.bg("#00000033").text_color("#ffffff"))
          .tooltip("Hide terminal (Ctrl+`)")
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click(() => run("p5-chrome.quick-terminal"))
          .child(svg("mods/pane/close.svg").size(14)),
      );
  }

  close() {
    if (props()?.part) return;
    const visible = shared("p5.quick-terminal.visible");
    if (!visible || visible.id !== props()?.overlay) return;
    setShared("p5.quick-terminal.visible", null);
    const space = spaces().find((s) => s.active);
    if (
      space &&
      `${space.machine ?? "local"}:${space.id}` === visible.space &&
      panes().some((p) => p.pane === visible.returnPane)
    )
      run("pane.focus", { pane: visible.returnPane });
  }
}
