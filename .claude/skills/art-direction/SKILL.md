---
name: art-direction
description: >-
  Use when adding or reskinning visuals in Own a Dungeon — new sprites,
  colour choices, new panel or overlay styling, or checking visual
  consistency across the game's surfaces. Triggers on "reskin", "sprite",
  "color palette", "looks off", "visual consistency", "art style". Adapted
  from AlterLab-IEU/AlterLab_GameForge's game-art-director agent, trimmed to
  this project's actual visual system.
license: MIT
---

# Own a Dungeon — Art Direction

Source: condensed from
[AlterLab-IEU/AlterLab_GameForge](https://github.com/AlterLab-IEU/AlterLab_GameForge)'s
`game-art-director` agent, written for studios with concept-art pipelines.
This project has one visual system, so this is a checklist against it.

## The established system

- **Everything derives from one tileset.** `assets-src/room/Room.png` is the
  source for the room backdrops, doors and torches; `TorchAnimation.png` for
  the flame; `MOCK.gif` is the composition reference the rooms were built
  from. `scripts/art/` regenerates all of `public/art/` from them — sprites,
  room art and the 9-slice UI frames alike. **Never hand-edit anything in
  `public/art/`; change the generator and re-run it.**
- **The UI chrome is made of the dungeon.** `gen_ui.py` samples real stone out
  of `Room.png` for the panel, inset, button, plate and danger frames. New
  chrome should come from the same place rather than a flat CSS rectangle.
- **Palette lives in two places that must agree:** `PALETTE` in
  `scripts/art/tiles.py` for generated art, and the CSS custom properties at
  the top of `app/game/styles/tokens.css` for the DOM. Pull from those rather
  than introducing a new hex literal.
- **9-slice via `border-image`** for anything that resizes — `.frame`,
  `.inset`, `.btn`, `.plate`, `.danger` in `styles/chrome.css` are the
  reference. Never stretch a pixel-art background.
- **`image-rendering: pixelated`** on every pixel-art reference. Omitting it
  is the most common way a new element looks soft next to everything else.
- **Sprites are addressed by content id.** `art()` in `app/game/art.ts` builds
  `hero-<id>.png`, `monster-<id>.png`, `trap-<id>.png`, `treasure-<id>.png`.
  A new content id needs a matching generator function and sprite key.

## Before shipping a visual change

1. Does it reuse a token from `tokens.css` and a colour from `PALETTE`?
2. Does it reuse an existing crop, or does the generator need a new one?
3. Which stylesheet does it belong in — `tokens`, `chrome`, `dungeon` or
   `panels`? They are imported in order and the cascade depends on it.
4. Does it hold at **360×640** as well as 390×844?
5. **Redundant affordances** — check a new crop has no baked-in UI that would
   double up with a real DOM element on top. The room art deliberately has no
   painted door because the door is a live element.

## Known open item

The Lord's sprite is still a crowned figure from when he was the King. Once a
hero-side King exists, the crown will read as the wrong faction.

## Not applicable

Concept-art pipelines, multi-artist style guides, 3D specs, cinematics.
