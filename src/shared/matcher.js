/**
 * Match a hostname to an environment type.
 * Checks user-configured programs first (exact/glob), then fallback regex patterns.
 *
 * @param {string} hostname
 * @param {Array}  programs - from storage
 * @param {Array}  fallbackPatterns - from storage
 * @returns {{ envType: string|null, programId: string|null, programName: string|null }}
 */
export function matchEnvironment(hostname, programs, fallbackPatterns) {
  if (!hostname) return { envType: null, programId: null, programName: null };
  const safePrograms = Array.isArray(programs) ? programs : [];
  const safeFallbacks = Array.isArray(fallbackPatterns) ? fallbackPatterns : [];

  for (const program of safePrograms) {
    if (!Array.isArray(program.environments)) continue;
    for (const env of program.environments) {
      if (matchPattern(hostname, env.urlPattern)) {
        return {
          envType:     env.type,
          programId:   program.id,
          programName: program.name,
        };
      }
    }
  }

  for (const fb of safeFallbacks) {
    try {
      const regex = new RegExp(fb.pattern, 'i');
      if (regex.test(hostname)) {
        return { envType: fb.type, programId: null, programName: null };
      }
    } catch {
      // Ignore invalid regex patterns
    }
  }

  return { envType: null, programId: null, programName: null };
}

/**
 * Match a hostname against a pattern.
 * Supports:
 * - Exact match: "author-p123-e456.adobeaemcloud.com"
 * - Glob: "*.dev.example.com" (converts to regex)
 */
function matchPattern(hostname, pattern) {
  if (!pattern) return false;
  if (pattern.includes('*')) {
    // Escape all regex metacharacters except *, then replace * with .*
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regexStr = '^' + escaped.replace(/\*/g, '.*') + '$';
    try {
      return new RegExp(regexStr, 'i').test(hostname);
    } catch {
      return false;
    }
  }
  return hostname.toLowerCase() === pattern.toLowerCase();
}
