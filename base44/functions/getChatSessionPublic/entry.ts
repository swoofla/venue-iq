import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { id } = await req.json();

    if (!id) {
      return Response.json({ error: 'Missing id' }, { status: 400 });
    }

    let session;
    try {
      session = await base44.asServiceRole.entities.ChatSession.get(id);
    } catch (_err) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    if (!session) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    let venueName = '';
    let venueDomain = '';
    try {
      const venue = await base44.asServiceRole.entities.Venue.get(session.venue_id);
      venueName = venue?.name || '';
      venueDomain = venue?.domain || '';
    } catch (_err) {
      // venue fetch is not critical
    }

    // Return only the fields needed for display — no internal IDs/secrets
    return Response.json({
      session: {
        id: session.id,
        venue_name: venueName,
        venue_domain: venueDomain,
        lead_name: session.lead_name || null,
        lead_phone: session.lead_phone || null,
        lead_email: session.lead_email || null,
        lead_wedding_date: session.lead_wedding_date || null,
        lead_guest_count: session.lead_guest_count || null,
        lead_budget_range: session.lead_budget_range || null,
        messages: session.messages || [],
        flows_completed: session.flows_completed || [],
        flow_results: session.flow_results || {},
        handoff_topic: session.handoff_topic || null,
        status: session.status,
        created_date: session.created_date,
        updated_date: session.updated_date
      }
    });
  } catch (error) {
    console.error('getChatSessionPublic error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});