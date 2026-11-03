// Agents in grouped or priority views; parents take their most urgent sub-agent's place.
// A viewed done agent stays in Done until left.

import { PathBuilder, Background, View, div, image, svg } from "gpui-kit";
import { sprite } from "./sprite.js";
import { v_flex, h_flex } from "gpui-base";
import { sidebarTear, noise } from "./torn.js";
import {
  agents,
  terminals,
  panes,
  focused,
  spaces,
  run,
  theme,
  shared,
  setShared,
  setAgentOrder,
  openOverlay,
  closeOverlay,
  props,
  window,
  layout,
} from "herdr";
import { startSp, sp as spLeft } from "./sp.js";

const p5 = () => true;
const P5_COLORS = {
  chrome: "#93000be6",
  foreground: "#ffffff",
  muted: "#ffd6d9",
  dim: "#ffb8bd",
  hover: "#00000033",
  selected: "#000000",
  raised: "#00000055",
  border: "#000000",
  working: "#ffd400",
  done: "#ffffff",
  blocked: "#000000",
  popover: "#000000",
};
const FULL = PathBuilder.fill()
  .add_polygon([
    [0, 0],
    ["100%", 0],
    ["100%", "100%"],
    [0, "100%"],
  ])
  .build();
const stripes = (path = FULL) =>
  globalThis.window
    .paint_path(path, Background.pattern_slash("#00000020", 3, 14))
    .absolute()
    .inset_0();

// Paints `color` over a torn fill with paper showing at the tear, or untorn without a tear.
function paintTear(el, tear, color) {
  if (!tear) return el.bg(color).child(stripes());
  const fill = PathBuilder.fill().add_polygon(tear.fill).build();
  return el
    .child(globalThis.window.paint_path(fill, color).absolute().inset_0())
    .child(stripes(fill))
    .children(tear.rims.map(({ color, polygons }) => globalThis.window.paint_path(polygons.reduce((b, p) => b.add_polygon(p), PathBuilder.fill()).build(), color).absolute().inset_0()));
}
// prompt cache lifetime after the last turn; 5 min on default Claude Code, 1 h on plans with the extended TTL
const CACHE_TTL = 60 * 60000;
const CARD_SHAPE = [
  [0, "10%"],
  ["96%", 0],
  ["100%", "88%"],
  ["3%", "100%"],
];
const CARD = PathBuilder.fill().add_polygon(CARD_SHAPE).build();
const SLANT = PathBuilder.fill()
  .add_polygon([
    [0, "14%"],
    ["97%", 0],
    ["100%", "84%"],
    ["4%", "100%"],
  ])
  .build();
const ARROW = PathBuilder.fill()
  .add_polygon([
    [0, 0],
    ["100%", "50%"],
    [0, "100%"],
  ])
  .build();

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
  run("layout.resize", {
    id: "sidebar",
    px: narrow()
      ? (shared("sidebar.width") ?? 268)
      : window()?.platform === "macos"
        ? 76
        : 44,
  });
}

const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

function lead(tab, all = panes()) {
  const mine = all.filter((p) => p.tab === tab.id && p.terminal);
  return (
    mine.find((p) => p.program?.agent) ?? mine.find((p) => p.focused) ?? mine[0]
  );
}

function title(tab, l) {
  const prog = l?.program?.name;
  const live = clean(l?.title);
  const telling =
    live &&
    live !== prog &&
    !/^[~/]|^[A-Za-z]:\\/.test(live) &&
    !live.includes("@") &&
    live.toLowerCase() !== l?.program?.key;
  return tab.name === prog && telling ? live : tab.name;
}
const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
// A sub-agent without a pane isn't in agents(): its raw word, error counting as
// blocked. It's never done: it reports to its parent, and the parent's done is the news.
const kidStatus = (k, listed) => {
  const s = listed.get(k.address) ?? k.status;
  return s === "error" ? "blocked" : s === "done" ? "idle" : s;
};
const SORTS = [
  { id: "priority", label: "Priority", icon: "clock" },
  { id: "grouped", label: "Grouped by space", icon: "layers" },
];
const sortOf = () =>
  SORTS.find((s) => s.id === shared("agents.sort")) ?? SORTS[0];
const SECTION = { 4: "Needs you", 3: "Done", 2: "Working", 1: "Idle" };
const SECTION_STATUS = { 4: "blocked", 3: "done", 2: "working" };

function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// The agent's icon from the app's program table: a one-color glyph or a picture.
function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint
    ? svg(p.icon).size(size).flex_none().text_color(color)
    : image(p.icon).w(size).h(size).flex_none();
}

