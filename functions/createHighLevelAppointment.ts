/**
 * Creates an appointment in HighLevel calendar
 */
export default async function createHighLevelAppointment(data, context) {
  const { HIGHLEVEL_API_KEY, HIGHLEVEL_LOCATION_ID } = context.secrets;
  
  if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_LOCATION_ID) {
    throw new Error('HighLevel credentials not configured');
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
  
  const appointmentData = {
    locationId: HIGHLEVEL_LOCATION_ID,
    contactId: contactId,
    title: `Venue Tour - ${data.name}`,
    startTime: appointmentDateTime.toISOString(),
    endTime: new Date(appointmentDateTime.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour tour
    appointmentStatus: 'confirmed',
    notes: `Wedding Date: ${data.wedding_date || 'TBD'}\nGuest Count: ${data.guest_count || 'TBD'}\nSource: Virtual Planner`
  };

  const appointmentResponse = await fetch('https://rest.gohighlevel.com/v1/appointments/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(appointmentData)
  });

  if (!appointmentResponse.ok) {
    const error = await appointmentResponse.text();
    throw new Error(`HighLevel API error: ${error}`);
  }

  const appointment = await appointmentResponse.json();
  return { success: true, appointmentId: appointment.id, contactId };
}

// Helper function to convert 12-hour time to 24-hour format
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