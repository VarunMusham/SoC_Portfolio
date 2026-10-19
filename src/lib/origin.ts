// Centre of a diagram block on screen, so the docs can open from it and shrink back into it.
export function blockOrigin(slug: string): { x: number; y: number } | null {
  // Measure the block itself: the link around it also spans its bus arrow.
  const el = document.querySelector(`[data-ip="${CSS.escape(slug)}"] .block`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
