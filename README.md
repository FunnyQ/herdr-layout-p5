# herdr-layout-p5

A Persona 5 style layout for [herdr-app](https://herdr.dev): deep red striped bars, tilted black selection slabs, slanted pane tops, and agents shown as party cards with HP and SP.

![Persona 5](preview.png)

## What's inside

- `layouts/persona5.json`: the layout, with `layouts/persona5.svg` as its picker preview.
- `themes/persona5.json`: the terminal theme (near-black background, red-leaning ANSI palette).
- `mods/`: six mods the layout draws with.
  - `p5-chrome`: the brand row and the sidebar footer.
  - `p5-spaces`: the spaces list, with branch and ahead/behind counts.
  - `p5-agents`: agent party cards with HP (prompt cache time left) and SP (turns left).
  - `p5-tabs`: the tab bar.
  - `p5-pane`: the slanted pane header.
  - `p5-status`: the status bar.

## Requirements

- herdr-app 0.1.9 or 0.1.10. The `p5-*` mods are clones of the shipped mods from those versions, so a newer herdr-app may need its changes merged in.
- The shipped mods `files`, `changes`, `menu` and `new-menu`, which herdr-app installs by default.

## Install

1. Clone the repo.

   ```sh
   git clone git@github.com:FunnyQ/herdr-layout-p5.git
   cd herdr-layout-p5
   ```

2. Copy the layout, theme and mods into your herdr-app config folder.

   ```sh
   cp layouts/persona5.json layouts/persona5.svg ~/.config/herdr-app/layouts/
   cp themes/persona5.json ~/.config/herdr-app/themes/
   cp -R mods/p5-* ~/.config/herdr-app/mods/
   ```

3. Check each mod.

   ```sh
   for m in mods/p5-*; do herdr-app check "$m"; done
   ```

4. Switch to the layout from the layout picker, or press `ctrl-shift-l` to cycle layouts until Persona 5 shows.

Copy the files rather than symlinking them. Herdr doesn't notice edits behind a symlinked mod or layout, and a symlinked `persona5.svg` shows an empty card in the layout picker.

## Configure

- If your Claude plan uses the default 5-minute prompt cache, set `CACHE_TTL` in `mods/p5-agents/main.js` to `5 * 60000`. It defaults to 60 minutes.

## Privacy

`p5-spaces` runs `git status` and `git rev-parse` in each space's folder, and `hc machine ls`, to show branches. Nothing reaches the network, and nothing reads files outside the space folders.

## Known limits

- HP counts from the agent's last state change, not its last API call. It is only meaningful for Claude Code.
- SP counts turns, not tokens. It is not the context window.
- On the first run, `p5-agents` stamps every agent "now", so HP and the time are off until each agent changes state once.
- The animated selection slabs repaint the window at about 30fps while they are on screen.

## Design notes

See [RECIPE.md](RECIPE.md) for the full spec: every color, size and shape, how each mod draws, and the pitfalls found while building it.
