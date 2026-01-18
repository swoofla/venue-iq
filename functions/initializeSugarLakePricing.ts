import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { venueId } = await req.json();

    const guest_tiers = [
      { "id": "up_to_2", "label": "Just us two 💕", "sublabel": "Elopement Package", "min_guests": 1, "max_guests": 2, "default_guest_count": 2 },
      { "id": "up_to_20", "label": "Inner Circle", "sublabel": "Intimate gathering (up to 20)", "min_guests": 3, "max_guests": 20, "default_guest_count": 15 },
      { "id": "up_to_50", "label": "50 and Under", "sublabel": "Small celebration (21-50)", "min_guests": 21, "max_guests": 50, "default_guest_count": 35 },
      { "id": "51_to_120", "label": "Classic Wedding", "sublabel": "51-120 guests", "min_guests": 51, "max_guests": 120, "default_guest_count": 85 }
    ];

    const availability_rules = {
      "up_to_2": { "peak": ["weekday"], "nonpeak": ["saturday", "friday", "sunday", "weekday"] },
      "up_to_20": { "peak": ["weekday"], "nonpeak": ["saturday", "friday", "sunday", "weekday"] },
      "up_to_50": { "peak": ["sunday", "weekday"], "nonpeak": ["saturday", "friday", "sunday", "weekday"] },
      "51_to_120": { "peak": ["saturday", "friday", "sunday", "weekday"], "nonpeak": ["saturday", "friday", "sunday", "weekday"] }
    };

    const venue_base = {
        up_to_2: {
          weekday_peak: { price: 2950 },
          saturday_nonpeak: { price: 2950 },
          friday_nonpeak: { price: 2950 },
          sunday_nonpeak: { price: 2950 },
          weekday_nonpeak: { price: 2950 }
        },
        up_to_20: {
          weekday_peak: { price: 4250 },
          saturday_nonpeak: { price: 4250 },
          friday_nonpeak: { price: 4250 },
          sunday_nonpeak: { price: 4250 },
          weekday_nonpeak: { price: 4250 }
        },
        up_to_50: {
          sunday_peak: { price: 6500 },
          weekday_peak: { price: 6000 },
          saturday_nonpeak: { price: 5500 },
          friday_nonpeak: { price: 5500 },
          sunday_nonpeak: { price: 5500 },
          weekday_nonpeak: { price: 5000 }
        },
        '51_to_120': {
          saturday_peak: { price: 12000 },
          friday_peak: { price: 11000 },
          sunday_peak: { price: 9000 },
          weekday_peak: { price: 7500 },
          saturday_nonpeak: { price: 7500 },
          friday_nonpeak: { price: 7500 },
          sunday_nonpeak: { price: 7500 },
          weekday_nonpeak: { price: 6500 }
        }
    };

    const peak_months = [5, 6, 7, 8, 9, 10];

    const spirits = {
      '51_to_120': [
        { label: 'I plan to bring my own alcohol', price_type: 'flat', price: 1000, note: 'corkage fee' },
        { label: 'Beer and Wine Package', price_type: 'per_person', price: 25 },
        { label: 'Beer, Wine & 2 Signature drinks', price_type: 'per_person', price: 35 },
        { label: 'Standard full bar', price_type: 'per_person', price: 50 },
        { label: 'Craft cocktail full bar', price_type: 'per_person', price: 65 },
      ],
      up_to_50: [
        { label: 'I plan to bring my own alcohol', price_type: 'flat', price: 750, note: 'corkage fee' },
        { label: 'Beer and Wine Package', price_type: 'per_person', price: 20 },
        { label: 'Beer, Wine & 2 Signature drinks', price_type: 'per_person', price: 30 },
        { label: 'Standard full bar', price_type: 'per_person', price: 45 },
        { label: 'Craft cocktail full bar', price_type: 'per_person', price: 60 },
      ],
      up_to_20: [
        { label: 'The champagne toast is perfect for me!', price_type: 'flat', price: 0 },
        { label: 'I plan to bring my own alcohol', price_type: 'flat', price: 250, note: 'corkage fee' },
        { label: 'Beer and Wine Package', price_type: 'flat_plus_per_person', price: 350, extra_pp: 15 },
        { label: 'Standard full bar', price_type: 'flat_plus_per_person', price: 350, extra_pp: 30 },
      ],
      up_to_2: [
        { label: 'The champagne toast is perfect for me!', price_type: 'flat', price: 0 },
      ],
    };

    const planning = {
      '51_to_120': [
        { label: 'No, I want to plan on my own and have family/friends responsible for set up', price_type: 'flat', price: 0 },
        { label: 'I think I want to plan on my own, but I would love someone to run the day and set up for me', price_type: 'flat', price: 2500 },
        { label: 'I want a planner to help guide me, pair me with vendors to create a stress-free experience', price_type: 'flat', price: 5000 },
      ],
      up_to_50: [
        { label: 'No, I want to plan on my own and have family/friends responsible for decor set up/timeline', price_type: 'flat', price: 0 },
        { label: 'I think I want to plan on my own, but I would love someone to run the day and set up for me', price_type: 'flat', price: 1500 },
        { label: 'I want a planner to help guide me, pair me with vendors to create a stress-free experience', price_type: 'flat', price: 4000 },
      ],
      up_to_20: [
        { label: 'No, I want to plan on my own and have family/friends responsible for decor set up and timeline', price_type: 'flat', price: 0 },
        { label: 'I do not want to worry about a thing and would love guidance on the wedding day', price_type: 'flat', price: 300 },
      ],
      up_to_2: [
        { label: 'No, I think we have it covered', price_type: 'flat', price: 0 },
        { label: 'I do not want to worry about a thing and would love guidance on the wedding day', price_type: 'flat', price: 300 },
      ],
    };

    const catering = {
      '51_to_120': [
        { label: 'I want an affordable buffet option that tastes good', price_type: 'per_person', price: 35 },
        { label: 'I want an elevated buffet', price_type: 'per_person', price: 68 },
        { label: 'I want an elevated plated dinner', price_type: 'per_person', price: 85 },
        { label: 'I want delicious and custom or out of the box', price_type: 'per_person', price: 100 },
      ],
      up_to_50: [
        { label: 'I want an affordable buffet option that tastes good', price_type: 'per_person', price: 35 },
        { label: 'I want an elevated buffet', price_type: 'per_person', price: 68 },
        { label: 'I want an elevated plated dinner', price_type: 'per_person', price: 85 },
        { label: 'I want delicious and custom or out of the box', price_type: 'per_person', price: 100 },
      ],
      up_to_20: [
        { label: 'The grazing station is enough for me', price_type: 'flat', price: 0 },
        { label: 'I want to add an affordable buffet', price_type: 'per_person', price: 35 },
        { label: 'I want to add an elevated buffet', price_type: 'per_person', price: 68 },
        { label: 'I want an elevated plated dinner', price_type: 'per_person', price: 85 },
      ],
      up_to_2: [
        { label: 'The picnic is enough for me', price_type: 'flat', price: 0 },
        { label: 'I want to add a plated dinner', price_type: 'per_person', price: 85 },
      ],
    };

    const photography = {
      '51_to_120': [
        { label: 'I will be looking for the least expensive option. I\'m willing to hire an amateur.', price_type: 'flat', price: 2000 },
        { label: 'I know photos are important and want a semi-pro photographer, even if less coverage.', price_type: 'flat', price: 3000 },
        { label: 'I want really good photos and lots of them.', price_type: 'flat', price: 4000 },
        { label: 'Photography is one of the most important elements. I want to invest a lot.', price_type: 'flat', price: 5000, note: 'starting at' },
      ],
      up_to_50: [
        { label: 'I will be looking for the least expensive option. I\'m willing to hire an amateur.', price_type: 'flat', price: 2000 },
        { label: 'I know photos are important and want a semi-pro photographer, even if less coverage.', price_type: 'flat', price: 3000 },
        { label: 'I want really good photos and lots of them.', price_type: 'flat', price: 4000 },
        { label: 'Photography is one of the most important elements. I want to invest a lot.', price_type: 'flat', price: 5000, note: 'starting at' },
      ],
      up_to_20: [
        { label: 'I am happy with the photography included', price_type: 'flat', price: 0 },
        { label: 'I want to add an additional hour', price_type: 'flat', price: 750 },
      ],
      up_to_2: [
        { label: 'I am happy with the photography included', price_type: 'flat', price: 0 },
        { label: 'I want to add an additional hour', price_type: 'flat', price: 750 },
      ],
    };

    const florals = {
      '51_to_120': [
        { label: 'I would prefer not to spend any of my budget on flowers', price_type: 'flat', price: 0 },
        { label: 'I want flowers for the bridal party and parents only', price_type: 'flat', price: 1500 },
        { label: 'I want some flowers for the ceremony area and/or reception area', price_type: 'flat', price: 4000 },
        { label: 'Flowers are very important to me and I plan to invest heavily', price_type: 'flat', price: 6000, note: 'starting at' },
      ],
      up_to_50: [
        { label: 'I would prefer not to spend any of my budget on flowers', price_type: 'flat', price: 0 },
        { label: 'I want flowers for the bridal party and parents only', price_type: 'flat', price: 1500 },
        { label: 'I want some flowers for the ceremony area and/or reception area', price_type: 'flat', price: 3000 },
        { label: 'Flowers are very important to me and I plan to invest heavily', price_type: 'flat', price: 5000, note: 'starting at' },
      ],
      up_to_20: [
        { label: 'I am happy with the boutonniere and bouquet included', price_type: 'flat', price: 0 },
        { label: 'I want to add additional pieces', price_type: 'flat', price: 750 },
      ],
      up_to_2: [
        { label: 'I am happy with the boutonniere and bouquet included', price_type: 'flat', price: 0 },
        { label: 'I want to add additional pieces', price_type: 'flat', price: 750 },
      ],
    };

    const decor = {
      '51_to_120': [
        { label: 'I plan to purchase, store and provide all of my decor', price_type: 'flat', price: 3000 },
        { label: 'I plan to DIY everything', price_type: 'flat', price: 1000 },
        { label: 'I want to work with a professional designer with beautiful rentals and tableware upgrades', price_type: 'flat', price: 2500 },
      ],
      up_to_50: [
        { label: 'I plan to purchase, store and provide all of my decor', price_type: 'flat', price: 3000 },
        { label: 'I plan to DIY everything', price_type: 'flat', price: 1000 },
        { label: 'I want to work with a professional designer with beautiful rentals and tableware upgrades', price_type: 'flat', price: 1500 },
      ],
      up_to_20: [
        { label: 'I do not need any decor, the base inclusions are stunning as is!', price_type: 'flat', price: 0 },
        { label: 'I plan to bring a small amount of my own decorations and creations', price_type: 'flat', price: 400 },
        { label: 'I want access to an expansive inventory and tableware upgrades with a designer', price_type: 'flat', price: 300 },
      ],
      up_to_2: [
        { label: 'I do not need any decor, the base inclusions are stunning as is!', price_type: 'flat', price: 0 },
        { label: 'I want access to an expansive inventory and a designer to set it up for me', price_type: 'flat', price: 500 },
      ],
    };

    const entertainment = {
      '51_to_120': [
        { label: 'I plan to have a friend or family member play off a speaker (not recommended)', price_type: 'flat', price: 0 },
        { label: 'I want a competent professional', price_type: 'flat', price: 1500 },
        { label: 'I want a professional with more lighting and upgrades', price_type: 'flat', price: 2000 },
        { label: 'I want a professional with extensive lighting and upgrades', price_type: 'flat', price: 2500 },
      ],
      up_to_50: [
        { label: 'I plan to have a friend or family member play off a speaker (not recommended)', price_type: 'flat', price: 0 },
        { label: 'I want a competent professional', price_type: 'flat', price: 1000 },
        { label: 'I want a professional with more lighting and upgrades', price_type: 'flat', price: 1500 },
        { label: 'I want a professional with extensive lighting and upgrades', price_type: 'flat', price: 2000 },
      ],
      up_to_20: [
        { label: 'I plan to have a friend or family member play off a speaker', price_type: 'flat', price: 0 },
        { label: 'I want a coordinator assistant to help with main moments and have a playlist', price_type: 'flat', price: 300 },
        { label: 'I want a competent professional', price_type: 'flat', price: 800 },
        { label: 'I want a professional with more lighting and upgrades', price_type: 'flat', price: 1000 },
      ],
      up_to_2: [
        { label: 'I want the venue attendant to help with main moments and have a playlist', price_type: 'flat', price: 0 },
        { label: 'I want a competent professional', price_type: 'flat', price: 500 },
        { label: 'I want a professional with more lighting and upgrades', price_type: 'flat', price: 800 },
      ],
    };

    const videography = {
      '51_to_120': [
        { label: 'I don\'t think I want video', price_type: 'flat', price: 0 },
        { label: 'I want a content creator to capture moments, but not a full cinematic video', price_type: 'flat', price: 1250 },
        { label: 'Yes - I would love affordable video to remember our big day', price_type: 'flat', price: 3000 },
        { label: 'Yes - I want high end videography of our wedding day', price_type: 'flat', price: 4000, note: 'starting at' },
      ],
      up_to_50: [
        { label: 'I don\'t think I want video', price_type: 'flat', price: 0 },
        { label: 'I want a content creator to capture moments, but not a full cinematic video', price_type: 'flat', price: 1250 },
        { label: 'Yes - I would love affordable video to remember our big day', price_type: 'flat', price: 3000 },
        { label: 'Yes - I want high end videography of our wedding day', price_type: 'flat', price: 4000, note: 'starting at' },
      ],
      up_to_20: [
        { label: 'I am happy with content clips included', price_type: 'flat', price: 0 },
        { label: 'I would like to add a 3-4 minute video', price_type: 'flat', price: 750 },
      ],
      up_to_2: [
        { label: 'I am happy with content clips included', price_type: 'flat', price: 0 },
        { label: 'I would like to add a 3-4 minute video', price_type: 'flat', price: 750 },
      ],
    };

    const desserts = {
      '51_to_120': [
        { label: 'We will work hard to choose an affordable option', price_type: 'flat', price: 500 },
        { label: 'We want a cutting cake and assorted desserts', price_type: 'flat', price: 750 },
        { label: 'We want something fun like an ice cream bar, cheesecake bar, etc.', price_type: 'flat', price: 1200 },
      ],
      up_to_50: [
        { label: 'We will work hard to choose an affordable option', price_type: 'flat', price: 250 },
        { label: 'We want a traditional, but not over the top cake', price_type: 'flat', price: 400 },
        { label: 'We want something fun like an ice cream bar, cheesecake bar, etc.', price_type: 'flat', price: 1200, note: 'starting at' },
      ],
      up_to_20: [
        { label: 'I am happy with the cake included', price_type: 'flat', price: 0 },
        { label: 'I would like to add assorted desserts', price_type: 'flat', price: 200 },
        { label: 'I want something super custom', price_type: 'flat', price: 100 },
      ],
      up_to_2: [
        { label: 'I am happy with the cake included', price_type: 'flat', price: 0 },
        { label: 'I would like to add assorted desserts', price_type: 'flat', price: 200 },
        { label: 'I want something super custom', price_type: 'flat', price: 100 },
      ],
    };

    const linens = {
      '51_to_120': [
        { label: 'I plan to use the custom wood tables or included linens and napkins', price_type: 'flat', price: 0 },
        { label: 'I plan to get upgraded linens or napkins', price_type: 'flat', price: 750 },
      ],
      up_to_50: [
        { label: 'I plan to use the custom wood tables or included linens and napkins', price_type: 'flat', price: 0 },
        { label: 'I plan to get upgraded linens or napkins', price_type: 'flat', price: 500 },
      ],
      up_to_20: [
        { label: 'I am happy with the inclusions for the elopement', price_type: 'flat', price: 0 },
        { label: 'I want to use upgraded table linens', price_type: 'flat', price: 250 },
      ],
      up_to_2: [
        { label: 'I am happy with the inclusions for the elopement', price_type: 'flat', price: 0 },
        { label: 'I want to use upgraded table linens', price_type: 'flat', price: 100 },
      ],
    };

    const tableware = {
      '51_to_120': [
        { label: 'I want to use the disposable with the caterer\'s pricing', price_type: 'flat', price: 0 },
        { label: 'I want a pretty upgraded disposable option that looks good in photos', price_type: 'flat', price: 400 },
        { label: 'I want real china', price_type: 'flat', price: 1000 },
      ],
      up_to_50: [
        { label: 'I want to use the disposable with the caterer\'s pricing', price_type: 'flat', price: 0 },
        { label: 'I want a pretty upgraded disposable option that looks good in photos', price_type: 'flat', price: 250 },
        { label: 'I want real china', price_type: 'flat', price: 500 },
      ],
      up_to_20: [
        { label: 'I am happy with the tableware inclusions in the elopement package', price_type: 'flat', price: 0 },
      ],
      up_to_2: [
        { label: 'I am happy with the tableware inclusions in the elopement package', price_type: 'flat', price: 0 },
      ],
    };

    const extras = [
      { label: '$0', price: 0 },
      { label: '$500', price: 500 },
      { label: '$1,000', price: 1000 },
      { label: '$1,500', price: 1500 },
      { label: '$2,000', price: 2000 },
      { label: '$3,000', price: 3000 },
      { label: '$5,000', price: 5000 },
      { label: '$10,000', price: 10000 },
    ];

    // Create or update pricing configuration - store each field at root level
    const pricingRecord = {
      venue_id: venueId,
      guest_tiers,
      availability_rules,
      venue_base,
      peak_months,
      spirits,
      planning,
      catering,
      photography,
      florals,
      decor,
      entertainment,
      videography,
      desserts,
      linens,
      tableware,
      extras,
    };

    const existing = await base44.entities.WeddingPricingConfiguration.filter({ venue_id: venueId });
    
    if (existing.length > 0) {
      await base44.entities.WeddingPricingConfiguration.update(existing[0].id, pricingRecord);
    } else {
      await base44.entities.WeddingPricingConfiguration.create(pricingRecord);
    }

    return Response.json({ success: true, message: 'Sugar Lake pricing initialized successfully' });
  } catch (error) {
    console.log('DEBUG: Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});