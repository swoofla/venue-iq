Deno.serve(async (req) => {
  try {
    const { startDate, endDate, timezone = 'America/New_York' } = await req.json();
    
    const HIGHLEVEL_API_KEY = Deno.env.get('HIGHLEVEL_API_KEY');
    const HIGHLEVEL_TOUR_CALENDAR_ID = Deno.env.get('HIGHLEVEL_TOUR_CALENDAR_ID');
    
    if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_TOUR_CALENDAR_ID) {
      return Response.json({ 
        error: 'HighLevel configuration missing' 
      }, { status: 500 });
    }

    // Get timezone offset string for date range query
    const getTimezoneOffsetString = (tz) => {
      const offsets = {
        'America/New_York': '-05:00',
        'America/Chicago': '-06:00',
        'America/Denver': '-07:00',
        'America/Phoenix': '-07:00',
        'America/Los_Angeles': '-08:00',
        'America/Anchorage': '-09:00',
        'Pacific/Honolulu': '-10:00',
        'America/Puerto_Rico': '-04:00'
      };
      return offsets[tz] || '-05:00';
    };

    // Parse ISO 8601 string and extract formatted time
    const formatTimeFromISO = (isoString) => {
      let hours, minutes;
      
      if (typeof isoString === 'string' && isoString.includes('T')) {
        // ISO 8601 string: "2026-02-15T12:00:00-05:00"
        const timePart = isoString.split('T')[1];
        const timeOnly = timePart.split(/[-+]/)[0];
        const [h, m] = timeOnly.split(':');
        hours = parseInt(h, 10);
        minutes = parseInt(m, 10);
      } else {
        // Fallback: Unix timestamp (milliseconds)
        const ts = Number(isoString);
        if (isNaN(ts)) return 'Invalid Time';
        const date = new Date(ts);
        hours = date.getUTCHours();
        minutes = date.getUTCMinutes();
      }
      
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
    };

    const tzOffsetString = getTimezoneOffsetString(timezone);
    
    // Convert date strings to Unix milliseconds for API request
    const startDateTime = new Date(`${startDate}T00:00:00${tzOffsetString}`);
    const endDateTime = new Date(`${endDate}T23:59:59${tzOffsetString}`);
    
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
      if (dateKey === 'traceId' || !dateData || !Array.isArray(dateData.slots)) {
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