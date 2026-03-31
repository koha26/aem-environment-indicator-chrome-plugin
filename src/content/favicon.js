/**
 * Overlays a small colored dot on the page favicon.
 *
 * The badge is drawn on a 32×32 canvas so it looks crisp at high-DPI.
 * It appears in the bottom-right corner (matching the Chrome action-badge
 * convention) — a white ring separates it from whatever favicon is beneath.
 *
 * @param {string} color - hex color e.g. "#1976d2"
 */
export function applyFaviconOverlay(color) {
  const SIZE = 32;
  const canvas = document.createElement('canvas');
  canvas.width  = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  const existingUrl = getExistingFaviconUrl();

  if (canDrawExistingFavicon(existingUrl, window.location.origin)) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      drawBadge(ctx, color, SIZE);
      setFaviconFromCanvas(canvas);
    };
    img.onerror = () => {
      // Favicon failed to load (CORS or missing) — draw badge on blank canvas
      drawBadge(ctx, color, SIZE);
      setFaviconFromCanvas(canvas);
    };
    img.src = existingUrl;
  } else {
    drawBadge(ctx, color, SIZE);
    setFaviconFromCanvas(canvas);
  }
}

/**
 * Returns true when the current page favicon can be safely drawn onto canvas
 * without tainting it (which would block toDataURL and hide the overlay).
 *
 * @param {string|null} existingUrl
 * @param {string} pageOrigin
 * @returns {boolean}
 */
export function canDrawExistingFavicon(existingUrl, pageOrigin) {
  if (!existingUrl) return false;
  try {
    const parsed = new URL(existingUrl, pageOrigin);
    if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') return true;
    return parsed.origin === pageOrigin;
  } catch {
    return false;
  }
}

/**
 * Removes the injected favicon overlay, restoring browser default behavior.
 */
export function restoreFavicon() {
  const injected = document.querySelector('link[data-aem-env-favicon]');
  if (injected) injected.remove();
}

/**
 * Draws a small colored dot in the bottom-right corner of the canvas.
 * Outer white ring → inner colored disc (no letter).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} color - fill color for the disc
 * @param {number} size  - canvas size in pixels (square)
 */
function drawBadge(ctx, color, size) {
  const cx     = size * 0.72;  // badge center x (bottom-right quadrant)
  const cy     = size * 0.72;  // badge center y
  const outerR = size * 0.30;  // white ring outer radius
  const innerR = size * 0.22;  // colored disc radius (leaves ~2px white ring)

  // White ring — contrast against any favicon background
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Colored disc
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function getExistingFaviconUrl() {
  const link = document.querySelector('link[rel~="icon"]');
  return link ? link.href : null;
}

function setFaviconFromCanvas(canvas) {
  // Remove any previously injected favicon overlay
  const old = document.querySelector('link[data-aem-env-favicon]');
  if (old) old.remove();

  const link = document.createElement('link');
  link.rel  = 'icon';
  link.type = 'image/png';
  link.setAttribute('sizes', 'any'); // takes precedence over sized icons
  try {
    link.href = canvas.toDataURL('image/png');
  } catch {
    // Canvas tainted (cross-origin draw without CORS) — skip overlay
    return;
  }
  link.setAttribute('data-aem-env-favicon', 'true');
  document.head.appendChild(link);
}
