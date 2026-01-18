Deno.serve(async (req) => {
  try {
    const { startDate, endDate } = await req.json();
    
    const HIGHLEVEL_API_KEY = Deno.env.get('HIGHLEVEL_API_KEY');
    const HIGHLEVEL_TOUR_CALENDAR_ID = Deno.env.get('HIGHLEVEL_TOUR_CALENDAR_ID');
    
    if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_TOUR_CALENDAR_ID) {
      return Response.json({ error: 'HighLevel credentials not configured' }, { status: 500 });
    }

    const now = new Date();
    const startDateTime = startDate ? new Date(startDate + 'T00:00:00-05:00') : now;
    const endDateTime = endDate ? new Date(endDate + 'T23:59:59-05:00') : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const startMillis = startDateTime.getTime();
    const endMillis = endDateTime.getTime();

    const url = `https://services.leadconnectorhq.com/calendars/${HIGHLEVEL_TOUR_CALENDAR_ID}/free-slots?startDate=${startMillis}&endDate=${endMillis}&timezone=America/New_York`;

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

    if (!response.ok) {
      return Response.json({ error: `HighLevel API error: ${rawData}` }, { status: 500 });
    }

    const data = JSON.parse(rawData);
    
    // Helper function to convert UTC timestamp to EST time string
    const formatTimeEST = (timestamp) => {
      const date = new Date(parseInt(timestamp));
      // Get UTC hours and minutes
      const utcHours = date.getUTCHours();
      const utcMinutes = date.getUTCMinutes();
      
      // Convert to EST (UTC - 5 hours)
      let estHours = utcHours - 5;
      if (estHours < 0) estHours += 24;
      
      // Format as 12-hour time
      const period = estHours >= 12 ? 'PM' : 'AM';
      let displayHours = estHours % 12;
      if (displayHours === 0) displayHours = 12;
      const displayMinutes = utcMinutes.toString().padStart(2, '0');
      
      return `${displayHours}:${displayMinutes} ${period}`;
    };
    
    const transformedSlots = [];
    
    if (typeof data === 'object' && !Array.isArray(data)) {
      Object.entries(data).forEach(([dateKey, dayData]) => {
        if (dateKey === 'traceId' || !dayData?.slots) return;
        
        console.log(`DEBUG: Date ${dateKey} raw slots:`, dayData.slots);
        
        const times = dayData.slots.map(slotTime => {
          const formatted = formatTimeEST(slotTime);
          console.log(`DEBUG: ${slotTime} -> ${formatted}`);
          return formatted;
        });
        
        // Remove duplicates and sort
        const uniqueTimes = [...new Set(times)].sort((a, b) => {
          const parseTime = (t) => {
            const [time, period] = t.split(' ');
            let [hour, min] = time.split(':').map(Number);
            if (period === 'PM' && hour !== 12) hour += 12;
            if (period === 'AM' && hour === 12) hour = 0;
            return hour * 60 + min;
          };
          return parseTime(a) - parseTime(b);
        });
        
        console.log(`DEBUG: Date ${dateKey} unique times:`, uniqueTimes);
        
        if (uniqueTimes.length > 0) {
          transformedSlots.push({
            date: dateKey,
            times: uniqueTimes
          });
        }
      });
    }
    
    transformedSlots.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return Response.json({ success: true, slots: transformedSlots });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});