/**
 * Fetches booked wedding dates from HighLevel Scheduled Weddings calendar
 */
export default async function getHighLevelWeddingDates(data, context) {
  const { HIGHLEVEL_API_KEY, HIGHLEVEL_WEDDING_CALENDAR_ID } = context.secrets;
  
  if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_WEDDING_CALENDAR_ID) {
    throw new Error('HighLevel credentials not configured');
  }

  const startDate = data.startDate || new Date().toISOString().split('T')[0];
  const endDate = data.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const response = await fetch(
    `https://rest.gohighlevel.com/v1/calendars/${HIGHLEVEL_WEDDING_CALENDAR_ID}/appointments?startDate=${startDate}&endDate=${endDate}`,
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

  const appointments = await response.json();
  
  // Extract just the dates from appointments
  const bookedDates = appointments.events?.map(event => ({
    date: event.startTime?.split('T')[0],
    title: event.title
  })) || [];

  return { success: true, bookedDates };
}