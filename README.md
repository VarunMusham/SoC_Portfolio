# SoC Legacy IP Portfolio

An interactive portfolio for legacy SoC peripheral IP. The landing page renders a
slowly rotating system-on-chip on a circuit board, with its IP blocks (SPI, I2C,
UART, GPIO, TTC, WDT, DMA, CAN) as chip packages around it. Click a chip and the
camera flies into it. Its documentation then opens as a circle that grows out of
the chip, over the live scene.

![Landing page](docs/assets/landing.png)

![Documentation page](docs/assets/docs-page.png)

## Features

- Real-time 3D board built with React Three Fiber, with bloom, depth of field and
  tone mapping.
- Camera flight into a chip, and a clip-path reveal that starts from the chip's
  position on screen. Esc or the back button reverses both.
- Deep links (`/ip/spi`) and browser history work. The camera always follows the URL.
- A clean landing view with no text: just the board. A visually hidden list of the
  IP blocks gives keyboard and screen-reader access (press Tab to see it). The 3D
  scene itself is hidden from assistive technology.
- Built for laptop-sized screens only (checked at 1366x768, 1536x864 and 1920x1080).
- Reduced-motion support, a no-WebGL fallback, and automatic render-quality
  scaling.
- All documentation lives in one typed data file.

## Quick start

Requirements: Node.js 22 (the project was built and checked with 22.13), and npm.

```bash
npm install
npm run dev
```

Open the URL that Vite prints (usually http://localhost:5173).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check (`tsc -b`) and build the production bundle into `dist/` |
| `npm run preview` | Serve the production build locally, for checking before deployment |
| `npm run lint` | Run oxlint over `src/` |

## Editing the content

All IP documentation is in [`src/data/ips.ts`](src/data/ips.ts). The register
tables, signal lists and descriptions there are **placeholders**. Replace them
with values from your own specifications before publishing.

See [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) for the field-by-field reference.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) | How to write and add IP documentation |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Component map, camera and transition flow, rendering pipeline |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Working on the code: testing, render quality, known limitations, troubleshooting |

## Project layout

```
src/
  App.tsx              routes; the scene stays mounted under the docs
  main.tsx             entry point (BrowserRouter)
  index.css            design tokens and all styles
  data/ips.ts          IP documentation (edit this)
  lib/motion.ts        reduced-motion and WebGL detection
  pages/
    Landing.tsx        hidden headline and IP list, lazy-loaded 3D scene
    IpPage.tsx         documentation page and circle reveal
  scene/
    SocScene.tsx       canvas, lighting, camera flights, post-processing
    MainChip.tsx       the SoC package
    IpChip.tsx         one IP package with hover lift
    Board.tsx          board laminate, components and status LEDs
    Streaks.tsx        shader for travelling light along traces
    textures.ts        procedural circuit, board and lid textures
    layout.ts          ring geometry and placement rules
    pins.ts            shared pin and pad helpers
```

## Deployment

This is a single-page app with routes such as `/ip/spi`. The host must serve
`index.html` for any path it does not recognise. Otherwise a refresh on `/ip/spi`
returns a 404.

- **Netlify:** add a `public/_redirects` file containing `/* /index.html 200`.
- **Vercel:** works without configuration for Vite apps.
- **GitHub Pages:** copy `dist/index.html` to `dist/404.html`, or switch to hash
  routing. Serve from a subpath only after setting `base` in `vite.config.ts`.

The 3D scene is code-split into its own chunk (about 1.1 MB, roughly 300 KB
gzipped). The documentation pages do not download it.

Fonts (Instrument Serif, IBM Plex Sans and IBM Plex Mono) load from Google Fonts.

## Skills used during development

Two agent skills were installed with `npx skills` and are **not** committed:

```bash
npx skills add anthropics/skills@frontend-design
npx skills add freshtechbro/claudedesignskills@react-three-fiber
```

`skills-lock.json` records their sources and hashes.

## License

No license has been chosen yet. Until one is added, all rights are reserved by the author.
