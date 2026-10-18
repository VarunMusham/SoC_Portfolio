# Content guide

Each IP block has one entry in `src/data/ips.ts`. The landing page builds the
legend and the 3D chips from this array, and each entry gets its own documentation
page at `/ip/<slug>`.

> The shipped content is **placeholder**. The register offsets, reset values,
> signal lists and descriptions are illustrative and must be replaced with values
> from your specifications before the site is published.

## The `IpDoc` entry

```ts
{
  slug: 'spi',
  name: 'SPI',
  fullName: 'Serial Peripheral Interface',
  summary: 'Full-duplex synchronous serial link for flash, sensors and displays.',
  version: 'r2p1',
  overview: ['First paragraph.', 'Second paragraph.'],
  features: ['Master and slave operation', 'Four chip-select lines'],
  registers: [
    { name: 'CTRL', offset: '0x00', access: 'RW', reset: '0x00000000',
      description: 'Mode, clock divider, chip select and enable bits' },
  ],
  signals: [
    { name: 'sclk', direction: 'out', description: 'Serial clock' },
  ],
  programming: ['Set master mode and the clock divider in CTRL.'],
}
```

| Field | Type | Where it appears | Notes |
| --- | --- | --- | --- |
| `slug` | string | URL (`/ip/<slug>`), React keys | Lowercase, URL-safe, unique. Changing it breaks existing links. |
| `name` | string | Chip lid, 3D callout, legend button | Keep it short. Names of three characters or fewer are printed larger on the lid. |
| `fullName` | string | Documentation page heading | |
| `summary` | string | Documentation page, and read by screen readers from the legend | One sentence. |
| `version` | string | Chip lid (uppercased) and the documentation metadata | Your IP revision, for example `r2p1`. |
| `overview` | string[] | Overview section | One string per paragraph. |
| `features` | string[] | Features list | Short phrases. |
| `registers` | RegisterRow[] | Register map table | See below. |
| `signals` | SignalRow[] | Signals table | See below. |
| `programming` | string[] | Programming section, shown as numbered steps | Put these in order. |

### `RegisterRow`

| Field | Allowed values | Notes |
| --- | --- | --- |
| `name` | any | Register mnemonic, for example `CTRL`. |
| `offset` | any | Free text. Use `0x` hex, or a formula such as `0x100 + n*0x20` for arrays. |
| `access` | `'RW'`, `'RO'`, `'WO'`, `'W1C'` | `W1C` means write 1 to clear. |
| `reset` | any | Free text, for example `0x00000000` or `pin state`. |
| `description` | any | One line. |

### `SignalRow`

| Field | Allowed values | Notes |
| --- | --- | --- |
| `name` | any | Signal name, including bus ranges such as `gpio[31:0]`. |
| `direction` | `'in'`, `'out'`, `'inout'` | From the IP's point of view. |
| `description` | any | One line. |

## Adding or removing a block

1. Add or remove an entry in the `ips` array. Keep the order you want on the ring.
2. Nothing else needs changing. The legend, the 3D ring, the bus lines and the
   documentation routes are all generated from the array.
3. Check the result with `npm run dev`. The ring spacing is tuned for eight blocks.
   More blocks have not been tested, and the bus and label layout may need tuning.

## Writing tips

- Write for the engineer who will integrate the block. Lead with what it does, then
  the programming sequence.
- Keep each `description` to one line. The tables are narrow on phone screens.
- Use the same register names as your RTL and specification, so readers can search
  them.
- If a value is not yet verified, say so in the text rather than presenting a guess
  as fact.
