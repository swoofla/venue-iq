import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const { rating, venue_id, limit } = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);

    // Service role bypasses the venue-scoped read policy so a super-admin
    // (no venue_id) can review feedback across all venues.
    let records = await base44.asServiceRole.entities.ChatFeedback.list();

    records.sort((a, b) =>
      new Date(b.created_date || b.created_at || 0) - new Date(a.created_date || a.created_at || 0)
    );

    if (rating) records = records.filter(r => r.rating === rating);
    if (venue_id) records = records.filter(r => r.venue_id === venue_id);
    if (limit) records = records.slice(0, limit);

    return Response.json({ records });
  } catch (error) {
    console.error('getChatFeedback error:', error?.message || error);
    return Response.json({ records: [], error: error?.message || String(error) }, { status: 200 });
  }
});