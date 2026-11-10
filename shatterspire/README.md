# SHATTERSPIRE

A 3D action-ARPG roguelite that runs in any modern browser. Descend a floating spire of ash, glass, storm and root, bind boons to your blade, and break the four wardens guarding its heart.

## Play

Open `index.html` in Chrome, Edge, Firefox or Safari. There is no build step and no server: the game is one file and loads Three.js r186.1 from a pinned jsDelivr URL.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move |
| Mouse | Aim (the character faces the cursor) |
| LMB (hold) | Weapon combo / bolt |
| RMB | Weapon special (Earthbreaker, Shadow Lunge, Chain Nova) |
| Space | Dodge with i-frames |
| Q | Healing flask (refilled by clearing rooms) |
| E | Ultimate, once Fury reaches 100 (Sunder, Death Dance, Tempest) |
| 1 / 2 / 3 | Swap weapons (more are found in chests and bosses) |
| Mouse wheel | Zoom |
| Esc | Pause |
| M | Mute |

## What is in it

- **Three weapons** with different feel: Greatblade (heavy combo, stagger), Fangs (fast flurry, bleed lunge), Stormstaff (homing bolts, chain lightning).
- **Four floors**, each a floating-island arena in its own biome (Ashen Gardens, Glass Cathedral, Storm Ruins, Void Roots), with its own palette, fog, sky, props and music loop.
- **Varied room loop**: skirmishes, elite hunts, shrines (pick one of three boons), treasure chests and warden chambers. Some rooms add modifiers: Storm, Frenzy or Molten.
- **Boons** that change the rules of a run: burn on hit, dodge gusts, chain lightning, reflect damage, echo strikes, frost aura, second wind and more.
- **Loot** with rarity and affixes (damage, crit, lifesteal, speed, cooldown, Fury gain), auto-equipped when it beats your current gear.
- **Four wardens**, each with telegraphed attack patterns and phase changes: the Ashen Warden, Glass Colossus, Stormcaller Ilse and The Shattered King.
- **Art without assets**: low-poly flat-shaded geometry, procedural ground textures, emissive crystals with bloom, ambient ember motes, a camera with shake and hit-stop, and procedural WebAudio sound effects and music.

## Code layout

Everything lives in `index.html`, in this order:

1. Markup, CSS and the import map (`three@0.186.1` from jsDelivr).
2. Engine setup, biome palettes, procedural textures, arena and prop builders, lights and sky.
3. Particles, damage numbers, audio, input, weapons and the player controller.
4. Enemies, warden patterns, hazards, projectiles, pickups and the damage pipeline.
5. Items and boons, floor and room flow, HUD, game loop and wiring.

## Debugging

`window.SHATTERSPIRE` exposes the player, the run state, the enemy list, and two helpers: `killAll()` clears the current wave, and `sim(seconds)` steps gameplay at 60 Hz without rendering, which is handy for headless tests.