const PORTRAITS = new Set(["claude", "codex", "opencode"]);
const portrait = (p, size) =>
  PORTRAITS.has(p?.key)
    ? image(`mods/p5-agents/portraits/${p.key}.png`).w(size).h(size).flex_none()
    : icon(p, size, "#ffffff");

// The selected card's slabs: each corner drifts up to about 5px inward, out of
// step with the others. Their own views, so a frame rebuilds only them.
const MORPH_STEP = 300;
// Step motion: a new pose every MORPH_STEP ms, no in-between. Each corner's pull is a hash of the pose number.
const pull = (now, i) => noise(Math.floor(now / MORPH_STEP) * 8 + i);
const morphed = (now) => [
  [`${2 * pull(now, 0)}%`, 8 + 5 * pull(now, 1)],
  [`${96 - 2 * pull(now, 2)}%`, 5 * pull(now, 3)],
  [`${100 - 2 * pull(now, 4)}%`, 74 - 5 * pull(now, 5)],
  [`${3 + 2 * pull(now, 6)}%`, 84 - 5 * pull(now, 7)],
];

// The selected slab: black with a white edge, a cyan and a magenta shadow lagging behind it.
const SHADOWS = [
  { color: "#ff1a8cb3", lag: 6, x: 10, y: 6 },
  { color: "#00e5ffb3", lag: 3, x: -8, y: -5 },
];

class Morph extends View {
  init(_props, cx) {
    cx.timer.every(MORPH_STEP, (cx) => {
      if (shared("p5.motion") !== false || !this.still) cx.notify();
    });
  }

  render() {
    this.still = shared("p5.motion") === false;
    const now = this.still ? 0 : Date.now();
    const shape = morphed(now);
    const fill = (shape, color) =>
      globalThis.window
        .paint_path(PathBuilder.fill().add_polygon(shape).build(), color)
        .absolute()
        .inset_0();
    return div()
      .size_full()
      .relative()
      .children(
        SHADOWS.map((s) =>
          div()
            .absolute()
            .left(s.x)
            .top(s.y)
            .size_full()
            .child(
              fill(morphed(this.still ? 0 : now - MORPH_STEP * s.lag), s.color),
            ),
        ),
      )
      .child(fill(shape, "#000000"))
      .child(
        globalThis.window
          .paint_path(
            PathBuilder.stroke(2).add_polygon(shape, true).build(),
            "#ffffff",
          )
          .absolute()
          .inset_0(),
      );
  }
}

export default class Agents extends View {
  init(_props, cx) {
    if (props()?.sortMenu) return;
    this.folded = new Set();
    // Each agent's last state and when it changed (ms), kept across restarts.
    this.changed = JSON.parse(localStorage.getItem("changed") ?? "{}");
    this.pins = JSON.parse(localStorage.getItem("pins") ?? "[]");
    this.morph = cx.new(Morph, {});
    cx.timer.every(30000, (cx) => cx.notify());
    startSp(cx);
  }

  // Stamps agents whose state changed. Done and idle count as one: looking at a
  // finished agent turns done into idle, and looking isn't the agent doing anything.
  track(list, now) {
    let dirty = false;
    for (const a of list) {
      const s = a.status === "done" ? "idle" : a.status;
      if (this.changed[a.address]?.s === s) continue;
      this.changed[a.address] = { s, at: now };
      dirty = true;
    }
    if (!dirty) return;
    // Gone and old: the list alone is empty right after a start.
    const listed = new Set(list.map((a) => a.address));
    for (const [k, c] of Object.entries(this.changed))
      if (!listed.has(k) && now - c.at > 30 * 86400000) delete this.changed[k];
    localStorage.setItem("changed", JSON.stringify(this.changed));
  }

  setPins(pins) {
    this.pins = pins;
    localStorage.setItem("pins", JSON.stringify(pins));
  }

  // Drops pins of agents that ended. Only for machines the list has heard from:
  // right after a start, or while a machine connects, its agents aren't listed yet.
  prunePins(all) {
    const machine = (addr) => (addr.includes("/") ? addr.split("/")[0] : "");
    const heard = new Set(all.map((k) => machine(k.address)));
    const live = new Set(
      all.filter((k) => k.state === "live").map((k) => k.address),
    );
    const kept = this.pins.filter((p) => !heard.has(machine(p)) || live.has(p));
    if (kept.length !== this.pins.length) this.setPins(kept);
  }

  since(a) {
    return this.changed[a.address]?.at ?? 0;
  }

