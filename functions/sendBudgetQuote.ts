import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, email, phone, budgetData, venueName, totalBudget, deliveryPreference } = await req.json();

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

    // 2. Save to SavedBudgetEstimate first (our source of truth)
    const budgetBreakdown = calculateBudgetBreakdown(budgetData);
    
    const savedEstimate = await base44.entities.SavedBudgetEstimate.create({
      venue_id: sugarlakeVenue?.id,
      name,
      email: deliveryPreference === 'email' ? email : null,
      phone: deliveryPreference === 'text' ? phone : null,
      delivery_preference: deliveryPreference,
      total_budget: totalBudget,
      guest_count: budgetData.guestCount || 0,
      guest_tier: budgetData.guestTier,
      day_of_week: budgetData.dayOfWeek,
      season: budgetData.season,
      budget_selections: budgetData,
      budget_breakdown: budgetBreakdown,
      highlevel_sync_status: 'pending'
    });

    // 3. Save to ContactSubmission for backward compatibility
    const contactSubmission = await base44.entities.ContactSubmission.create({
      venue_id: sugarlakeVenue?.id,
      name,
      email: email || null,
      phone: phone || null,
      budget: totalBudget,
      recommended_package: budgetData.guestTier,
      source: 'budget_calculator',
      status: 'new',
      priorities: Object.entries(budgetData)
        .filter(([key, value]) => value && !['guestTier', 'dayOfWeek', 'season', 'totalBudget', 'guestCount', 'extras'].includes(key))
        .map(([key, value]) => `${key}: ${value}`)
        .slice(0, 3)
    });

    // 4. Send delivery message (email or SMS)
    const plannersEmail = Deno.env.get('SUGAR_LAKE_PLANNERS_EMAIL') || 'info@sugarlakeweddings.com';
    const budgetBreakdownText = formatBudgetBreakdown(budgetData, totalBudget);
    
    if (deliveryPreference === 'email' && email) {
      const brideEmailSubject = `Your Sugar Lake Wedding Budget Estimate - $${totalBudget.toLocaleString()}`;
      const brideEmailBody = generateBrideEmail(name, budgetBreakdownText, totalBudget, venueName);
      
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: brideEmailSubject,
        body: brideEmailBody,
        from_name: venueName || 'Sugar Lake Weddings'
      });
    }

    // 5. Always send planner notification
    const plannerEmailSubject = `New Budget Quote Request - ${name}`;
    const plannerEmailBody = generatePlannerEmail(name, email || phone || 'No contact', phone || email || 'No contact', budgetBreakdownText, totalBudget);
    
    await base44.integrations.Core.SendEmail({
      to: plannersEmail,
      subject: plannerEmailSubject,
      body: plannerEmailBody,
      from_name: venueName || 'Sugar Lake Weddings'
    });

    // 6. Sync to HighLevel
    const highlevelApiKey = Deno.env.get('HIGHLEVEL_API_KEY');
    const locationId = Deno.env.get('HIGHLEVEL_LOCATION_ID');

    let highlevelContactId = null;
    let syncStatus = 'pending';

    if (highlevelApiKey && locationId) {
      try {
        const contactResponse = await fetch('https://rest.gohighlevel.com/v2/contacts/upsert', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${highlevelApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            locationId,
            email: email || undefined,
            phone: phone || undefined,
            firstName: name.split(' ')[0],
            lastName: name.split(' ').slice(1).join(' '),
            customFields: {
              budgetEstimate: totalBudget.toString(),
              budgetPackage: budgetData.guestTier,
              budgetSource: 'budget_calculator'
            }
          })
        });

        if (contactResponse.ok) {
          const contactData = await contactResponse.json();
          highlevelContactId = contactData.contact?.id;
          syncStatus = 'synced';
        } else {
          console.error('Failed to create HighLevel contact:', await contactResponse.text());
          syncStatus = 'failed';
        }
      } catch (hlError) {
        console.error('HighLevel sync error:', hlError.message);
        syncStatus = 'failed';
      }
    }

    // 7. Update sync status
    await base44.entities.SavedBudgetEstimate.update(savedEstimate.id, {
      highlevel_sync_status: syncStatus,
      highlevel_contact_id: highlevelContactId
    });

    return Response.json({ 
      success: true, 
      message: 'Budget estimate saved successfully',
      estimateId: savedEstimate.id,
      syncStatus: syncStatus,
      contactSubmissionId: contactSubmission.id
    });
  } catch (error) {
    console.error('Send budget quote error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function calculateBudgetBreakdown(budgetData) {
  const breakdown = {};
  
  const labels = {
    guestTier: 'Package',
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
    if (value && key !== 'totalBudget' && key !== 'guestCount') {
      const label = labels[key] || key;
      breakdown[key] = value;
    }
  });

  return breakdown;
}

function formatBudgetBreakdown(budgetData, totalBudget) {
  const lines = [];
  
  const labels = {
    guestTier: 'Package',
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
    if (value && key !== 'totalBudget' && key !== 'guestCount') {
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

TOTAL ESTIMATE: $${totalBudget.toLocaleString()}

This estimate is based on your selections and current pricing. Our planning team will review your preferences and reach out within 24 hours to discuss your vision in detail and answer any questions you may have.

We look forward to creating something beautiful together!

Warm regards,
The ${venueName} Planning Team

---
Ready to see the venue in person? Schedule a tour with us to experience the space firsthand and discuss how we can bring your vision to life.`;
}

function generatePlannerEmail(name, email, phone, budgetBreakdown, totalBudget) {
  return `New Budget Quote Request

Couple Name: ${name}
Email: ${email}
Phone: ${phone}
Estimated Budget: $${totalBudget.toLocaleString()}

BUDGET BREAKDOWN:
${budgetBreakdown}

---
This lead was generated from the Sugar Lake wedding budget calculator. Please follow up within 24 hours.`;
}