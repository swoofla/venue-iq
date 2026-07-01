// One-off diagnostic probe. Fetches a GHL contact by id and returns the raw fields.
// Not called from the app. Safe to delete after use.
Deno.serve(async (req) => {
  const HIGHLEVEL_API_KEY = Deno.env.get('HIGHLEVEL_API_KEY');
  if (!HIGHLEVEL_API_KEY) {
    return Response.json({ error: 'HIGHLEVEL_API_KEY not set' }, { status: 500 });
  }
  try {
    const { contactId } = await req.json();
    if (!contactId) return Response.json({ error: 'contactId required' }, { status: 400 });

    const res = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
        'Version': '2021-07-28',
        'Accept': 'application/json'
      }
    });
    const bodyText = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(bodyText); } catch { /* ignore */ }
    const c = parsed?.contact || parsed || {};
    return Response.json({
      status: res.status,
      ok: res.ok,
      raw_body: bodyText,
      picked: {
        id: c.id,
        phone: c.phone,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        tags: c.tags,
        dateAdded: c.dateAdded,
        dateUpdated: c.dateUpdated,
      }
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});