  // Looking at a done agent makes it idle; it stays with Done until you leave
  // it rather than drop away under you. Any other change moves it at once.
  hold(list) {
    const cur = list.find((a) => a.focused);
    const same = cur && cur.address === this.held?.address;
    // Arriving, or any change but done turning idle, sets what it was.
    if (!same || cur.status !== "idle")
      this.held = cur
        ? { address: cur.address, rank: RANK[cur.status] ?? 0 }
        : null;
  }

  rank(a) {
    const sawDone =
      a.address === this.held?.address &&
      this.held.rank === RANK.done &&
      a.status === "idle";
    return sawDone ? RANK.done : (RANK[a.status] ?? 0);
  }

  sortMenu(t) {
    const on = sortOf().id;
    return v_flex()
      .w_full()
      .p(5)
      .bg(t.popover)
      .text_size(12.8)
      .child(
        div()
          .px(8)
          .pt(4)
          .pb(6)
          .text_size(11)
          .text_color(t.dim)
          .child("Sort agents"),
      )
      .children(
        SORTS.map((s) =>
          h_flex()
            .id(`sort-${s.id}`)
            .h(31)
            .px(8)
            .gap(9)
            .rounded(7)
            .items_center()
            .text_color(t.foreground)
            .hover((el) => el.bg(t.hover))
            .on_click(() => {
              setShared("agents.sort", s.id);
              closeOverlay(props().overlay);
            })
            .child(
              svg(`mods/workspace-chrome/${s.icon}.svg`)
                .size(14)
                .flex_none()
                .text_color(t.muted),
            )
            .child(div().flex_1().child(s.label))
            .when(s.id === on, (el) =>
              el.child(
                svg("mods/workspace-chrome/check.svg")
                  .size(14)
                  .flex_none()
                  .text_color(t.foreground),
              ),
            ),
        ),
      );
  }

  peek(addr) {
    run("terminal.peek", { terminal: addr });
  }

  // Live sub-agents of `addr`, depth first, each with the tree lines in front of it.
  tree(all, addr, lead = []) {
    const kids = all.filter((k) => k.parent === addr && k.state === "live");
    return kids.flatMap((k, i) => {
      const last = i === kids.length - 1;
      return [
        { t: k, lines: [...lead, last ? "└" : "├"] },
        ...this.tree(all, k.address, [...lead, last ? "" : "│"]),
      ];
    });
  }

  subRow(t, s, shown, compact) {
    const k = s.t;
    const st = kidStatus(k, this.listed);
    const pic = icon(k.program, 14, t.foreground);
    const on = k.address === shown;
    const name = k.name || k.template || k.program?.name || k.address;
    if (p5())
      return h_flex()
        .id(`sub-${k.address}`)
        .pl(39)
        .pr(8)
        .h(26)
        .flex_none()
        .items_center()
        .cursor_pointer()
        .on_click(() => this.peek(k.address))
        .children(
          s.lines.map((l) =>
            div()
              .self_start()
              .mt(-4)
              .w(9)
              .h(17)
              .mr(4)
              .flex_none()
              .when(Boolean(l), (el) => el.border_l(2).border_color("#ffffff"))
              .when(l === "└" || l === "├", (el) =>
                el
                  .relative()
                  .border_b(2)
                  .child(
                    globalThis.window
                      .paint_path(ARROW, "#ffffff")
                      .absolute()
                      .right(-4)
                      .bottom(-5)
                      .w(6)
                      .h(8),
                  ),
              ),
          ),
        )
        .child(
          h_flex()
            .relative()
            .flex_1()
            .min_w(0)
            .h(22)
            .pl(10)
            .pr(14)
            .gap(6)
            .items_center()
            .child(
              globalThis.window
                .paint_path(SLANT, on ? "#000000" : "#4d0008")
                .absolute()
                .inset_0(),
            )
            .child(portrait(k.program, 18) ?? div())
            .child(
              div()
                .flex_1()
                .min_w(0)
                .truncate()
                .italic()
                .font_weight(800)
                .text_size(11)
                .text_color(on ? "#ffffff" : "#ffb8bd")
                .child(name.toUpperCase()),
            )
            .child(
              this.status({ ...t, blocked: "#ffd400" }, { status: st }, true),
            ),
        );
    return h_flex()
      .id(`sub-${k.address}`)
      .pl(39)
      .pr(8)
      .rounded(8)
      .h(26)
      .flex_none()
      .gap(0)
      .items_center()
      .text_size(12.5)
      .when(on, (el) => el.bg(t.raised))
      .hover((s) => s.bg(t.hover))
      .on_click(() => this.peek(k.address))
      .children(
        s.lines.map((l) =>
          div()
            .self_start()
            .mt(-4)
            .w(9)
            .h(17)
            .mr(4)
            .flex_none()
            .when(Boolean(l), (el) => el.border_l(1.5).border_color(t.input))
            .when(l === "└" || l === "├", (el) =>
              el.border_b(1.5).rounded_bl(6),
            ),
        ),
      )
      .when(Boolean(pic), (el) => el.child(div().mr(8).child(pic)))
      .child(
        div()
          .flex_1()
          .truncate()
          .text_color(on ? t.foreground : t.muted)
          .child(name),
      )
      .child(this.status(t, { status: st }, compact));
  }

