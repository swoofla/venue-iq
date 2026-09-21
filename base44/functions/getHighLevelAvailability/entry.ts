import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const { startDate, endDate, venueId } = await req.json();
    const base44 = createClientFromRequest(req);
    
    const { apiKey: HIGHLEVEL_API_KEY, locationId: HIGHLEVEL_LOCATION_ID, calendarId: HIGHLEVEL_TOUR_CALENDAR_ID } = highLevelConfig(venueId);
    
    if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_LOCATION_ID || !HIGHLEVEL_TOUR_CALENDAR_ID) {
      return Response.json({ 
        error: 'HighLevel configuration missing' 
      }, { status: 500 });
    }

    const venue = await base44.asServiceRole.entities.Venue.get(venueId);
    const timezone = venue.timezone || 'America/New_York';
    const calendarResponse = await fetch(`https://services.leadconnectorhq.com/calendars/${HIGHLEVEL_TOUR_CALENDAR_ID}`, {
      headers: { Authorization: `Bearer ${HIGHLEVEL_API_KEY}`, Version: '2021-07-28' },
    });
    if (!calendarResponse.ok) return Response.json({ error: 'Unable to access this venue’s tour calendar' }, { status: 503 });
    const calendarData = await calendarResponse.json();
    const calendar = calendarData.calendar || calendarData;
    if (calendar.locationId !== HIGHLEVEL_LOCATION_ID || calendar.isActive === false) {
      return Response.json({ error: 'Tour calendar is inactive or belongs to a different account' }, { status: 503 });
    }


    const formatTimeFromISO = (slot) => new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(new Date(typeof slot === 'string' && slot.includes('T') ? slot : Number(slot)));

    // Pad UTC boundaries so a DST transition cannot omit the first/last local slot.
    const startDateTime = new Date(`${startDate}T00:00:00Z`);
    const endDateTime = new Date(`${endDate}T23:59:59Z`);
    startDateTime.setUTCDate(startDateTime.getUTCDate() - 1);
    endDateTime.setUTCDate(endDateTime.getUTCDate() + 1);
    if (!Number.isFinite(startDateTime.getTime()) || !Number.isFinite(endDateTime.getTime()) || startDate > endDate) {
      return Response.json({ error: 'Invalid date range' }, { status: 400 });
    }

    // Call HighLevel V2 API
    const url = `https://services.leadconnectorhq.com/calendars/${HIGHLEVEL_TOUR_CALENDAR_ID}/free-slots?startDate=${startDateTime.getTime()}&endDate=${endDateTime.getTime()}&timezone=${encodeURIComponent(timezone)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('HighLevel API error:', response.status, errorText);
      return Response.json({ 
        error: `HighLevel API error: ${response.status}`,
        details: errorText 
      }, { status: response.status });
    }
    
    const rawData = await response.json();
    
    // Transform the response
    const transformedSlots = [];
    
    for (const [dateKey, dateData] of Object.entries(rawData)) {
      if (dateKey < startDate || dateKey > endDate || dateKey === 'traceId' || !dateData || !Array.isArray(dateData.slots)) {
        continue;
      }
      
      const times = dateData.slots.map(slot => formatTimeFromISO(slot));
      
      transformedSlots.push({
        date: dateKey,
        times: times
      });
    }
    
    // Sort by date
    transformedSlots.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return Response.json({ 
      success: true, 
      slots: transformedSlots,
      timezone: timezone
    });
    
  } catch (error) {
    console.error('getHighLevelAvailability error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
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
