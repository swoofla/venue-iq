Deno.serve(async (req) => {
  try {
    const { startDate, endDate, timezone = 'America/New_York' } = await req.json();
    
    const HIGHLEVEL_API_KEY = Deno.env.get('HIGHLEVEL_API_KEY');
    const HIGHLEVEL_TOUR_CALENDAR_ID = Deno.env.get('HIGHLEVEL_TOUR_CALENDAR_ID');
    
    if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_TOUR_CALENDAR_ID) {
      return Response.json({ error: 'HighLevel credentials not configured' }, { status: 500 });
    }

    const getTimezoneOffset = (tz) => {
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

    const tzOffset = getTimezoneOffset(timezone);

    const now = new Date();
    const startDateTime = startDate ? new Date(startDate + `T00:00:00${tzOffset}`) : now;
    const endDateTime = endDate ? new Date(endDate + `T23:59:59${tzOffset}`) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const startMillis = startDateTime.getTime();
    const endMillis = endDateTime.getTime();

    const url = `https://services.leadconnectorhq.com/calendars/${HIGHLEVEL_TOUR_CALENDAR_ID}/free-slots?startDate=${startMillis}&endDate=${endMillis}&timezone=${timezone}`;

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
    
    const formatTimeInTimezone = (timestamp, tz) => {
      const date = new Date(parseInt(timestamp));
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true,
        timeZone: tz
      });
    };
    
    const transformedSlots = [];
    
    console.log(`RAW HighLevel response:`, JSON.stringify(data, null, 2));
    
    if (data.slots && Array.isArray(data.slots)) {
      // HighLevel returns slots as an array of { startsAt: timestamp, ... } objects
      const slotsByDate = {};
      
      data.slots.forEach(slot => {
        const timestamp = parseInt(slot.startsAt || slot.start_time || slot.startTime);
        if (!timestamp) return;
        
        const date = new Date(timestamp);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        if (!slotsByDate[dateStr]) {
          slotsByDate[dateStr] = [];
        }
        slotsByDate[dateStr].push(timestamp);
      });
      
      // Convert timestamps to formatted times and deduplicate
      Object.entries(slotsByDate).forEach(([dateStr, timestamps]) => {
        const times = timestamps.map(ts => formatTimeInTimezone(ts, timezone));
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
        
        if (uniqueTimes.length > 0) {
          transformedSlots.push({
            date: dateStr,
            times: uniqueTimes
          });
        }
      });
    } else if (typeof data === 'object' && !Array.isArray(data)) {
      // Fallback for older/different API response format
      Object.entries(data).forEach(([dateKey, dayData]) => {
        if (dateKey === 'traceId' || !dayData?.slots) return;
        
        const times = dayData.slots.map(slotTime => formatTimeInTimezone(slotTime, timezone));
        
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
        
        if (uniqueTimes.length > 0) {
          transformedSlots.push({
            date: dateKey,
            times: uniqueTimes
          });
        }
      });
    }
    
    transformedSlots.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return Response.json({ success: true, slots: transformedSlots, timezone });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});