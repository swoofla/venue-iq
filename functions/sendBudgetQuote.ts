// sendBudgetQuote.js - UPDATED VERSION
// Now includes quote summary link in BOTH SMS and Email
// Deploy to: functions/sendBudgetQuote.js in Base44

Deno.serve(async (req) => {
  try {
    const { 
      name, 
      email, 
      phone, 
      budgetData, 
      venueName, 
      totalBudget, 
      deliveryPreference,
      estimateId  // The saved estimate ID for the quote link
    } = await req.json();

    console.log('=== sendBudgetQuote START ===');
    console.log('Delivery preference:', deliveryPreference);
    console.log('Email:', email);
    console.log('Phone:', phone);
    console.log('Estimate ID:', estimateId);

    const highlevelApiKey = Deno.env.get('HIGHLEVEL_API_KEY');
    const highlevelLocationId = Deno.env.get('HIGHLEVEL_LOCATION_ID');

    if (!highlevelApiKey || !highlevelLocationId) {
      throw new Error('HighLevel configuration missing');
    }

    // Build the quote link (same for both SMS and email)
    const quoteUrl = estimateId 
      ? `https://sugarlakeweddings.com/quote/${estimateId}`
      : null;

    // Format budget breakdown for plain text
    const budgetBreakdownText = formatBudgetBreakdown(budgetData, totalBudget);

    // 1. Create/upsert contact in HighLevel
    console.log('Creating HighLevel contact...');
    const contactPayload = {
      locationId: highlevelLocationId,
      email: email || undefined,
      phone: phone || undefined,
      name: name,
      source: 'Budget Calculator',
      tags: ['Budget Calculator Lead', 'VenueIQ Lead'],
      customFields: [
        { key: 'budget_estimate', value: totalBudget.toString() },
        { key: 'budget_breakdown', value: budgetBreakdownText },
        { key: 'delivery_preference', value: deliveryPreference }
      ]
    };

    // Remove undefined fields
    Object.keys(contactPayload).forEach(key => 
      contactPayload[key] === undefined && delete contactPayload[key]
    );

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

    const contactResult = await contactResponse.json();
    const highlevelContactId = contactResult.contact?.id;
    console.log('HighLevel contact ID:', highlevelContactId);

    if (!highlevelContactId) {
      throw new Error('Failed to create HighLevel contact');
    }

    let deliveryStatus = 'pending';

    // 2. Send notification based on preference
    if (deliveryPreference === 'email' && email && highlevelContactId) {
      // Send Email via HighLevel with quote link
      console.log('Sending email to contact:', highlevelContactId);

      const emailHtml = formatBudgetBreakdownHtml(budgetData, totalBudget, name, venueName, quoteUrl);

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
            subject: `Your ${venueName} Wedding Budget Estimate 💒`,
            html: emailHtml
          })
        });

        const emailResponseText = await emailResponse.text();
        console.log('Email response status:', emailResponse.status);
        console.log('Email response:', emailResponseText);

        if (emailResponse.ok) {
          deliveryStatus = 'sent_email';
          console.log('Email sent successfully');
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

      // Build the quote link for SMS
      const quoteLink = quoteUrl 
        ? `\n\nView your full breakdown:\n${quoteUrl}`
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

    // 3. Add internal note for planners
    if (highlevelContactId) {
      try {
        await fetch('https://services.leadconnectorhq.com/contacts/' + highlevelContactId + '/notes', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${highlevelApiKey}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            body: `💰 NEW BUDGET ESTIMATE: $${totalBudget.toLocaleString()}\n\n` +
                  `Delivered via: ${deliveryPreference === 'text' ? 'SMS' : 'Email'}\n` +
                  `Quote Link: ${quoteUrl || 'Not available'}\n\n` +
                  `SELECTIONS:\n${budgetBreakdownText}\n\n` +
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
      highlevelContactId: highlevelContactId,
      quoteUrl: quoteUrl
    });

  } catch (error) {
    console.error('sendBudgetQuote error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

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

  // Skip guestTier since it's redundant with guestCount
  Object.entries(budgetData).forEach(([key, value]) => {
    if (value && key !== 'totalBudget' && key !== 'guestTier') {
      const label = labels[key] || key;
      lines.push(`${label}: ${value}`);
    }
  });

  return lines.join('\n');
}

function formatBudgetBreakdownHtml(budgetData, totalBudget, name, venueName, quoteUrl) {
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

  let breakdownRows = '';
  // Skip guestTier since it's redundant with guestCount
  Object.entries(budgetData).forEach(([key, value]) => {
    if (value && key !== 'totalBudget' && key !== 'guestTier') {
      const label = labels[key] || key;
      breakdownRows += `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; color: #666;">${label}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: 500;">${value}</td>
        </tr>
      `;
    }
  });

  // Build the "View Full Breakdown" button HTML if we have a quote URL
  const viewBreakdownButton = quoteUrl ? `
    <tr>
      <td style="padding: 20px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <a href="${quoteUrl}" style="display: inline-block; background-color: #333; color: #fff; text-decoration: none; padding: 14px 40px; border-radius: 50px; font-size: 13px; font-weight: 500; letter-spacing: 1px;">
                VIEW FULL BREAKDOWN
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : '';

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
              
              <!-- View Full Breakdown Button (if quoteUrl exists) -->
              ${viewBreakdownButton}
              
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