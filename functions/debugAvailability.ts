Deno.serve(async (req) => {
  try {
    const { selectedDate } = await req.json();
    
    const HIGHLEVEL_API_KEY = Deno.env.get('HIGHLEVEL_API_KEY');
    const HIGHLEVEL_WEDDING_CALENDAR_ID = Deno.env.get('HIGHLEVEL_WEDDING_CALENDAR_ID');
    
    // Get wedding dates for the next year
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);
    startDateTime.setHours(0, 0, 0, 0);
    endDateTime.setHours(23, 59, 59, 999);
    
    // Fetch free slots (in chunks like the main function)
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
    
    const datesWithSlots = Object.keys(allSlots || {}).filter(key => key !== 'traceId');
    const availableDates = allDates.filter(date => !datesWithSlots.includes(date));
    
    // Debug info
    const debugInfo = {
      selectedDate: selectedDate,
      selectedDateIsAvailable: availableDates.includes(selectedDate),
      selectedDateHasSlots: datesWithSlots.includes(selectedDate),
      totalDatesInRange: allDates.length,
      totalAvailableDates: availableDates.length,
      totalDatesWithSlots: datesWithSlots.length,
      first10AvailableDates: availableDates.slice(0, 10),
      first10DatesWithSlots: datesWithSlots.slice(0, 10),
      sampleSlotData: Object.keys(allSlots).slice(0, 3).reduce((obj, key) => {
        obj[key] = allSlots[key];
        return obj;
      }, {}),
      
      // Alternative date logic test
      alternativesTest: (() => {
        const dateObj = new Date(selectedDate + 'T00:00:00');
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 5 || dateObj.getDay() === 6;
        
        let alternatives = [];
        for (let offset of [1, -1, 2, -2, 3, -3, 7, -7, 14, -14]) {
          const altDate = new Date(dateObj.getTime() + offset * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          if (availableDates.includes(altDate) && !alternatives.includes(altDate)) {
            alternatives.push(altDate);
            if (alternatives.length >= 5) break;
          }
        }
        
        return {
          isWeekend,
          foundAlternatives: alternatives,
          selectedDateDayOfWeek: dateObj.getDay()
        };
      })()
    };
    
    return Response.json(debugInfo);
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});