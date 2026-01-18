// getHighLevelAvailability.js - FIXED VERSION v3
// With extensive debugging to trace timezone conversion

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

    console.log('========================================');
    console.log('getHighLevelAvailability v3 STARTING');
    console.log('========================================');
    console.log('Input timezone:', timezone);

    // Timezone offsets in HOURS from UTC (negative = behind UTC)
    const TIMEZONE_OFFSETS = {
      'America/New_York': -5,
      'America/Chicago': -6,
      'America/Denver': -7,
      'America/Phoenix': -7,
      'America/Los_Angeles': -8,
      'America/Anchorage': -9,
      'Pacific/Honolulu': -10,
      'America/Puerto_Rico': -4
    };

    const offsetHours = TIMEZONE_OFFSETS[timezone];
    console.log('Offset hours for', timezone, ':', offsetHours);
    
    if (offsetHours === undefined) {
      console.log('WARNING: Unknown timezone, defaulting to -5 (Eastern)');
    }
    
    const finalOffset = offsetHours ?? -5;
    console.log('Using offset:', finalOffset);

    // MANUAL timezone conversion function with debug logging
    const formatTimeInTimezone = (timestampMs) => {
      console.log('  --- formatTimeInTimezone ---');
      console.log('  Input timestamp (ms):', timestampMs);
      console.log('  Input timestamp type:', typeof timestampMs);
      
      // Ensure it's a number
      const tsNum = Number(timestampMs);
      console.log('  As number:', tsNum);
      
      if (isNaN(tsNum)) {
        console.log('  ERROR: timestamp is NaN!');
        return 'Invalid Time';
      }
      
      // Create UTC date
      const utcDate = new Date(tsNum);
      console.log('  UTC Date object:', utcDate.toISOString());
      console.log('  UTC Hours:', utcDate.getUTCHours());
      console.log('  UTC Minutes:', utcDate.getUTCMinutes());
      
      // Calculate local time by applying offset
      // UTC-5 means local = UTC - 5 hours
      // So we ADD a negative offset (which subtracts hours)
      const offsetMs = finalOffset * 60 * 60 * 1000;
      console.log('  Offset in ms:', offsetMs);
      
      const localTimeMs = tsNum + offsetMs;
      console.log('  Local time ms:', localTimeMs);
      
      const localDate = new Date(localTimeMs);
      console.log('  Local Date object (treated as UTC):', localDate.toISOString());
      
      // Use UTC methods on the shifted date to get "local" time
      const hours = localDate.getUTCHours();
      const minutes = localDate.getUTCMinutes();
      console.log('  Local hours (from UTC methods):', hours);
      console.log('  Local minutes:', minutes);
      
      // Format as 12-hour time
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12; // Convert 0 to 12
      const minuteStr = String(minutes).padStart(2, '0');
      
      const result = `${hour12}:${minuteStr} ${period}`;
      console.log('  RESULT:', result);
      console.log('  --- end formatTimeInTimezone ---');
      
      return result;
    };

    // Build date range for API call
    const getOffsetString = (hours) => {
      const absHours = Math.abs(hours);
      const sign = hours >= 0 ? '+' : '-';
      return `${sign}${String(absHours).padStart(2, '0')}:00`;
    };
    
    const tzOffsetString = getOffsetString(finalOffset);
    console.log('TZ offset string:', tzOffsetString);
    
    const startDateTime = new Date(`${startDate}T00:00:00${tzOffsetString}`);
    const endDateTime = new Date(`${endDate}T23:59:59${tzOffsetString}`);
    
    console.log('Start date string:', startDate);
    console.log('End date string:', endDate);
    console.log('Start as ISO:', startDateTime.toISOString());
    console.log('End as ISO:', endDateTime.toISOString());
    console.log('Start millis:', startDateTime.getTime());
    console.log('End millis:', endDateTime.getTime());
    
    // Call HighLevel V2 API
    const url = `https://services.leadconnectorhq.com/calendars/${HIGHLEVEL_TOUR_CALENDAR_ID}/free-slots?startDate=${startDateTime.getTime()}&endDate=${endDateTime.getTime()}&timezone=${encodeURIComponent(timezone)}`;
    
    console.log('HighLevel API URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('HighLevel response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('HighLevel API error:', errorText);
      return Response.json({ 
        error: `HighLevel API error: ${response.status}`,
        details: errorText 
      }, { status: response.status });
    }
    
    const rawData = await response.json();
    console.log('Raw response keys:', Object.keys(rawData));
    console.log('Raw response (first 1000 chars):', JSON.stringify(rawData).substring(0, 1000));
    
    // Transform the response
    const transformedSlots = [];
    
    for (const [dateKey, dateData] of Object.entries(rawData)) {
      // Skip non-date keys
      if (dateKey === 'traceId' || !dateData || !Array.isArray(dateData.slots)) {
        console.log(`Skipping key "${dateKey}" - not a date with slots`);
        continue;
      }
      
      console.log(`\n=== Processing date: ${dateKey} ===`);
      console.log(`Raw slots array:`, JSON.stringify(dateData.slots));
      console.log(`Number of slots: ${dateData.slots.length}`);
      
      const times = [];
      
      for (let i = 0; i < dateData.slots.length; i++) {
        const rawTimestamp = dateData.slots[i];
        console.log(`\nSlot ${i + 1}:`);
        console.log(`  Raw value: "${rawTimestamp}"`);
        console.log(`  Type: ${typeof rawTimestamp}`);
        
        const timeString = formatTimeInTimezone(rawTimestamp);
        times.push(timeString);
      }
      
      console.log(`\nFinal times for ${dateKey}:`, times);
      
      transformedSlots.push({
        date: dateKey,
        times: times
      });
    }
    
    // Sort by date
    transformedSlots.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    console.log('\n========================================');
    console.log('FINAL RESULT');
    console.log('========================================');
    console.log('Total dates:', transformedSlots.length);
    console.log('Slots:', JSON.stringify(transformedSlots, null, 2));
    
    return Response.json({ 
      success: true, 
      slots: transformedSlots,
      timezone: timezone
    });
    
  } catch (error) {
    console.error('FATAL ERROR:', error);
    console.error('Stack:', error.stack);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});