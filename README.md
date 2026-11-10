# Neon Drift

A fast, no-build 3D arcade runner in the browser, built with Three.js. Dodge the walls, chase the orbs, charge overdrive and smash straight through everything.

## Play

Serve the folder with any static server (WebGL is required) and open it:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. There is nothing to install or build: Three.js 0.160.0 is loaded from jsDelivr through the import map in `index.html`.

## Controls

| Action | Input |
| --- | --- |
| Steer | Move the pointer or finger, or use the arrow keys / WASD |
| Overdrive | Tap or press Space once the meter is full |
| Mute / unmute | `M` or the SOUND button |

## How it plays

- **Orbs** fill the overdrive meter and build a streak. Every 5 orbs in a row raises the multiplier, up to x8.
- **Overdrive** lasts 5.5 seconds. Walls shatter instead of crashing you, the score doubles, and nearby orbs are pulled toward you.
- **CLOSE!** bonus: threading a hole right at its edge scores extra and charges the meter.
- **Crystals** give a big charge boost.
- The palette shifts every 700 units of distance: NEON CITY, SUNSET STRIP, ACID GRID, NEBULA DRIVE.
- The best score is saved in `localStorage`.

## Layout

- `index.html`: page shell, HUD and overlays, import map
- `css/style.css`: HUD and overlay styling
- `js/main.js`: renderer, bloom post-processing, game state, scoring, input
- `js/world.js`: neon frame tunnel, rails, starfield and sun
- `js/track.js`: wall patterns, orbs, crystals and collision rules
- `js/player.js`: ship model
- `js/fx.js`: particles, shattering walls and popups
- `js/audio.js`: procedural WebAudio sound effects and music
- `js/config.js`: tuning constants and colour palettes

`window.neonDrift` is exposed in the console as a debugging handle (state, track, camera and ship).
