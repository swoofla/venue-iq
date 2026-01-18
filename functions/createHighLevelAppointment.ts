import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const data = await req.json();

    const HIGHLEVEL_API_KEY = Deno.env.get('HIGHLEVEL_API_KEY');
    const HIGHLEVEL_LOCATION_ID = Deno.env.get('HIGHLEVEL_LOCATION_ID');
    const HIGHLEVEL_TOUR_CALENDAR_ID = Deno.env.get('HIGHLEVEL_TOUR_CALENDAR_ID');

    if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_LOCATION_ID || !HIGHLEVEL_TOUR_CALENDAR_ID) {
      return Response.json({ error: 'HighLevel credentials not configured' }, { status: 500 });
    }

    // First, create or get the contact using V2 API
    const contactResponse = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      },
      body: JSON.stringify({
        locationId: HIGHLEVEL_LOCATION_ID,
        email: data.email,
        name: data.name,
        phone: data.phone
      })
    });

    if (!contactResponse.ok) {
      const error = await contactResponse.text();
      return Response.json({ error: `Contact creation failed: ${error}` }, { status: 500 });
    }

    const contactData = await contactResponse.json();
    const contactId = contactData.contact?.id;

    if (!contactId) {
      return Response.json({ error: 'Failed to get contact ID' }, { status: 500 });
    }

    // Build start and end times with EST timezone
    const time24 = convertTo24Hour(data.tour_time);
    const startTimeISO = `${data.tour_date}T${time24}-05:00`;
    
    // End time is 1 hour later
    const [hours, minutes] = time24.split(':').map(Number);
    const endHours = (hours + 1).toString().padStart(2, '0');
    const endTimeISO = `${data.tour_date}T${endHours}:${minutes.toString().padStart(2, '0')}:00-05:00`;

    console.log('DEBUG: Appointment times:', { startTimeISO, endTimeISO });

    // Create the appointment using CORRECT V2 endpoint
    const appointmentData = {
      calendarId: HIGHLEVEL_TOUR_CALENDAR_ID,
      locationId: HIGHLEVEL_LOCATION_ID,
      contactId: contactId,
      title: `Venue Tour - ${data.name}`,
      startTime: startTimeISO,
      endTime: endTimeISO,
      timezone: 'America/New_York',
      appointmentStatus: 'confirmed',
      notes: `Wedding Date: ${data.wedding_date || 'TBD'}\nGuest Count: ${data.guest_count || 'TBD'}\nSource: Virtual Planner`
    };

    console.log('DEBUG: Appointment payload:', JSON.stringify(appointmentData, null, 2));

    // CORRECT ENDPOINT: /calendars/events/appointments (NOT /calendars/{id}/appointments)
    const appointmentResponse = await fetch('https://services.leadconnectorhq.com/calendars/events/appointments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
        'Accept': 'application/json'
      },
      body: JSON.stringify(appointmentData)
    });

    const responseText = await appointmentResponse.text();
    console.log('DEBUG: Appointment response:', responseText);

    if (!appointmentResponse.ok) {
      return Response.json({ error: `HighLevel API error: ${responseText}` }, { status: 500 });
    }

    const appointment = JSON.parse(responseText);
    return Response.json({ success: true, appointmentId: appointment.id, contactId });
  } catch (error) {
    console.log('DEBUG: Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function convertTo24Hour(time12h) {
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  
  hours = parseInt(hours, 10);
  
  if (modifier === 'AM' && hours === 12) {
    hours = 0;
  } else if (modifier === 'PM' && hours !== 12) {
    hours = hours + 12;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
}