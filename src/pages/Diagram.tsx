import { useEffect, useRef } from 'react';
import { Link, useMatch } from 'react-router-dom';
import { apb, ahb, bridge, centreX, cpus, peripherals, VIEW, type Box } from '../diagram/layout';
import { ips } from '../data/ips';

const HEAD = { length: 14, half: 7 };

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

function Block({ box, label, className }: { box: Box; label: string; className: string }) {
  return (
    <>
      <rect className={className} x={box.x} y={box.y} width={box.width} height={box.height} />
      <text className="block-label" x={centreX(box)} y={box.y + box.height / 2}>
        {label}
      </text>
    </>
  );
}

function Bus({ y, from, to, label }: { y: number; from: number; to: number; label: string }) {
  return (
    <>
      <line className="bus" x1={from} y1={y} x2={to} y2={y} />
      <text className="bus-label" x={to} y={y - 14} textAnchor="end">
        {label}
      </text>
    </>
  );
}

// The block diagram is the whole landing page. The docs open over it, so it stays mounted.
export default function Diagram() {
  const docSlug = useMatch('/ip/:slug')?.params.slug ?? null;

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

  return (
    <main className="diagram-page" inert={docSlug !== null} aria-hidden={docSlug !== null}>
      <h1 className="sr-only">System-Level Block Design</h1>
      <svg
        className="diagram"
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="SoC block diagram. Each peripheral on the APB bus links to its documentation."
      >
        <rect className="frame" x="24" y="24" width={VIEW.width - 48} height={VIEW.height - 48} rx="6" />
        <text className="title" x="72" y="104">
          System-Level
        </text>
        <text className="title" x="72" y="152">
          Block Design
        </text>
        <text className="hint" x="72" y="190">
          Select a peripheral to open its documentation.
        </text>
        <text className="soc-tag" x={VIEW.width - 72} y="88" textAnchor="end">
          SoC
        </text>

        {/* Infrastructure: drawn for context, not linked. */}
        {cpus.map((cpu) => (
          <g key={cpu.label}>
            <Arrow x={centreX(cpu.box)} from={cpu.box.y + cpu.box.height} to={ahb.y} />
            <Block box={cpu.box} label={cpu.label} className="block block--infra" />
          </g>
        ))}
        <Bus {...ahb} />
        <Arrow x={centreX(bridge.box)} from={ahb.y} to={bridge.box.y} />
        <Block box={bridge.box} label={bridge.label} className="block block--infra" />
        <Arrow x={centreX(bridge.box)} from={bridge.box.y + bridge.box.height} to={apb.y} />
        <Bus {...apb} />

        {/* Peripherals: one link each. Hovering or focusing it lights the box and its arrow. */}
        {peripherals.map((p, i) => (
          <Link key={p.slug} to={`/ip/${p.slug}`} className="ip-node" data-ip={p.slug} aria-label={`${p.name}: ${ips[i].summary}`}>
            {/* The arrow is thin, so a transparent strip makes it part of the link's hit area. */}
            <rect className="hit" x={centreX(p.box) - 14} y={apb.y} width="28" height={p.box.y - apb.y} />
            <Arrow x={centreX(p.box)} from={apb.y} to={p.box.y} />
            <Block box={p.box} label={p.name} className="block block--ip" />
          </Link>
        ))}
      </svg>
    </main>
  );
}
