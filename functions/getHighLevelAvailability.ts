// getHighLevelAvailability.js - FIXED VERSION
// Fixes the "all times show as 7:00 PM" and "only 1 slot per day" bugs

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

    // Get timezone offset for date calculations
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
    
    // Convert date strings to Unix timestamps in MILLISECONDS
    // IMPORTANT: Include timezone offset to avoid date shifting
    const startDateTime = new Date(`${startDate}T00:00:00${tzOffset}`);
    const endDateTime = new Date(`${endDate}T23:59:59${tzOffset}`);
    
    console.log('=== getHighLevelAvailability DEBUG ===');
    console.log('Input startDate:', startDate);
    console.log('Input endDate:', endDate);
    console.log('Timezone:', timezone);
    console.log('TZ Offset:', tzOffset);
    console.log('Start as millis:', startDateTime.getTime());
    console.log('End as millis:', endDateTime.getTime());
    
    // Call HighLevel V2 API
    const url = `https://services.leadconnectorhq.com/calendars/${HIGHLEVEL_TOUR_CALENDAR_ID}/free-slots?startDate=${startDateTime.getTime()}&endDate=${endDateTime.getTime()}&timezone=${encodeURIComponent(timezone)}`;
    
    console.log('HighLevel URL:', url);
    
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
    console.log('Raw HighLevel response:', JSON.stringify(rawData).substring(0, 500));
    
    // Transform the response
    // HighLevel returns: { "2026-01-24": { slots: ["1737727200000", ...] }, "traceId": "..." }
    const transformedSlots = [];
    
    for (const [dateKey, dateData] of Object.entries(rawData)) {
      // Skip the traceId key
      if (dateKey === 'traceId') continue;
      
      // Make sure dateData has slots array
      if (!dateData || !Array.isArray(dateData.slots)) {
        console.log(`Skipping ${dateKey} - no slots array`);
        continue;
      }
      
      console.log(`Processing ${dateKey} with ${dateData.slots.length} slots`);
      
      // Convert each timestamp to human-readable time
      const times = dateData.slots.map(timestamp => {
        // timestamp is a string of Unix milliseconds
        const ts = parseInt(timestamp, 10);
        const date = new Date(ts);
        
        // FIX: Use toLocaleTimeString with EXPLICIT timezone parameter
        // This is the key fix - without the timezone, it defaults to server time (UTC)
        const timeString = date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: timezone  // <-- CRITICAL: Must pass timezone here!
        });
        
        console.log(`  Timestamp ${timestamp} -> ${timeString} (in ${timezone})`);
        return timeString;
      });
      
      // Deduplicate times (remove if same time appears multiple times)
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
      
      console.log(`  Unique times for ${dateKey}: ${uniqueTimes.join(', ')}`);
      
      // Add to results
      transformedSlots.push({
        date: dateKey,
        times: uniqueTimes
      });
    }
    
    // Sort by date
    transformedSlots.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    console.log('Transformed slots count:', transformedSlots.length);
    console.log('First few slots:', JSON.stringify(transformedSlots.slice(0, 3)));
    
    return Response.json({ 
      success: true, 
      slots: transformedSlots,
      timezone: timezone,
      debug: {
        datesProcessed: transformedSlots.length,
        startDate: startDate,
        endDate: endDate
      }
    });
    
  } catch (error) {
    console.error('getHighLevelAvailability error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});