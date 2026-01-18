import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { configId, venueBaseUp_to_2 } = await req.json();

    // Fetch the existing config
    const config = await base44.entities.WeddingPricingConfiguration.get(configId);

    // Update only venue_base.up_to_2
    const updatedPricingData = {
      ...config.pricing_data,
      venue_base: {
        ...config.pricing_data.venue_base,
        up_to_2: venueBaseUp_to_2
      }
    };

    // Update the record
    await base44.entities.WeddingPricingConfiguration.update(configId, {
      pricing_data: updatedPricingData
    });

    return Response.json({ success: true, message: 'Updated venue_base.up_to_2 successfully' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});