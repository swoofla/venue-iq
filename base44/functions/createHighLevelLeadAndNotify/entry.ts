import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const HIGHLEVEL_API_KEY = Deno.env.get('HIGHLEVEL_API_KEY');
  const HIGHLEVEL_LOCATION_ID = Deno.env.get('HIGHLEVEL_LOCATION_ID');

  if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_LOCATION_ID) {
    return Response.json({ error: 'HighLevel credentials not configured' }, { status: 500 });
  }

  try {
    const { name, phone, email, question } = await req.json();

    if (!name || !phone) {
      return Response.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    const contactData = {
      locationId: HIGHLEVEL_LOCATION_ID,
      firstName: name.split(' ')[0],
      lastName: name.split(' ').slice(1).join(' '),
      phone: phone,
      email: email || `unknown_${Date.now()}@sugar-lake.com`,
      source: 'Sugar Lake Chatbot - Planner Contact Request',
      tags: ['Planner_Contact_Requested'],
      customFields: []
    };

    if (question) {
      contactData.customFields.push({
        key: 'chatbot_question',
        value: question
      });
    }

    const response = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HighLevel API error:', errorText);
      return Response.json({ error: `HighLevel API error: ${errorText}` }, { status: response.status });
    }

    const contact = await response.json();
    return Response.json({ success: true, contactId: contact.contact?.id });
  } catch (error) {
    console.error('Error in createHighLevelLeadAndNotify:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});