  // compact: a ! for blocked where a header already says "Needs you".
  status(t, a, compact = false) {
    const color = t[a.status] ?? t.dim;
    if (a.status === "working")
      return svg("mods/workspace-chrome/spinner.svg")
        .size(12)
        .mx(1)
        .flex_none()
        .text_color(t.working)
        .spin(1800);
    if (a.status === "blocked" && compact)
      return div()
        .size(14)
        .flex_none()
        .rounded(4)
        .bg(t.blocked + "26")
        .text_size(10.5)
        .font_bold()
        .text_color(t.blocked)
        .flex()
        .items_center()
        .justify_center()
        .child("!");
    if (a.status === "blocked")
      return div()
        .flex_none()
        .px(6)
        .h(18)
        .rounded(5)
        .bg(t.blocked + "26")
        .text_size(10.5)
        .font_semibold()
        .text_color(t.blocked)
        .flex()
        .items_center()
        .child("Needs you");
    // Idle: a ring; done: a dot.
    if (a.status === "idle")
      return div()
        .size(7)
        .mx(3)
        .flex_none()
        .rounded(4)
        .border(1.5)
        .border_color(t.idle ?? t.dim);
    return div()
      .size(7)
      .mx(3)
      .flex_none()
      .rounded(4)
      .bg(a.status === "done" ? color : t.dim + "00");
  }

  render(cx) {
    const t = p5() ? { ...theme(), ...P5_COLORS } : theme();
    if (props()?.sortMenu) return this.sortMenu(t);
    const collapsed = narrow();
    const sort = sortOf();
    let list = agents();
    this.listed = new Map(list.map((a) => [a.address, a.status]));
    const all = terminals();
    const shown = focused()?.agent;
    const now = Date.now();
    const turns = new Map(terminals().map((x) => [x.address, x.turn ?? 0]));
    this.track(list, now);
    this.hold(list);
    const byPriority = sort.id === "priority";
    const urgency = new Map(
      list.map((a) => [
        a.address,
        Math.max(
          this.rank(a),
          ...this.tree(all, a.address).map(
            (s) => RANK[kidStatus(s.t, this.listed)] ?? 0,
          ),
        ),
      ]),
    );
    const rankOf = (a) => urgency.get(a.address);
    if (byPriority)
      list = [...list].sort(
        (x, y) =>
          rankOf(y) - rankOf(x) ||
          this.since(y) - this.since(x) ||
          y.seq - x.seq,
      );
    this.prunePins(all);
    const pinned = this.pins
      .map((p) => list.find((a) => a.address === p))
      .filter(Boolean);
    const rest = list.filter((a) => !this.pins.includes(a.address));
    list = [...pinned, ...rest];
    setAgentOrder(list.map((a) => a.address));
    // Priority view is an inbox: agents waiting on the person, then the ones still working.
    const inbox = byPriority
      ? rest.filter((a) => rankOf(a) >= RANK.working)
      : rest;
    // The focused agent leads the list on screen only: in the agent order, next from the
    // top would land on the one it displaced, and back again.
    const selected = list.find((a) => a.focused);
    const notSelected = (a) => a !== selected;

    const withKids = (a, i) => {
      const subs = collapsed ? [] : this.tree(all, a.address);
      const r = row(a, i, subs);
      if (this.folded.has(a.address)) return [r];
      return [r, ...subs.map((s) => this.subRow(t, s, shown, byPriority))];
    };

    // The fold chevron; folded, the count too, colored by the most urgent one.
    const fold = (a, subs) => {
      const sts = subs.map((s) => kidStatus(s.t, this.listed));
      const top = sts.reduce(
        (m, s) => ((RANK[s] ?? 0) > (RANK[m] ?? 0) ? s : m),
        null,
      );
      const open = !this.folded.has(a.address);
      return div()
        .id(`fold-${a.address}`)
        .h(18)
        .px(3)
        .gap(3)
        .flex()
        .items_center()
        .rounded(4)
        .text_size(11)
        .text_color(open ? t.dim : (t[top] ?? t.dim))
        .cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => {
          cx.stop_propagation();
          open ? this.folded.add(a.address) : this.folded.delete(a.address);
          cx.notify();
        })
        .child(
          svg(`mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`)
            .size(11)
            .flex_none(),
        )
        .when(!open, (el) => el.child(String(subs.length)));
    };

