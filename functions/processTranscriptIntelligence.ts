import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const PASS_PROMPTS = {
  pricing: `You are a wedding venue intelligence analyst. Extract ALL pricing from these venue conversations.
- Extract every price point, fee, add-on, and package price with their CONDITIONS (season, day, guest count)
- Flag instances where a prospect was CONFUSED about pricing
- Note upsell patterns
- Include minor add-on fees that come up repeatedly (tableware, extra hours, corkage)
- Set category to "pricing" for straightforward prices, "pricing_nuance" for confusion risks or conditional pricing
- Set priority 9-10 for core packages, 7-8 for common add-ons, 5-6 for edge cases
- Write the "answer" as a warm chatbot response to a bride asking about this

Transcript:
`,

  capacity: `You are a wedding venue intelligence analyst. Extract everything about CAPACITY LIMITS and OBJECTION HANDLING.
- Hard capacity limits and any exceptions being explored
- Conversations where prospects wanted more guests than allowed — what was the venue's response?
- Workarounds mentioned (tent expansion, outdoor space, attendance rate talking points)
- Overage fees
- Other common objections (price, location, dates) and how the venue handles them
- Set category to "capacity" for limit facts, "objection_handling" for response strategies
- Priority 10 for hard limits, 8-9 for workarounds, 7 for other objections
- Write answers that acknowledge concerns warmly then give facts and workarounds

Transcript:
`,

  policies: `You are a wedding venue intelligence analyst. Extract POLICIES, REQUIREMENTS, and SALES PROCESS.
- Booking policies (first-come first-served? deposits? contracts?)
- Mandatory packages for certain dates (e.g., planning package required for peak Saturdays)
- Payment terms and schedules
- Tour booking process (pre-tour phone call? arrival experience? drinks offered?)
- Follow-up cadence and messaging
- Date hold policy
- Vendor policies (BYO alcohol, preferred vendors)
- Venue access timeline (hours of access, event window, setup/teardown)
- Set category to "policy" for rules, "sales_workflow" for process/cadence
- Priority 10 for mandatory requirements, 8 for booking process, 6 for nice-to-know

Transcript:
`,

  amenities: `You are a wedding venue intelligence analyst. Extract VENUE DETAILS and PHYSICAL FEATURES.
- Every ceremony location option, which is most popular and why
- Reception areas (indoor/outdoor, layout, capacity)
- Lodging (cabins, cottages, rooms — count, inclusions, pricing)
- Grounds features (lake, forest, gardens, unique features)
- Venue history or backstory
- Address and arrival directions
- What's provided vs. what couples rent
- Weather/seasonal considerations and indoor backup options
- Set category to "ceremony_spaces", "amenities", "lodging", or "location_directions"
- Priority 8 for ceremony spaces, 6-7 for others
- Write answers that paint a visual picture for brides

Transcript:
`,

  brand_voice: `You are a wedding venue intelligence analyst. Analyze HOW the venue team communicates — not what they say, but their style.
- Greeting patterns (first name? formal? emoji?)
- Affirmation words ("Of course!", "Absolutely!", "Love that!")
- Emoji usage patterns — which ones, how often, in what context
- Closing phrases, especially when leads go cold
- Warmth signals (congratulations, excitement, empathy)
- Follow-up tone changes over time
- Hospitality rituals (offering drinks at tours, etc.)
- Format each entry as: question = "Brand Voice: [aspect]", answer = a RULE the chatbot should follow
- All entries category "brand_voice", priority 9 for core elements, 7 for secondary

Transcript:
`,

  handoff: `You are a wedding venue intelligence analyst. Identify topics where the CHATBOT SHOULD NOT ANSWER and must hand off to a human.
- Complex pricing that could be explained wrong
- Custom requests outside standard packages
- Emotionally sensitive situations
- Contract, deposit, or refund discussions
- Specific vendor coordination
- Capacity exception requests
- Date conflicts between multiple couples
- Budget concerns (needs human sales skill)
- For each: question = the situation type, answer = what the bot should say BEFORE handing off
- All entries category "human_handoff", priority 10

Transcript:
`
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
          category: { type: "string" },
          priority: { type: "number" },
          tags: { type: "array", items: { type: "string" } },
          confidence: { type: "number" }
        },
        required: ["question", "answer", "category"]
      }
    }
  }
};

function calculateSimilarity(question1, question2) {
  const words1 = new Set(question1.toLowerCase().split(/\s+/));
  const words2 = new Set(question2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { venue_id, transcript, pass } = await req.json();

    if (!venue_id || !transcript || !pass) {
      return Response.json({ 
        error: 'Missing required fields: venue_id, transcript, pass' 
      }, { status: 400 });
    }

    if (!PASS_PROMPTS[pass]) {
      return Response.json({ 
        error: `Invalid pass. Must be one of: ${Object.keys(PASS_PROMPTS).join(', ')}` 
      }, { status: 400 });
    }

    // Call LLM with pass-specific prompt
    const prompt = PASS_PROMPTS[pass] + transcript;
    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: RESPONSE_SCHEMA
    });

    const entries = llmResponse.entries || [];

    // Fetch existing knowledge for duplicate detection
    const existingKnowledge = await base44.asServiceRole.entities.VenueKnowledge.filter({
      venue_id
    });

    let saved = 0;
    let skipped_duplicates = 0;

    // Process each extracted entry
    for (const entry of entries) {
      // Check for duplicates
      let isDuplicate = false;
      for (const existing of existingKnowledge) {
        if (existing.category === entry.category) {
          const similarity = calculateSimilarity(existing.question, entry.question);
          if (similarity > 0.85) {
            isDuplicate = true;
            skipped_duplicates++;
            break;
          }
        }
      }

      if (!isDuplicate) {
        const needsReview = (entry.confidence !== undefined && entry.confidence < 0.8);
        
        await base44.asServiceRole.entities.VenueKnowledge.create({
          venue_id,
          question: entry.question,
          answer: entry.answer,
          category: entry.category,
          priority: entry.priority || 5,
          tags: entry.tags || [],
          source: 'transcript',
          confidence: entry.confidence || null,
          needs_review: needsReview,
          is_active: !needsReview
        });

        saved++;
      }
    }

    return Response.json({
      success: true,
      pass,
      extracted: entries.length,
      saved,
      skipped_duplicates
    });

  } catch (error) {
    console.error('Error processing transcript:', error);
    return Response.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});