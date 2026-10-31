# Persona 5

A herdr-app layout in the style of Persona 5's menus. Every bar is deep red with black diagonal stripes. Whatever is selected sits in a tilted black slab with a white outline and a red copy knocked out behind it. Agents show up as party cards with HP and SP. Terminals stay near-black, and each pane's top edge is cut on a slant.

![Persona 5](preview.png)

## What you see

Red is `#b3000e` everywhere. Stripes are `#00000040`, 3px wide every 14px, at 45°. "Selected style" means a black irregular quad (corners at different heights), a 2px white outline, and a `#e60012` copy of the quad offset about 5px right and 4px down. On the active space, the focused agent and the active tab, the red copy bobs: it slides between 1px and 8px down (the tab slides between 2px and 9px right) every 1.5s. "Unselected style" means a `#7a0009` slant with `#ffb8bd` text. Text is heavy italic caps throughout.

- **Window background** (behind the panes): flat `#b3000e`. There are no dividers between regions, so the bars and the sidebar run edge to edge.
- **Sidebar, left, 268px:**
  - **Brand row, 46px** (`p5-chrome`): the Herdr icon, a `HERDR` section tag, and the search and sidebar-toggle buttons. Dragging it moves the window.
  - **Section tags** (`HERDR`, `SPACES`, `AGENTS`): selected-style quads. The first letter is set at 1.45× (23px against 16px), like a ransom-note title.
  - **Spaces** (`p5-spaces`): each row has a colored avatar letter and the name in weight-800 italic caps. Under the name is the branch with ahead/behind counts in `#ffb8bd`.
    - Unselected rows are 46px tall (32px without a branch line) with 12px side padding. Every second row is indented 12px for a zig-zag.
    - The active space is a selected-style quad, 66px tall (48px without a branch line), padded 24px left and 20px right, with a `#bdbdbd` branch line.
  - **Agents** (`p5-agents`): the block grows with its content, from 56px up to 420px. Agents are grouped under their space name, and each agent is a 68px black irregular card:
    - **Left:** the program icon at 30px, like a party portrait.
    - **Middle:** the name, then a stat line, then two 4px bars:
      - `HP` in `#5ef2ff`: minutes left before the prompt cache goes cold. It is full while the agent is working and counts down from its last state change. It shows a grey `COLD` once the time runs out, or when the agent has never run a turn.
      - `SP` in `#ff5fb4`: 100 minus the turns taken, floored at 0.
      - The cyan bar and the pink bar track HP and SP.
    - **Right:** the time since the state change, then the status icon.
    - **Focused agent:** the card gets the white outline and the red offset copy.
  - **Footer, 92px** (`p5-chrome` with `footer: true`): a black block whose top edge slopes up to the right, holding `SETTINGS` and `ADD MACHINE`.
- **Tab bar, 42px** (`p5-tabs`): red with stripes. Tabs are spaced 10px apart and use 13px weight-800 italic caps. The active tab is selected style (32px tall, 20px side padding); the other tabs are unselected style. Files and Changes toggles sit on the right.
- **Panes** (`main`): `#0d0d0d`, 10px gap, no border. Each pane has a 42px header (`p5-pane`), red with stripes, overlaid with a `#0d0d0d` slab whose top runs from 38% height on the left up to the top right. The slab merges with the terminal below, so the pane looks cut on a slant, with a red wedge in its top-left corner.
  - The focused pane has a 4px white line along the slant, a white irregular name tag with black text, and a red offset copy behind the tag.
  - Other panes have an unselected-style name tag.
  - The folder follows in `#ffb8bd`.
- **Status bar, 34px** (`p5-status`): red with stripes.
  - The machine and branch are white irregular chips with black text, tilted in opposite directions.
  - `AGENTS N` is selected style: a small label with the count at 18px in `#5ef2ff`, plus `/N` in `#ff5fb4` when N agents are blocked.
  - When any agent is blocked, a `N NEEDS YOU!` chip appears in `#ffd400` with black text.
  - On the right is a white key chip `⌘ ⇧ P` followed by `COMMANDS`.
- **Theme** `themes/persona5.json`: terminal background `#0d0d0d`, foreground `#f2f2f2`, selection `#6b000a`, cursor `#ff1a2d`, and a red-leaning ANSI palette. `colors.border` is `#000000` to hide herdr's overlay frame.
- **Overlays:** the `herdr-q-saddle` overlays (`q-saddle-project`, `q-saddle-ssh`, `q-saddle-tab`) restyle themselves in P5 when `shared('layout') === 'persona5'`.

## How it behaves

- Agent status is shown by an icon: blocked is a black `!`, done a white dot, working a `#ffd400` spinner, and idle a hollow ring.
- Spaces: click to select, drag to reorder, right-click for the menu. The active row is taller, so switching spaces shifts the rows below by about 20px.
- Agents:
  - Clicking a card focuses its pane, and clicking the portrait folds or unfolds its sub-agents.
  - Hovering a card swaps the time for a pin button.
  - The block resizes itself to fit the cards.
- Tabs: click to select, double-click to rename, drag to reorder, and scroll the wheel to switch. The × on the active tab closes it.
- Pane headers: hovering shows the split, zoom and close buttons, and clicking focuses the pane.
- `ctrl-shift-l` cycles layouts, so the person's own layout stays one key away.

