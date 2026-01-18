import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { venueId } = await req.json();

    const pricingData = {
      venue_base: {
        up_to_2: {
          saturday_peak: { price: 2950, per_person: 1475 },
          friday_peak: { price: 2950, per_person: 1475 },
          sunday_peak: { price: 2950, per_person: 1475 },
          weekday_peak: { price: 2950, per_person: 1475 },
          saturday_non_peak: { price: 2950, per_person: 1475 },
          friday_non_peak: { price: 2950, per_person: 1475 },
          sunday_non_peak: { price: 2950, per_person: 1475 },
          weekday_non_peak: { price: 2950, per_person: 1475 },
        },
        '2_to_20': {
          saturday_peak: null,
          friday_peak: null,
          sunday_peak: null,
          weekday_peak: { price: 4250, per_person: 212.50 },
          saturday_non_peak: { price: 4250, per_person: 212.50 },
          friday_non_peak: { price: 4250, per_person: 212.50 },
          sunday_non_peak: { price: 4250, per_person: 212.50 },
          weekday_non_peak: { price: 4250, per_person: 212.50 },
        },
        '20_to_50': {
          saturday_peak: null,
          friday_peak: null,
          sunday_peak: { price: 6500, per_person: 130 },
          weekday_peak: { price: 6000, per_person: 120 },
          saturday_non_peak: { price: 5500, per_person: 110 },
          friday_non_peak: { price: 5500, per_person: 110 },
          sunday_non_peak: { price: 5500, per_person: 110 },
          weekday_non_peak: { price: 5000, per_person: 100 },
        },
        '51_to_120': {
          saturday_peak: { price: 12000, per_person: 235.29 },
          friday_peak: { price: 11000, per_person: 215.69 },
          sunday_peak: { price: 9000, per_person: 176.47 },
          weekday_peak: { price: 7500, per_person: 147.06 },
          saturday_non_peak: { price: 7500, per_person: 147.06 },
          friday_non_peak: { price: 7500, per_person: 147.06 },
          sunday_non_peak: { price: 7500, per_person: 147.06 },
          weekday_non_peak: { price: 6500, per_person: 127.45 },
        },
      },
      spirits: [
        {
          guest_tier: '51_to_120',
          options: [
            { label: 'I plan to bring my own alcohol', price_type: 'flat', price: 1000 },
            { label: 'Beer and Wine Package', price_type: 'per_person', price: 25 },
            { label: 'Beer, Wine & 2 Signature drinks', price_type: 'per_person', price: 35 },
            { label: 'Standard full bar', price_type: 'per_person', price: 50 },
            { label: 'Craft cocktail full bar', price_type: 'per_person', price: 65 },
          ],
        },
        {
          guest_tier: '20_to_50',
          options: [
            { label: 'I plan to bring my own alcohol', price_type: 'flat', price: 750 },
            { label: 'Beer and Wine Package', price_type: 'per_person', price: 20 },
            { label: 'Beer, Wine & 2 Signature drinks', price_type: 'per_person', price: 30 },
            { label: 'Standard full bar', price_type: 'per_person', price: 45 },
            { label: 'Craft cocktail full bar', price_type: 'per_person', price: 60 },
          ],
        },
        {
          guest_tier: '2_to_20',
          options: [
            { label: 'The champagne toast is perfect for me!', price_type: 'flat', price: 0 },
            { label: 'I plan to bring my own alcohol', price_type: 'flat', price: 250 },
            { label: 'Beer and Wine Package', price_type: 'flat', price: 350 },
            { label: 'Standard full bar', price_type: 'flat', price: 380 },
          ],
        },
        {
          guest_tier: 'up_to_2',
          options: [
            { label: 'The champagne toast is perfect for me!', price_type: 'flat', price: 0 },
          ],
        },
      ],
      catering: [
        {
          guest_tier: '51_to_120',
          options: [
            { label: 'I want an affordable buffet option that tastes good', price_type: 'per_person', price: 35 },
            { label: 'I want an elevated buffet', price_type: 'per_person', price: 68 },
            { label: 'I want an elevated plated dinner', price_type: 'per_person', price: 85 },
            { label: 'I want delicious and custom or out of the box', price_type: 'per_person', price: 100 },
          ],
        },
        {
          guest_tier: '20_to_50',
          options: [
            { label: 'I want an affordable buffet option that tastes good', price_type: 'per_person', price: 35 },
            { label: 'I want an elevated buffet', price_type: 'per_person', price: 68 },
            { label: 'I want an elevated plated dinner', price_type: 'per_person', price: 85 },
            { label: 'I want delicious and custom or out of the box', price_type: 'per_person', price: 100 },
          ],
        },
        {
          guest_tier: '2_to_20',
          options: [
            { label: 'The grazing station is enough for me', price_type: 'flat', price: 0 },
            { label: 'I want to add an affordable buffet', price_type: 'per_person', price: 35 },
            { label: 'I want to add an elevated buffet', price_type: 'per_person', price: 68 },
            { label: 'I want an elevated plated dinner', price_type: 'per_person', price: 85 },
          ],
        },
        {
          guest_tier: 'up_to_2',
          options: [
            { label: 'The picnic is enough for me', price_type: 'flat', price: 0 },
            { label: 'I want to add a plated dinner', price_type: 'per_person', price: 85 },
          ],
        },
      ],
      planning: [
        {
          guest_tier: '51_to_120',
          options: [
            { label: 'I want to plan on my own and have family and friends responsible for set up', price: 0 },
            { label: 'I want someone to run the day and set up for me', price: 2500 },
            { label: 'I want a planner to help guide me and pair me with vendors', price: 5000 },
          ],
        },
        {
          guest_tier: '20_to_50',
          options: [
            { label: 'I want to plan on my own and have family and friends responsible for decor set up timeline', price: 0 },
            { label: 'I want someone to run the day and set up for me', price: 1500 },
            { label: 'I want a planner to help guide me and pair me with vendors', price: 4000 },
          ],
        },
        {
          guest_tier: '2_to_20',
          options: [
            { label: 'I want to plan on my own and have family and friends responsible for decor set up and timeline', price: 0 },
            { label: 'I do not want to worry about a thing and would love to have guidance on the wedding day', price: 300 },
          ],
        },
        {
          guest_tier: 'up_to_2',
          options: [
            { label: 'I think we have it covered', price: 0 },
            { label: 'I do not want to worry about a thing and would love to have guidance on the wedding day', price: 300 },
          ],
        },
      ],
      photography: [
        {
          guest_tier: '51_to_120',
          options: [
            { label: 'I will be looking for the least expensive option. I\'m willing to hire an amateur.', price: 2000 },
            { label: 'I want a semi-pro wedding photographer', price: 3000 },
            { label: 'I want really good photos and lots of them', price: 4000 },
            { label: 'Photography is one of the most important elements of my wedding to me', price: 5000 },
          ],
        },
        {
          guest_tier: '20_to_50',
          options: [
            { label: 'I will be looking for the least expensive option. I\'m willing to hire an amateur.', price: 2000 },
            { label: 'I want a semi-pro wedding photographer', price: 3000 },
            { label: 'I want really good photos and lots of them', price: 4000 },
            { label: 'Photography is one of the most important elements of my wedding to me', price: 5000 },
          ],
        },
        {
          guest_tier: '2_to_20',
          options: [
            { label: 'I am happy with the boutonniere and bouquet included', price: 0 },
            { label: 'I want to add an additional hour', price: 750 },
          ],
        },
        {
          guest_tier: 'up_to_2',
          options: [
            { label: 'I am happy with the boutonniere and bouquet included', price: 0 },
            { label: 'I want to add an additional hour', price: 750 },
          ],
        },
      ],
      florals: [
        {
          guest_tier: '51_to_120',
          options: [
            { label: 'I would prefer not to spend any of my budget on flowers', price: 0 },
            { label: 'I want flowers for the bridal party and parents only', price: 1500 },
            { label: 'I want some flowers for the ceremony area and/or reception area', price: 4000 },
            { label: 'Flowers are very important to me and I plan to invest in them heavily', price: 6000 },
          ],
        },
        {
          guest_tier: '20_to_50',
          options: [
            { label: 'I would prefer not to spend any of my budget on flowers', price: 0 },
            { label: 'I want flowers for the bridal party and parents only', price: 1500 },
            { label: 'I want some flowers for the ceremony area and/or reception area', price: 3000 },
            { label: 'Flowers are very important to me and I plan to invest in them heavily', price: 5000 },
          ],
        },
        {
          guest_tier: '2_to_20',
          options: [
            { label: 'I am happy with the boutonniere and bouquet included', price: 0 },
            { label: 'I want to add additional pieces', price: 750 },
          ],
        },
        {
          guest_tier: 'up_to_2',
          options: [
            { label: 'I am happy with the boutonniere and bouquet included', price: 0 },
            { label: 'I want to add additional pieces', price: 750 },
          ],
        },
      ],
      decor: [
        {
          guest_tier: '51_to_120',
          options: [
            { label: 'I plan to purchase, store and provide all of my decor', price: 3000 },
            { label: 'I plan to DIY everything', price: 1000 },
            { label: 'I want to work with a professional designer to bring in a custom look/feel for the space', price: 2500 },
          ],
        },
        {
          guest_tier: '20_to_50',
          options: [
            { label: 'I plan to purchase, store and provide all of my decor', price: 3000 },
            { label: 'I plan to DIY everything', price: 1000 },
            { label: 'I want to work with a professional designer to bring in a custom look/feel for the space', price: 1500 },
          ],
        },
        {
          guest_tier: '2_to_20',
          options: [
            { label: 'I do not need any decor, the base inclusions are stunning as is!', price: 0 },
            { label: 'I plan to bring a small amount of my own decorations and creations', price: 400 },
            { label: 'I want to not have to worry about the day feeling cohesive and would love designer help', price: 300 },
          ],
        },
        {
          guest_tier: 'up_to_2',
          options: [
            { label: 'I do not need any decor, the base inclusions are stunning as is!', price: 0 },
            { label: 'I want to not have to worry about the day feeling cohesive and would love designer help', price: 500 },
          ],
        },
      ],
      entertainment: [
        {
          guest_tier: '51_to_120',
          options: [
            { label: 'I plan to have a friend or family member play off of a speaker', price: 0 },
            { label: 'I want a competent professional', price: 1500 },
            { label: 'I want a professional with more lighting and upgrades', price: 2000 },
            { label: 'I want a professional with more lighting, upgrades and premium services', price: 2500 },
          ],
        },
        {
          guest_tier: '20_to_50',
          options: [
            { label: 'I plan to have a friend or family member play off of a speaker', price: 0 },
            { label: 'I want a competent professional', price: 1000 },
            { label: 'I want a professional with more lighting and upgrades', price: 1500 },
            { label: 'I want a professional with more lighting, upgrades and premium services', price: 2000 },
          ],
        },
        {
          guest_tier: '2_to_20',
          options: [
            { label: 'I plan to have a friend or family member play off of a speaker', price: 0 },
            { label: 'I want a coordinator assistant to help with main moments and have a playlist', price: 300 },
            { label: 'I want a competent professional', price: 800 },
            { label: 'I want a professional with more lighting and upgrades', price: 1000 },
          ],
        },
        {
          guest_tier: 'up_to_2',
          options: [
            { label: 'I want the venue attendant to help with the main moments and have a play list', price: 0 },
            { label: 'I want a competent professional', price: 500 },
            { label: 'I want a professional with more lighting and upgrades', price: 800 },
          ],
        },
      ],
      videography: [
        {
          guest_tier: '51_to_120',
          options: [
            { label: 'I don\'t think I want video', price: 0 },
            { label: 'I want a content creator to capture the moments', price: 1250 },
            { label: 'Yes - I would love affordable video to remember our big day', price: 3000 },
            { label: 'Yes - I want high end videography of our wedding day', price: 3400 },
          ],
        },
        {
          guest_tier: '20_to_50',
          options: [
            { label: 'I don\'t think I want video', price: 0 },
            { label: 'I want a content creator to capture the moments', price: 1250 },
            { label: 'Yes - I would love affordable video to remember our big day', price: 3000 },
            { label: 'Yes - I want high end videography of our wedding day', price: 3400 },
          ],
        },
        {
          guest_tier: '2_to_20',
          options: [
            { label: 'I am happy with content clips included', price: 0 },
            { label: 'I would like to add a 3-4 minute video', price: 750 },
          ],
        },
        {
          guest_tier: 'up_to_2',
          options: [
            { label: 'I am happy with content clips included', price: 0 },
            { label: 'I would like to add a 3-4 minute video', price: 750 },
          ],
        },
      ],
      desserts: [
        {
          guest_tier: '51_to_120',
          options: [
            { label: 'We will work hard to choose an affordable option', price: 500 },
            { label: 'We want a cutting cake and assorted desserts', price: 750 },
            { label: 'We want something fun like an ice cream bar, cheesecake bar, etc', price: 1200 },
          ],
        },
        {
          guest_tier: '20_to_50',
          options: [
            { label: 'We will work hard to choose an affordable option', price: 250 },
            { label: 'We want a traditional, but not over the top cake', price: 400 },
            { label: 'We want something fun like an ice cream bar, cheesecake bar, etc', price: 1200 },
          ],
        },
        {
          guest_tier: '2_to_20',
          options: [
            { label: 'I am happy with the cake included', price: 0 },
            { label: 'I would like to add assorted desserts', price: 200 },
          ],
        },
        {
          guest_tier: 'up_to_2',
          options: [
            { label: 'I am happy with the cake included', price: 0 },
            { label: 'I want something super custom', price: 100 },
          ],
        },
      ],
      linens: [
        {
          guest_tier: '51_to_120',
          options: [
            { label: 'I plan to use the custom wood tables or included linens and napkins with venue rental', price: 0 },
            { label: 'I plan to get upgraded linens or napkins', price: 750 },
          ],
        },
        {
          guest_tier: '20_to_50',
          options: [
            { label: 'I plan to use the custom wood tables or included linens and napkins with venue rental', price: 0 },
            { label: 'I plan to get upgraded linens or napkins', price: 500 },
          ],
        },
        {
          guest_tier: '2_to_20',
          options: [
            { label: 'I am happy with the inclusions for the elopement', price: 0 },
            { label: 'I want to use upgraded table linens', price: 250 },
          ],
        },
        {
          guest_tier: 'up_to_2',
          options: [
            { label: 'I am happy with the inclusions for the elopement', price: 0 },
            { label: 'I want to use upgraded table linens', price: 100 },
          ],
        },
      ],
      tableware: [
        {
          guest_tier: '51_to_120',
          options: [
            { label: 'I want to use the disposable with the caterers pricing if they provide it', price: 0 },
            { label: 'I want a pretty upgraded disposable option that looks good in photos', price: 400 },
            { label: 'I want real china', price: 1000 },
          ],
        },
        {
          guest_tier: '20_to_50',
          options: [
            { label: 'I want to use the disposable with the caterers pricing if they provide it', price: 0 },
            { label: 'I want a pretty upgraded disposable option that looks good in photos', price: 250 },
            { label: 'I want real china', price: 500 },
          ],
        },
        {
          guest_tier: '2_to_20',
          options: [
            { label: 'I am happy with the tableware inclusions in the elopement package', price: 0 },
          ],
        },
        {
          guest_tier: 'up_to_2',
          options: [
            { label: 'I am happy with the tableware inclusions in the elopement package', price: 0 },
          ],
        },
      ],
      extras_options: [0, 500, 1000, 1500, 2000, 3000, 5000, 10000],
    };

    // Create or update pricing configuration
    const existing = await base44.entities.WeddingPricingConfiguration.filter({ venue_id: venueId });
    
    if (existing.length > 0) {
      await base44.entities.WeddingPricingConfiguration.update(existing[0].id, { pricing_data: pricingData });
    } else {
      await base44.entities.WeddingPricingConfiguration.create({ venue_id: venueId, pricing_data: pricingData });
    }

    return Response.json({ success: true, message: 'Sugar Lake pricing initialized successfully' });
  } catch (error) {
    console.log('DEBUG: Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});