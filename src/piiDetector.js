/**
 * Mock PII Detector — regex-based pattern matching.
 * No external API calls needed. Runs entirely in the browser.
 */

const PII_PATTERNS = [
  {
    type: 'EMAIL',
    regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    icon: '📧',
    color: 'rgba(239, 68, 68, 0.35)',
  },
  {
    type: 'PHONE',
    regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    icon: '📱',
    color: 'rgba(168, 85, 247, 0.35)',
  },
  {
    type: 'SSN',
    regex: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    icon: '🔐',
    color: 'rgba(220, 38, 38, 0.5)',
  },
  {
    type: 'CREDIT_CARD',
    regex: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g,
    icon: '💳',
    color: 'rgba(234, 88, 12, 0.35)',
  },
  {
    type: 'DATE_OF_BIRTH',
    regex: /\b(?:(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2})\b/g,
    icon: '🎂',
    color: 'rgba(14, 165, 233, 0.35)',
  },
  {
    type: 'ADDRESS',
    regex: /\b\d{1,5}\s+(?:[A-Z][a-z]+\s*){1,4}(?:St(?:reet)?|Ave(?:nue)?|Blvd|Boulevard|Dr(?:ive)?|Ln|Lane|Rd|Road|Ct|Court|Pl|Place|Way|Cir(?:cle)?|Pkwy|Parkway|Ter(?:race)?)\b\.?(?:\s*,?\s*(?:Apt|Suite|Ste|Unit|#)\s*\d+[A-Za-z]?)?\s*,?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*,?\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/gi,
    icon: '🏠',
    color: 'rgba(16, 185, 129, 0.35)',
  },
  {
    type: 'NAME',
    // Match "First Last" patterns near common PII context clues
    regex: /(?:(?:Mr|Mrs|Ms|Dr|Prof)\.\s+)?[A-Z][a-z]{1,15}\s+(?:[A-Z]\.?\s+)?[A-Z][a-z]{1,20}/g,
    icon: '👤',
    color: 'rgba(99, 102, 241, 0.35)',
    // Names require contextual validation to reduce false positives
    validate: (match, fullText) => {
      const nameStr = typeof match === 'string' ? match : match[0];
      const matchIdx = typeof match === 'string' ? fullText.indexOf(nameStr) : match.index;
      
      const words = nameStr.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
      const firstWord = words[0];

      // 1. Common First Names - If it starts with one of these, it's almost certainly a name
      const commonNames = new Set([
        'emily', 'john', 'michael', 'sarah', 'david', 'jessica', 'james', 'mary', 
        'robert', 'patricia', 'william', 'jennifer', 'richard', 'linda', 'thomas', 
        'elizabeth', 'charles', 'barbara', 'christopher', 'susan', 'daniel', 'joseph', 
        'margaret', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew',
        'joshua', 'kenneth', 'kevin', 'brian', 'george', 'edward', 'ronald', 'timothy',
        'jason', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas', 'eric', 'jonathan',
        'stephen', 'larry', 'justin', 'scott', 'brandon', 'benjamin', 'samuel', 'gregory',
        'alexander', 'frank', 'patrick', 'raymond', 'jack', 'dennis', 'jerry', 'tyler',
        'aaron', 'jose', 'adam', 'nathan', 'henry', 'douglas', 'zachary', 'peter',
        'kyle', 'ethan', 'walter', 'noah', 'jeremy', 'christian', 'keith', 'roger',
        'terry', 'gerald', 'harold', 'sean', 'austin', 'carl', 'arthur', 'lawrence',
        'dylan', 'jesse', 'jordan', 'bryan', 'billy', 'joe', 'bruce', 'gabriel',
        'logan', 'albert', 'willie', 'alan', 'juan', 'wayne', 'roy', 'ralph', 'randy',
        'eugene', 'vincent', 'russell', 'elijah', 'louis', 'bobby', 'philip', 'johnny',
        'luke', 'marcus', 'olivia', 'emma', 'charlotte', 'amelia', 'ava', 'sophia',
        'isabella', 'mia', 'evelyn', 'harper', 'camila', 'gianna', 'abigail', 'luna',
        'ella', 'chloe', 'aria', 'penelope', 'grace', 'layla', 'riley', 'zoey', 'nora',
        'lily', 'eleanor', 'hannah', 'lillian', 'addison', 'aubrey', 'ellie', 'stella',
        'natalie', 'zoe', 'leah', 'hazel', 'violet', 'aurora', 'savannah', 'audrey',
        'brooklyn', 'bella', 'claire', 'skylar', 'lucy', 'paisley', 'everly', 'anna',
        'caroline', 'nova', 'genesis', 'emilia', 'kennedy', 'samantha', 'maya', 'willow',
        'kinsley', 'naomi', 'aaliyah', 'elena', 'sarah', 'ariana', 'allison', 'gabriella',
        'alice', 'madelyn', 'cora', 'ruby', 'eva', 'serenity', 'autumn', 'adeline'
      ]);

      if (commonNames.has(firstWord) || nameStr.match(/^(Mr|Mrs|Ms|Dr|Prof)\./i)) {
        return true;
      }

      // 2. Stop list of common non-name title-cased words in documents
      const stopWords = new Set([
        'department', 'status', 'notes', 'engineering', 'track', 'risk',
        'assessment', 'compliance', 'recommendations', 'lessons', 'learned',
        'appendix', 'page', 'section', 'table', 'figure', 'project', 'team',
        'management', 'summary', 'conclusion', 'introduction', 'report',
        'update', 'weekly', 'monthly', 'annual', 'review', 'analysis',
        'data', 'base', 'system', 'network', 'security', 'policy', 'procedure',
        'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for',
        'with', 'by', 'about', 'as', 'is', 'are', 'was', 'were', 'be', 'been',
        'maple', 'grove', 'inc', 'llc', 'corp', 'corporation', 'company',
        'business', 'overview', 'quarterly', 'quality', 'assurance', 'customer',
        'support', 'stable', 'document', 'confidential', 'internal', 'external',
        'global', 'local', 'national', 'international', 'state', 'city', 'county',
        'street', 'avenue', 'boulevard', 'road', 'lane', 'drive', 'court', 'plaza'
      ]);
      
      if (words.some(w => stopWords.has(w))) return false;

      // 3. Contextual check if it's not a common name and not a stopword
      const contextWords = [
        'name', 'patient', 'client', 'applicant', 'employee', 'resident',
        'tenant', 'dear', 'sincerely', 'from:', 'to:', 'contact', 'attn',
        'manager', 'director', 'officer', 'executive', 'representative',
        'born', 'dob', 'ssn', 'address', 'phone', 'email',
      ];
      const lower = fullText.toLowerCase();
      // Increase window size to be more forgiving for names
      const nearby = lower.substring(Math.max(0, matchIdx - 200), matchIdx + nameStr.length + 200);
      return contextWords.some(w => nearby.includes(w));
    },
  },
  {
    type: 'IP_ADDRESS',
    regex: /\b(?:25[0-5]|2[0-4]\d|1?\d{1,2})(?:\.(?:25[0-5]|2[0-4]\d|1?\d{1,2})){3}\b/g,
    icon: '🌐',
    color: 'rgba(245, 158, 11, 0.35)',
  },
  {
    type: 'PASSPORT',
    regex: /\b[A-Z]{1,2}\d{6,9}\b/g,
    icon: '🛂',
    color: 'rgba(190, 18, 60, 0.35)',
    validate: (match, fullText) => {
      const passportStr = typeof match === 'string' ? match : match[0];
      const idx = typeof match === 'string' ? fullText.toLowerCase().indexOf(passportStr.toLowerCase()) : match.index;
      
      const lower = fullText.toLowerCase();
      const nearby = lower.substring(Math.max(0, idx - 80), idx + passportStr.length + 80);
      return nearby.includes('passport') || nearby.includes('travel document');
    },
  },
];

/**
 * Scan text for PII and return an array of redaction objects.
 * Each object has: { id, original_text, pii_type, confidence, start, end, is_redacted, icon, color }
 */
export function detectPII(text) {
  const results = [];
  const seen = new Set(); // Prevent duplicate overlapping matches

  for (const pattern of PII_PATTERNS) {
    // Reset regex lastIndex
    pattern.regex.lastIndex = 0;
    let match;

    while ((match = pattern.regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const key = `${start}-${end}`;

      // Skip if we've already flagged this exact range
      if (seen.has(key)) continue;

      // Run optional validator (for context-sensitive patterns like NAMEs)
      if (pattern.validate && !pattern.validate(match, text)) continue;

      seen.add(key);

      results.push({
        id: `pii-${start}-${end}-${Math.random().toString(36).slice(2, 7)}`,
        original_text: match[0],
        pii_type: pattern.type,
        confidence: pattern.type === 'NAME' ? 0.7 : 0.95,
        start,
        end,
        is_redacted: true,
        icon: pattern.icon,
        color: pattern.color,
      });
    }
  }

  // Sort by position
  results.sort((a, b) => a.start - b.start);
  return results;
}