    // A row reads "space \u00b7 detail": the detail is a tab someone named or the
    // agent's own title, never an automatic tab number unless two rows would
    // otherwise read the same.
    const tabs = spaces().flatMap((s) => s.tabs);
    const label = (a) => {
      const tab = tabs.find((tab) => tab.id === a.tab);
      return tab ? title(tab, lead(tab)) : a.title || a.program?.name || "";
    };
    const detail = new Map(
      list.map((a) => [a.address, /^\d+$/.test(label(a)) ? null : label(a)]),
    );
    const seen = {};
    for (const a of list) {
      const k = `${a.space_name}\u0000${detail.get(a.address) ?? ""}`;
      seen[k] = (seen[k] ?? 0) + 1;
    }
    for (const a of list) {
      if (detail.get(a.address) == null && seen[`${a.space_name}\u0000`] > 1)
        detail.set(a.address, label(a));
    }

    const row = (a, i, subs = []) => {
      const pic = icon(a.program, 22, t.foreground);
      const more = detail.get(a.address);
      // An agent on another machine (`vps/t7`) says which.
      const machine = a.address.includes("/") ? a.address.split("/")[0] : null;
      if (collapsed) {
        return h_flex()
          .id(`ag-${a.address}`)
          .h(26)
          .px(8)
          .flex_none()
          .items_center()
          .gap(4)
          .hover((s) => s.bg(t.hover))
          .on_click(() => run("pane.focus", { pane: a.pane }))
          .child(
            div()
              .flex_1()
              .min_w(0)
              .whitespace_nowrap()
              .text_right()
              .text_color(t.muted)
              .child(String(i + 1)),
          )
          .child(
            h_flex()
              .w(14)
              .flex_none()
              .items_center()
              .justify_center()
              .child(this.status(t, a, true)),
          );
      }
      const when = this.since(a);
      const idle = a.status === "idle" && !a.focused;
      const isPinned = this.pins.includes(a.address);
      const pin = div()
        .id(`pin-${a.address}`)
        .flex_none()
        .p(2)
        .rounded(4)
        .text_color(t.dim)
        .cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .tooltip(isPinned ? "Unpin" : "Pin to the top")
        .on_click((_e, cx) => {
          cx.stop_propagation();
          this.setPins(
            isPinned
              ? this.pins.filter((p) => p !== a.address)
              : [...this.pins, a.address],
          );
          // The row moves away from under the pointer, and no hover-out comes.
          this.hovered = null;
          cx.notify();
        })
        .child(
          svg(`mods/workspace-chrome/${isPinned ? "pin-off" : "pin"}.svg`).size(
            13,
          ),
        );
      // Under a space header the space goes without saying; an automatic tab number says nothing.
      // Without a space header above (priority, pinned, selected) the row names its space.
      const full = byPriority || isPinned || a.focused;
      const tabName =
        more ??
        (/^\d+$/.test(label(a)) ? a.program?.name || label(a) : label(a));
      const plainTab = !tabName || tabName.replace(/^\W+/u, "") === "main";
      const name = full ? a.space_name || tabName : tabName;
      const sub = full && !plainTab && tabName !== name ? tabName : null;
      if (p5()) {
        const turn = turns.get(a.address) ?? 0;
        const sp = spLeft(a.address, turn);
        const cacheLeft =
          turn === 0
            ? 0
            : a.status === "working"
              ? CACHE_TTL
              : when
                ? Math.max(0, CACHE_TTL - (now - when))
                : 0;
        const energy = cacheLeft / CACHE_TTL;
        const hp = Math.ceil(cacheLeft / 60000);
        const stat = (n, color) =>
          h_flex()
            .text_size(20)
            .font_weight(900)
            .text_color(color)
            .child(
              div()
                .opacity(0.5)
                .child("0".repeat(Math.max(0, 3 - String(n).length))),
            )
            .child(div().child(String(n)));
        const bar = (fill, color) =>
          div()
            .h(4)
            .w_full()
            .bg("#ffffff1f")
            .child(
              div()
                .h_full()
                .w(`${Math.round(fill * 100)}%`)
                .bg(color),
            );
        return h_flex()
          .id(`ag-${a.address}`)
          .relative()
          .mx(6)
          .my(20)
          .h(84)
          .flex_none()
          .pl(18)
          .pr(24)
          .gap(10)
          .items_center()
          .cursor_pointer()
          .on_hover((on, cx) => {
            if (on) this.hovered = a.address;
            else if (this.hovered === a.address) this.hovered = null;
            cx.notify();
          })
          .on_click(() => run("pane.focus", { pane: a.pane }))
          .when(a.focused, (el) =>
            el.child(
              div()
                .absolute()
                .top(0)
                .bottom(0)
                .left(24)
                .right(0)
                .child(this.morph),
            ),
          )
          .when(!a.focused, (el) =>
            el.child(
              globalThis.window
                .paint_path(CARD, "#4d0008")
                .absolute()
                .inset_0(),
            ),
          )
          .when(a.focused, (el) =>
            el.child(
              div()
                .id(`selected-fold-${a.address}`)
                .absolute()
                .top(-16)
                .right(-8)
                .w(95)
                .h(38)
                .child(sprite("selected", 95, 38))
                .tooltip("Collapse selected agent")
                .on_click((_e, cx) => {
                  cx.stop_propagation();
                  this.folded.add("selected");
                  cx.notify();
                }),
            ),
          )
          .child(
            div()
              .id(`agent-fold-${a.address}`)
              .flex_none()
              .when(subs.length > 0, (el) =>
                el.on_click((_e, cx) => {
                  cx.stop_propagation();
                  this.folded.has(a.address)
                    ? this.folded.delete(a.address)
                    : this.folded.add(a.address);
                  cx.notify();
                }),
              )
              .when(PORTRAITS.has(a.program?.key), (el) =>
                el
                  .relative()
                  .w(62)
                  .h(84)
                  .child(
                    portrait(a.program, 120).absolute().top(-20).left(-50),
                  ),
              )
              .when(!PORTRAITS.has(a.program?.key), (el) =>
                el.child(portrait(a.program, 30) ?? div().size(30)),
              ),
          )
          .child(
            v_flex()
              .flex_1()
              .min_w(0)
              .gap(2)
              .italic()
              .font_weight(800)
              .child(
                h_flex()
                  .gap(6)
                  .items_end()
                  .child(
                    div()
                      .flex_1()
                      .min_w(0)
                      .truncate()
                      .text_size(12)
                      .text_color(idle ? "#bdbdbd" : "#ffffff")
                      .child(name.toUpperCase()),
                  )
                  .when(Boolean(machine), (el) =>
                    el.child(
                      div().text_size(9).text_color("#bdbdbd").child(machine),
                    ),
                  ),
              )
              .child(
                h_flex()
                  .gap(3)
                  .items_end()
                  .line_height(1)
                  .child(div().text_size(9).text_color("#5ef2ff").child("HP"))
                  .child(stat(hp, cacheLeft > 0 ? "#5ef2ff" : "#ffd400"))
                  .child(
                    div().ml(4).text_size(9).text_color("#ff5fb4").child("SP"),
                  )
                  .child(stat(sp, "#ff5fb4")),
              )
              .child(
                v_flex()
                  .gap(3)
                  .child(div().pr(14).child(bar(energy, "#5ef2ff")))
                  .child(
                    div()
                      .pl(10)
                      .pr(4)
                      .child(bar(sp / 100, "#ff5fb4")),
                  ),
              ),
          )
          .when(this.hovered === a.address, (el) => el.child(pin))
          .when(this.hovered !== a.address && Boolean(when), (el) =>
            el.child(
              div()
                .flex_none()
                .text_size(10)
                .text_color("#bdbdbd")
                .child(duration(now - when)),
            ),
          )
          .child(this.status({ ...t, blocked: "#ffd400" }, a, true));
      }
      return h_flex()
        .id(`ag-${a.address}`)
        .px(8)
        .h(sub ? 44 : 30)
        .flex_none()
        .rounded(8)
        .items_center()
        .gap(9)
        .relative()
        .when(a.focused && !p5(), (el) => el.bg(t.selected))
        .when(a.focused && p5(), (el) =>
          el
            .child(
              globalThis.window
                .paint_path(SLANT, "#e60012")
                .absolute()
                .top(4)
                .left(6)
                .right(-6)
                .bottom(-4),
            )
            .child(
              globalThis.window
                .paint_path(SLANT, "#000000")
                .absolute()
                .inset_0(),
            ),
        )
        .cursor_pointer()
        .hover((s) => s.bg(t.hover))
        .on_hover((on, cx) => {
          if (on) this.hovered = a.address;
          else if (this.hovered === a.address) this.hovered = null;
          cx.notify();
        })
        .on_click(() => run("pane.focus", { pane: a.pane }))
        .when(Boolean(pic), (el) =>
          el.child(
            div()
              .id(`agent-fold-${a.address}`)
              .when(subs.length > 0, (el) =>
                el.on_click((_e, cx) => {
                  cx.stop_propagation();
                  this.folded.has(a.address)
                    ? this.folded.delete(a.address)
                    : this.folded.add(a.address);
                  cx.notify();
                }),
              )
              .child(pic),
          ),
        )
        .child(
          v_flex()
            .flex_1()
            .min_w(0)
            .gap(2)
            .child(
              p5()
                ? div()
                    .truncate()
                    .font_weight(800)
                    .italic()
                    .text_color(
                      a.focused ? "#ffffff" : idle ? t.muted : t.foreground,
                    )
                    .child(name.toUpperCase())
                : div()
                    .truncate()
                    .text_color(idle ? t.muted : t.foreground)
                    .child(name),
            )
            .when(Boolean(sub), (el) =>
              el.child(
                div()
                  .truncate()
                  .text_size(11.5)
                  .text_color(a.focused && p5() ? "#bdbdbd" : t.dim)
                  .child(sub),
              ),
            ),
        )
        .when(Boolean(machine), (el) =>
          el.child(div().text_size(10).text_color(t.dim).child(machine)),
        )
        .when(subs.length > 0, (el) => el.child(fold(a, subs)))
        .when(this.hovered === a.address, (el) => el.child(pin))
        .when(this.hovered !== a.address && Boolean(when), (el) =>
          el.child(
            div()
              .flex_none()
              .text_size(11)
              .text_color(t.dim)
              .child(duration(now - when)),
          ),
        )
        .child(this.status(t, a, byPriority && !isPinned));
    };