## Built from

- `layouts/persona5.json`: a root row of `sidebar` and `work`. The root sets `theme: persona5`, `background: "#b3000e"`, `titlebar: none` and `traffic_lights: [12, 16]`, and has no `divider`.
  - `sidebar` is a column of `brand`, `sidebar-lists` (holding `spaces` and `agents`) and `sidebar-footer`.
  - `work` is a column of `tabs`, a `work-body` row, and `status`. `work-body` holds `main` and the hidden `panel` stack of `files` and `changes`.
  - The pane frame in `main` is `{gap: 10, radius: 0, background: "#0d0d0d", border/focus width 0, header {mod: p5-pane, height: 42}, lone: true}`.
- The mods:
  - `p5-tabs`, `p5-pane`, `p5-chrome` and `p5-status` are clones of Herdr 0.1.9's `tabs`, `pane`, `workspace-chrome` and `workspace-status`.
  - `p5-spaces` and `p5-agents` are reworked spaces and agents lists.
- Drawing:
  - Every shape is a `PathBuilder.fill().add_polygon(...)` with percentage coordinates, drawn by `window.paint_path(path, color)` as an `.absolute().inset_0()` child behind the text.
  - Outlines use `PathBuilder.stroke(2).add_polygon(shape, true)`. The slanted pane top uses `PathBuilder.stroke(4).move_to(...).line_to(...)`.
  - The static red offset copies are the same path with `.top(4).left(6).right(-6).bottom(-4)`.
  - The animated copies (active space, focused agent, active tab) sit in a wrapper `div().id(...).absolute().top(4).left(6).w_full().h_full()` with `.loop("top", { from: 1, to: 8, period: 1500 })`. The active tab uses `.left(5)` and `.loop("left", { from: 2, to: 9, period: 1500 })`.
  - Stripes are a full-rect path painted with `Background.pattern_slash("#00000040", 3, 14)`.
- Each mod overrides theme colors locally (`{ ...theme(), chrome: "#b3000e", ... }`).
- HP reads a constant `CACHE_TTL` in `p5-agents/main.js`: 60 minutes, for Claude plans with the 1-hour prompt cache. Set it to `5 * 60000` for the default 5-minute cache.
- SP reads `turn` from `terminals()`, the same field `hc ls --json` reports.
- Icons load from the shipped mods' folders (`mods/workspace-chrome/`, `mods/pane/`, `mods/tabs/`).
- Uses the shipped mods `files`, `changes`, `menu` and `new-menu`.
- **Runs programs:** `p5-spaces` runs `git status` / `git rev-parse` in each space's folder, local or remote, to show branches, and calls `hc machine ls`. Nothing reaches the network, and nothing reads files outside the space folders.

## Watch out

- A pane frame can only be a rectangle, and a header mod can't draw over it. That is why the slant is a header slab the same color as the terminal, and why a focus border can't follow the slant.
- A theme file color must be `#rrggbb`. One `#rrggbbaa` value makes the whole layout fail to apply (`... is not #rrggbb`).
- `.loop()` does not animate a `paint_path` element directly. Wrap the path in a `div()` with an `.id(...)` and put `.loop()` on the wrapper.
- A running `.loop()` repaints the whole window at about 30fps for as long as the selected quad is on screen.
- `colors.border: "#000000"` also blacks out every other use of `t.border`: the separators in `menu` and `new-menu` vanish against the `#000000` popover, and the frames and dividers in `files` and `changes` nearly vanish against `#0d0d0d`.
- `line_height` given a bare number is a multiplier (`1.1`), not pixels.
- Herdr doesn't notice edits behind a symlinked mod or layout, and a symlinked mod can't load SVGs from its own folder. Switch layouts (`ctrl-shift-l`) to reload.
- When `layouts/persona5.svg` is a symlink, the layout picker shows an empty preview card. Copy the file into `~/.config/herdr-app/layouts/` instead of linking it.
- `herdr` exports a `window()` function, while the drawing `window` is gpui-kit's global. Import herdr's as `window as appWindow`, or call `globalThis.window.paint_path`.
- `p5-agents` keeps state-change times in its own `localStorage`. On its first run every agent is stamped "now", so HP and the time are off until each agent changes state once.
- HP counts from the agent's last state change, not its last API call, and it means nothing for agents that aren't Claude Code. SP counts turns, not tokens.
- Percentage-based slants get flatter on longer labels.
- The zig-zag indent follows list order, so adding or dragging a space shifts which rows indent.
- After a mod reloads, the branch lines take a few seconds to come back while git is asked again.
- The four clones track Herdr 0.1.9; a newer Herdr may need its changes merged in.

## Done when

- `herdr-app check mods/<name>` passes for all six `p5-*` mods.
- `herdr-app status` shows `"errors": []` after `layout.switch {"name":"persona5"}`.
- A screenshot shows:
  - striped red bars with no divider lines
  - selected-style quads on the section tags, the active tab, the active space and the focused agent
  - a slanted top on every pane, with a white line on the focused one
- An agent that has never run a turn shows `HP COLD / SP 100`.
- Blocking an agent shows the yellow `NEEDS YOU!` chip in the status bar.
