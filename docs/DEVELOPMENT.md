# Development

## Setup

```bash
npm install
npm run dev
```

The project uses:

- Vite 8, React 19 and TypeScript
- three.js, React Three Fiber 9, drei 10
- @react-three/postprocessing 3 and postprocessing 6
- react-router-dom 7
- oxlint for linting

## Checking your work

There is no automated test suite yet. Before committing, run:

```bash
npm run build    # type-checks with tsc -b, then bundles
npm run lint     # oxlint over src/
```

`npm run build` runs the type check first. If it fails, Vite does not run, so
`dist/` keeps the previous bundle. Always check the build output, not just the
exit code of the preview server.

`npm run lint` reports a number of `react(immutability)` warnings in the scene files. They come
from mutating the camera, materials and shared scene state inside frame callbacks. That is the
standard React Three Fiber pattern, and the linter cannot tell it apart from an unsafe mutation.
Nothing else should warn.

### Manual checks

Test these by hand in a browser after any change to the scene or the transitions:

1. The page loads without console errors. (`THREE.Clock` is deprecated is expected, from a dependency.)
2. The intro plays: the camera dollies in, the tiers rise, the chip lands and its lid lifts off,
   and the blocks drop in one by one.
3. Light travels from the CPU to the peripherals, then back in mint. Blocks glow as it lands, and
   the chip's traces and under-glow flare as it sends and receives.
4. Pointing at a block lifts it, turns it blue, dims the others and lights its route.
5. Clicking a block flies the camera over the board to it, and the docs open as a circle from it.
6. Esc and the back button shrink the circle back and the camera flies out.
7. Refreshing on `/ip/<slug>` shows the docs; the camera starts on that block.
8. Tab reveals the hidden list; Enter on an item flies to that block.
9. The whole diagram is visible at 1366x768, 1536x864 and 1920x1080.
10. With reduced motion enabled in the OS settings, there is no intro, parallax or travelling
    light, and flights are quick cuts.
11. `?view=2d` shows the flat diagram, and everything above still works there.
12. Once the docs are open, the scene has stopped rendering.

## Render quality and developer parameters

| Parameter | Effect |
| --- | --- |
| `?quality=low` / `?quality=high` | Pin the render tier. Use `low` to check the slow-machine path and `high` for screenshots. |
| `?intro=1.5` | Freeze the intro at that many seconds. Useful for tuning it, and for screenshots on machines that render slowly. |
| `?view=2d` | Force the flat SVG diagram. |

## Troubleshooting

**The docs reveal is invisible, or it covers the whole screen in one frame.**
The circle's radius must be the distance to the screen corner. Check
`coverRadius()` in `IpPage.tsx`. A radius of `150vmax` makes most of the
animation happen before the first frame is drawn.

**The reveal starts from the wrong place, or is just a fade.**
In 3D the scene publishes the block's screen position when the camera arrives
(`publishBlockOrigin` in `lib/origin.ts`). If nothing was published, `IpPage` falls back to
measuring the flat diagram's `.block-base` rect, and finally to a plain fade. On a deep link the
position is measured on the first frame, so a reveal on load is not expected.

**Clicking a block flies the camera but never opens the docs.**
Arrival is reported by the camera tween finishing. The start-pose layout effect in `SocScene`
must run on mount only. If it re-runs on a focus change it snaps the camera to the block first, and
the flight has nowhere to go.

**The route to a hovered block is missing along the bus.**
Wire paths in `world.ts` sit at fixed heights and the route is lifted by `ROUTE_LIFT` so it rides
above the rail. A route at rail height is hidden inside the rail's box. Measuring
the link itself gives the wrong point, because it also spans the bus arrow.

**A refresh on `/ip/<slug>` returns 404.**
The host lacks an SPA fallback. See the deployment section of the README. On GitHub
Pages the workflow provides it by copying `index.html` to `404.html`.

**A local Pages build loads a blank page, or its assets 404.**
Check three things. `VITE_BASE` must be set for both the build and the preview
server, because `vite preview` reads it too. In Git Bash, a value starting with `/`
is turned into a Windows path (you will see `/Program Files/Git/...` in
`dist/index.html`), so prefix the command with `MSYS_NO_PATHCONV=1`. And restart
`vite preview` after rebuilding, because it indexes `dist` at startup.

**Headless screenshots show the wrong animation frame.**
Software WebGL renders about one frame a second, so the time-based intro and flights are over
before the first screenshot. Use `?intro=<seconds>` to freeze the intro for a screenshot. Launch
Chromium with `--use-angle=swiftshader --use-gl=angle --enable-unsafe-swiftshader` to get WebGL
headless. For the flat view, pause the page's animations with `Animation.pause()` and set
`currentTime`. Do not rely on screenshot timing.

**The 3D view is blank.**
Check that WebGL is available (`chrome://gpu`). If it is not, the flat diagram should appear
instead. If it does not, check the console for a shader or texture error.

**The pulses and the flash drift out of step.**
`CYCLE` in `flow.ts` is the loop length. The flat view passes it to its CSS as `--cycle`, and the
3D shader gets it as the `uCycle` uniform. Both the light and the block flashes use the scene clock,
so they stay together. Do not hard-code a duration.

**A new timing is added but nothing moves.**
Pulses live in `pulses` in `flow.ts`. A pulse with `start + dur` past `CYCLE` never finishes
its slot. Keep every pulse inside the loop.

## Known limitations

- **No automated tests.** The flows above were checked by hand and with headless
  Chrome scripts.
- **Placeholder content.** See [CONTENT_GUIDE.md](CONTENT_GUIDE.md).
- **Laptop screens only.** Phones, tablets and portrait displays are not
  supported. There is no responsive layout. The diagram scales down on a narrow
  window, but its text becomes small.
- **Thirteen blocks.** The layout is spaced evenly for the `ips` array as it stands.
  Many more blocks would need a narrower box or a third row.
- **Not profiled on real GPUs.** The quality tiers are a guess until tested on integrated
  graphics. All checks so far used software WebGL, which is far slower than a real GPU.
- **The scene chunk is large.** It is about 1.1 MB before compression, mostly three.js and the
  post-processing library. It loads only on the map page, and the flat fallback does not need it.
- **Flat-view animation cost.** The flat diagram runs about 65 CSS animations at once. They are
  cheap on a laptop, but repaint SVG on the main thread. They pause when the docs cover it.
- **All peripherals on APB.** The diagram follows the reference and puts every block on
  the APB bus, including the high-bandwidth ones (xSPI, QSPI, SD4 and SD6/eMMC). That is
  a drawing choice, not a statement about the real bus topology.
- **External fonts.** Fonts load from Google Fonts. The page still works without
  them, but the typography falls back to system faces.

## Conventions

- Comments explain why, not what.
- Keep geometry in `src/diagram/layout.ts`, not in the component.
- Put new documentation content in `src/data/ips.ts`, not in components.
- Styles go in `src/index.css`, using the tokens on `:root`.