    // Groups in list order: spaces (grouped) or priority sections. Agents of a
    // space are next to each other in agents(), so neighbours make a group.
    const groups = selected
      ? [
          {
            id: "selected",
            label: "Selected",
            status: null,
            members: [selected],
          },
        ]
      : [];
    if (pinned.some(notSelected))
      groups.push({
        id: "pinned",
        label: "Pinned",
        status: null,
        members: pinned.filter(notSelected),
      });
    for (const a of inbox.filter(notSelected)) {
      const r = rankOf(a) || RANK.idle;
      const id = byPriority ? `sec-${r}` : `sp-${a.space}`;
      if (groups.at(-1)?.id === id) groups.at(-1).members.push(a);
      else
        groups.push({
          id,
          label: byPriority ? SECTION[r] : a.space_name || "",
          status: byPriority ? SECTION_STATUS[r] : null,
          members: [a],
        });
    }

    const showHeader = (g) =>
      !p5() || g.id !== "selected" || this.folded.has(g.id);

    // A group's header; it folds the group. Folded, it says how many and the most urgent state.
    const header = (g) => {
      const open = !this.folded.has(g.id);
      const top = g.members.reduce(
        (m, a) => ((RANK[a.status] ?? 0) > (RANK[m] ?? 0) ? a.status : m),
        null,
      );
      const loud = g.status === "blocked";
      return h_flex()
        .id(g.id)
        .px(8)
        .pt(8)
        .h(30)
        .flex_none()
        .gap(6)
        .items_center()
        .text_size(11)
        .font_medium()
        .cursor_pointer()
        .hover((s) => s.text_color(t.foreground))
        .on_click((_e, cx) => {
          open ? this.folded.add(g.id) : this.folded.delete(g.id);
          cx.notify();
        })
        .child(div().flex_1())
        .child(
          h_flex()
            .relative()
            .min_w(0)
            .gap(6)
            .items_center()
            .when(p5(), (el) =>
              el
                .h(20)
                .px(10)
                .child(
                  globalThis.window
                    .paint_path(SLANT, "#000000")
                    .absolute()
                    .top(3)
                    .left(3)
                    .w_full()
                    .h_full(),
                )
                .child(
                  globalThis.window
                    .paint_path(SLANT, loud ? "#ffd400" : "#5c0008")
                    .absolute()
                    .inset_0(),
                ),
            )
            .child(
              div()
                .truncate()
                .text_color(loud ? "#000000" : (t[g.status] ?? t.dim))
                .child(g.label),
            )
            .when(g.id !== "selected" && (byPriority || !open), (el) =>
              el.child(
                div()
                  .px(4)
                  .bg("#000000")
                  .text_color("#ffffff")
                  .child(String(g.members.length)),
              ),
            ),
        )
        .when(!open, (el) =>
          el
            .when(!byPriority && top && top !== "idle", (el) =>
              el.child(this.status(t, { status: top }, true)),
            )
            .child(
              svg("mods/workspace-chrome/chevron-right.svg")
                .size(11)
                .flex_none()
                .text_color(t.dim),
            ),
        );
    };
    // The block is as tall as the inbox, capped, so the spaces list keeps the rest.
    if (!collapsed) {
      const card = (a) =>
        124 +
        (this.folded.has(a.address)
          ? 0
          : this.tree(all, a.address).length * 26);
      const body = groups.reduce(
        (h, g) =>
          h +
          (showHeader(g) ? 30 : 0) +
          (this.folded.has(g.id)
            ? 0
            : g.members.reduce((m, a) => m + card(a), 0)),
        0,
      );
      // 58 title row + 28 bottom row, plus room for the selected card's red copy
      const px = body ? Math.min(58 + 28 + body + 8, 540) : 86;
      if (this.px !== px) {
        this.px = px;
        run("layout.resize", { id: "agents", px });
      }
    }
    const rows = collapsed
      ? list.flatMap(withKids)
      : groups.flatMap((g) => [
          ...(showHeader(g) ? [header(g)] : []),
          ...(this.folded.has(g.id) ? [] : g.members.flatMap(withKids)),
        ]);

