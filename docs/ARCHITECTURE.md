# Architecture

This document explains how the pieces fit together, and why a few of the less
obvious choices were made.

## Overview

The app has two routes:

| Route | Page | What is visible |
| --- | --- | --- |
| `/` | `Landing` | The 3D SoC map, the hero text and the IP legend |
| `/ip/:slug` | `IpPage` | A documentation page over the same map |

`App.tsx` renders `Landing` on every route, so the 3D scene stays mounted while
the docs are open. The docs route is an overlay. This is what lets the page open
from a chip and shrink back into it, with the scene behind it.

```
           ┌────────────────────────── App ──────────────────────────┐
           │                                                          │
URL ──────▶│  Landing (always mounted)          Routes               │
           │  ├─ hero + legend (DOM)            ├─ "/"     → null    │
           │  ├─ SocScene (lazy, WebGL)         └─ "/ip/:slug"       │
           │  └─ scene-labels (DOM portal)          → IpPage (overlay)│
           └──────────────────────────────────────────────────────────┘
```

## Source map

| File | Responsibility |
| --- | --- |
| `src/data/ips.ts` | The only source of documentation content. Typed as `IpDoc`. |
| `src/pages/Landing.tsx` | Decides what the camera should focus on, from the URL and the legend. Holds the hero, the legend and the lazy import of the scene. |
| `src/pages/IpPage.tsx` | The documentation page. Runs the reveal and close animations with the Web Animations API. |
| `src/scene/SocScene.tsx` | Canvas setup, lights, the camera controller, rotation, quality tiers and post-processing. |
| `src/scene/MainChip.tsx` | The central SoC: substrate, pins, interposer, pads and a floating lid. |
| `src/scene/IpChip.tsx` | One IP package. Handles hover, the lift animation and the callout label. |
| `src/scene/Board.tsx` | Laminate texture, about 2,000 instanced components and status LEDs. |
| `src/scene/Streaks.tsx` | A single instanced draw call with a custom shader for the travelling light. |
| `src/scene/textures.ts` | Canvas-generated textures: circuit routing, board surface and lid markings. |
| `src/scene/layout.ts` | Ring geometry, sizes, and the keep-out rules used when placing procedural parts. |
| `src/scene/pins.ts` | Shared helper that builds pin and pad matrices for the instanced meshes. |
| `src/lib/motion.ts` | Reduced-motion and WebGL detection, and the easing function. |

## Data flow

1. **Selection.** A legend button, a click on a chip, or a page load on
   `/ip/<slug>` sets the focused chip. `Landing` derives `focusSlug` from the
   route (`docSlug`) or the last pick (`pickedSlug`).
2. **Camera.** `SocScene` watches `focusSlug`. When it changes, it builds a
   tween from the current camera pose to the chip's focus pose, or back to the
   overview if the focus is cleared.
3. **Arrival.** When the tween finishes, the scene reports the chip's position on
   screen through `onArrive`. `Landing` then navigates to `/ip/<slug>`, passing
   the position in router state.
4. **Reveal.** `IpPage` reads that position and animates a clip-path circle from
   it, out to the screen's corner radius. The reveal lasts 900 ms.
5. **Cover.** One second after the docs open, `Landing` marks the scene as
   covered. The render loop then stops, which saves the GPU while the reader works.
6. **Close.** Esc or the back button shrinks the circle back into the chip, then
   navigates to `/`. Because `focusSlug` is now empty, the camera pulls back to
   the overview.

## Camera transitions

All camera moves use one helper, `makeTween`, which follows a quadratic Bezier
curve. The start and end points are the current and target camera positions. The
control point sits halfway between them, raised by `ARC_LIFT` (3.5 units). The
camera therefore rises over the board and swoops down, rather than skimming it.

| Move | Duration | Field of view |
| --- | --- | --- |
| Fly to a chip | 1400 ms | 36° to 28° |
| Return to overview | 1500 ms | 28° to 36° |
| Reduced motion (either way) | 250 ms | unchanged |

Both the focus pose and the overview pose depend on the viewport shape. Wide
screens shift the scene to the right of the hero text. Portrait screens pull the
camera back so the whole ring fits.

## Rendering

- **Post-processing** (`@react-three/postprocessing`): depth of field, bloom,
  film grain, vignette and ACES tone mapping. Depth of field is only enabled at
  high quality, because it is the most expensive pass.
- **Quality tiers.** The scene starts at high quality. `PerformanceMonitor`
  switches to low if the frame rate drops. Low quality uses a 1x pixel ratio,
  no depth of field and no multisampling. The `?quality=` URL parameter pins
  either tier.
- **Frame loop pausing.** `frameloop` is `never` while the docs cover the scene,
  and `always` otherwise.
- **Instancing.** The board, its components, the LEDs, the pins and the bus
  streaks are all instanced meshes, so each group is one draw call.
- **Textures.** They are generated on a canvas at start-up, not loaded from files.
  Lid and footprint text is redrawn once the web fonts finish loading.

## Labels

IP callouts and the SoC label are drei `Html` components. Each one renders into
`.scene-labels`, a `div` that React owns, through the `portal` prop.

The default `Html` behaviour appends its node to the canvas container and removes
it manually on unmount. When the landing page unmounted during navigation, that
manual removal threw `NotFoundError: removeChild`. Using a React-owned portal
avoids the problem. See [DEVELOPMENT.md](DEVELOPMENT.md#troubleshooting).

## Accessibility and fallbacks

- The legend is the accessible navigation. Each button has the chip's name, and
  its summary is read by screen readers through visually hidden text.
- Keyboard focus on a legend button previews the chip, just as hovering does.
- The scene container is `aria-hidden`, and `inert` is applied to the main
  landmark while the docs are open.
- `prefers-reduced-motion` turns off board rotation, shortens camera moves to
  quick cuts, and opens the docs without the reveal.
- Without WebGL (`supportsWebGL()` returns false), the scene is not mounted. The
  page becomes a plain list of buttons.

## Styling

`src/index.css` defines one set of tokens on `:root`: colours, fonts and the paper
palette used by the datasheet page. The landing page is dark and the docs page is
light, which makes the circle reveal read as a change of medium. Layout breakpoints
are at 860 px (docs stack to one column) and 640 px (legend becomes a four-column
grid, and the hero gets a dark fade for readability).
