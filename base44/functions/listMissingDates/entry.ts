import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const HIGHLEVEL_API_KEY = Deno.env.get('HIGHLEVEL_API_KEY');
    const HIGHLEVEL_WEDDING_CALENDAR_ID = Deno.env.get('HIGHLEVEL_WEDDING_CALENDAR_ID');
    
    if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_WEDDING_CALENDAR_ID) {
      return Response.json({ error: 'HighLevel credentials not configured' }, { status: 500 });
    }

    const startDate = new Date('2026-01-18');
    const endDate = new Date('2027-01-17');
    
    // Fetch all slots in chunks
    const allSlots = {};
    let currentStart = new Date(startDate);
    
    while (currentStart < endDate) {
      const chunkEnd = new Date(Math.min(
        currentStart.getTime() + 30 * 24 * 60 * 60 * 1000,
        endDate.getTime()
      ));
      
      const response = await fetch(
        `https://services.leadconnectorhq.com/calendars/${HIGHLEVEL_WEDDING_CALENDAR_ID}/free-slots?startDate=${currentStart.getTime()}&endDate=${chunkEnd.getTime()}&timezone=America/New_York`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const chunkData = await response.json();
        Object.assign(allSlots, chunkData);
      }
      
      currentStart = new Date(chunkEnd.getTime() + 1);
    }
    
    // Generate all dates
    const allDates = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      allDates.push(current.toISOString().split('T')[0]);
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }
    
    const datesWithSlots = Object.keys(allSlots).filter(key => key !== 'traceId');
    const datesWithoutSlots = allDates.filter(date => !datesWithSlots.includes(date));
    
    // Group missing dates by month
    const missingByMonth = {};
    datesWithoutSlots.forEach(date => {
      const month = date.substring(0, 7); // YYYY-MM
      if (!missingByMonth[month]) missingByMonth[month] = [];
      missingByMonth[month].push(date);
    });
    
    return Response.json({
      totalDates: allDates.length,
      datesWithSlots: datesWithSlots.length,
      datesWithoutSlots: datesWithoutSlots.length,
      missingByMonth,
      first20Missing: datesWithoutSlots.slice(0, 20),
      expectedUnavailable: ['2026-04-25']
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});