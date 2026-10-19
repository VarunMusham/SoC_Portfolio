import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { ips } from '../data/ips';
import { supportsWebGL } from '../lib/motion';
import Diagram from './Diagram';

// Three.js is large, so the scene loads in its own chunk.
const SocScene = lazy(() => import('../scene/SocScene'));

// The docs reveal takes 900 ms; after that the scene is fully covered and can stop rendering.
const COVER_MS = 1000;

// `?view=2d` forces the flat diagram, which is also what browsers without WebGL get.
function wantsFlat(): boolean {
  return !supportsWebGL() || new URLSearchParams(window.location.search).get('view') === '2d';
}

export default function Landing() {
  const [flat] = useState(wantsFlat);
  return flat ? <Diagram /> : <Landing3D />;
}

function Landing3D() {
  const navigate = useNavigate();
  const docSlug = useMatch('/ip/:slug')?.params.slug ?? null;
  const [pickedSlug, setPickedSlug] = useState<string | null>(null);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [covered, setCovered] = useState(false);

  // The camera follows the URL: a docs route keeps it on that block, the map route pulls it back out.
  const focusSlug = docSlug ?? pickedSlug;

  // Uncover as soon as the docs close (adjusted during render, per React's guidance);
  // cover once the reveal has finished.
  if (!docSlug && covered) setCovered(false);
  useEffect(() => {
    if (!docSlug) return;
    const timer = window.setTimeout(() => setCovered(true), COVER_MS);
    return () => window.clearTimeout(timer);
  }, [docSlug]);

  const handleArrive = useCallback(
    (slug: string) => {
      setPickedSlug(null);
      if (slug !== docSlug) navigate(`/ip/${slug}`);
    },
    [navigate, docSlug],
  );

  const pick = useCallback((slug: string) => {
    // Disabled buttons may never fire pointerleave, so drop the preview here.
    setPreviewSlug(null);
    setPickedSlug(slug);
  }, []);

  const classes = ['stage', focusSlug ? 'stage--focused' : ''].filter(Boolean).join(' ');

  return (
    <main className={classes} inert={docSlug !== null} aria-hidden={docSlug !== null}>
      <div className="stage-canvas" aria-hidden="true">
        <Suspense fallback={null}>
          <SocScene focusSlug={focusSlug} previewSlug={previewSlug} active={!covered} onSelect={pick} onArrive={handleArrive} />
        </Suspense>
      </div>

      <header className="hud" aria-hidden={false}>
        <h1 className="hud-title">
          System-Level
          <br />
          Block Design
        </h1>
        <p className="hud-hint">Select a peripheral to open its documentation.</p>
        <span className="hud-tag" aria-hidden="true">
          SoC
        </span>
        <p className="hud-key" aria-hidden="true">
          <span className="hud-dot hud-dot--request" />
          Request
          <span className="hud-dot hud-dot--response" />
          Response
        </p>
      </header>

      {/* The scene is the interface; this list is the same choice for keyboard and screen-reader users. */}
      <nav className="legend" aria-label="IP blocks">
        <ul>
          {ips.map((ip) => (
            <li key={ip.slug}>
              <button
                type="button"
                className="legend-item"
                disabled={focusSlug !== null}
                onClick={() => pick(ip.slug)}
                onPointerEnter={() => setPreviewSlug(ip.slug)}
                onPointerLeave={() => setPreviewSlug(null)}
                onFocus={() => setPreviewSlug(ip.slug)}
                onBlur={() => setPreviewSlug(null)}
              >
                <span className="legend-name">{ip.name}</span>
                <span className="sr-only">{ip.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
