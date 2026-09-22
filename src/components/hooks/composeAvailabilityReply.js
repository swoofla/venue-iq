// The calendar verdict belongs to code; the model only supplies a follow-up.
// Remove only matching verdict sentences, never unrelated dates or pricing.
export function composeAvailabilityReply(verdict, followUp) {
  const lead = typeof verdict === 'string' ? verdict.trim() : '';
  const tail = typeof followUp === 'string' ? followUp.trim() : '';
  if (!lead) return tail;
  const sentences = text => text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  const normalize = text => text
    .normalize('NFKC')
    .replace(/[*_]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim().toLowerCase();
  const owned = new Set(sentences(lead).map(normalize));
  const remainder = sentences(tail)
    .filter(sentence => !owned.has(normalize(sentence)))
    .join('').trim();
  return remainder ? `${lead}\n\n${remainder}` : lead;
}
