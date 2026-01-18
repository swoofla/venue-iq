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
      tags: ['Virtual Planner Lead']
    };

    // Add custom fields if provided
    const customFields = [];
    
    if (data.wedding_date) {
      customFields.push({ key: 'wedding_date', value: data.wedding_date });
    }
    if (data.guest_count) {
      customFields.push({ key: 'guest_count', value: data.guest_count.toString() });
    }
    if (data.budget) {
      customFields.push({ key: 'budget', value: data.budget.toString() });
    }
    if (data.recommended_package) {
      customFields.push({ key: 'recommended_package', value: data.recommended_package });
    }
    if (data.source) {
      customFields.push({ key: 'chatbot_source', value: data.source });
    }

    if (customFields.length > 0) {
      contactData.customFields = customFields;
    }

    // Use V2 API upsert endpoint (creates or updates contact)
    const response = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
        'Accept': 'application/json'
      },
      body: JSON.stringify(contactData)
    });

    const responseText = await response.text();
    console.log('DEBUG: Contact response:', responseText);

    if (!response.ok) {
      return Response.json({ error: `HighLevel API error: ${responseText}` }, { status: 500 });
    }

    const contact = JSON.parse(responseText);
    return Response.json({ success: true, contactId: contact.contact?.id });
  } catch (error) {
    console.log('DEBUG: Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});