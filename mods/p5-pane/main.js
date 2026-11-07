// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "p5-pane" } } } }
// Shows the program's icon (the app's program table), the agent's name or
// the terminal's title, the folder, and the agent's status; buttons split, zoom, pop out and close
// this pane. Props from the app: { pane, terminal }. Click: focus the pane.

import { View, div, svg, image, PathBuilder, Background } from "gpui-kit";
import { tearLine, tornShape } from "./torn.js";

// The header's top edge: a slant down to the left, torn. Laid out over SPAN units stretched to the pane's width.
const HEADER_HEIGHT = 36; // layouts/persona5.json, pane.header.height
const SLANT_DROP = 0.2 * HEADER_HEIGHT;
const SPAN = 600;
const LINE = tearLine(0, SPAN, 4, [], 3);
const TEAR = LINE.map(([x, d]) => [
  `${(x / SPAN) * 100}%`,
  SLANT_DROP * (1 - x / SPAN) + d,
]);
const SLAB = PathBuilder.fill()
  .add_polygon([...TEAR, ["100%", "100%"], [0, "100%"]])
  .build();
// The focused header looks like the tab bar: its fill starts a rim's width below the tear, with paper showing in between.
// Laid out in SPAN units, so the shade cuts are 45 degrees only on a 600px pane, flatter on a wider one; PaneInfo has no width.
const FOCUSED = tornShape(
  LINE.map(([x, , r, shade], i) => [x, TEAR[i][1] + r, TEAR[i][1], shade]),
  SPAN,
  HEADER_HEIGHT,
  "top",
);
const stretch = (polygon) =>
  polygon.map(([x, y]) => [`${(x / SPAN) * 100}%`, y]);
const FOCUSED_SLAB = PathBuilder.fill()
  .add_polygon(stretch(FOCUSED.fill))
  .build();
const SLAB_RIMS = FOCUSED.rims.map(({ color, polygons }) => [
  polygons
    .reduce((b, p) => b.add_polygon(stretch(p)), PathBuilder.fill())
    .build(),
  color,
]);
const TAG_SHAPE = [
  [0, "14%"],
  ["96%", 0],
  ["100%", "86%"],
  ["3%", "100%"],
];
const TAG = PathBuilder.fill().add_polygon(TAG_SHAPE).build();
const SLANT = PathBuilder.fill().add_polygon([[0, 0], ["100%", 0], ["88%", "100%"], [0, "100%"]]).build();
import { h_flex } from "gpui-base";
import { panes, spaces, props, run, exec, theme, home } from "herdr";

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

// Ghostty's AppleScript opens the window inside one running Ghostty; open -a drops --args once Ghostty runs.
const GHOSTTY_ATTACH = `on run argv
  tell application "Ghostty"
    set cfg to new surface configuration
    set command of cfg to (quoted form of item 1 of argv) & " attach " & (quoted form of item 2 of argv)
    new window with configuration cfg
    activate
  end tell
end run`;

export default class Pane extends View {
  // Ghostty's command may not get the login shell's PATH, so hc goes in by absolute path.
  init() {
    this.hovered = false;
    exec("which", ["hc"]).then((r) => {
      this.hcPath = r.stdout.trim();
    });
  }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  popOut(terminal) {
    if (!this.hcPath) return;
    exec("osascript", ["-e", GHOSTTY_ATTACH, this.hcPath, terminal]);
    // app.hide answers ok but does nothing in Herdr 0.1.13; switch back to run("app.hide") once it hides.
    exec("osascript", [
      "-e",
      'tell application "System Events" to set visible of process "Herdr" to false',
    ]);
  }

  button(t, id, icon, onClick) {
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
        onClick();
      })
      .child(svg(icon).size(14));
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
      .when(p.focused, (el) =>
        el
          .child(
            window.paint_path(FOCUSED_SLAB, "#0d0d0def").absolute().inset_0(),
          )
          .child(
            window
              .paint_path(
                FOCUSED_SLAB,
                Background.pattern_slash("#00000020", 3, 14),
              )
              .absolute()
              .inset_0(),
          )
          .children(
            SLAB_RIMS.map(([rim, color]) =>
              window.paint_path(rim, color).absolute().inset_0(),
            ),
          ),
      )
      .when(!p.focused, (el) =>
        el
          .child(window.paint_path(SLAB, "#0d0d0def").absolute().inset_0())
          .child(
            window
              .paint_path(SLAB, Background.pattern_slash("#00000018", 3, 14))
              .absolute()
              .inset_0(),
          ),
      )
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .child(
        h_flex()
          .relative()
          .h(24)
          .pl(10)
          .pr(16)
          .gap(6)
          .items_center()
          .flex_none()
          .when(p.focused, (el) =>
            el
              .child(
                window
                  .paint_path(TAG, "#e60012")
                  .absolute()
                  .top(2)
                  .left(2)
                  .right(-4)
                  .bottom(-3),
              )
              .child(window.paint_path(TAG, "#ffffff").absolute().inset_0()),
          )
          .when(!p.focused, (el) =>
            el.child(
              window.paint_path(SLANT, "#00000055").absolute().inset_0(),
            ),
          )
          .when(Boolean(pic), (el) => el.child(pic))
          .child(
            div()
              .truncate()
              .max_w(140)
              .tooltip(name)
              .font_weight(800)
              .italic()
              .text_size(13)
              .text_color(p.focused ? "#000000" : "#d6b6bc")
              .child(name.toUpperCase()),
          ),
      )
      .child(
        div()
          .flex_1()
          .min_w(0)
          .truncate()
          .text_color("#c9a8af")
          .tooltip(folder(p.cwd))
          .child(location),
      )
      .when(st === "working", (el) =>
        el.child(
          svg("mods/workspace-chrome/spinner.svg")
            .size(12)
            .flex_none()
            .text_color(t.working)
            .spin(1800),
        ),
      )
      .when(st === "blocked", (el) =>
        el.child(
          div()
            .flex_none()
            .px(6)
            .h(18)
            .flex()
            .items_center()
            .rounded(5)
            .bg(t.blocked + "26")
            .text_size(10.5)
            .font_semibold()
            .text_color(t.blocked)
            .child("Needs you"),
        ),
      )
      .when(st === "done", (el) =>
        el.child(div().size(7).flex_none().rounded(4).bg(t.done)),
      )
      .when(this.hovered, (el) =>
        el
          .child(
            this.button(t, `ph-r-${pane}`, "mods/pane/split-right.svg", () =>
              run("pane.split", { direction: "right", pane }),
            ),
          )
          .child(
            this.button(t, `ph-d-${pane}`, "mods/pane/split-down.svg", () =>
              run("pane.split", { direction: "down", pane }),
            ),
          )
          .child(
            this.button(
              t,
              `ph-z-${pane}`,
              `mods/pane/${p.zoomed ? "unzoom" : "zoom"}.svg`,
              () => run("pane.zoom", { pane }),
            ),
          )
          .child(
            this.button(t, `ph-o-${pane}`, "mods/p5-pane/pop-out.svg", () =>
              this.popOut(props().terminal),
            ),
          )
          .child(
            this.button(t, `ph-x-${pane}`, "mods/pane/close.svg", () =>
              run("pane.close", { pane }),
            ),
          ),
      );
  }
}
