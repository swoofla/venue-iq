const MONTH_LOOKUP = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sept: 9, sep: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const MONTH_RE = /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\b\.?/gi;

// "may" is also a modal verb ("we may", "may I"). Only count it as a month
// when the surrounding text looks date-like.
function mayIsMonth(text, index) {
  const before = text.slice(Math.max(0, index - 24), index).toLowerCase();
  const after = text.slice(index + 3, index + 24).toLowerCase();
  if (/\b(in|of|for|during|early|late|mid|through|thru|to|and|or|either|between)\s*[,]?\s*$/.test(before)) return true;
  if (/^\s*(of\s+)?(\d{1,2}(st|nd|rd|th)?\b|20\d{2}\b)/.test(after)) return true;
  if (/\b20\d{2}\b/.test(after) || /\b20\d{2}\b/.test(before)) return true;
  return false;
}

/**
 * Deterministically extract every month named in a message.
 * Returns an array of month numbers 1-12, de-duplicated, in the order stated.
 * Returns [] when no month is named.
 * Never infers a month from a date, a season, or context — literal month words only.
 */
export function parseMonthsFromText(text) {
  if (typeof text !== 'string' || !text) return [];
  const found = [];
  const mayHits = [];
  let m;
  MONTH_RE.lastIndex = 0;
  while ((m = MONTH_RE.exec(text)) !== null) {
    const word = m[1].toLowerCase();
    const num = MONTH_LOOKUP[word];
    if (!num) continue;
    if (word === 'may') {
      mayHits.push({ num, index: m.index, order: found.length });
      continue;
    }
    if (!found.includes(num)) found.push(num);
  }
  // Accept "may" if another month was named, or if its context looks date-like.
  for (const hit of mayHits) {
    if (found.length > 0 || mayIsMonth(text, hit.index)) {
      if (!found.includes(hit.num)) found.splice(hit.order, 0, hit.num);
    }
  }
  return found;
}

export default parseMonthsFromText;