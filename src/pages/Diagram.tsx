import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useMatch } from 'react-router-dom';
import { arrival, CYCLE, flowCss, pulsePath, pulses, routeFor } from '../diagram/flow';
import { ahb, apb, bridge, centreX, cpus, peripherals, VIEW, type Box } from '../diagram/layout';
import { ips } from '../data/ips';

const HEAD = { length: 14, half: 7 };
const RADIUS = 14;

// The docs reveal takes 900 ms; once it has finished the diagram is fully covered and can stop animating.
const COVER_MS = 1000;

const FLOW_CSS = flowCss();

// A double-headed vertical arrow, as in the reference diagram.
function Arrow({ x, from, to }: { x: number; from: number; to: number }) {
  return (
    <g className="link">
      <line x1={x} y1={from + HEAD.length} x2={x} y2={to - HEAD.length} />
      <polygon points={`${x},${from} ${x - HEAD.half},${from + HEAD.length} ${x + HEAD.half},${from + HEAD.length}`} />
      <polygon points={`${x},${to} ${x - HEAD.half},${to - HEAD.length} ${x + HEAD.half},${to - HEAD.length}`} />
    </g>
  );
}

// A glass block: a soft shadow, a dark base, a lit rim, and a flash for when traffic arrives.
function Block({ box, label, variant, flashAt }: { box: Box; label: string; variant: 'infra' | 'ip'; flashAt?: number }) {
  const shape = { x: box.x, y: box.y, width: box.width, height: box.height, rx: RADIUS };
  return (
    <g className={`lift lift--${variant}`}>
      <rect className="shadow" {...shape} filter="url(#soft)" />
      <rect className="block-base" {...shape} />
      <rect className="block-glass" {...shape} fill="url(#glass)" stroke="url(#rim)" />
      {flashAt !== undefined && <rect className="flash" {...shape} style={{ '--at': `${flashAt}s` } as CSSProperties} />}
      <text className="block-label" x={centreX(box)} y={box.y + box.height / 2}>
        {label}
      </text>
    </g>
  );
}

function Bus({ y, from, to, label }: { y: number; from: number; to: number; label: string }) {
  return (
    <>
      <line className="bus" x1={from} y1={y} x2={to} y2={y} pathLength="100" />
      <text className="bus-label" x={to} y={y - 14} textAnchor="end">
        {label}
      </text>
    </>
  );
}

