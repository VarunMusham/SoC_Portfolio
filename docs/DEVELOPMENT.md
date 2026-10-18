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

`npm run lint` reports eight `react(immutability)` warnings, from four call sites in
`SocScene.tsx` and `Streaks.tsx`. Each site is reported twice. They come from
mutating the camera and the shader uniforms inside frame callbacks. This is the
standard React Three Fiber pattern, and the linter cannot tell it apart from an
unsafe mutation.

### Manual checks

Test these by hand in a browser after any change to the scene or the transitions:

1. Landing page loads without console errors.
2. Clicking a chip flies the camera in, and the docs reveal from that chip.
3. Esc and the back button return to the map, and the camera pulls back out.
4. Refreshing on `/ip/<slug>` shows the docs. The camera starts on that chip.
5. Hovering a chip lifts it, lights its bus, shows its name and pauses the rotation.
6. The whole ring is visible at 1366x768, 1536x864 and 1920x1080.
7. Pressing Tab reveals the hidden IP list at the bottom of the screen.
8. With reduced motion enabled in the OS settings, transitions are quick cuts.

## Render quality for testing

Append `?quality=low` or `?quality=high` to the URL to pin the render tier.
Use `low` to check the fallback path on a slow machine, and `high` for
screenshots.

## Troubleshooting

**`NotFoundError: Failed to execute 'removeChild'` when leaving the landing page.**
Caused by drei `Html` labels rendering into the canvas container and removing
themselves manually during unmount. Keep `portal={labelRoot}` on every `Html`
component. Do not remove the `scene-labels` div from `Landing.tsx`.

**The docs reveal is invisible, or it covers the whole screen in one frame.**
The circle's radius must be the distance to the screen corner. Check
`coverRadius()` in `IpPage.tsx`. A radius of `150vmax` makes most of the
animation happen before the first frame is drawn.

**A refresh on `/ip/<slug>` returns 404.**
The host lacks an SPA fallback. See the deployment section of the README.

**The 3D view is blank.**
Check that WebGL is available. Open `chrome://gpu` or the equivalent. If it is
not, the page should fall back to the list view. If it does not, check the console
for an error.

**Headless screenshots show the wrong animation frame.**
Software WebGL is slow, so frame timestamps do not match wall-clock time. To
inspect a transition, pause the page's animations with `Animation.pause()` and
set `currentTime`, as the scene tests did. Do not rely on screenshot timing.

## Known limitations

- **No automated tests.** The flows above were checked by hand and with headless
  Chrome scripts.
- **Not profiled on real GPUs.** The quality tiers are a guess until tested on
  integrated graphics.
- **The scene chunk is large.** It is about 1.1 MB before compression, mostly
  three.js and the post-processing library. It loads only on the landing page.
- **Placeholder content.** See [CONTENT_GUIDE.md](CONTENT_GUIDE.md).
- **Laptop screens only.** Phones, tablets and portrait displays are not
  supported. There is no responsive layout.
- **Eight blocks.** The layout is tuned for eight IP blocks. More blocks have not
  been tested.
- **External fonts.** Fonts load from Google Fonts. The page still works without
  them, but the typography falls back to system faces.

## Conventions

- Comments explain why, not what.
- Keep the scene's magic numbers in named constants at the top of each file, or in
  `layout.ts` when they affect placement.
- Put new documentation content in `src/data/ips.ts`, not in components.
- Styles go in `src/index.css`, using the tokens on `:root`.
