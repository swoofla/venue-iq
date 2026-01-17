/**
 * Creates or updates a contact in HighLevel
 */
export default async function createHighLevelContact(data, context) {
  const { HIGHLEVEL_API_KEY, HIGHLEVEL_LOCATION_ID } = context.secrets;
  
  if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_LOCATION_ID) {
    throw new Error('HighLevel credentials not configured');
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
    throw new Error(`HighLevel API error: ${error}`);
  }

  const contact = await response.json();
  return { success: true, contactId: contact.contact?.id };
}