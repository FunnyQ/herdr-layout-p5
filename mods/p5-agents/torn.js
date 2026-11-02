// A paper tear along one edge. Its depth is a pure function of the position
// along the whole edge, so blocks that each paint their own stretch meet without a seam.
const STEP = 4;
export const noise = (k) => {
  const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (at, span, seed = 0) => {
  const k = Math.floor(at / span) * 13 + seed;
  const f = at / span - Math.floor(at / span);
  return noise(k) + (noise(k + 13) - noise(k)) * f * f * (3 - 2 * f);
};
// A long lean off the straight, a slow wander, a fine ragged fringe, and now and then a deep bite.
const depthAt = (at, amp, lean) => {
  const k = Math.round(at / STEP);
  const bite = noise(k * 7 + 3) > 0.93 ? 0.35 : 0;
  return (
    lean * smooth(at, 220, 5) +
    amp * Math.min(1, 0.45 * smooth(at, 36) + 0.3 * noise(k) ** 1.5 + bite)
  );
};

// [position from `from`, depth] pairs from `from` to `to`, with a vertex at each of `stops`.
// Depths stay within `amp + lean`.
export function tearLine(from, to, amp, stops = [], lean = 0) {
  const at = new Set([from, to, ...stops.filter((s) => s > from && s < to)]);
  for (let g = (Math.floor(from / STEP) + 1) * STEP; g < to; g += STEP)
    at.add(g);
  return [...at].sort((a, b) => a - b).map((g) => [g - from, depthAt(g, amp, lean)]);
}

// A block's top and height along the window's height.
export function spanOf(node, id, length, top = 0) {
  if (node.id === id) return { top, height: length };
  const kids = node.children ?? [];
  if (node.type !== "column")
    return kids.reduce((hit, c) => hit ?? spanOf(c, id, length, top), null);
  const fixed = kids.reduce((s, c) => s + (c.size?.px ?? 0), 0);
  const weight = kids.reduce(
    (s, c) => s + (c.size?.px == null ? (c.size?.weight ?? 1) : 0),
    0,
  );
  let at = top;
  for (const c of kids) {
    const len =
      c.size?.px ?? ((length - fixed) * (c.size?.weight ?? 1)) / weight;
    const hit = spanOf(c, id, len, at);
    if (hit) return hit;
    at += len;
  }
  return null;
}

const AMP = 10;
const BAR_AMP = 7;
const LEAN = 12;
const BAR_LEAN = 5;
const RIM = 1.5;
// The paper showing at a tear: warm and half see-through, so the rim reads as fibre, not an outline.
export const PAPER = "#f2e6d699";
const RAMP = 32;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// A block's torn fill and paper rim. `line` holds [position, fill depth, paper depth]
// along the torn `side`; `thickness` is the block's size across it.
export function tornShape(line, length, thickness, side) {
  const at = {
    right: (p, d) => [thickness - d, p],
    bottom: (p, d) => [p, thickness - d],
    top: (p, d) => [p, d],
  }[side];
  const far = { right: [[0, 0], [0, length]], bottom: [[0, 0], [length, 0]], top: [[0, thickness], [length, thickness]] }[side];
  const fill = line.map(([p, f]) => at(p, f));
  return {
    fill: [far[0], ...fill, far[1]],
    rim: [...fill, ...[...line].reverse().map(([p, , e]) => at(p, e))],
  };
}

// [position, fill depth, paper depth] along a tear, scaled by `calm` (0 flush, 1 full).
const depths = (line, calm) =>
  line.map(([p, d]) => [p, (d + RIM) * calm(p), d * calm(p)]);

// A sidebar block's torn fill and paper rim; null for a block outside the sidebar.
// The tear calms to flush beside the tab bar and the status bar, so they meet the sidebar without a gap.
export function sidebarTear(tree, id, viewportHeight) {
  const sidebar = tree.children?.find((c) => c.id === "sidebar");
  const span = sidebar?.size?.px && spanOf(sidebar, id, viewportHeight);
  if (!span) return null;
  const calmTop = spanOf(tree, "tabs", viewportHeight)?.height ?? 0;
  const calmBottom = viewportHeight - (spanOf(tree, "status", viewportHeight)?.height ?? 0);
  const { top, height } = span;
  const line = tearLine(top, top + height, AMP, [calmTop, calmTop + RAMP, calmBottom - RAMP, calmBottom], LEAN);
  const calm = (y) => clamp01((top + y - calmTop) / RAMP) * clamp01((calmBottom - top - y) / RAMP);
  return tornShape(depths(line, calm), height, sidebar.size.px, "right");
}

// The tab bar's or status bar's fill, torn along `side`, calm to flush where it meets the sidebar.
export function barTear(tree, id, viewportWidth, side) {
  const sidebar = tree.children?.find((c) => c.id === "sidebar")?.size?.px ?? 0;
  const thickness = spanOf(tree, id, 0)?.height;
  if (!thickness) return null;
  const length = viewportWidth - sidebar;
  const line = tearLine(0, length, BAR_AMP, [RAMP], BAR_LEAN);
  return tornShape(depths(line, (x) => clamp01(x / RAMP)), length, thickness, side);
}