// The block diagram is the whole landing page. The docs open over it, so it stays mounted.
export default function Diagram() {
  const docSlug = useMatch('/ip/:slug')?.params.slug ?? null;
  const [covered, setCovered] = useState(false);
  // The route stays drawn (faded out) after the pointer leaves, so it fades instead of vanishing.
  const [route, setRoute] = useState<{ slug: string; on: boolean } | null>(null);

  if (!docSlug && covered) setCovered(false);
  useEffect(() => {
    if (!docSlug) return;
    const timer = window.setTimeout(() => setCovered(true), COVER_MS);
    return () => window.clearTimeout(timer);
  }, [docSlug]);

  // Hand focus back to the block when the docs close, so keyboard users keep their place.
  const lastDoc = useRef<string | null>(null);
  useEffect(() => {
    if (docSlug) {
      lastDoc.current = docSlug;
      return;
    }
    if (!lastDoc.current) return;
    document.querySelector<SVGAElement>(`[data-ip="${CSS.escape(lastDoc.current)}"]`)?.focus({ preventScroll: true });
    lastDoc.current = null;
  }, [docSlug]);

  const routeTarget = route ? peripherals.find((p) => p.slug === route.slug) : undefined;
  const classes = ['diagram-page', covered ? 'is-covered' : ''].filter(Boolean).join(' ');

  return (
    <main className={classes} inert={docSlug !== null} aria-hidden={docSlug !== null}>
      <h1 className="sr-only">System-Level Block Design</h1>
      <svg
        className="diagram"
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="SoC block diagram. Each peripheral on the APB bus links to its documentation."
        style={{ '--cycle': `${CYCLE}s` } as CSSProperties}
      >
        <style>{FLOW_CSS}</style>
        <defs>
          <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.13" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.03" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.34" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0.08" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.16" />
          </linearGradient>
          <radialGradient id="aura" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#0a84ff" stopOpacity="0.16" />
            <stop offset="1" stopColor="#0a84ff" stopOpacity="0" />
          </radialGradient>
          <filter id="soft" x="-30%" y="-60%" width="160%" height="240%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <pattern id="dots" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="16" cy="16" r="1" fill="#fff" fillOpacity="0.05" />
          </pattern>
        </defs>

        <rect className="frame" x="24" y="24" width={VIEW.width - 48} height={VIEW.height - 48} rx="22" />
        <rect x="24" y="24" width={VIEW.width - 48} height={VIEW.height - 48} rx="22" fill="url(#dots)" />
        <ellipse cx={VIEW.width / 2} cy="520" rx="760" ry="330" fill="url(#aura)" />

        <text className="title" x="72" y="106">
          System-Level
        </text>
        <text className="title" x="72" y="156">
          Block Design
        </text>
        <text className="hint" x="72" y="196">
          Select a peripheral to open its documentation.
        </text>
        <text className="soc-tag" x={VIEW.width - 72} y="92" textAnchor="end">
          SoC
        </text>

        {/* Wires: a dim base, then the travelling pulses, then the hover route. */}
        <g className="wires" aria-hidden="true">
          {cpus.map((cpu) => (
            <Arrow key={cpu.label} x={centreX(cpu.box)} from={cpu.box.y + cpu.box.height} to={ahb.y} />
          ))}
          <Arrow x={centreX(bridge.box)} from={ahb.y} to={bridge.box.y} />
          <Arrow x={centreX(bridge.box)} from={bridge.box.y + bridge.box.height} to={apb.y} />
          <Bus {...ahb} />
          <Bus {...apb} />
          {peripherals.map((p) => (
            <Arrow key={p.slug} x={centreX(p.box)} from={apb.y} to={p.box.y} />
          ))}

          {pulses.map((pulse) => {
            const style = { animationName: `pulse-${pulse.id}` } as CSSProperties;
            const d = pulsePath(pulse);
            return (
              <g key={pulse.id} className={`pulse pulse--${pulse.kind}`}>
                {pulse.kind === 'request' && <path className="pulse-glow" d={d} pathLength="100" style={style} />}
                <path className="pulse-core" d={d} pathLength="100" style={style} />
              </g>
            );
          })}

          {routeTarget && (
            <g className={route?.on ? 'route route--on' : 'route'}>
              <path className="route-base" d={routeFor(routeTarget)} />
              <path className="route-flow" d={routeFor(routeTarget)} />
            </g>
          )}
        </g>

        {/* Infrastructure: drawn for context, not linked. */}
        {cpus.map((cpu) => (
          <Block key={cpu.label} box={cpu.box} label={cpu.label} variant="infra" flashAt={arrival.cpu} />
        ))}
        <Bridge />

        {/* Peripherals: one link each. Hovering or focusing it lifts the block and lights its route. */}
        {peripherals.map((p, i) => (
          <Link
            key={p.slug}
            to={`/ip/${p.slug}`}
            className="ip-node"
            data-ip={p.slug}
            style={{ '--i': i } as CSSProperties}
            aria-label={`${p.name}: ${ips[i].summary}`}
            onPointerEnter={() => setRoute({ slug: p.slug, on: true })}
            onPointerLeave={() => setRoute((r) => r && { ...r, on: false })}
            onFocus={() => setRoute({ slug: p.slug, on: true })}
            onBlur={() => setRoute((r) => r && { ...r, on: false })}
          >
            {/* The arrow is thin, so a transparent strip makes the span from the bus part of the hit area. */}
            <rect className="hit" x={centreX(p.box) - 14} y={apb.y} width="28" height={p.box.y - apb.y} />
            <Block box={p.box} label={p.name} variant="ip" flashAt={arrival.peripheral(p.slug)} />
          </Link>
        ))}

        <g className="key" aria-hidden="true">
          <circle cx="76" cy="838" r="5" className="key-dot key-dot--request" />
          <text x="90" y="838">Request</text>
          <circle cx="176" cy="838" r="5" className="key-dot key-dot--response" />
          <text x="190" y="838">Response</text>
        </g>
      </svg>
    </main>
  );
}

function Bridge() {
  return <Block box={bridge.box} label={bridge.label} variant="infra" flashAt={arrival.bridge} />;
}
