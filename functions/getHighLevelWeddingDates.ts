Deno.serve(async (req) => {
  try {
    const { startDate, endDate } = await req.json();
    
    const HIGHLEVEL_API_KEY = Deno.env.get('HIGHLEVEL_API_KEY');
    const HIGHLEVEL_WEDDING_CALENDAR_ID = Deno.env.get('HIGHLEVEL_WEDDING_CALENDAR_ID');
    
    if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_WEDDING_CALENDAR_ID) {
      return Response.json({ error: 'HighLevel credentials not configured' }, { status: 500 });
    }

    // Convert dates to Unix timestamps in milliseconds
    const now = new Date();
    const startDateTime = startDate ? new Date(startDate) : now;
    const endDateTime = endDate ? new Date(endDate) : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    
    startDateTime.setHours(0, 0, 0, 0);
    endDateTime.setHours(23, 59, 59, 999);
    
    const startMillis = startDateTime.getTime();
    const endMillis = endDateTime.getTime();

    const response = await fetch(
      `https://services.leadconnectorhq.com/calendars/${HIGHLEVEL_WEDDING_CALENDAR_ID}/free-slots?startDate=${startMillis}&endDate=${endMillis}&timezone=America/New_York`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: `HighLevel API error: ${error}` }, { status: 500 });
    }

    const slotsData = await response.json();
    
    // Dates WITH slots are AVAILABLE (no wedding booked)
    // Dates WITHOUT slots are BOOKED
    const availableDates = Object.keys(slotsData || {}).filter(date => 
      slotsData[date] && slotsData[date].slots && slotsData[date].slots.length > 0
    );

    return Response.json({ success: true, availableDates, rawSlots: slotsData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});