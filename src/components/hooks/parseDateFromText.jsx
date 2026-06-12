import { parse, isValid, format, addYears, startOfDay } from 'date-fns';

/**
 * Deterministically extract a date from free-form user text.
 *
 * SUPPORTED INPUTS → EXPECTED OUTPUT (assuming today = 2026-06-12):
 *
 *   Full month, no year:
 *     "October 17"                 → "2026-10-17"
 *     "october 17"                 → "2026-10-17"  (case-insensitive)
 *     "October 17th"               → "2026-10-17"  (ordinal suffix)
 *     "January 5"                  → "2027-01-05"  (past this year → next year)
 *
 *   Full month with year:
 *     "October 17, 2027"           → "2027-10-17"
 *     "October 17th, 2027"         → "2027-10-17"
 *     "October 17 2027"            → "2027-10-17"
 *
 *   Abbreviated month (with or without period):
 *     "Oct 17"                     → "2026-10-17"
 *     "Oct. 17"                    → "2026-10-17"
 *     "Oct 17, 2027"               → "2027-10-17"
 *     "Sep 5"                      → "2026-09-05"
 *     "Sept 5"                     → "2026-09-05"
 *     "Sept. 5"                    → "2026-09-05"
 *
 *   Day-then-month order:
 *     "17 October"                 → "2026-10-17"
 *     "the 17th of October"        → "2026-10-17"
 *     "17th of October 2027"       → "2027-10-17"
 *
 *   Numeric:
 *     "10/17"                      → "2026-10-17"
 *     "10-17"                      → "2026-10-17"
 *     "10/17/27"                   → "2027-10-17"  (2-digit year → 20xx)
 *     "10/17/2027"                 → "2027-10-17"
 *     "10-17-2027"                 → "2027-10-17"
 *
 *   ISO:
 *     "2027-10-17"                 → "2027-10-17"
 *
 *   Pure timeframes (NO specific date) → null:
 *     "next fall"                  → null
 *     "October"                    → null  (month only, no day)
 *     "sometime in 2027"           → null  (year only)
 *     "summer 2027"                → null
 *     ""                           → null
 *
 * Rules:
 *   - No year supplied → resolve to the next FUTURE occurrence (today or later).
 *   - 2-digit year → prefixed with "20" (e.g. "27" → 2027).
 *   - Case-insensitive throughout.
 */
