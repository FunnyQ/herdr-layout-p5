import { View, div, svg, image, PathBuilder } from "gpui-kit";
import { props, spaces, panes, run, shared, setShared } from "herdr";

// The frame's slab steps to a new pose every MORPH_STEP ms, each corner pulled up to PULL px inward.
const MORPH_STEP = 300;
const PULL = 6;
const noise = (k) => {
  const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const pull = (now, i) => PULL * noise(Math.floor(now / MORPH_STEP) * 8 + i);
const SLAB = 9;
// How far a corner may slant in before the slab's edge, pulled and stroked, reaches the terminal.
const room = (margin) => margin - SLAB - PULL - 4;
const quad = (w, h, now, frame) => [
  [
    Math.min(0.02 * w, room(frame.side)) + pull(now, 0),
    Math.min(0.04 * h, room(frame.top)) + pull(now, 1),
  ],
  [w - Math.min(0.04 * w, room(frame.side)) - pull(now, 2), pull(now, 3)],
  [w - pull(now, 4), h - Math.min(0.04 * h, room(frame.bottom)) - pull(now, 5)],
  [Math.min(0.03 * w, room(frame.side)) + pull(now, 6), h - pull(now, 7)],
];
const SHADOWS = [
  { color: "#ff1a8cb3", lag: 6, x: 8, y: 6 },
  { color: "#00e5ffb3", lag: 3, x: -6, y: -5 },
];

export default class QuickTerminalHeader extends View {
  init(_props, cx) {
    this.tick(cx);
  }

  // Each frame part redraws just past the same step boundary, so all four show one pose.
  tick(cx) {
    cx.timer.after(MORPH_STEP - (Date.now() % MORPH_STEP) + 10, (cx) => {
      if (shared("p5.motion") !== false || !this.still) cx.notify();
      this.tick(cx);
    });
  }

  outline(frame, part) {
    const x = part === "right" ? frame.width - frame.side : 0;
    const y =
      part === "bottom" ? frame.height - frame.bottom : part ? frame.top : 0;
    this.still = shared("p5.motion") === false;
    const now = this.still ? 0 : Date.now();
    const w = frame.width - SLAB * 2 - 2;
    const h = frame.height - SLAB * 2 - 2;
    const shape = quad(w, h, now, frame);
    const paint = (path, color, dx = 0, dy = 0) =>
      window
        .paint_path(path, color)
        .absolute()
        .w(w)
        .h(h)
        .left(SLAB + dx - x)
        .top(SLAB + dy - y);
    const fill = (shape) => PathBuilder.fill().add_polygon(shape).build();
    const line = (shape) =>
      PathBuilder.stroke(3).add_polygon(shape, true).build();
    return div()
      .size_full()
      .relative()
      .children(
        SHADOWS.map((s) =>
          paint(
            fill(quad(w, h, this.still ? 0 : now - MORPH_STEP * s.lag, frame)),
            s.color,
            s.x,
            s.y,
          ),
        ),
      )
      .child(paint(fill(shape), "#000000"))
      .child(paint(line(shape), "#ffffff"));
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
