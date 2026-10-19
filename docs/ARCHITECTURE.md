# Architecture

This document explains how the pieces fit together, and why a few of the less
obvious choices were made.

## Overview

The app has two routes:

| Route | Component | What is visible |
| --- | --- | --- |
| `/` | `Landing` | The block diagram: 3D if WebGL is available, otherwise the flat SVG |
| `/ip/:slug` | `IpPage` | A documentation page over the same diagram |

`App.tsx` renders `Landing` on every route, so the diagram stays mounted while the docs are
open. The docs route is an overlay. This is what lets the page open from a block and shrink
back into it.

```
URL ──▶  Landing (always mounted, inert while docs are open)
         ├─ 3D: SocScene (lazy, WebGL) + title overlay + hidden list of links
         └─ flat: Diagram (SVG), when WebGL is missing or ?view=2d
         Routes
         ├─ "/"          → null
         └─ "/ip/:slug"  → IpPage (fixed overlay, circle reveal)
```

## Source map

| File | Responsibility |
| --- | --- |
| `src/data/ips.ts` | The only source of documentation content. Typed as `IpDoc`. |
| `src/diagram/layout.ts` | 2D coordinates of every block and bus, in one 1600x900 space. The source of truth for both views. |
| `src/diagram/flow.ts` | The traffic schedule: every pulse with its start and duration, and arrival times. Used by both views. |
| `src/pages/Landing.tsx` | Picks 3D or flat. In 3D it decides what the camera focuses on, from the URL and the list. |
| `src/pages/Diagram.tsx` | The flat SVG diagram, with the same traffic and lift in CSS. Kept as the fallback. |
| `src/pages/IpPage.tsx` | The documentation page. Runs the reveal and close animations with the Web Animations API. |
| `src/lib/origin.ts` | Where a block is on screen: published by the 3D scene, or measured from the flat DOM. |
| `src/scene/SocScene.tsx` | Canvas, camera director (intro, parallax, flights), lights, quality tiers and post-processing. |
| `src/scene/world.ts` | Stands the 2D layout up in 3D: tiers, heights and the 3D path of every wire. |
| `src/scene/Stage.tsx` | The board, the surrounding components, the two tiers and the bus rails. |
| `src/scene/Block.tsx` | One glass block (the bridge and each peripheral): lift spring, label, shadow, arrival flash and pointer events. |
| `src/scene/Chip.tsx`, `pins.ts` | The CPU package: substrate with traces, pins, interposer, gold pads, and a floating lid. |
| `src/scene/Wires.tsx`, `wires.ts` | The conduits, the travelling light and the hover route, as three meshes with two shaders. |
| `src/scene/textures.ts` | Canvas-generated labels, tier surfaces, shadow and board texture. |
| `src/scene/state.ts` | Per-frame state shared by every part, and the intro timeline. |

## The 3D scene

### From the flat layout

The scene is the flat diagram stood up. `world.ts` maps 2D `x` to world `x` and 2D `y` to depth
(`z`), at 100 px per unit, so every block lands where it was in the flat view. Height then
carries the hierarchy:

| Tier | Top height | Holds |
| --- | --- | --- |
| AHB tier | 0.55 | the CPU, the AHB bus, the AHB2APB bridge |
| APB tier | 0.14 | the APB bus and the thirteen peripherals |

The one wire that leaves the bridge drops from one tier to the other. That is the only wire
with a bend; every other wire is straight.

### The CPU chip

The CPU is not a `Block`. `Chip.tsx` builds an exploded view of a package from the bottom up:
a dark substrate whose top is a generated fan-out routing texture (also its emissive map, so only
the copper glows), a ring of instanced gold pins, an interposer with a row of pads, a blue point
light in the gap, and a heat-spreader lid floating above with the name etched in.

- **Assembly.** The package drops onto the tier with the other parts, then the lid lifts away over
  about a second. After that the lid bobs gently, and the gap holds the under-glow.
- **Light.** The traces and the under-glow flare as the CPU sends a request and again when the last
  response returns (`arrival.cpuLaunch` and `arrival.cpu` in `flow.ts`).
- **Size.** In 3D the package is 3.0 units square, larger than its 2.6-unit slot in the flat layout,
  because it is the centrepiece. The tier and the wires are sized from it, not from the flat box.
- **Not interactive.** The CPU has no documentation page, so it has no pointer handlers.

The flat view draws the CPU as a small chip icon (substrate, a ring of pin ticks, the die) in the
same place.

### Frame state

`SocScene` writes one mutable `SceneState` object (intro time, hovered block, focused block,
whether motion is allowed) at the start of every frame. Every part reads it in its own frame
callback. Hovering therefore never re-renders React.

### Traffic

`flow.ts` builds one 8-second loop from the layout: a request leaves the CPU, taps the AHB rail
(which carries it outward), crosses the bridge and spreads along the APB bus; each peripheral's wire lights as the wave
passes its tap. The response is the same schedule reversed in direction and in time.

