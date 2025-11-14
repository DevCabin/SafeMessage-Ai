// Comprehensive scam pattern database
// Organized by category for maintainability and scalability

export type ScamPattern = {
  pattern: string | RegExp;
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export const scamPatterns: ScamPattern[] = [
  // URGENCY PATTERNS
  { pattern: 'within 24 hours', category: 'urgency', description: 'Creates false time pressure', severity: 'high' },
  { pattern: 'within 24hrs', category: 'urgency', description: 'Creates false time pressure', severity: 'high' },
  { pattern: 'within 48 hours', category: 'urgency', description: 'Creates false time pressure', severity: 'high' },
  { pattern: 'immediate action', category: 'urgency', description: 'Demands instant response', severity: 'high' },
  { pattern: 'act now', category: 'urgency', description: 'Creates false urgency', severity: 'high' },
  { pattern: 'urgent', category: 'urgency', description: 'General urgency signal', severity: 'medium' },
  { pattern: 'expire soon', category: 'urgency', description: 'False deadline pressure', severity: 'high' },
  { pattern: 'final notice', category: 'urgency', description: 'Fake final warning', severity: 'high' },
  { pattern: 'account will be closed', category: 'urgency', description: 'Account closure threat', severity: 'high' },
  { pattern: 'suspended indefinitely', category: 'urgency', description: 'Account suspension threat', severity: 'high' },

  // FINANCIAL SCAMS
  { pattern: 'gift card', category: 'financial', description: 'Gift card payment request', severity: 'high' },
  { pattern: 'giftcard', category: 'financial', description: 'Gift card payment request', severity: 'high' },
  { pattern: 'prepaid card', category: 'financial', description: 'Prepaid card request', severity: 'high' },
  { pattern: 'wire transfer', category: 'financial', description: 'Wire transfer request', severity: 'high' },
  { pattern: 'western union', category: 'financial', description: 'Money transfer service', severity: 'high' },
  { pattern: 'moneygram', category: 'financial', description: 'Money transfer service', severity: 'high' },
  { pattern: 'bitcoin', category: 'financial', description: 'Cryptocurrency request', severity: 'high' },
  { pattern: 'btc', category: 'financial', description: 'Bitcoin abbreviation', severity: 'high' },
  { pattern: 'ethereum', category: 'financial', description: 'Cryptocurrency request', severity: 'high' },
  { pattern: 'eth', category: 'financial', description: 'Ethereum abbreviation', severity: 'high' },
  { pattern: 'send funds', category: 'financial', description: 'Money sending request', severity: 'high' },
  { pattern: 'pay a fee', category: 'financial', description: 'Fee payment request', severity: 'high' },
  { pattern: 'release fee', category: 'financial', description: 'Fake release fee', severity: 'high' },
  { pattern: 'processing fee', category: 'financial', description: 'Fake processing fee', severity: 'high' },

  // AUTHORITY SPOOFING
  { pattern: 'irs ', category: 'authority', description: 'IRS impersonation', severity: 'high' },
  { pattern: 'social security', category: 'authority', description: 'SSA impersonation', severity: 'high' },
  { pattern: 'ssa ', category: 'authority', description: 'SSA impersonation', severity: 'high' },
  { pattern: 'medicare ', category: 'authority', description: 'Medicare impersonation', severity: 'high' },
  { pattern: 'fbi ', category: 'authority', description: 'FBI impersonation', severity: 'high' },
  { pattern: 'dea ', category: 'authority', description: 'DEA impersonation', severity: 'high' },
  { pattern: 'police department', category: 'authority', description: 'Police impersonation', severity: 'high' },
  { pattern: 'court order', category: 'authority', description: 'Fake court order', severity: 'high' },
  { pattern: 'legal action', category: 'authority', description: 'Legal threat', severity: 'high' },
  { pattern: 'law enforcement', category: 'authority', description: 'Law enforcement impersonation', severity: 'high' },
  { pattern: 'government grant', category: 'authority', description: 'Fake government grant', severity: 'high' },
  { pattern: 'federal reserve', category: 'authority', description: 'Federal Reserve impersonation', severity: 'high' },

  // SUSPICIOUS URLS (Regex patterns)
  { pattern: /\b(bit\.ly|tinyurl|tiny\.cc|t\.co|short\.link)\//i, category: 'urls', description: 'URL shorteners often hide malicious links', severity: 'high' },
  { pattern: /https?:\/\/[^\/]*\.(ru|tk|ml|cf|top|xyz|click|download|stream)\//i, category: 'urls', description: 'Suspicious TLDs commonly used in scams', severity: 'high' },

  // GENERIC SCAM PHRASES
  { pattern: 'congratulations you won', category: 'generic', description: 'Fake prize notification', severity: 'high' },
  { pattern: 'you have been selected', category: 'generic', description: 'Fake selection notification', severity: 'high' },
  { pattern: '100% guaranteed', category: 'generic', description: 'False guarantee', severity: 'medium' },
  { pattern: 'risk free', category: 'generic', description: 'False risk-free claim', severity: 'medium' },
  { pattern: 'no upfront cost', category: 'generic', description: 'Hidden cost scam', severity: 'medium' },
  { pattern: 'make money fast', category: 'generic', description: 'Get rich quick scheme', severity: 'high' },
  { pattern: 'work from home', category: 'generic', description: 'Fake work opportunity', severity: 'medium' },
  { pattern: 'investment opportunity', category: 'generic', description: 'Fake investment scam', severity: 'high' },

  // CRYPTO SCAMS
  { pattern: 'double your bitcoin', category: 'crypto', description: 'Bitcoin doubling scam', severity: 'high' },
  { pattern: 'multiply your crypto', category: 'crypto', description: 'Crypto multiplication scam', severity: 'high' },
  { pattern: 'send 1 get 2', category: 'crypto', description: 'Fake crypto return', severity: 'high' },
  { pattern: 'guaranteed return', category: 'crypto', description: 'False guarantee', severity: 'high' },
  { pattern: 'profit in 24 hours', category: 'crypto', description: 'Impossible promise', severity: 'high' },

  // PERSONAL INFO REQUESTS
  { pattern: 'confirm your ssn', category: 'personal', description: 'SSN request', severity: 'high' },
  { pattern: 'verify your social', category: 'personal', description: 'Social security verification', severity: 'high' },
  { pattern: 'update your password', category: 'personal', description: 'Password phishing', severity: 'high' },
  { pattern: 'click here to verify', category: 'personal', description: 'Verification phishing', severity: 'high' },
  { pattern: 'login to secure', category: 'personal', description: 'Fake security login', severity: 'high' },

  // GRANDPARENT/ROMANCE SCAMS
  { pattern: 'grandchild in jail', category: 'relationship', description: 'Grandparent scam', severity: 'high' },
  { pattern: 'need bail money', category: 'relationship', description: 'Fake bail request', severity: 'high' },
  { pattern: 'hospital payment', category: 'relationship', description: 'Fake medical emergency', severity: 'high' },
  { pattern: 'plane ticket money', category: 'relationship', description: 'Fake travel emergency', severity: 'high' },
  { pattern: 'i love you send money', category: 'relationship', description: 'Romance scam', severity: 'high' },

  // FAKE DELIVERY
  { pattern: 'missed delivery', category: 'delivery', description: 'Fake delivery notification', severity: 'high' },
  { pattern: 'redelivery fee', category: 'delivery', description: 'Fake redelivery charge', severity: 'high' },
  { pattern: 'customs duty', category: 'delivery', description: 'Fake customs fee', severity: 'high' },
  { pattern: 'shipping cost', category: 'delivery', description: 'Fake shipping fee', severity: 'high' },
  { pattern: 'package holding', category: 'delivery', description: 'Fake package hold', severity: 'high' },
  { pattern: 'ups fee', category: 'delivery', description: 'Fake UPS charge', severity: 'high' },
  { pattern: 'dhl fee', category: 'delivery', description: 'Fake DHL charge', severity: 'high' },

  // TECH SUPPORT SCAMS
  { pattern: 'your computer is infected', category: 'tech', description: 'Fake virus alert', severity: 'high' },
  { pattern: 'virus detected', category: 'tech', description: 'Fake virus detection', severity: 'high' },
  { pattern: 'suspicious activity', category: 'tech', description: 'Fake security alert', severity: 'high' },
  { pattern: 'login attempt blocked', category: 'tech', description: 'Fake login block', severity: 'high' },
  { pattern: 'account breached', category: 'tech', description: 'Fake breach notification', severity: 'high' },

  // CATFISHING/CHECKING MESSAGES (often from unknown numbers)
  { pattern: 'r u there', category: 'catfishing', description: 'Checking if recipient is active', severity: 'medium' },
  { pattern: 'are you there', category: 'catfishing', description: 'Checking if recipient is active', severity: 'medium' },
  { pattern: 'you there', category: 'catfishing', description: 'Checking if recipient is active', severity: 'medium' },
  { pattern: 'u there', category: 'catfishing', description: 'Checking if recipient is active', severity: 'medium' },
  { pattern: 'ru there', category: 'catfishing', description: 'Checking if recipient is active', severity: 'medium' },
  { pattern: 'r u up', category: 'catfishing', description: 'Checking if recipient is awake/active', severity: 'medium' },
  { pattern: 'are you up', category: 'catfishing', description: 'Checking if recipient is awake/active', severity: 'medium' },
  { pattern: 'you up', category: 'catfishing', description: 'Checking if recipient is awake/active', severity: 'medium' },
  { pattern: 'u up', category: 'catfishing', description: 'Checking if recipient is awake/active', severity: 'medium' },

  { pattern: 'hi', category: 'catfishing', description: 'Generic greeting from unknown sender', severity: 'low' },
  { pattern: 'hello', category: 'catfishing', description: 'Generic greeting from unknown sender', severity: 'low' },
  { pattern: 'sup', category: 'catfishing', description: 'Casual greeting from unknown sender', severity: 'low' },
  { pattern: 'yo', category: 'catfishing', description: 'Casual greeting from unknown sender', severity: 'low' },
  { pattern: 'wassup', category: 'catfishing', description: 'Casual greeting from unknown sender', severity: 'low' },
  { pattern: "what's up", category: 'catfishing', description: 'Casual greeting from unknown sender', severity: 'low' },
  { pattern: 'whats up', category: 'catfishing', description: 'Casual greeting from unknown sender', severity: 'low' },
  { pattern: 'wyd', category: 'catfishing', description: 'What you doing - checking activity', severity: 'medium' },
  { pattern: 'what you doing', category: 'catfishing', description: 'Checking current activity', severity: 'medium' },
  { pattern: 'what are you doing', category: 'catfishing', description: 'Checking current activity', severity: 'medium' },
  { pattern: 'awake', category: 'catfishing', description: 'Checking if recipient is awake', severity: 'medium' },
  { pattern: 'still up', category: 'catfishing', description: 'Checking if recipient is still active', severity: 'medium' },
  { pattern: 'you awake', category: 'catfishing', description: 'Checking wakefulness', severity: 'medium' },
  { pattern: 'you still up', category: 'catfishing', description: 'Checking continued activity', severity: 'medium' },
  { pattern: 'still awake', category: 'catfishing', description: 'Checking wakefulness', severity: 'medium' },
  { pattern: 'you still awake', category: 'catfishing', description: 'Checking wakefulness', severity: 'medium' }
];

// Export just the patterns for backward compatibility
export const redFlagPatterns = scamPatterns.map(p => p.pattern);

// Utility functions for working with patterns
export function getPatternsByCategory(category: string): ScamPattern[] {
  return scamPatterns.filter(p => p.category === category);
}

export function getPatternsBySeverity(severity: 'low' | 'medium' | 'high'): ScamPattern[] {
  return scamPatterns.filter(p => p.severity === severity);
}

export function addPattern(pattern: ScamPattern): void {
  scamPatterns.push(pattern);
}

export function removePattern(pattern: string | RegExp): void {
  const index = scamPatterns.findIndex(p => p.pattern === pattern);
  if (index > -1) {
    scamPatterns.splice(index, 1);
  }
}
