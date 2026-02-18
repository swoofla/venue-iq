import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { venue_id, section_id, answers, regenerate = false } = await req.json();

    if (!venue_id || !section_id || !answers) {
      return Response.json({ 
        error: 'Missing required fields: venue_id, section_id, answers' 
      }, { status: 400 });
    }

    const validSections = ['spaces', 'policies', 'faq', 'personality'];
    if (!validSections.includes(section_id)) {
      return Response.json({ 
        error: 'Invalid section_id. Must be one of: spaces, policies, faq, personality' 
      }, { status: 400 });
    }

    // Fetch venue
    const venue = await base44.asServiceRole.entities.Venue.get(venue_id);
    if (!venue) {
      return Response.json({ error: 'Venue not found' }, { status: 404 });
    }

    const venueName = venue.name || 'the venue';
    const conciergeName = 'our AI concierge';

    // Map section to category
    const categoryMap = {
      'spaces': 'amenities',
      'policies': 'policy',
      'faq': 'faq',
      'personality': 'other'
    };
    const category = categoryMap[section_id];

    // If regenerate, delete existing knowledge for this category
    if (regenerate) {
      const existingKnowledge = await base44.asServiceRole.entities.VenueKnowledge.filter({
        venue_id,
        category
      });
      
      for (const entry of existingKnowledge) {
        await base44.asServiceRole.entities.VenueKnowledge.delete(entry.id);
      }
    }

    // Build formatted answers string
    const formattedAnswers = Object.entries(answers)
      .filter(([_, value]) => value && String(value).trim())
      .map(([question_id, answer]) => `${question_id}: ${answer}`)
      .join('\n\n');

    if (!formattedAnswers.trim()) {
      return Response.json({ 
        success: true, 
        created: 0, 
        skipped: 0, 
        total: 0,
        message: 'No answers provided to process'
      });
    }

    // Call LLM
    const prompt = `You are helping build a knowledge base for "${venueName}", a wedding venue.
The venue's AI concierge is named "${conciergeName}".

Based on the venue owner's answers below, generate Q&A pairs that the AI chatbot can use to answer bride/couple questions accurately and warmly.

CRITICAL RULES:
1. ONLY use information explicitly provided in the answers below. Do NOT invent specific prices, capacities, dates, percentages, or any factual details not mentioned.
2. If the venue owner gave a vague answer, keep the bot response appropriately vague — say "Please reach out to us for specific details" rather than making up numbers.
3. Write answers in a warm, professional tone as if a friendly wedding planner is talking to an excited bride. Use "we" and "our" (speaking as the venue).
4. Generate 2-5 Q&A pairs per topic covered. Think about different ways brides might ask the same question.
5. Keep answers concise (2-4 sentences max).
6. Each answer should stand alone — don't reference other Q&A pairs.

VENUE OWNER'S ANSWERS:
${formattedAnswers}

Generate the Q&A pairs now.`;

    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          qa_pairs: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                answer: { type: "string" },
                category: { 
                  type: "string", 
                  enum: ["faq", "policy", "pricing", "amenities", "other"] 
                }
              },
              required: ["question", "answer", "category"]
            }
          }
        },
        required: ["qa_pairs"]
      }
    });

    const qaPairs = llmResponse.qa_pairs || [];
    let created = 0;
    let skipped = 0;

    // Anti-hallucination check and save
    for (const pair of qaPairs) {
      const answer = pair.answer || '';
      
      // Check for hallucinated numbers
      const dollarAmounts = answer.match(/\$[\d,]+/g) || [];
      const percentages = answer.match(/\d+%/g) || [];
      const capacityNumbers = answer.match(/\d+\s*(guests?|people|cars?)/gi) || [];
      
      let isHallucinated = false;
      
      // Check if these numbers appear in original answers
      for (const amount of dollarAmounts) {
        if (!formattedAnswers.includes(amount)) {
          isHallucinated = true;
          break;
        }
      }
      
      for (const pct of percentages) {
        if (!formattedAnswers.includes(pct)) {
          isHallucinated = true;
          break;
        }
      }
      
      for (const cap of capacityNumbers) {
        const numberMatch = cap.match(/\d+/);
        if (numberMatch && !formattedAnswers.includes(numberMatch[0])) {
          isHallucinated = true;
          break;
        }
      }

      if (isHallucinated) {
        skipped++;
        continue;
      }

      // Save valid Q&A
      await base44.asServiceRole.entities.VenueKnowledge.create({
        venue_id,
        question: pair.question,
        answer: pair.answer,
        category: pair.category,
        is_active: true,
        source: 'manual',
        priority: 5
      });
      
      created++;
    }

    // Update or create VenueOnboardingProgress
    const progressRecords = await base44.asServiceRole.entities.VenueOnboardingProgress.filter({ venue_id });
    
    const totalKnowledge = await base44.asServiceRole.entities.VenueKnowledge.filter({ 
      venue_id, 
      is_active: true 
    });

    const progressData = {
      venue_id,
      [`section_${section_id}`]: 'complete',
      [`answers_${section_id}`]: answers,
      knowledge_generated_at: new Date().toISOString(),
      knowledge_count: totalKnowledge.length
    };

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
      skipped,
      total: qaPairs.length
    });

  } catch (error) {
    console.error('processOnboardingAnswers error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Failed to process onboarding answers' 
    }, { status: 500 });
  }
});