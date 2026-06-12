import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let data = {};
  try {
    data = await req.json();
  } catch (_) {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const HIGHLEVEL_API_KEY = Deno.env.get('HIGHLEVEL_API_KEY');
  const HIGHLEVEL_LOCATION_ID = Deno.env.get('HIGHLEVEL_LOCATION_ID');

  // Fallback: persist a ContactSubmission so the lead is never lost when
  // HighLevel rejects, env vars are missing, or any unexpected error fires.
  // RLS for ContactSubmission.create is open (null), so user-scoped create
  // commits cleanly. The bride still sees success either way.
  const writeFallback = async (errorMessage) => {
    const appendedNotes = `${data.notes || ''}${data.notes ? '\n\n' : ''}HighLevel error: ${errorMessage}`;
    const payload = {
      venue_id: data.venue_id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      source: 'chat',
      status: 'new',
      notes: appendedNotes,
    };
    try {
      const created = await base44.entities.ContactSubmission.create(payload);
      console.log('DEBUG: ContactSubmission fallback created id:', created?.id);
      return Response.json({ success: true, fallback: true, error: errorMessage, fallbackId: created?.id });
    } catch (fallbackErr) {
      console.log('DEBUG: ContactSubmission fallback failed:', fallbackErr?.message);
      return Response.json({ success: true, fallback: true, fallbackFailed: true, error: errorMessage });
    }
  };

  if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_LOCATION_ID) {
    return writeFallback('HighLevel credentials not configured');
  }

  try {
    const contactData = {
      locationId: HIGHLEVEL_LOCATION_ID,
      email: data.email,
      name: data.name,
      phone: data.phone,
      source: 'Sugar Lake Virtual Planner',
      tags: ['Virtual Planner Lead']
    };

    const customFields = [];
    if (data.wedding_date) customFields.push({ key: 'wedding_date', value: data.wedding_date });
    if (data.guest_count) customFields.push({ key: 'guest_count', value: data.guest_count.toString() });
    if (data.budget) customFields.push({ key: 'budget', value: data.budget.toString() });
    if (data.recommended_package) customFields.push({ key: 'recommended_package', value: data.recommended_package });
    if (data.source) customFields.push({ key: 'chatbot_source', value: data.source });
    if (customFields.length > 0) contactData.customFields = customFields;

    const headers = {
      'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28',
      'Accept': 'application/json'
    };

    const response = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
      method: 'POST',
      headers,
      body: JSON.stringify(contactData)
    });

    const responseText = await response.text();
    console.log('DEBUG: Contact upsert response:', response.status, responseText);

    if (!response.ok) {
      return await writeFallback(`HighLevel upsert ${response.status}: ${responseText}`);
    }

    let contact;
    try {
      contact = JSON.parse(responseText);
    } catch (_) {
      return await writeFallback(`Unparseable HighLevel response: ${responseText}`);
    }
    const contactId = contact?.contact?.id;

    // Best-effort: attach the notes as a Note on the new contact. If this fails
    // the contact still exists, so we return success.
    if (contactId && data.notes) {
      try {
        const noteRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ body: data.notes })
        });
        const noteText = await noteRes.text();
        console.log('DEBUG: Note create response:', noteRes.status, noteText);
        if (!noteRes.ok) {
          console.log('DEBUG: Note creation failed but contact exists, returning success.');
        }
      } catch (noteErr) {
        console.log('DEBUG: Note creation threw:', noteErr.message);
      }
    }

    return Response.json({ success: true, contactId });
  } catch (error) {
    console.log('DEBUG: Unexpected error in createHighLevelContact:', error.message);
    return await writeFallback(error.message);
  }
});