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



    // Fetch all events/appointments in the calendar
    const eventsResponse = await fetch(
      `https://services.leadconnectorhq.com/calendars/events?calendarId=${HIGHLEVEL_WEDDING_CALENDAR_ID}&startDate=${startMillis}&endDate=${endMillis}`,
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

    if (!eventsResponse.ok) {
      const error = await eventsResponse.text();
      return Response.json({ error: `HighLevel API error: ${error}` }, { status: 500 });
    }

    const eventsData = await eventsResponse.json();
    const events = eventsData.events || [];
    
    // Extract booked dates from events (dates that have appointments)
    const bookedDates = events.map(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.toISOString().split('T')[0];
    });
    
    // Generate all dates in range
    const allDates = [];
    let currentDate = new Date(startDateTime);
    while (currentDate <= endDateTime) {
      allDates.push(currentDate.toISOString().split('T')[0]);
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    }
    
    // Dates WITHOUT appointments are AVAILABLE
    const availableDates = allDates.filter(date => !bookedDates.includes(date));

    return Response.json({ success: true, availableDates, bookedDates, totalDays: allDates.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});