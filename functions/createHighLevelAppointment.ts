import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const data = await req.json();

    const HIGHLEVEL_API_KEY = Deno.env.get('HIGHLEVEL_API_KEY');
    const HIGHLEVEL_LOCATION_ID = Deno.env.get('HIGHLEVEL_LOCATION_ID');

    if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_LOCATION_ID) {
      return Response.json({ error: 'HighLevel credentials not configured' }, { status: 500 });
    }

    // First, create or get the contact
    const contactResponse = await fetch('https://rest.gohighlevel.com/v1/contacts/lookup', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locationId: HIGHLEVEL_LOCATION_ID,
        email: data.email
      })
    });

    let contactId;
    if (contactResponse.ok) {
      const contactData = await contactResponse.json();
      contactId = contactData.contacts?.[0]?.id;
    }

    // If contact doesn't exist, create it
    if (!contactId) {
      const createContact = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          locationId: HIGHLEVEL_LOCATION_ID,
          email: data.email,
          name: data.name,
          phone: data.phone
        })
      });

      const newContact = await createContact.json();
      contactId = newContact.contact?.id;
    }

    // Create the appointment
    const appointmentDateTime = new Date(`${data.tour_date}T${convertTo24Hour(data.tour_time)}`);
    const endDateTime = new Date(appointmentDateTime.getTime() + 60 * 60 * 1000);
    const HIGHLEVEL_TOUR_CALENDAR_ID = Deno.env.get('HIGHLEVEL_TOUR_CALENDAR_ID');

    const appointmentData = {
      locationId: HIGHLEVEL_LOCATION_ID,
      contactId: contactId,
      calendarId: HIGHLEVEL_TOUR_CALENDAR_ID,
      title: `Venue Tour - ${data.name}`,
      selectedSlot: appointmentDateTime.toISOString(),
      selectedTimezone: 'America/New_York',
      endTime: endDateTime.toISOString(),
      notes: `Wedding Date: ${data.wedding_date || 'TBD'}\nGuest Count: ${data.guest_count || 'TBD'}\nSource: Virtual Planner`
    };

    const appointmentResponse = await fetch(`https://services.leadconnectorhq.com/calendars/${HIGHLEVEL_TOUR_CALENDAR_ID}/appointments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      },
      body: JSON.stringify(appointmentData)
    });

    if (!appointmentResponse.ok) {
      const error = await appointmentResponse.text();
      return Response.json({ error: `HighLevel API error: ${error}` }, { status: 500 });
    }

    const appointment = await appointmentResponse.json();
    return Response.json({ success: true, appointmentId: appointment.id, contactId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function convertTo24Hour(time12h) {
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');

  if (hours === '12') {
    hours = '00';
  }

  if (modifier === 'PM') {
    hours = parseInt(hours, 10) + 12;
  }

  return `${hours}:${minutes}:00`;
}