/**
 * Overlays a colored badge on the page favicon.
 * @param {string} color  - hex color e.g. "#1976d2"
 * @param {string} letter - single character e.g. "D"
 */
export function applyFaviconOverlay(color, letter) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');

  const existingUrl = getExistingFaviconUrl();

  if (existingUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 16, 16);
      drawBadge(ctx, color, letter);
      setFaviconFromCanvas(canvas);
    };
    img.onerror = () => {
      // Favicon failed to load — draw badge on blank canvas
      drawBadge(ctx, color, letter);
      setFaviconFromCanvas(canvas);
    };
    img.src = existingUrl;
  } else {
    drawBadge(ctx, color, letter);
    setFaviconFromCanvas(canvas);
  }
}

/**
 * Removes the injected favicon overlay, restoring browser default behavior.
 */
export function restoreFavicon() {
  const injected = document.querySelector('link[data-aem-env-favicon]');
  if (injected) injected.remove();
}

function drawBadge(ctx, color, letter) {
  // Colored circle in top-left quadrant (radius 4 at position 4,4)
  ctx.beginPath();
  ctx.arc(4, 4, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // White letter centered in the circle
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 6px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 4, 4.5); // +0.5 optical correction for small font rendering
}

function getExistingFaviconUrl() {
  const link = document.querySelector('link[rel~="icon"]');
  return link ? link.href : null;
}

function setFaviconFromCanvas(canvas) {
  // Remove any previously injected favicon
  const old = document.querySelector('link[data-aem-env-favicon]');
  if (old) old.remove();

  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = canvas.toDataURL('image/png');
  link.setAttribute('data-aem-env-favicon', 'true');
  document.head.appendChild(link);
}
