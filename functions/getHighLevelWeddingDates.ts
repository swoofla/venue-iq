Deno.serve(async (req) => {
  try {
    const { startDate, endDate } = await req.json();
    
    const HIGHLEVEL_API_KEY = Deno.env.get('HIGHLEVEL_API_KEY');
    const HIGHLEVEL_WEDDING_CALENDAR_ID = Deno.env.get('HIGHLEVEL_WEDDING_CALENDAR_ID');
    
    if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_WEDDING_CALENDAR_ID) {
      return Response.json({ error: 'HighLevel credentials not configured' }, { status: 500 });
    }

    const start = startDate || new Date().toISOString().split('T')[0];
    const end = endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const response = await fetch(
      `https://rest.gohighlevel.com/v1/calendars/${HIGHLEVEL_WEDDING_CALENDAR_ID}/appointments?startDate=${start}&endDate=${end}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: `HighLevel API error: ${error}` }, { status: 500 });
    }

    const appointments = await response.json();
    
    // Extract just the dates from appointments
    const bookedDates = appointments.events?.map(event => ({
      date: event.startTime?.split('T')[0],
      title: event.title
    })) || [];

    return Response.json({ success: true, bookedDates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});