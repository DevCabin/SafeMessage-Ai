// Comprehensive scam pattern detection system
// Uses the organized scamPatterns database for maintainable, scalable detection

import { redFlagPatterns, scamPatterns, ScamPattern, getPatternsByCategory, getPatternsBySeverity, addPattern, removePattern } from './scamPatterns';

/**
 * Performs lightning-fast client-side scam pattern detection
 * @param text - The message text to scan
 * @returns The matching pattern (string or RegExp) or null if no matches
 */
export function quickScan(text: string): string | RegExp | null {
  if (!text) return null;
  const t = text.toLowerCase();
  return redFlagPatterns.find(p =>
    typeof p === 'string' ? t.includes(p) : p.test(t)
  ) || null;
}

/**
 * Gets detailed information about a matched pattern
 * @param text - The message text that was scanned
 * @returns Detailed ScamPattern info or null
 */
export function getPatternDetails(text: string): ScamPattern | null {
  if (!text) return null;
  const t = text.toLowerCase();
  return scamPatterns.find(p =>
    typeof p.pattern === 'string' ? t.includes(p.pattern) : p.pattern.test(t)
  ) || null;
}

// Re-export all scam pattern utilities
export {
  scamPatterns,
  redFlagPatterns,
  getPatternsByCategory,
  getPatternsBySeverity,
  addPattern,
  removePattern
};

// Re-export the type
export type { ScamPattern } from './scamPatterns';
