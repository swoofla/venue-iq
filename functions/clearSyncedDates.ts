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
    
    // Delete in batches of 10 in parallel to avoid timeout
    let deleted = 0;
    const batchSize = 10;
    for (let i = 0; i < dates.length; i += batchSize) {
      const batch = dates.slice(i, i + batchSize);
      await Promise.all(
        batch.map(date => 
          base44.asServiceRole.entities.BookedWeddingDate.delete(date.id)
            .then(() => { deleted++; })
            .catch(e => console.error(`Failed to delete ${date.id}:`, e))
        )
      );
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return Response.json({ success: true, deleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});