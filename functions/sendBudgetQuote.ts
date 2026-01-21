import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, email, phone, budgetData, venueName, totalBudget, deliveryPreference } = await req.json();

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

    // 1. Get venue
    const venues = await base44.entities.Venue.list();
    const sugarlakeVenue = venues.find(v => v.name.toLowerCase().includes('sugar lake')) || venues[0];

    // 2. Format budget breakdown for messages
    const budgetBreakdownText = formatBudgetBreakdown(budgetData, totalBudget);
    const plannersEmail = Deno.env.get('SUGAR_LAKE_PLANNERS_EMAIL') || 'info@sugarlakeweddings.com';

    // 3. Get HighLevel credentials
    const highlevelApiKey = Deno.env.get('HIGHLEVEL_API_KEY');
    const locationId = Deno.env.get('HIGHLEVEL_LOCATION_ID');

    let highlevelContactId = null;
    let deliveryStatus = 'pending';

    // 4. Create/upsert contact in HighLevel first (needed for SMS)
    if (highlevelApiKey && locationId) {
      try {
        console.log('Creating HighLevel contact...');
        
        const contactPayload = {
          locationId,
          firstName: name.split(' ')[0],
          lastName: name.split(' ').slice(1).join(' ') || '',
          tags: ['Budget Calculator Lead'],
          customFields: [
            { key: 'budget_estimate', field_value: totalBudget.toString() },
            { key: 'budget_delivery_preference', field_value: deliveryPreference },
            { key: 'budget_package', field_value: budgetData.guestTier || '' }
          ]
        };

        // Add email or phone based on delivery preference
        if (deliveryPreference === 'email' && email) {
          contactPayload.email = email;
        }
        if (deliveryPreference === 'text' && phone) {
          // Format phone number - HighLevel expects +1XXXXXXXXXX format
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
        }
      } catch (hlError) {
        console.error('HighLevel contact creation error:', hlError.message);
      }
    }

    // 5. Send based on delivery preference
    if (deliveryPreference === 'email' && email) {
      // Send email to bride
      console.log('Sending email to:', email);
      const brideEmailSubject = `Your Sugar Lake Wedding Budget Estimate - $${totalBudget.toLocaleString()}`;
      const brideEmailBody = generateBrideEmail(name, budgetBreakdownText, totalBudget, venueName || 'Sugar Lake Weddings');

      try {
        await base44.integrations.Core.SendEmail({
          to: email,
          subject: brideEmailSubject,
          body: brideEmailBody,
          from_name: venueName || 'Sugar Lake Weddings'
        });
        deliveryStatus = 'sent_email';
        console.log('Email sent successfully');
      } catch (emailError) {
        console.error('Email send error:', emailError.message);
        deliveryStatus = 'email_failed';
      }
    } else if (deliveryPreference === 'text' && phone && highlevelContactId) {
      // Send SMS via HighLevel V2 API
      console.log('Sending SMS to contact:', highlevelContactId);
      
      const smsMessage = `Hi ${name.split(' ')[0]}! 💍 Your Sugar Lake wedding budget estimate is $${totalBudget.toLocaleString()}. Our planning team will reach out within 24 hours to discuss your vision. Questions? Call us at (216) 616-1598`;

      try {
        // HighLevel V2 API for sending SMS
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
    } else if (deliveryPreference === 'text' && phone && !highlevelContactId) {
      console.error('Cannot send SMS - no HighLevel contact ID');
      deliveryStatus = 'sms_failed_no_contact';
    }

    // 6. Always send planner notification email
    console.log('Sending planner notification...');
    const contactMethod = deliveryPreference === 'email' ? email : phone;
    const plannerEmailSubject = `New Budget Quote Request - ${name}`;
    const plannerEmailBody = generatePlannerEmail(
      name, 
      email || 'Not provided', 
      phone || 'Not provided', 
      budgetBreakdownText, 
      totalBudget,
      deliveryPreference
    );

    try {
      await base44.integrations.Core.SendEmail({
        to: plannersEmail,
        subject: plannerEmailSubject,
        body: plannerEmailBody,
        from_name: venueName || 'Sugar Lake Weddings'
      });
      console.log('Planner notification sent');
    } catch (plannerEmailError) {
      console.error('Planner email error:', plannerEmailError.message);
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
    guestTier: 'Package',
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

  Object.entries(budgetData).forEach(([key, value]) => {
    if (value && key !== 'totalBudget') {
      const label = labels[key] || key;
      lines.push(`${label}: ${value}`);
    }
  });

  return lines.join('\n');
}

function generateBrideEmail(name, budgetBreakdown, totalBudget, venueName) {
  return `Dear ${name.split(' ')[0]},

Thank you for using our budget calculator! We're excited to help you envision your perfect day at ${venueName}.

Here's your wedding budget estimate:

${budgetBreakdown}

═══════════════════════════════
TOTAL ESTIMATE: $${totalBudget.toLocaleString()}
═══════════════════════════════

This estimate is based on your selections and current pricing. Our planning team will review your preferences and reach out within 24 hours to discuss your vision in detail and answer any questions you may have.

We look forward to creating something beautiful together!

Warm regards,
The ${venueName} Planning Team

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ready to see the venue in person? 
Schedule a tour: https://sugarlakeweddings.com/tour
Questions? Call us: (216) 616-1598
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

function generatePlannerEmail(name, email, phone, budgetBreakdown, totalBudget, deliveryPreference) {
  return `🔔 NEW BUDGET QUOTE REQUEST

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTACT INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: ${name}
Email: ${email}
Phone: ${phone}
Preferred Contact Method: ${deliveryPreference === 'text' ? '📱 TEXT' : '📧 EMAIL'}
Estimated Budget: $${totalBudget.toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUDGET BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${budgetBreakdown}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Please follow up within 24 hours via their preferred method (${deliveryPreference}).

This lead was generated from the Sugar Lake wedding budget calculator.`;
}