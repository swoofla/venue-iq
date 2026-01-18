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



    // API limits date range to 31 days, so we need to query in chunks
    const allSlots = {};
    let currentStart = startDateTime;
    
    while (currentStart < endDateTime) {
      const chunkEnd = new Date(Math.min(
        currentStart.getTime() + 30 * 24 * 60 * 60 * 1000,
        endDateTime.getTime()
      ));
      
      const chunkStartMillis = currentStart.getTime();
      const chunkEndMillis = chunkEnd.getTime();
      
      const chunkResponse = await fetch(
        `https://services.leadconnectorhq.com/calendars/${HIGHLEVEL_WEDDING_CALENDAR_ID}/free-slots?startDate=${chunkStartMillis}&endDate=${chunkEndMillis}&timezone=America/New_York`,
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
      
      if (chunkResponse.ok) {
        const chunkData = await chunkResponse.json();
        Object.assign(allSlots, chunkData);
      }
      
      currentStart = new Date(chunkEnd.getTime() + 1);
    }
    
    // Generate all dates in range
    const allDates = [];
    let currentDate = new Date(startDateTime);
    while (currentDate <= endDateTime) {
      allDates.push(currentDate.toISOString().split('T')[0]);
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    }
    
    // Filter out traceId and extract actual date keys from HighLevel response
    const datesWithSlots = Object.keys(allSlots || {}).filter(key => key !== 'traceId');
    
    // Dates WITHOUT slots in the calendar are AVAILABLE (no appointment blocking them)
    // Dates WITH slots means there's availability configured but could be booked
    // Since we can't access the appointments directly, we'll assume dates without any slots are available
    const availableDates = allDates.filter(date => !datesWithSlots.includes(date));

    return Response.json({ success: true, availableDates, bookedDates: datesWithSlots, totalDays: allDates.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});