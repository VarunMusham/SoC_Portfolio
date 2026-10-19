# Architecture

This document explains how the pieces fit together, and why a few of the less
obvious choices were made.

## Overview

The app has two routes:

| Route | Component | What is visible |
| --- | --- | --- |
| `/` | `Diagram` | The SVG block diagram |
| `/ip/:slug` | `IpPage` | A documentation page over the same diagram |

`App.tsx` renders `Diagram` on every route, so it stays mounted while the docs are
open. The docs route is an overlay. This is what lets the page open from a block and
shrink back into it.

```
URL ──▶  Diagram (always mounted, inert while docs are open)
         Routes
         ├─ "/"          → null
         └─ "/ip/:slug"  → IpPage (fixed overlay, circle reveal)
```

## Source map

| File | Responsibility |
| --- | --- |
| `src/data/ips.ts` | The only source of documentation content. Typed as `IpDoc`. |
| `src/diagram/layout.ts` | Coordinates for the CPUs, buses, bridge and peripherals, in one 1600x900 space. |
| `src/diagram/flow.ts` | The traffic schedule: every pulse with its start and duration, the arrival times, the hover route, and the generated keyframes. |
| `src/pages/Diagram.tsx` | Draws the SVG. Each peripheral is a router `Link` around its glass block. |
| `src/pages/IpPage.tsx` | The documentation page. Runs the reveal and close animations with the Web Animations API. |
| `src/lib/origin.ts` | Finds a block's centre on screen from the DOM. |
| `src/lib/motion.ts` | Reduced-motion detection. |

## Diagram layout

Everything is positioned in a fixed `viewBox` of 1600x900. The SVG scales to fit the
window with `preserveAspectRatio="xMidYMid meet"`. Text and strokes scale with it,
which keeps the picture identical at the supported laptop sizes (1366x768, 1536x864 and
1920x1080) without per-size rules.

```
   [CPU 1]   [CPU 2]
  ───────────────────  AHB
        [AHB2APB]
  ─────────────────────────────────────────  APB
  [UART] [SPI] [xSPI] [PWM] [TTC] [SD4] [GPIO]      row 0
     [I2C] [I2S] [QSPI] [RTC] [WDT] [SD6/eMMC]      row 1
```

- The CPUs, the bridge and the two buses are fixed in `layout.ts`.
- Peripherals come from the `ips` array. Index `i` goes in column `i`, in row `i % 2`.
  Columns are spaced evenly across the APB bus. A row-1 arrow drops between two row-0
  boxes, which is what lets thirteen blocks share one bus.
- Only the peripherals are links. The CPUs and the bridge are drawn for context.

## Data flow

1. **Selection.** Clicking a peripheral, or pressing Enter on it, follows its `Link`
   to `/ip/<slug>`. A page load on that URL does the same.
2. **Reveal.** `IpPage` mounts and asks `blockOrigin(slug)` for the block's centre on
   screen. It animates a clip-path circle from there out to the screen corner. The
   reveal lasts 900 ms. Paging between blocks swaps the content in place, without
   replaying it.
3. **Inert diagram.** While the docs are open the diagram is `inert` and `aria-hidden`.
4. **Close.** Esc or the back button shrinks the circle back into the block (700 ms),
   then navigates to `/`. `Diagram` then focuses that block again, so keyboard users
   keep their place.

`blockOrigin` measures the block's `rect`, not the link. The link's box also spans the
arrow up to the bus, so its centre would be in the wrong place.

## Animation

**Traffic.** `flow.ts` builds one 9-second loop from the layout. A request leaves each CPU,
merges on the AHB bus, crosses the bridge and spreads along the APB bus. Each peripheral arrow
lights as the wave passes its tap, so far blocks are reached later. The response is the same
schedule reversed in direction and in time, drawn in mint instead of blue.

Each pulse is a short dash on a wire, measured against `pathLength="100"` so one keyframe shape
fits every wire. `flowCss()` generates a keyframe per pulse that holds the dash off-screen except
during its slot in the loop. The animations are plain CSS, so the browser can pause them and
there is no per-frame JavaScript. Both the CSS and the schedule use `CYCLE`, passed to the CSS
as `--cycle`.

**Arrival flash.** Each block has a `.flash` overlay that uses the same loop with its own
`animation-delay`, so it glows when the wave lands.

**Lift.** Hover and keyboard focus scale the block by 1.09 from its top edge, so it stays joined
to its arrow. The shadow deepens at the same time. The easing is a damped spring, sampled as a CSS
`linear()` curve with a cubic-bezier fallback.

**Route.** The pointer or focus on a block lights the path from the bridge, along the APB bus, to
that block: a dim solid line with a bright dash running along it. It fades out after the pointer
leaves, which is why the last route stays in the DOM.

**Entrance.** On load the frame fades in, the buses draw themselves, and the blocks rise one by one.

**Pausing.** One second after the docs open, the diagram is marked `is-covered` and every
animation is paused. It resumes when the docs close.

## Interaction states

A peripheral turns blue (`--hot`) on hover and on keyboard focus. Focus also draws a white ring
around the block, because blue alone is hard to tell from hover. A transparent strip between the
bus and each block makes the arrow part of the hit area.

## Accessibility and fallbacks

- A visually hidden `h1` names the page. The SVG is a `group` with a label, and each
  peripheral link is labelled with its name and summary.
- Tab walks the peripherals in `ips` order, which is also left-to-right order.
- **Reduce Motion** removes the travelling pulses, the arrival flash, the lift and the entrance,
  and opens and closes the docs without the circle. Hover state still shows through colour.
- **Reduce Transparency** removes the glass gradient, the shadows and the glow.
- **Increase Contrast** brightens the wires and block rims.
- Nothing needs WebGL or any other special capability, so there is no fallback view.

## Styling

`src/index.css` defines one set of tokens on `:root`. The look is a dark appearance in the
style of Apple's interfaces: near-black surfaces separated by hairlines, a single system blue
(`#0a84ff`) for interaction, light-on-dark glass blocks with a lit rim, a rounded-corner radius
of 14, and spring motion. Type uses the system font first (SF Pro on Apple devices) and Inter
elsewhere. The docs page is the same palette, one step lighter, so the circle reveal is visible
against the diagram.

This follows Apple's published guidance (the Human Interface Guidelines, the Liquid Glass
material and its motion principles, and the Reduce Motion, Reduce Transparency and Increase
Contrast settings). It is an interpretation for the web, not a certified implementation. No
WWDC 2026 specific guidance was available to check against.

There are no responsive breakpoints, because only laptop-sized screens are supported.