    return v_flex()
      .size_full()
      .min_h(0)
      .relative()
      .when(!p5(), (el) => el.bg(t.chrome))
      .when(p5(), (el) =>
        paintTear(
          el,
          sidebarTear(
            layout() ?? {},
            "agents",
            globalThis.window.viewport_size().height,
          ),
          t.chrome,
        ),
      )
      .when(!p5(), (el) => el.border_t(1).border_color(t.border))
      .text_size(13)
      .when(!collapsed, (el) =>
        el.child(
          h_flex()
            .pl(16)
            .pr(10)
            .h(58)
            .pt(4)
            .pb(4)
            .flex_none()
            .items_center()
            .justify_between()
            .child(
              p5()
                ? div()
                    .relative()
                    .w(150)
                    .h(50)
                    .flex_none()
                    .child(
                      sprite("agents-shadow", 150, 50)
                        .absolute()
                        .top(3)
                        .left(3),
                    )
                    .child(
                      sprite("agents", 150, 50)
                        .absolute()
                        .top(0)
                        .left(0),
                    )
                : div()
                    .text_size(11.5)
                    .font_medium()
                    .text_color(t.dim)
                    .child("Agents"),
            )
            .child(
              div()
                .id("ag-sort")
                .size(26)
                .flex_none()
                .flex()
                .items_center()
                .justify_center()
                .rounded(5)
                .text_color(t.foreground)
                .hover((s) => s.bg(t.hover))
                .on_click(() =>
                  openOverlay({
                    mod: "p5-agents",
                    kind: "popup",
                    width: 200,
                    height: 140,
                    props: { sortMenu: true },
                  }),
                )
                .tooltip(`Sort agents: ${sort.label}`)
                .child(svg(`mods/workspace-chrome/${sort.icon}.svg`).size(14)),
            ),
        ),
      )
      .when(list.length === 0 && !collapsed && !byPriority, (el) =>
        el.child(
          div()
            .px(12)
            .text_size(12)
            .text_color(t.dim)
            .child(
              "No agent status yet. Agents show up here when they report their status. Older versions and agents inside tmux may not.",
            ),
        ),
      )
      .child(
        v_flex()
          .id("ag-list")
          .flex_1()
          .min_h(0)
          .px(collapsed ? 0 : 8)
          .overflow_y_scrollbar()
          .mode("always")
          .children(rows),
      )
      .child(
        h_flex()
          .h(28)
          .px(12)
          .items_center()
          .justify_end()
          .when(collapsed, (el) => el.justify_center().px(0))
          .child(
            div()
              .id("collapse")
              .text_size(13)
              .text_color(t.dim)
              .hover((s) => s.text_color(t.foreground))
              .on_click(toggleSidebar)
              .child(collapsed ? "»" : ""),
          ),
      );
  }
}
