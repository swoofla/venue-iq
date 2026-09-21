import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
Deno.serve(async req => {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try { user = await base44.auth.me(); } catch { /* unauthenticated */ }
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });
    const { venueId } = await req.json();
    if (!venueId || (user.role !== 'admin' && user.venue_id !== venueId)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { apiKey, locationId, calendarId } = highLevelConfig(venueId);
    const missing = [!apiKey && 'integration token', !locationId && 'location ID', !calendarId && 'tour calendar ID'].filter(Boolean);
    if (missing.length) return Response.json({ connected: false, message: `Setup needed: ${missing.join(', ')}.` });
    const response = await fetch(`https://services.leadconnectorhq.com/calendars/${encodeURIComponent(calendarId)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Version: '2021-07-28' },
    });
    if (!response.ok) return Response.json({ connected: false, message: `HighLevel rejected the calendar check (${response.status}). Check the integration token, calendar ID, and calendar read permission.` });
    const body = await response.json();
    const calendar = body.calendar || body;
    if (calendar.locationId !== locationId) return Response.json({ connected: false, message: 'The tour calendar belongs to a different HighLevel account. Check the location and calendar IDs.' });
    if (calendar.isActive === false) return Response.json({ connected: false, message: 'Activate this tour calendar in HighLevel.' });
    return Response.json({ connected: true, message: `Tour calendar connected: ${calendar.name || 'Venue tours'}. Text delivery and appointment creation still need an end-to-end test.` });
  } catch {
    return Response.json({ connected: false, message: 'Connection check failed. Please try again.' }, { status: 500 });
  }
});
// Keep credentials server-side. Never fall back to another venue's account.
function highLevelConfig(venueId) {
  const prefixes = {
    '696c4539ef1c68d790d9c6a0': '',
    '6aac0d32b262b9e75ba4515d': 'CONRAD_',
  };
  const prefix = prefixes[venueId];
  if (prefix === undefined) return {};
  return {
    apiKey: Deno.env.get(`${prefix}HIGHLEVEL_API_KEY`),
    locationId: Deno.env.get(`${prefix}HIGHLEVEL_LOCATION_ID`),
    calendarId: Deno.env.get(`${prefix}HIGHLEVEL_TOUR_CALENDAR_ID`),
  };
}
