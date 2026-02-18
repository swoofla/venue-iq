import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { venue_id, source } = await req.json();

    if (!venue_id || !source) {
      return Response.json({ 
        error: 'Missing required fields: venue_id, source' 
      }, { status: 400 });
    }

    const validSources = ['venue_basics', 'packages', 'pricing', 'all'];
    if (!validSources.includes(source)) {
      return Response.json({ 
        error: 'Invalid source. Must be one of: venue_basics, packages, pricing, all' 
      }, { status: 400 });
    }

    const venue = await base44.asServiceRole.entities.Venue.get(venue_id);
    if (!venue) {
      return Response.json({ error: 'Venue not found' }, { status: 404 });
    }

    let created = 0;
    let updated = 0;
    const processedSources = [];

    // Helper to create or update knowledge entry
    async function createOrUpdateKnowledge(question, answer, category) {
      const existing = await base44.asServiceRole.entities.VenueKnowledge.filter({
        venue_id,
        question
      });

      const data = {
        venue_id,
        question,
        answer,
        category,
        is_active: true,
        source: 'manual',
        priority: 5
      };

      if (existing.length > 0) {
        await base44.asServiceRole.entities.VenueKnowledge.update(existing[0].id, data);
        updated++;
      } else {
        await base44.asServiceRole.entities.VenueKnowledge.create(data);
        created++;
      }
    }

    // Process venue_basics
    if (source === 'venue_basics' || source === 'all') {
      if (venue.location) {
        await createOrUpdateKnowledge(
          'Where are you located?',
          `We're located at ${venue.location}. We'd love to show you around in person!`,
          'faq'
        );
        await createOrUpdateKnowledge(
          'What is the venue address?',
          `Our venue is at ${venue.location}.`,
          'faq'
        );
      }

      if (venue.phone) {
        await createOrUpdateKnowledge(
          'What is your phone number?',
          `You can reach us at ${venue.phone}. We'd love to hear from you!`,
          'faq'
        );
      }

      if (venue.email && venue.phone) {
        await createOrUpdateKnowledge(
          'How do I contact you?',
          `You can reach us at ${venue.phone} or email us at ${venue.email}. We typically respond within 24 hours!`,
          'faq'
        );
      } else if (venue.email) {
        await createOrUpdateKnowledge(
          'What is your email?',
          `You can reach us at ${venue.email}. We typically respond within 24 hours!`,
          'faq'
        );
        await createOrUpdateKnowledge(
          'How do I contact you?',
          `You can reach us at ${venue.email}. We typically respond within 24 hours!`,
          'faq'
        );
      }

      processedSources.push('venue_basics');
    }

    // Process packages
    if (source === 'packages' || source === 'all') {
      const packages = await base44.asServiceRole.entities.VenuePackage.filter({
        venue_id,
        is_active: true
      });

      if (packages.length > 0) {
        const sortedPackages = packages.sort((a, b) => a.price - b.price);

        // What packages do you offer?
        const packageList = sortedPackages
          .map(pkg => `${pkg.name} (${pkg.max_guests} guests, $${pkg.price.toLocaleString()})`)
          .join(', ');
        await createOrUpdateKnowledge(
          'What packages do you offer?',
          `We offer ${packages.length} beautiful packages: ${packageList}. Each package is designed to create an unforgettable celebration!`,
          'pricing'
        );

        // Individual package entries
        for (const pkg of sortedPackages) {
          let answer = `The ${pkg.name} package is $${pkg.price.toLocaleString()} and accommodates up to ${pkg.max_guests} guests.`;
          if (pkg.description) {
            answer += ` ${pkg.description}`;
          }
          if (pkg.includes && pkg.includes.length > 0) {
            answer += ` It includes: ${pkg.includes.join(', ')}.`;
          }
          await createOrUpdateKnowledge(
            `Tell me about the ${pkg.name} package`,
            answer,
            'pricing'
          );
        }

        // How much does a wedding cost?
        const minPrice = sortedPackages[0].price;
        const maxPrice = sortedPackages[sortedPackages.length - 1].price;
        await createOrUpdateKnowledge(
          'How much does a wedding cost?',
          `Our wedding packages range from $${minPrice.toLocaleString()} to $${maxPrice.toLocaleString()}, depending on guest count and your vision. I'd recommend using our budget calculator to get a personalized estimate!`,
          'pricing'
        );

        // Most affordable option
        const cheapest = sortedPackages[0];
        await createOrUpdateKnowledge(
          'What is your most affordable option?',
          `Our most affordable package is the ${cheapest.name} at $${cheapest.price.toLocaleString()} for up to ${cheapest.max_guests} guests. It's perfect for intimate celebrations!`,
          'pricing'
        );

        processedSources.push('packages');
      }
    }

    // Process pricing
    if (source === 'pricing' || source === 'all') {
      const pricingConfigs = await base44.asServiceRole.entities.WeddingPricingConfiguration.filter({
        venue_id
      });

      if (pricingConfigs.length > 0) {
        await createOrUpdateKnowledge(
          'How does pricing work?',
          `Our pricing is customized based on your guest count, day of the week, and season. Use our budget calculator to get a personalized estimate for your dream wedding!`,
          'pricing'
        );

        await createOrUpdateKnowledge(
          'Are weekday weddings cheaper?',
          `Yes! Weekday weddings typically have more flexible pricing. Use our budget calculator to see the difference for your specific date and guest count.`,
          'pricing'
        );

        await createOrUpdateKnowledge(
          'Can I get a custom quote?',
          `Absolutely! Use our budget calculator to get an instant personalized estimate, or schedule a tour and we'll walk through all the details with you.`,
          'pricing'
        );

        processedSources.push('pricing');
      }
    }

    // Update VenueOnboardingProgress
    const progressRecords = await base44.asServiceRole.entities.VenueOnboardingProgress.filter({ venue_id });
    
    const totalKnowledge = await base44.asServiceRole.entities.VenueKnowledge.filter({ 
      venue_id, 
      is_active: true 
    });

    const progressData = {
      venue_id,
      knowledge_count: totalKnowledge.length
    };

    if (processedSources.includes('venue_basics')) {
      progressData.section_venue_basics = 'auto_complete';
    }
    if (processedSources.includes('packages')) {
      progressData.section_packages = 'auto_complete';
    }
    if (processedSources.includes('pricing')) {
      progressData.section_pricing = 'auto_complete';
    }

    if (progressRecords.length > 0) {
      await base44.asServiceRole.entities.VenueOnboardingProgress.update(
        progressRecords[0].id,
        progressData
      );
    } else {
      await base44.asServiceRole.entities.VenueOnboardingProgress.create(progressData);
    }

    return Response.json({
      success: true,
      created,
      updated,
      skipped: 0
    });

  } catch (error) {
    console.error('generateAutoKnowledge error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Failed to generate auto knowledge' 
    }, { status: 500 });
  }
});