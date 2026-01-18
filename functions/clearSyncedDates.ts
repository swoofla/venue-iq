import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const venueId = body.venue_id;

    if (!venueId) {
      return Response.json({ error: 'venue_id required' }, { status: 400 });
    }

    // Get all synced dates for this venue
    const dates = await base44.asServiceRole.entities.BookedWeddingDate.filter({ venue_id: venueId });
    
    // Delete each one with delay to avoid rate limit
    let deleted = 0;
    for (const date of dates) {
      await base44.asServiceRole.entities.BookedWeddingDate.delete(date.id);
      deleted++;
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return Response.json({ success: true, deleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});