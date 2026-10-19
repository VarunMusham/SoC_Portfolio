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
| `src/pages/Diagram.tsx` | Draws the SVG. Each peripheral is a router `Link` around its box and arrow. |
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

## Interaction states

A peripheral turns blue (`--hot`) on hover and on keyboard focus, along with its arrow.
Focus also draws a dark ring around the block, because blue alone is hard to tell from
hover. A transparent strip around each arrow makes the arrow part of the hit area.

## Accessibility and fallbacks

- A visually hidden `h1` names the page. The SVG is a `group` with a label, and each
  peripheral link is labelled with its name and summary.
- Tab walks the peripherals in `ips` order, which is also left-to-right order.
- `prefers-reduced-motion` opens and closes the docs without the circle, and removes
  the colour transitions.
- Nothing needs WebGL or any other special capability, so there is no fallback view.

## Styling

`src/index.css` defines one set of tokens on `:root`. The diagram uses the grey canvas,
slate blocks and blue highlight from the reference image. The docs page is a light
datasheet in the same cool palette. There are no responsive breakpoints, because only
laptop-sized screens are supported.
