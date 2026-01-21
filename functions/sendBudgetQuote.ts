import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, email, phone, budgetData, venueName, totalBudget, deliveryPreference, estimateId } = await req.json();

    console.log('=== sendBudgetQuote START ===');
    console.log('Delivery preference:', deliveryPreference);
    console.log('Email:', email);
    console.log('Phone:', phone);

    if (!name || !deliveryPreference || !budgetData || !totalBudget) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate delivery preference
    if (!['text', 'email'].includes(deliveryPreference)) {
      return Response.json({ error: 'Invalid delivery preference' }, { status: 400 });
    }

    // Get HighLevel credentials
    const highlevelApiKey = Deno.env.get('HIGHLEVEL_API_KEY');
    const locationId = Deno.env.get('HIGHLEVEL_LOCATION_ID');

    if (!highlevelApiKey || !locationId) {
      console.error('HighLevel credentials not configured');
      return Response.json({ error: 'Email/SMS service not configured' }, { status: 500 });
    }

    // Format budget breakdown for messages
    const budgetBreakdownText = formatBudgetBreakdown(budgetData, totalBudget);
    const budgetBreakdownHtml = formatBudgetBreakdownHtml(budgetData, totalBudget, name, venueName || 'Sugar Lake Weddings');

    let highlevelContactId = null;
    let deliveryStatus = 'pending';

    // 1. Create/upsert contact in HighLevel first (needed for both email and SMS)
    try {
      console.log('Creating HighLevel contact...');

      const contactPayload = {
        locationId,
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' ') || '',
        tags: ['Budget Calculator Lead'],
        source: 'Budget Calculator',
        customFields: [
          { key: 'budget_estimate', field_value: totalBudget.toString() },
          { key: 'budget_delivery_preference', field_value: deliveryPreference },
          { key: 'budget_package', field_value: budgetData.guestTier || '' }
        ]
      };

      // Add email if provided
      if (email) {
        contactPayload.email = email;
      }
      
      // Add phone if provided (format for HighLevel)
      if (phone) {
        const cleanPhone = phone.replace(/\D/g, '');
        contactPayload.phone = cleanPhone.startsWith('1') ? `+${cleanPhone}` : `+1${cleanPhone}`;
      }

      console.log('Contact payload:', JSON.stringify(contactPayload));

      const contactResponse = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${highlevelApiKey}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(contactPayload)
      });

      const contactResponseText = await contactResponse.text();
      console.log('HighLevel contact response status:', contactResponse.status);
      console.log('HighLevel contact response:', contactResponseText);

      if (contactResponse.ok) {
        const contactData = JSON.parse(contactResponseText);
        highlevelContactId = contactData.contact?.id;
        console.log('HighLevel contact ID:', highlevelContactId);
      } else {
        console.error('Failed to create HighLevel contact:', contactResponseText);
        return Response.json({ 
          error: 'Failed to create contact', 
          details: contactResponseText 
        }, { status: 500 });
      }
    } catch (hlError) {
      console.error('HighLevel contact creation error:', hlError.message);
      return Response.json({ error: 'Contact creation failed: ' + hlError.message }, { status: 500 });
    }

    // 2. Send message based on delivery preference
    if (deliveryPreference === 'email' && email && highlevelContactId) {
      // Send email via HighLevel
      console.log('Sending email via HighLevel to:', email);

      try {
        const emailResponse = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${highlevelApiKey}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            type: 'Email',
            contactId: highlevelContactId,
            subject: `Your Sugar Lake Wedding Budget Estimate - $${totalBudget.toLocaleString()}`,
            html: budgetBreakdownHtml,
            emailFrom: venueName || 'Sugar Lake Weddings'
          })
        });

        const emailResponseText = await emailResponse.text();
        console.log('Email response status:', emailResponse.status);
        console.log('Email response:', emailResponseText);

        if (emailResponse.ok) {
          deliveryStatus = 'sent_email';
          console.log('Email sent successfully via HighLevel');
        } else {
          console.error('Email send failed:', emailResponseText);
          deliveryStatus = 'email_failed';
        }
      } catch (emailError) {
        console.error('Email send error:', emailError.message);
        deliveryStatus = 'email_failed';
      }

    } else if (deliveryPreference === 'text' && phone && highlevelContactId) {
      // Send SMS via HighLevel with link to quote summary
      console.log('Sending SMS to contact:', highlevelContactId);

      // Build the quote link using the passed estimate ID
      const quoteLink = estimateId 
        ? `\n\nView your full breakdown:\nhttps://sugarlakeweddings.com/quote/${estimateId}`
        : '';

      const smsMessage = `Hi ${name.split(' ')[0]}! 💍 Your Sugar Lake wedding budget estimate is $${totalBudget.toLocaleString()}.${quoteLink}\n\nOur team will reach out within 24 hours. Questions? Call (216) 616-1598`;

      try {
        const smsResponse = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${highlevelApiKey}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            type: 'SMS',
            contactId: highlevelContactId,
            message: smsMessage
          })
        });

        const smsResponseText = await smsResponse.text();
        console.log('SMS response status:', smsResponse.status);
        console.log('SMS response:', smsResponseText);

        if (smsResponse.ok) {
          deliveryStatus = 'sent_sms';
          console.log('SMS sent successfully');
        } else {
          console.error('SMS send failed:', smsResponseText);
          deliveryStatus = 'sms_failed';
        }
      } catch (smsError) {
        console.error('SMS send error:', smsError.message);
        deliveryStatus = 'sms_failed';
      }
    }

    // 3. Create internal note for planners (shows up in HighLevel contact timeline)
    if (highlevelContactId) {
      console.log('Adding internal note for planners...');
      try {
        const quoteLink = estimateId 
          ? `\n\n📄 View Full Quote:\nhttps://sugarlakeweddings.com/quote/${estimateId}` 
          : '';
        
        await fetch('https://services.leadconnectorhq.com/contacts/' + highlevelContactId + '/notes', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${highlevelApiKey}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            body: `📊 BUDGET CALCULATOR SUBMISSION\n\n` +
                  `Estimated Budget: $${totalBudget.toLocaleString()}\n` +
                  `Delivery Method: ${deliveryPreference === 'text' ? 'SMS' : 'Email'}\n\n` +
                  `SELECTIONS:\n${budgetBreakdownText}${quoteLink}\n\n` +
                  `⏰ Please follow up within 24 hours!`
          })
        });
        console.log('Internal note added');
      } catch (noteError) {
        console.error('Failed to add note:', noteError.message);
        // Don't fail the whole request for this
      }
    }

    console.log('=== sendBudgetQuote END ===');
    console.log('Delivery status:', deliveryStatus);

    return Response.json({
      success: true,
      message: 'Budget estimate processed',
      deliveryStatus: deliveryStatus,
      deliveryPreference: deliveryPreference,
      highlevelContactId: highlevelContactId
    });
  } catch (error) {
    console.error('sendBudgetQuote error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function formatBudgetBreakdown(budgetData, totalBudget) {
  const lines = [];

  const labels = {
    guestCount: 'Guest Count',
    dayOfWeek: 'Day of Week',
    season: 'Season',
    spirits: 'Spirits & Beverages',
    planning: 'Planning Services',
    catering: 'Catering',
    photography: 'Photography',
    florals: 'Florals',
    decor: 'Decorations',
    entertainment: 'Entertainment',
    videography: 'Videography',
    desserts: 'Desserts',
    linens: 'Table Linens',
    tableware: 'Tableware',
    extras: 'Extras Budget'
  };

  // Skip guestTier (redundant with guestCount) and totalBudget
  const skipKeys = ['guestTier', 'totalBudget'];

  Object.entries(budgetData).forEach(([key, value]) => {
    if (value && !skipKeys.includes(key)) {
      const label = labels[key] || key;
      lines.push(`${label}: ${value}`);
    }
  });

  return lines.join('\n');
}

function formatBudgetBreakdownHtml(budgetData, totalBudget, name, venueName) {
  const labels = {
    guestCount: 'Guest Count',
    dayOfWeek: 'Day of Week',
    season: 'Season',
    spirits: 'Spirits & Beverages',
    planning: 'Planning Services',
    catering: 'Catering',
    photography: 'Photography',
    florals: 'Florals',
    decor: 'Decorations',
    entertainment: 'Entertainment',
    videography: 'Videography',
    desserts: 'Desserts',
    linens: 'Table Linens',
    tableware: 'Tableware',
    extras: 'Extras Budget'
  };

  // Skip guestTier (redundant with guestCount) and totalBudget
  const skipKeys = ['guestTier', 'totalBudget'];

  let breakdownRows = '';
  Object.entries(budgetData).forEach(([key, value]) => {
    if (value && !skipKeys.includes(key)) {
      const label = labels[key] || key;
      breakdownRows += `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; color: #666;">${label}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: 500;">${value}</td>
        </tr>
      `;
    }
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
              
              <!-- Header -->
              <tr>
                <td style="background-color: #000000; padding: 32px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 300; letter-spacing: 2px;">${venueName.toUpperCase()}</h1>
                  <p style="margin: 8px 0 0 0; color: #999; font-size: 12px; letter-spacing: 3px;">WEDDING BUDGET ESTIMATE</p>
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 40px 40px 20px 40px;">
                  <p style="margin: 0; color: #333; font-size: 16px; line-height: 1.6;">
                    Dear ${name.split(' ')[0]},
                  </p>
                  <p style="margin: 16px 0 0 0; color: #666; font-size: 15px; line-height: 1.6;">
                    Thank you for using our budget calculator! We're excited to help you envision your perfect day at ${venueName}.
                  </p>
                </td>
              </tr>
              
              <!-- Total -->
              <tr>
                <td style="padding: 20px 40px;">
                  <div style="background: linear-gradient(135deg, #f8f8f8 0%, #f0f0f0 100%); border-radius: 12px; padding: 32px; text-align: center;">
                    <p style="margin: 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Your Estimated Total</p>
                    <p style="margin: 8px 0 0 0; color: #000; font-size: 42px; font-weight: 600;">$${totalBudget.toLocaleString()}</p>
                  </div>
                </td>
              </tr>
              
              <!-- Breakdown -->
              <tr>
                <td style="padding: 20px 40px 40px 40px;">
                  <h3 style="margin: 0 0 16px 0; color: #333; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Selections</h3>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${breakdownRows}
                  </table>
                </td>
              </tr>
              
              <!-- CTA -->
              <tr>
                <td style="padding: 0 40px 40px 40px;">
                  <p style="margin: 0 0 20px 0; color: #666; font-size: 15px; line-height: 1.6; text-align: center;">
                    Our planning team will reach out within 24 hours to discuss your vision in detail.
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="https://sugarlakeweddings.com/tour" style="display: inline-block; background-color: #000; color: #fff; text-decoration: none; padding: 16px 48px; border-radius: 50px; font-size: 14px; font-weight: 500; letter-spacing: 1px;">
                          SCHEDULE A TOUR
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #fafafa; padding: 24px 40px; border-top: 1px solid #eee;">
                  <p style="margin: 0; color: #999; font-size: 13px; text-align: center;">
                    Questions? Call us at <a href="tel:+12166161598" style="color: #666;">(216) 616-1598</a>
                  </p>
                  <p style="margin: 8px 0 0 0; color: #ccc; font-size: 12px; text-align: center;">
                    ${venueName} • Since 2017
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}