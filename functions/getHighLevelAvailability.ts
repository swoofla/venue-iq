// getHighLevelAvailability.js - FIXED VERSION v2
// Fixes the "all times show as 7:00 PM" bug with MANUAL timezone conversion
// (Deno doesn't support toLocaleTimeString timezone option reliably)

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

    // Timezone offsets in HOURS from UTC
    // Note: These are standard time offsets. For full DST support, 
    // you'd need to check the date and adjust accordingly.
    const getTimezoneOffsetHours = (tz) => {
      const offsets = {
        'America/New_York': -5,      // EST (winter) / -4 EDT (summer)
        'America/Chicago': -6,       // CST (winter) / -5 CDT (summer)
        'America/Denver': -7,        // MST (winter) / -6 MDT (summer)
        'America/Phoenix': -7,       // MST (no DST)
        'America/Los_Angeles': -8,   // PST (winter) / -7 PDT (summer)
        'America/Anchorage': -9,     // AKST (winter) / -8 AKDT (summer)
        'Pacific/Honolulu': -10,     // HST (no DST)
        'America/Puerto_Rico': -4    // AST (no DST)
      };
      return offsets[tz] ?? -5;
    };

    // Get string offset for ISO dates (e.g., "-05:00")
    const getTimezoneOffsetString = (tz) => {
      const hours = getTimezoneOffsetHours(tz);
      const absHours = Math.abs(hours);
      const sign = hours >= 0 ? '+' : '-';
      return `${sign}${String(absHours).padStart(2, '0')}:00`;
    };

    // MANUAL timezone conversion function
    // Converts Unix timestamp (ms) to formatted time string in target timezone
    const formatTimeInTimezone = (timestampMs, tz) => {
      const offsetHours = getTimezoneOffsetHours(tz);
      
      // Create UTC date from timestamp
      const utcDate = new Date(timestampMs);
      
      // Apply timezone offset to get local time
      // We add the offset (which is negative for US timezones) to shift from UTC
      const localTimeMs = timestampMs + (offsetHours * 60 * 60 * 1000);
      const localDate = new Date(localTimeMs);
      
      // Extract hours and minutes using UTC methods 
      // (since we've already shifted the time, UTC methods give us "local" values)
      const hours = localDate.getUTCHours();
      const minutes = localDate.getUTCMinutes();
      
      // Format as 12-hour time with AM/PM
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12; // Convert 0 to 12 for midnight
      const minuteStr = String(minutes).padStart(2, '0');
      
      return `${hour12}:${minuteStr} ${period}`;
    };

    const tzOffsetString = getTimezoneOffsetString(timezone);
    
    // Convert date strings to Unix timestamps in MILLISECONDS
    const startDateTime = new Date(`${startDate}T00:00:00${tzOffsetString}`);
    const endDateTime = new Date(`${endDate}T23:59:59${tzOffsetString}`);
    
    console.log('=== getHighLevelAvailability DEBUG v2 ===');
    console.log('Input:', { startDate, endDate, timezone });
    console.log('Offset hours:', getTimezoneOffsetHours(timezone));
    console.log('Offset string:', tzOffsetString);
    console.log('Start millis:', startDateTime.getTime());
    console.log('End millis:', endDateTime.getTime());
    
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
    console.log('Raw HighLevel response keys:', Object.keys(rawData));
    
    // Transform the response
    // HighLevel returns: { "2026-01-24": { slots: ["1737727200000", ...] }, "traceId": "..." }
    const transformedSlots = [];
    
    for (const [dateKey, dateData] of Object.entries(rawData)) {
      // Skip non-date keys like traceId
      if (dateKey === 'traceId' || !dateData || !Array.isArray(dateData.slots)) {
        continue;
      }
      
      console.log(`Processing date ${dateKey}: ${dateData.slots.length} slots`);
      
      // Convert each timestamp to human-readable time using MANUAL conversion
      const times = dateData.slots.map(timestamp => {
        const ts = parseInt(timestamp, 10);
        const timeString = formatTimeInTimezone(ts, timezone);
        
        // Debug: also show what UTC would be
        const utcDate = new Date(ts);
        console.log(`  ${timestamp} -> UTC: ${utcDate.toISOString()} -> Local (${timezone}): ${timeString}`);
        
        return timeString;
      });
      
      transformedSlots.push({
        date: dateKey,
        times: times
      });
    }
    
    // Sort by date
    transformedSlots.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    console.log('=== RESULT ===');
    console.log('Total dates with slots:', transformedSlots.length);
    if (transformedSlots.length > 0) {
      console.log('Sample:', transformedSlots[0]);
    }
    
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