import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import type { Origin } from '../scene/SocScene';
import { ips } from '../data/ips';
import { supportsWebGL } from '../lib/motion';

// Three.js is large, so the scene loads in its own chunk.
const SocScene = lazy(() => import('../scene/SocScene'));

// The docs reveal takes 900 ms; after that the scene is fully covered and can stop rendering.
const COVER_MS = 1000;

export default function Landing() {
  const navigate = useNavigate();
  const docSlug = useMatch('/ip/:slug')?.params.slug ?? null;
  const [pickedSlug, setPickedSlug] = useState<string | null>(null);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [covered, setCovered] = useState(false);
  const [webgl] = useState(() => supportsWebGL());
  const labelRoot = useRef<HTMLDivElement>(null);

  // The camera follows the URL: a docs route keeps it on that chip, the map route pulls it back out.
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
    (slug: string, origin: Origin) => {
      setPickedSlug(null);
      if (slug !== docSlug) navigate(`/ip/${slug}`, { state: { origin } });
    },
    [navigate, docSlug],
  );

  const pick = (slug: string) => {
    // Disabled buttons may never fire pointerleave, so drop the preview here.
    setPreviewSlug(null);
    if (webgl) setPickedSlug(slug);
    else navigate(`/ip/${slug}`);
  };

  const classes = ['landing', webgl ? '' : 'landing--static', focusSlug ? 'landing--focused' : ''].filter(Boolean).join(' ');

  return (
    <main className={classes} inert={docSlug !== null} aria-hidden={docSlug !== null}>
      {webgl && (
        <div className="landing-scene" aria-hidden="true">
          <Suspense fallback={null}>
            <SocScene
              focusSlug={focusSlug}
              previewSlug={previewSlug}
              active={!covered}
              labelRoot={labelRoot}
              onSelect={pick}
              onArrive={handleArrive}
            />
          </Suspense>
          <div className="scene-labels" ref={labelRoot} />
        </div>
      )}

      {/* With the scene running the page shows only the board; the text stays for assistive technology. */}
      <header className={webgl ? 'sr-only' : 'landing-hero'}>
        <h1>Legacy IP, mapped on one die.</h1>
        <p>
          Eight peripheral blocks on a shared SoC bus.{' '}
          {webgl
            ? 'Click a chip on the board or pick one from the list to open its documentation.'
            : 'Pick a block below to open its documentation.'}
        </p>
      </header>

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