In 3D, `wires.ts` builds a tube along every pulse's wire and merges all of them into **one mesh**.
Each vertex carries its distance along the wire and its slot in the loop. The fragment shader
draws a comet in world units: a sharp head and a soft tail, so every wire gets the same comet
however long it is. Outside its slot a fragment is discarded. Blending is additive and the
output is brighter than 1, so the bloom pass makes it glow. Request light is blue and response
light is mint.

Each block also flashes as the wave lands, using the same arrival times, so the glow and the
light agree.

### Lift and hover

`Block` runs a damped spring (stiffness 170, damping 13) toward lifted or resting. A lifted block
rises 0.34, grows slightly, turns blue and its soft shadow spreads. The other blocks dim. A point
light follows the lit block and washes the tier around it in blue.

The hover **route** is a third mesh holding the path to every peripheral, tagged with its index.
A shader shows only the lit one: a dim solid line with bright dashes running away from the bridge.
It rides just above the rail so it is never hidden inside it. It fades out on its own index after
the pointer leaves, so it never snaps off.

### Camera

The camera is directed in `SocScene`:

1. **Intro.** It starts high and far, and dollies into the overview while the tiers rise, the
   wires grow and the blocks drop in one after another. The timeline is `INTRO` in `state.ts`.
2. **Overview.** It leans toward the pointer by up to 0.9 units, smoothed. This is off under
   Reduce Motion.
3. **Flight.** A click flies it to the block along a Bezier arc that rises 3 units mid-flight,
   so it swoops over the board instead of skimming it (1.5 s in, 1.6 s out). The lit route and
   the block's lift stay on during the flight.
4. **Arrival.** The block's position on screen is projected and published through `origin.ts`;
   `Landing` then navigates to `/ip/<slug>`, and `IpPage` reveals from that point.

A deep link (`/ip/spi` on load) skips the intro and the flight: the camera starts on the block,
and its screen position is measured on the first frame, so closing can shrink back into it.

### Rendering

- **Post-processing:** bloom, film grain, vignette and ACES tone mapping. Depth of field is added
  at high quality only, because it is the most expensive pass.
- **Quality tiers:** the scene starts at high. `PerformanceMonitor` drops to low if the frame
  rate falls. Low uses a 1x pixel ratio, no depth of field and no multisampling.
- **Frame loop pausing:** `frameloop` is `never` while the docs cover the scene.
- **Instancing:** the surrounding components and their LEDs are instanced meshes.
- **Textures:** generated on a canvas at start-up, not loaded. Block labels are redrawn once the
  web fonts finish loading. Reflections come from a generated studio environment, not a CDN.

### Developer parameters

| Parameter | Effect |
| --- | --- |
| `?view=2d` | Show the flat SVG diagram |
| `?quality=high` / `?quality=low` | Pin the render tier |
| `?intro=1.5` | Freeze the intro at 1.5 seconds, to inspect or tune it frame by frame |

## Documentation overlay

1. **Selection.** Clicking a block, pressing Enter on a list item, or loading `/ip/<slug>` sets
   the focus.
2. **Reveal.** `IpPage` mounts and asks `blockOrigin(slug)` for the block's screen position. It
   animates a clip-path circle from there to the screen corner over 900 ms, with a long ease-out.
   Paging between blocks swaps the content in place, without replaying it.
3. **Cover.** One second after the docs open, the scene stops rendering. It resumes when the
   docs close.
4. **Close.** Esc or the back button shrinks the circle back into the block (700 ms), then
   navigates to `/`. The camera flies back to the overview.

## The flat fallback

`Diagram.tsx` draws the same layout as an SVG, with the same traffic schedule as CSS animations
and the same lift on hover. It is used when WebGL is missing or `?view=2d` is set. Its blocks are
real links, so it needs no separate list. See the comments in that file for its CSS animation
scheme.

## Accessibility and fallbacks

- The 3D canvas is `aria-hidden`. The same choice is offered as a visually hidden list of buttons,
  each named for its block, with the summary as hidden text. Pressing Tab reveals the list at the
  bottom of the screen; focusing an item previews the block just as hovering does.
- `inert` is applied to the main landmark while the docs are open.
- **Reduce Motion** removes the intro, the parallax, the lift and the travelling light, and turns
  flights into quick cuts. The docs open without the circle.
- Without WebGL the flat diagram is shown.

## Styling

`src/index.css` defines one set of tokens on `:root`. The look is a dark appearance in the style
of Apple's interfaces: near-black surfaces separated by hairlines, a single system blue
(`#0a84ff`), glass-and-metal blocks and spring motion. Type uses the system font first (SF Pro
on Apple devices) and Inter elsewhere.

This follows Apple's published guidance (the Human Interface Guidelines, the Liquid Glass
material and its motion principles). It is an interpretation for the web, not a certified
implementation. No WWDC 2026 specific guidance was available to check against.

There are no responsive breakpoints, because only laptop-sized screens are supported.
