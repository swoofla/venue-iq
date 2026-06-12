import { parse, isValid, format, addYears, startOfDay } from 'date-fns';

/**
 * Deterministically extract a date from free-form user text.
 * Handles: "October 17th", "Oct 17", "10/17", "October 17 2027", "10/17/27", "10-17-2027", etc.
 * Returns YYYY-MM-DD or null. If no year is provided, resolves to the next FUTURE occurrence.
 */
export default function parseDateFromText(text) {
  if (!text || typeof text !== 'string') return null;

  // Normalize: strip ordinal suffixes (1st, 2nd, 3rd, 17th) and collapse whitespace
  const cleaned = text
    .replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  const today = startOfDay(new Date());

  // Patterns to try, in priority order. Each pattern includes the date-fns format and whether year is present.
  const patterns = [
    // Full month name with year: "October 17 2027", "October 17, 2027"
    { regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,)?\s+(\d{4})\b/i, fmt: 'MMMM d yyyy', hasYear: true, normalize: m => `${m[1]} ${m[2]} ${m[3]}` },
    // Short month with year: "Oct 17 2027", "Oct 17, 2027"
    { regex: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:,)?\s+(\d{4})\b/i, fmt: 'MMM d yyyy', hasYear: true, normalize: m => `${m[1].replace(/^Sept$/i, 'Sep')} ${m[2]} ${m[3]}` },
    // Full month name no year: "October 17"
    { regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/i, fmt: 'MMMM d', hasYear: false, normalize: m => `${m[1]} ${m[2]}` },
    // Short month no year: "Oct 17"
    { regex: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})\b/i, fmt: 'MMM d', hasYear: false, normalize: m => `${m[1].replace(/^Sept$/i, 'Sep')} ${m[2]}` },
    // Numeric with 4-digit year: "10/17/2027", "10-17-2027"
    { regex: /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/, fmt: 'M/d/yyyy', hasYear: true, normalize: m => `${m[1]}/${m[2]}/${m[3]}` },
    // Numeric with 2-digit year: "10/17/27"
    { regex: /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2})\b/, fmt: 'M/d/yy', hasYear: true, normalize: m => `${m[1]}/${m[2]}/${m[3]}` },
    // Numeric no year: "10/17", "10-17"
    { regex: /\b(\d{1,2})[/-](\d{1,2})\b/, fmt: 'M/d', hasYear: false, normalize: m => `${m[1]}/${m[2]}` },
  ];

  for (const { regex, fmt, hasYear, normalize } of patterns) {
    const match = cleaned.match(regex);
    if (!match) continue;

    const candidate = normalize(match);
    let parsed = parse(candidate, fmt, today);
    if (!isValid(parsed)) continue;

    // If no year was supplied, default to current year; bump to next year if already past
    if (!hasYear) {
      if (parsed < today) parsed = addYears(parsed, 1);
    }

    return format(parsed, 'yyyy-MM-dd');
  }

  return null;
}