import { View, div, PathBuilder } from "gpui-kit";
import { shared } from "herdr";

const STEP = 300;
const pull = (now, i) => {
  const n = Math.sin((Math.floor(now / STEP) * 8 + i) * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};
const quad = (now) => [
  [`${2 + pull(now, 0)}%`, `${6 + 2 * pull(now, 1)}%`],
  [`${97 - pull(now, 2)}%`, `${2 * pull(now, 3)}%`],
  [`${100 - pull(now, 4)}%`, `${91 - 2 * pull(now, 5)}%`],
  [`${pull(now, 6)}%`, `${100 - 2 * pull(now, 7)}%`],
];
const paint = (points, color) => globalThis.window
  .paint_path(PathBuilder.fill().add_polygon(points).build(), color)
  .absolute().inset_0();

export class Frame extends View {
  init(_props, cx) {
    this.tick(cx);
  }

  tick(cx) {
    cx.timer.after(STEP - Date.now() % STEP + 10, (cx) => {
      if (shared("p5.motion") !== false || !this.still) cx.notify();
      this.tick(cx);
    });
  }

  render() {
    this.still = shared("p5.motion") === false;
    const now = this.still ? 0 : Date.now();
    const main = quad(now);
    return div().relative().size_full().p(16)
      .child(div().absolute().top(10).left(6).right(26).bottom(22).child(paint(quad(this.still ? 0 : now - STEP * 3), "#00e5ffb3")))
      .child(div().absolute().top(24).left(26).right(4).bottom(5).child(paint(quad(this.still ? 0 : now - STEP * 6), "#ff1a8cb3")))
      .child(div().relative().size_full()
        .child(paint(main, "#ffffff"))
        .child(div().absolute().inset(5).child(paint(main, "#080808"))));
  }
}
