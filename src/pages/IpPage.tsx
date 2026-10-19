import { useCallback, useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { findIp, ips } from '../data/ips';
import { prefersReducedMotion } from '../lib/motion';
import { blockOrigin } from '../lib/origin';

// Radius that just covers the viewport from (x, y). Anything larger makes most of the animation invisible.
function coverRadius(x: number, y: number): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Math.ceil(Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y))) + 2;
}

const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'features', label: 'Features' },
  { id: 'registers', label: 'Register map' },
  { id: 'signals', label: 'Signals' },
  { id: 'programming', label: 'Programming' },
];

export default function IpPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  // Read by the reveal and close animations, which must not restart when the slug changes.
  const slugRef = useRef(slug);
  useEffect(() => {
    slugRef.current = slug;
  }, [slug]);

  const ip = findIp(slug);
  const index = ips.findIndex((item) => item.slug === slug);

  // Reveal: the page opens as a circle that grows out from the block it belongs to.
  // Only on first open: paging between blocks swaps the content in place.
  useEffect(() => {
    const el = rootRef.current;
    const origin = slugRef.current ? blockOrigin(slugRef.current) : null;
    if (!el || !origin || prefersReducedMotion()) return;
    const { x, y } = origin;
    const reveal = el.animate(
      [
        { clipPath: `circle(0px at ${x}px ${y}px)` },
        { clipPath: `circle(${coverRadius(x, y)}px at ${x}px ${y}px)` },
      ],
      { duration: 900, easing: EASE_IN_OUT },
    );
    reveal.onfinish = () => reveal.cancel();
    return () => reveal.cancel();
  }, []);

  useEffect(() => {
    if (rootRef.current) rootRef.current.scrollTop = 0;
  }, [slug]);

  // Close: the page shrinks back into its block, then navigates to the diagram.
  const closingRef = useRef(false);
  const close = useCallback(() => {
    const el = rootRef.current;
    if (closingRef.current) return;
    if (!el || prefersReducedMotion()) {
      navigate('/');
      return;
    }
    closingRef.current = true;
    const origin = blockOrigin(slugRef.current ?? '');
    const keyframes = origin
      ? [
          { clipPath: `circle(${coverRadius(origin.x, origin.y)}px at ${origin.x}px ${origin.y}px)` },
          { clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` },
        ]
      : [{ opacity: 1 }, { opacity: 0 }];
    const exit = el.animate(keyframes, {
      duration: origin ? 700 : 350,
      easing: EASE_IN_OUT,
      fill: 'forwards',
    });
    exit.onfinish = () => navigate('/');
  }, [navigate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  if (!ip) return <Navigate to="/" replace />;

  const prev = index > 0 ? ips[index - 1] : null;
  const next = index < ips.length - 1 ? ips[index + 1] : null;

  return (
    <div className="doc" ref={rootRef}>
      <header className="doc-bar">
        <button type="button" className="doc-back" onClick={close}>
          Back to block diagram <kbd>Esc</kbd>
        </button>
        <nav className="doc-pager" aria-label="Other IP blocks">
          {prev && <Link to={`/ip/${prev.slug}`}>{prev.name}</Link>}
          {next && <Link to={`/ip/${next.slug}`}>{next.name}</Link>}
        </nav>
      </header>

      <div className="doc-layout">
        <aside className="doc-toc">
          <nav aria-label="On this page">
            <ul>
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <article className="doc-article">
          <header className="doc-head">
            <h1>{ip.fullName}</h1>
            <p className="doc-summary">{ip.summary}</p>
            <dl className="doc-meta">
              <div>
                <dt>Block</dt>
                <dd>{ip.name}</dd>
              </div>
              <div>
                <dt>IP version</dt>
                <dd>{ip.version}</dd>
              </div>
              <div>
                <dt>Registers</dt>
                <dd>{ip.registers.length}</dd>
              </div>
            </dl>
          </header>

          <section id="overview">
            <h2>Overview</h2>
            {ip.overview.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </section>

          <section id="features">
            <h2>Features</h2>
            <ul className="doc-list">
              {ip.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </section>

          <section id="registers">
            <h2>Register map</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Offset</th>
                    <th scope="col">Access</th>
                    <th scope="col">Reset</th>
                    <th scope="col">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {ip.registers.map((reg) => (
                    <tr key={reg.name}>
                      <td className="mono">{reg.name}</td>
                      <td className="mono">{reg.offset}</td>
                      <td className="mono">{reg.access}</td>
                      <td className="mono">{reg.reset}</td>
                      <td>{reg.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="signals">
            <h2>Signals</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Signal</th>
                    <th scope="col">Direction</th>
                    <th scope="col">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {ip.signals.map((signal) => (
                    <tr key={signal.name}>
                      <td className="mono">{signal.name}</td>
                      <td className="mono">{signal.direction}</td>
                      <td>{signal.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="programming">
            <h2>Programming</h2>
            <ol className="doc-steps">
              {ip.programming.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        </article>
      </div>
    </div>
  );
}
