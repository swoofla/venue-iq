/**
 * Fetches available time slots from HighLevel calendar
 */
export default async function getHighLevelAvailability(data, context) {
  const { HIGHLEVEL_API_KEY, HIGHLEVEL_TOUR_CALENDAR_ID } = context.secrets;
  
  if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_TOUR_CALENDAR_ID) {
    throw new Error('HighLevel credentials not configured');
  }

  const startDate = data.startDate || new Date().toISOString().split('T')[0];
  const endDate = data.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const response = await fetch(
    `https://rest.gohighlevel.com/v1/calendars/${HIGHLEVEL_TOUR_CALENDAR_ID}/free-slots?startDate=${startDate}&endDate=${endDate}`,
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
    throw new Error(`HighLevel API error: ${error}`);
  }

  const slots = await response.json();
  return { success: true, slots: slots };
}