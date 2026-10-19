// Where a block sits on screen, so the docs can open from it and shrink back into it.
// The 3D scene publishes the point when the camera arrives; the flat diagram is measured from the DOM.
export type Point = { x: number; y: number };

const published = new Map<string, Point>();

export function publishBlockOrigin(slug: string, point: Point): void {
  published.set(slug, point);
}

export function clearBlockOrigins(): void {
  published.clear();
}

export function blockOrigin(slug: string): Point | null {
  const scene = published.get(slug);
  if (scene) return scene;
  // Measure the block itself: the link around it also spans its bus arrow.
  const el = document.querySelector(`[data-ip="${CSS.escape(slug)}"] .block-base`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
