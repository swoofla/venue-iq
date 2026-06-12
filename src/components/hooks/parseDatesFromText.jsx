import { parse, isValid, format, addYears, startOfDay } from 'date-fns';
import parseDateFromText from './parseDateFromText';

/**
 * Extract ALL dates from a free-form message.
 *
 * Handles compact multi-date phrasing on top of the single-date parser:
 *   - "May 28/29/30 or June 3"             → ["2026-05-28","2026-05-29","2026-05-30","2026-06-03"]
 *   - "Oct 17, 18 or Nov 1"                → ["2026-10-17","2026-10-18","2026-11-01"]
 *   - "9/10 or 9/17"                       → ["2026-09-10","2026-09-17"]
 *   - "October 17th"                       → ["2026-10-17"]   (delegates to single parser)
 *
 * Year-resolution rules match parseDateFromText: any date without an explicit
 * year resolves to its next future occurrence. Duplicates are removed, order preserved.
 * Returns [] when nothing is found.
 */
export default function parseDatesFromText(text, context) {
  if (!text || typeof text !== 'string') return [];

  const cleaned = text.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1').replace(/\s+/g, ' ').trim();
  const today = startOfDay(new Date());
  const found = [];
  const seen = new Set();
  const push = (iso) => {
    if (iso && !seen.has(iso)) {
      seen.add(iso);
      found.push(iso);
    }
  };

  const FULL_MONTH = '(January|February|March|April|May|June|July|August|September|October|November|December)';
  const ABBR_MONTH = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)';

  // ── Pass 1: "<Month> <day>[/,& or] <day> [/,& or] <day>" (shared-month day lists) ──
  // Captures the month plus a tail of separators + days, e.g. "May 28/29/30", "May 28, 29 or 30", "Oct 17 and 18".
  const sharedMonthRegex = new RegExp(
    `\\b(?:${FULL_MONTH}|${ABBR_MONTH})\\.?\\s+(\\d{1,2})((?:\\s*(?:[\\/,&]|or|and)\\s*\\d{1,2})+)\\b`,
    'gi'
  );

  let m;
  while ((m = sharedMonthRegex.exec(cleaned)) !== null) {
    const monthRaw = m[1] || m[2];
    const firstDay = m[3];
    const tail = m[4] || '';
    const monthName = normalizeMonth(monthRaw);
    const days = [firstDay, ...tail.split(/[\/,&]|or|and/i).map(s => s.trim()).filter(Boolean)];
    for (const day of days) {
      const iso = resolveMonthDay(monthName, day, today, context);
      if (iso) push(iso);
    }
  }

  // ── Pass 2: split on common multi-date separators and run the single-date parser on each chunk ──
  // Catches "9/10 or 9/17", "Oct 17 or Nov 1", "May 30 and June 3", etc.
  const chunks = cleaned.split(/\s*(?:,|;| or | and | & )\s*/i).filter(Boolean);
  for (const chunk of chunks) {
    const iso = parseDateFromText(chunk, context);
    if (iso) push(iso);
  }

  // ── Fallback: if nothing matched, try the single parser on the whole string ──
  if (found.length === 0) {
    const iso = parseDateFromText(cleaned, context);
    if (iso) push(iso);
  }

  return found;
}

function normalizeMonth(raw) {
  const lower = raw.toLowerCase();
  if (lower === 'sept') return 'Sep';
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function resolveMonthDay(monthName, day, today, context) {
  // Try full month first, then abbreviated.
  const candidates = [
    { str: `${monthName} ${day}`, fmt: 'MMMM d' },
    { str: `${monthName} ${day}`, fmt: 'MMM d' },
  ];
  for (const { str, fmt } of candidates) {
    let parsed = parse(str, fmt, today);
    if (!isValid(parsed)) continue;
    const mm = parsed.getMonth() + 1;
    const dd = parsed.getDate();
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) continue;
    // Prefer the active context year when it yields a today-or-later date.
    if (context && Number.isInteger(context.year)) {
      const ctxCandidate = new Date(context.year, parsed.getMonth(), parsed.getDate());
      if (isValid(ctxCandidate) && ctxCandidate >= today) {
        return format(ctxCandidate, 'yyyy-MM-dd');
      }
    }
    if (parsed < today) parsed = addYears(parsed, 1);
    return format(parsed, 'yyyy-MM-dd');
  }
  return null;
}