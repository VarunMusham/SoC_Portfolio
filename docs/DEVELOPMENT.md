# Development

## Setup

```bash
npm install
npm run dev
```

The project uses:

- Vite 8, React 19 and TypeScript
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

### Manual checks

Test these by hand in a browser after any change to the diagram or the transitions:

1. The page loads without console errors.
2. The whole diagram is visible at 1366x768, 1536x864 and 1920x1080.
3. Hovering a peripheral turns its block and arrow blue.
4. Clicking a peripheral opens the docs as a circle that grows from that block.
5. Esc and the back button shrink the circle back into the block, and focus returns to it.
6. Refreshing on `/ip/<slug>` shows the docs.
7. Tab visits the peripherals from left to right, and Enter opens one.
8. With reduced motion enabled in the OS settings, the docs open and close as quick cuts.

## Troubleshooting

**The docs reveal is invisible, or it covers the whole screen in one frame.**
The circle's radius must be the distance to the screen corner. Check
`coverRadius()` in `IpPage.tsx`. A radius of `150vmax` makes most of the
animation happen before the first frame is drawn.

**The reveal starts from the wrong place.**
`blockOrigin()` in `lib/origin.ts` measures the `.block` rect inside the link. Measuring
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
Software rendering is slow, so frame timestamps do not match wall-clock time. To
inspect a transition, pause the page's animations with `Animation.pause()` and
set `currentTime`. Do not rely on screenshot timing.

## Known limitations

- **No automated tests.** The flows above were checked by hand and with headless
  Chrome scripts.
- **Placeholder content.** See [CONTENT_GUIDE.md](CONTENT_GUIDE.md).
- **Laptop screens only.** Phones, tablets and portrait displays are not
  supported. There is no responsive layout. The diagram scales down on a narrow
  window, but its text becomes small.
- **Thirteen blocks.** The layout is spaced evenly for the `ips` array as it stands.
  Many more blocks would need a narrower box or a third row.
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
