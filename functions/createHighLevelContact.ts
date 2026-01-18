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

    const contactData = {
      locationId: HIGHLEVEL_LOCATION_ID,
      email: data.email,
      name: data.name,
      phone: data.phone,
      source: 'Sugar Lake Virtual Planner',
      customFields: []
    };

    // Add custom fields if provided
    if (data.wedding_date) {
      contactData.customFields.push({
        key: 'wedding_date',
        value: data.wedding_date
      });
    }

    if (data.guest_count) {
      contactData.customFields.push({
        key: 'guest_count',
        value: data.guest_count.toString()
      });
    }

    if (data.budget) {
      contactData.customFields.push({
        key: 'budget',
        value: data.budget.toString()
      });
    }

    if (data.recommended_package) {
      contactData.customFields.push({
        key: 'recommended_package',
        value: data.recommended_package
      });
    }

    if (data.source) {
      contactData.customFields.push({
        key: 'chatbot_source',
        value: data.source
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
      const error = await response.text();
      return Response.json({ error: `HighLevel API error: ${error}` }, { status: 500 });
    }

    const contact = await response.json();
    return Response.json({ success: true, contactId: contact.contact?.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});