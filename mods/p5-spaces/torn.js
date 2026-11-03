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

// The paper rim's width: mostly thin, now and then a wide strip of torn-off fibre.
const RIM_MIN = 0.5;
const RIM_MAX = 8;
const rimAt = (at) => {
  const k = Math.round(at / STEP);
  const swing = Math.min(1, 0.75 * smooth(at, 48, 21) + 0.35 * noise(k * 5 + 11));
  return RIM_MIN + (RIM_MAX - RIM_MIN) * swing ** 2;
};

// The paper's shade: patches from nearly clear to nearly solid, in SHADES steps.
const SHADES = 5;
const shadeAt = (at) => {
  const k = Math.round(at / STEP);
  return Math.min(SHADES - 1, Math.floor((0.7 * smooth(at, 40, 37) + 0.3 * noise(k * 3 + 29)) * SHADES));
};

// [position from `from`, depth, rim width, shade] quadruples from `from` to `to`, with a vertex at each of `stops`.
// Depths stay within `amp + lean`.
export function tearLine(from, to, amp, stops = [], lean = 0) {
  const at = new Set([from, to, ...stops.filter((s) => s > from && s < to)]);
  for (let g = (Math.floor(from / STEP) + 1) * STEP; g < to; g += STEP)
    at.add(g);
  return [...at].sort((a, b) => a - b).map((g) => [g - from, depthAt(g, amp, lean), rimAt(g), shadeAt(g)]);
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
// The paper showing at a tear: warm and see-through, so the rim reads as fibre, not an outline.
const PAPER = "#f2e6d6";
const ALPHA_MIN = 0.58;
const ALPHA_MAX = 0.98;
const paper = (shade) => {
  const alpha = ALPHA_MIN + ((ALPHA_MAX - ALPHA_MIN) * shade) / (SHADES - 1);
  return PAPER + Math.round(alpha * 255).toString(16).padStart(2, "0");
};
const RAMP = 32;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// `line` holds [position, fill depth, paper depth, shade] along the torn `side`.
export function tornShape(line, length, thickness, side) {
  const at = {
    right: (p, d) => [thickness - d, p],
    bottom: (p, d) => [p, thickness - d],
    top: (p, d) => [p, d],
  }[side];
  const far = { right: [[0, 0], [0, length]], bottom: [[0, 0], [length, 0]], top: [[0, thickness], [length, thickness]] }[side];
  const fill = line.map(([p, f]) => at(p, f));
  // Cuts only move forward, so one cursor walks the line once.
  let seg = 0;
  const paperAt = (q) => {
    while (seg < line.length - 2 && line[seg + 1][0] < q) seg++;
    const [[p0, , e0], [p1, , e1]] = [line[seg], line[seg + 1]];
    return p1 === p0 ? e0 : e0 + ((e1 - e0) * (q - p0)) / (p1 - p0);
  };
  const rims = new Map();
  let cut = line[0][0];
  let cutPoint = at(cut, line[0][2]);
  let k = 0;
  for (let a = 0; a < line.length - 1; ) {
    let b = a + 1;
    while (b < line.length - 1 && line[b][3] === line[a][3]) b++;
    // Shade patches meet at 45 degrees: the cut leans back along the edge by the rim's width.
    const [pb, fb, eb] = line[b];
    const next = b === line.length - 1 ? pb : Math.max(cut, pb - (fb - eb));
    const nextPoint = at(next, paperAt(next));
    const polygon = [nextPoint, cutPoint];
    while (k < line.length && line[k][0] <= cut) k++;
    for (; k < line.length && line[k][0] < next; k++) polygon.splice(1, 0, at(line[k][0], line[k][2]));
    for (let i = b; i >= a; i--) polygon.unshift(at(line[i][0], line[i][1]));
    const color = paper(line[a][3]);
    if (!rims.has(color)) rims.set(color, []);
    rims.get(color).push(polygon);
    cut = next;
    cutPoint = nextPoint;
    a = b;
  }
  return {
    fill: [far[0], ...fill, far[1]],
    rims: [...rims].map(([color, polygons]) => ({ color, polygons })),
  };
}

// [position, fill depth, paper depth, shade] along a tear, scaled by `calm` (0 flush, 1 full).
const depths = (line, calm) =>
  line.map(([p, d, r, s]) => [p, (d + r) * calm(p), d * calm(p), s]);

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
