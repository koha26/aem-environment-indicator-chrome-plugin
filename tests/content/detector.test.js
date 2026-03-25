import { describe, it, expect, afterEach } from 'vitest';
import { detectFromParentVar, detectFromLocalStorage } from '../../src/content/detector.js';

describe('detectFromParentVar', () => {
  afterEach(() => {
    delete window.AEMRepoEnv;
  });

  it('returns DEV for "dev"', () => {
    window.AEMRepoEnv = 'dev';
    expect(detectFromParentVar()).toBe('DEV');
  });

  it('returns STAGE for "stage"', () => {
    window.AEMRepoEnv = 'stage';
    expect(detectFromParentVar()).toBe('STAGE');
  });

  it('returns PROD for "prod"', () => {
    window.AEMRepoEnv = 'prod';
    expect(detectFromParentVar()).toBe('PROD');
  });

  it('is case-insensitive ("PROD" → PROD)', () => {
    window.AEMRepoEnv = 'PROD';
    expect(detectFromParentVar()).toBe('PROD');
  });

  it('returns null when AEMRepoEnv is not set', () => {
    expect(detectFromParentVar()).toBeNull();
  });

  it('returns null for an unrecognised value', () => {
    window.AEMRepoEnv = 'preview';
    expect(detectFromParentVar()).toBeNull();
  });

  it('returns null when window.parent access throws (cross-origin simulation)', () => {
    // Simulate the cross-origin SecurityError that can occur if the content
    // script ever runs inside an iframe whose parent is a different origin.
    Object.defineProperty(window, 'parent', {
      get() { throw new DOMException('cross-origin', 'SecurityError'); },
      configurable: true,
    });
    expect(detectFromParentVar()).toBeNull();
    // Restore: delete own-property so the prototype's 'parent' (= window) is visible again
    delete window.parent;
  });
});

describe('detectFromLocalStorage', () => {
  const HOSTNAME = 'author-p123-e456.adobeaemcloud.com';

  // Helper: builds a valid aemInstances JSON string
  function makeStorage(instances) {
    return JSON.stringify({ instances, timestamp: 1234567890 });
  }

  afterEach(() => {
    localStorage.clear();
  });

  it('returns DEV when hostname matches a dev instance', () => {
    localStorage.setItem('aemInstances', makeStorage({
      '123@AdobeOrg': [{ domain: HOSTNAME, environment: 'dev' }],
    }));
    expect(detectFromLocalStorage(HOSTNAME)).toBe('DEV');
  });

  it('returns STAGE for a stage instance', () => {
    localStorage.setItem('aemInstances', makeStorage({
      '123@AdobeOrg': [{ domain: HOSTNAME, environment: 'stage' }],
    }));
    expect(detectFromLocalStorage(HOSTNAME)).toBe('STAGE');
  });

  it('returns PROD for a prod instance', () => {
    localStorage.setItem('aemInstances', makeStorage({
      '123@AdobeOrg': [{ domain: HOSTNAME, environment: 'prod' }],
    }));
    expect(detectFromLocalStorage(HOSTNAME)).toBe('PROD');
  });

  it('returns null when hostname does not match any instance', () => {
    localStorage.setItem('aemInstances', makeStorage({
      '123@AdobeOrg': [{ domain: HOSTNAME, environment: 'dev' }],
    }));
    expect(detectFromLocalStorage('publish-p123-e456.adobeaemcloud.com')).toBeNull();
  });

  it('returns null when aemInstances key is absent', () => {
    expect(detectFromLocalStorage(HOSTNAME)).toBeNull();
  });

  it('returns null when aemInstances JSON is malformed', () => {
    localStorage.setItem('aemInstances', 'not-valid-json{');
    expect(detectFromLocalStorage(HOSTNAME)).toBeNull();
  });

  it('matches a hostname across multiple org arrays', () => {
    localStorage.setItem('aemInstances', makeStorage({
      '111@AdobeOrg': [{ domain: 'other.adobeaemcloud.com', environment: 'prod' }],
      '222@AdobeOrg': [{ domain: HOSTNAME, environment: 'stage' }],
    }));
    expect(detectFromLocalStorage(HOSTNAME)).toBe('STAGE');
  });

  it('matches against the hostname parameter, not window.location.hostname', () => {
    // jsdom sets window.location.hostname to 'localhost' by default.
    // If the function incorrectly read window.location.hostname it would return null here,
    // because HOSTNAME !== 'localhost'.
    localStorage.setItem('aemInstances', makeStorage({
      '123@AdobeOrg': [{ domain: HOSTNAME, environment: 'dev' }],
    }));
    expect(detectFromLocalStorage(HOSTNAME)).toBe('DEV');
  });
});