export default function parseDateFromText(text, context) {
  if (!text || typeof text !== 'string') return null;

  // Normalize: strip ordinal suffixes (1st, 2nd, 3rd, 17th), keep periods on abbrevs for now
  const cleaned = text.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1').replace(/\s+/g, ' ').trim();
  const today = startOfDay(new Date());

  // ── Context-aware bare-day resolution ──────────────────────────────
  // If the user says "the 28th" / "what about the 17th" / "the 5" and we have
  // an active date context (most recent month/year discussed), resolve against it.
  // We only do this when the message contains NO month name and NO slash/dash date,
  // so we don't hijack a real month+day phrase.
  if (context && Number.isInteger(context.month) && Number.isInteger(context.year)) {
    const hasMonth = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\b/i.test(cleaned);
    const hasNumericDate = /\b\d{1,2}[/-]\d{1,2}\b/.test(cleaned) || /\b\d{4}-\d{1,2}-\d{1,2}\b/.test(cleaned);
    if (!hasMonth && !hasNumericDate) {
      // "the 28", "the 28th" (suffix already stripped), or a bare " 28 " in a short phrase
      const bare = cleaned.match(/\bthe\s+(\d{1,2})\b/i) || cleaned.match(/^(\d{1,2})$/);
      if (bare) {
        const day = parseInt(bare[1], 10);
        if (day >= 1 && day <= 31) {
          const parsed = new Date(context.year, context.month - 1, day);
          if (
            isValid(parsed) &&
            parsed.getMonth() === context.month - 1 &&
            parsed.getDate() === day
          ) {
            return format(parsed, 'yyyy-MM-dd');
          }
        }
      }
    }
  }

  const FULL_MONTH = '(January|February|March|April|May|June|July|August|September|October|November|December)';
  const ABBR_MONTH = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)';

  // Each pattern: regex + format + hasYear + normalizer that produces the string fed to date-fns parse.
  // "Sept" is normalized to "Sep" so date-fns "MMM" can parse it.
  const patterns = [
    // ISO: 2027-10-17
    {
      regex: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/,
      fmt: 'yyyy-M-d', hasYear: true,
      normalize: m => `${m[1]}-${m[2]}-${m[3]}`,
    },

    // Full month + day + 4-digit year: "October 17, 2027" / "October 17 2027"
    {
      regex: new RegExp(`\\b${FULL_MONTH}\\s+(\\d{1,2})(?:,)?\\s+(\\d{4})\\b`, 'i'),
      fmt: 'MMMM d yyyy', hasYear: true,
      normalize: m => `${cap(m[1])} ${m[2]} ${m[3]}`,
    },
    // Day + full month + 4-digit year: "17 October 2027" / "17th of October 2027"
    {
      regex: new RegExp(`\\b(\\d{1,2})(?:\\s+of)?\\s+${FULL_MONTH}\\s+(\\d{4})\\b`, 'i'),
      fmt: 'd MMMM yyyy', hasYear: true,
      normalize: m => `${m[1]} ${cap(m[2])} ${m[3]}`,
    },
    // Abbreviated month + day + 4-digit year: "Oct 17, 2027" / "Oct. 17 2027" / "Sept. 5 2027"
    {
      regex: new RegExp(`\\b${ABBR_MONTH}\\.?\\s+(\\d{1,2})(?:,)?\\s+(\\d{4})\\b`, 'i'),
      fmt: 'MMM d yyyy', hasYear: true,
      normalize: m => `${normalizeAbbr(m[1])} ${m[2]} ${m[3]}`,
    },
    // Day + abbreviated month + 4-digit year: "17 Oct 2027"
    {
      regex: new RegExp(`\\b(\\d{1,2})(?:\\s+of)?\\s+${ABBR_MONTH}\\.?\\s+(\\d{4})\\b`, 'i'),
      fmt: 'd MMM yyyy', hasYear: true,
      normalize: m => `${m[1]} ${normalizeAbbr(m[2])} ${m[3]}`,
    },

    // Full month + day, no year: "October 17"
    {
      regex: new RegExp(`\\b${FULL_MONTH}\\s+(\\d{1,2})\\b`, 'i'),
      fmt: 'MMMM d', hasYear: false,
      normalize: m => `${cap(m[1])} ${m[2]}`,
    },
    // Day + full month, no year: "17 October" / "the 17th of October"
    {
      regex: new RegExp(`\\b(\\d{1,2})(?:\\s+of)?\\s+${FULL_MONTH}\\b`, 'i'),
      fmt: 'd MMMM', hasYear: false,
      normalize: m => `${m[1]} ${cap(m[2])}`,
    },
    // Abbreviated month + day, no year: "Oct 17" / "Oct. 17" / "Sept 5"
    {
      regex: new RegExp(`\\b${ABBR_MONTH}\\.?\\s+(\\d{1,2})\\b`, 'i'),
      fmt: 'MMM d', hasYear: false,
      normalize: m => `${normalizeAbbr(m[1])} ${m[2]}`,
    },
    // Day + abbreviated month, no year: "17 Oct"
    {
      regex: new RegExp(`\\b(\\d{1,2})(?:\\s+of)?\\s+${ABBR_MONTH}\\.?\\b`, 'i'),
      fmt: 'd MMM', hasYear: false,
      normalize: m => `${m[1]} ${normalizeAbbr(m[2])}`,
    },

    // Numeric with 4-digit year: "10/17/2027" / "10-17-2027"
    {
      regex: /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/,
      fmt: 'M/d/yyyy', hasYear: true,
      normalize: m => `${m[1]}/${m[2]}/${m[3]}`,
    },
    // Numeric with 2-digit year: "10/17/27"
    {
      regex: /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2})\b/,
      fmt: 'M/d/yyyy', hasYear: true,
      normalize: m => `${m[1]}/${m[2]}/20${m[3]}`,
    },
    // Numeric, no year: "10/17" / "10-17"
    {
      regex: /\b(\d{1,2})[/-](\d{1,2})\b/,
      fmt: 'M/d', hasYear: false,
      normalize: m => `${m[1]}/${m[2]}`,
    },
  ];

  for (const { regex, fmt, hasYear, normalize } of patterns) {
    const match = cleaned.match(regex);
    if (!match) continue;

    const candidate = normalize(match);
    let parsed = parse(candidate, fmt, today);
    if (!isValid(parsed)) continue;

    // Sanity: numeric M/d patterns can also match things like phone fragments; ensure month/day are real.
    const m = parsed.getMonth() + 1;
    const d = parsed.getDate();
    if (m < 1 || m > 12 || d < 1 || d > 31) continue;

    if (!hasYear) {
      // Prefer the active context year when it produces a today-or-later date.
      if (context && Number.isInteger(context.year)) {
        const candidate = new Date(context.year, parsed.getMonth(), parsed.getDate());
        if (isValid(candidate) && candidate >= today) {
          return format(candidate, 'yyyy-MM-dd');
        }
      }
      if (parsed < today) parsed = addYears(parsed, 1);
    }

    return format(parsed, 'yyyy-MM-dd');
  }

  return null;
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function normalizeAbbr(s) {
  const lower = s.toLowerCase();
  if (lower === 'sept') return 'Sep';
  return cap(lower);
}