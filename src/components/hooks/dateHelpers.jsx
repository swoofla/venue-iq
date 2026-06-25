// ── Safe date formatting (NEVER use new Date('YYYY-MM-DD') — it parses as UTC and shifts) ──
export const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function partsFromIso(iso) {
  const [y, m, d] = iso.split('-').map(n => parseInt(n, 10));
  return { y, m, d, jsDate: new Date(y, m - 1, d) };
}

// "Saturday, October 17, 2026"
export function formatFullDate(iso) {
  const { y, m, d, jsDate } = partsFromIso(iso);
  return `${DAY_NAMES[jsDate.getDay()]}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

// "Friday, October 16" (no year — for alternate-date lists)
export function formatShortDate(iso) {
  const { m, d, jsDate } = partsFromIso(iso);
  return `${DAY_NAMES[jsDate.getDay()]}, ${MONTH_NAMES[m - 1]} ${d}`;
}

export function formatList(items) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

// Ordinal suffix for a day-of-month integer: 1 → 'st', 2 → 'nd', 28 → 'th', ...
export function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

// Detect a bare day-of-month reference like "the 28th", "the 28", or a lone "28".
// Returns the day number, or null. Skips messages that already contain a month name
// or a slash/dash numeric date — those are not bare-day references.
export const detectBareDay = (text) => {
  if (!text) return null;
  const hasMonth = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\b/i.test(text);
  if (hasMonth) return null;
  if (/\b\d{1,2}[/-]\d{1,2}\b/.test(text) || /\b\d{4}-\d{1,2}-\d{1,2}\b/.test(text)) return null;
  const cleaned = text.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1');
  const m = cleaned.match(/\bthe\s+(\d{1,2})\b/i) || cleaned.match(/(?:^|\s)(\d{1,2})(?:\s|$)/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  if (day < 1 || day > 31) return null;
  return day;
};

// From a list of ISO dates, return the majority month if a single month accounts
// for STRICTLY MORE than half of the dates. Otherwise null (no confident majority).
export const getMajorityMonth = (isoDates) => {
  if (!Array.isArray(isoDates) || isoDates.length === 0) return null;
  const counts = new Map();
  for (const iso of isoDates) {
    const p = partsFromIso(iso);
    const key = `${p.y}-${p.m}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let bestKey = null, bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) { bestKey = k; bestN = n; }
  }
  if (bestKey && bestN > isoDates.length / 2) {
    const [y, m] = bestKey.split('-').map(Number);
    return { month: m, year: y };
  }
  return null;
};

// Distinct months represented in a list of ISO dates, preserving first-seen order.
export const distinctMonths = (isoDates) => {
  const seen = new Map();
  for (const iso of isoDates || []) {
    const p = partsFromIso(iso);
    const key = `${p.y}-${p.m}`;
    if (!seen.has(key)) seen.set(key, { month: p.m, year: p.y });
  }
  return Array.from(seen.values());
};

// Detect which one of `candidates` the user picked in a free-form reply like
// "May", "June please", "the may one". Returns a candidate {month,year} or null.
export const matchAmbiguityAnswer = (text, candidates) => {
  if (!text || !candidates?.length) return null;
  for (const c of candidates) {
    const name = MONTH_NAMES[c.month - 1];
    const abbr = name.slice(0, 3);
    const re = new RegExp(`\\b(${name}|${abbr})\\b`, 'i');
    if (re.test(text)) return c;
  }
  return null;
};