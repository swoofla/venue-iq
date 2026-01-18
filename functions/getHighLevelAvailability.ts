Deno.serve(async (req) => {
  try {
    const { startDate, endDate } = await req.json();
    
    const HIGHLEVEL_API_KEY = Deno.env.get('HIGHLEVEL_API_KEY');
    const HIGHLEVEL_TOUR_CALENDAR_ID = Deno.env.get('HIGHLEVEL_TOUR_CALENDAR_ID');
    
    console.log('DEBUG: Calendar ID:', HIGHLEVEL_TOUR_CALENDAR_ID);
    console.log('DEBUG: Input dates:', { startDate, endDate });
    
    if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_TOUR_CALENDAR_ID) {
      return Response.json({ error: 'HighLevel credentials not configured' }, { status: 500 });
    }

    const now = new Date();
    const startDateTime = startDate ? new Date(startDate) : now;
    const endDateTime = endDate ? new Date(endDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    startDateTime.setHours(0, 0, 0, 0);
    endDateTime.setHours(23, 59, 59, 999);
    
    const startMillis = startDateTime.getTime();
    const endMillis = endDateTime.getTime();

    console.log('DEBUG: Milliseconds:', { startMillis, endMillis });

    const url = `https://services.leadconnectorhq.com/calendars/${HIGHLEVEL_TOUR_CALENDAR_ID}/free-slots?startDate=${startMillis}&endDate=${endMillis}&timezone=America/New_York`;
    console.log('DEBUG: Request URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const rawData = await response.text();
    console.log('DEBUG: Raw HighLevel response:', rawData);

    if (!response.ok) {
      return Response.json({ error: `HighLevel API error: ${rawData}` }, { status: 500 });
    }

    const data = JSON.parse(rawData);
    console.log('DEBUG: Parsed data structure:', JSON.stringify(data, null, 2));
    console.log('DEBUG: Data keys:', Object.keys(data));
    
    // Transform HighLevel response into our format
    const transformedSlots = [];
    
    // HighLevel free-slots returns data keyed by date, not as data.data array
    // Example: { "2026-01-20": { "slots": ["1737399600000", "1737403200000"] }, ... }
    
    if (typeof data === 'object' && !Array.isArray(data)) {
      // Handle date-keyed object format
      Object.entries(data).forEach(([dateKey, dayData]) => {
        // Skip non-date keys like "traceId"
        if (dateKey === 'traceId' || !dayData?.slots) return;
        
        const times = dayData.slots.map(slotTime => {
          const slotDateTime = new Date(parseInt(slotTime));
          return slotDateTime.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });
        });
        
        if (times.length > 0) {
          transformedSlots.push({
            date: dateKey,
            times: [...new Set(times)].sort()
          });
        }
      });
    }
    
    // Sort by date
    transformedSlots.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    console.log('DEBUG: Transformed slots:', JSON.stringify(transformedSlots, null, 2));
    
    return Response.json({ success: true, slots: transformedSlots, rawStructure: Object.keys(data) });
  } catch (error) {
    console.log('DEBUG: Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});