import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Internal feedback log reader for the chatbot.
// Reads with SERVICE ROLE so it bypasses the entity's venue_id read rule.

Deno.serve(async (req) => {
  try {
    const { rating, venueId, limit } = await req.json().catch(() => ({}));

    const base44 = createClientFromRequest(req);

    const filter = {};
    if (rating) filter.rating = rating;
    if (venueId) filter.venue_id = venueId;

    const all = await base44.asServiceRole.entities.ChatFeedback.filter(filter);

    const sorted = [...all].sort((a, b) => {
      const aT = a.created_date || a.created_at || '';
      const bT = b.created_date || b.created_at || '';
      if (aT === bT) return 0;
      return aT < bT ? 1 : -1;
    });

    const records = Number.isFinite(limit) ? sorted.slice(0, limit) : sorted;

    return Response.json({ success: true, records });
  } catch (error) {
    console.error('getChatFeedback error:', error?.message || error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});