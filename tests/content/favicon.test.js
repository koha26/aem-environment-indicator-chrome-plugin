import { describe, it, expect } from 'vitest';
import { canDrawExistingFavicon } from '../../src/content/favicon.js';

describe('canDrawExistingFavicon', () => {
  const pageOrigin = 'https://author.example.com';

  it('allows same-origin absolute URLs', () => {
    expect(canDrawExistingFavicon('https://author.example.com/favicon.ico', pageOrigin)).toBe(true);
  });

  it('blocks cross-origin URLs to avoid tainted canvas', () => {
    expect(canDrawExistingFavicon('https://cdn.example.net/favicon.ico', pageOrigin)).toBe(false);
  });

  it('allows relative URLs resolved to current origin', () => {
    expect(canDrawExistingFavicon('/favicon.ico', pageOrigin)).toBe(true);
  });

  it('allows data URLs', () => {
    expect(canDrawExistingFavicon('data:image/svg+xml;base64,AAA=', pageOrigin)).toBe(true);
  });

  it('returns false for empty URL', () => {
    expect(canDrawExistingFavicon('', pageOrigin)).toBe(false);
  });
});
