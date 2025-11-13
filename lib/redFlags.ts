// Optimised for lightning client-side scan
export const redFlagPatterns = [
  // Urgency
  'within 24 hours','within 24hrs','within 48 hours','immediate action','act now','urgent','expire soon','final notice','account will be closed','suspended indefinitely',
  // Financial triggers
  'gift card','giftcard','prepaid card','wire transfer','western union','moneygram','bitcoin','btc','ethereum','eth','send funds','pay a fee','release fee','processing fee',
  // Authority spoof
  'irs ','social security','ssa ','medicare ','fbi ','dea ','police department','court order','legal action','law enforcement','government grant','federal reserve',
  // Sketchy URLs (regexes)
  /\b(bit\.ly|tinyurl|tiny\.cc|t\.co|short\.link)\//i,
  /https?:\/\/[^\/]*\.(ru|tk|ml|cf|top|xyz|click|download|stream)\//i,
  // Generic scam lines
  'congratulations you won','you have been selected','100% guaranteed','risk free','no upfront cost','make money fast','work from home','investment opportunity',
  // Crypto
  'double your bitcoin','multiply your crypto','send 1 get 2','guaranteed return','profit in 24 hours',
  // Personal info
  'confirm your ssn','verify your social','update your password','click here to verify','login to secure',
  // Grandparent / romance
  'grandchild in jail','need bail money','hospital payment','plane ticket money','i love you send money',
  // Fake delivery
  'missed delivery','redelivery fee','customs duty','shipping cost','package holding','ups fee','dhl fee',
  // Tech support
  'your computer is infected','virus detected','suspicious activity','login attempt blocked','account breached'
];

export function quickScan(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  return redFlagPatterns.find(p =>
    typeof p === 'string' ? t.includes(p) : p.test(t)
  ) || null;
}