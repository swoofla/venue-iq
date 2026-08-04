import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const VALID_TOPICS = [
  'packages_pricing','capacity_guests','alcohol_bar','catering',
  'ceremony_spaces','reception_spaces','amenities','rules_policies',
  'payment_deposits','vendors','lodging','availability_dates','getting_ready'
];

const TOPIC_TO_CATEGORY = {
  packages_pricing: 'pricing',
  capacity_guests: 'capacity',
  alcohol_bar: 'policy',
  catering: 'faq',
  ceremony_spaces: 'ceremony_spaces',
  reception_spaces: 'amenities',
  amenities: 'amenities',
  rules_policies: 'policy',
  payment_deposits: 'pricing',
  vendors: 'vendor_info',
  lodging: 'lodging',
  availability_dates: 'seasonal',
  getting_ready: 'amenities'
};

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string', enum: VALID_TOPICS },
          question: { type: 'string' },
          answer: { type: 'string' },
          confidence: { type: 'number' },
          source_excerpt: { type: 'string' }
        },
        required: ['topic','question','answer']
      }
    }
  }
};

const EXTRACTION_PROMPT = `You are reading a wedding venue's own pricing or information document. Extract the facts a bride would ask about, and write each as a question-and-answer pair the venue's chatbot could use.

For each fact you extract:
- Choose the single best matching topic from the allowed list.
- Write "question" the way a bride would actually ask it, in plain language.
- Write "answer" as a warm, direct reply that states the fact plainly. Include real numbers exactly as the document gives them.
- Set "source_excerpt" to the short passage from the document that the fact came from, so a human can verify it.
- Set "confidence" between 0 and 1. Use 0.9+ only when the document states the fact outright. Use 0.5 or below for anything you inferred.

CRITICAL RULES:
- Extract ONLY what the document actually says. Never invent a price, capacity, date, name, address, or policy that is not written there.
- If the document is ambiguous, extract the fact with low confidence and quote the ambiguous passage in source_excerpt rather than resolving it yourself.
- Pay special attention to what the document says is NOT included, NOT allowed, or NOT available. Those exclusions are as important as the inclusions and are frequently what a chatbot gets wrong.
- Do not merge several distinct facts into one entry. One fact per entry.
- Returning fewer entries is always better than returning invented ones. An empty array is acceptable.
- Documents can be out of date. Extract what it says; a human will verify.`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { venue_id, file_url, document_name } = await req.json();
    if (!venue_id || !file_url) {
      return Response.json({ error: 'Missing required fields: venue_id, file_url' }, { status: 400 });
    }

    // ExtractDataFromUploadedFile accepts no prompt, so the anti-invention and
    // exclusion-capture rules in EXTRACTION_PROMPT would never reach the model.
    // Route through InvokeLLM instead so the document is read under those rules.
    let extraction;
    try {
      extraction = await base44.integrations.Core.InvokeLLM({
        prompt: EXTRACTION_PROMPT,
        file_urls: [file_url],
        response_json_schema: EXTRACTION_SCHEMA
      });
    } catch (err) {
      console.error('Document extraction failed:', err?.message || err);
      return Response.json({
        error: 'Could not read that document',
        detail: err?.message || 'The file could not be parsed. PDFs work best — if this is a Word or Google Doc, export it as a PDF and try again.'
      }, { status: 422 });
    }

    const raw = extraction?.entries || extraction?.output?.entries || [];
    if (!Array.isArray(raw)) {
      return Response.json({ error: 'Unexpected extraction shape', detail: JSON.stringify(extraction).slice(0, 500) }, { status: 500 });
    }

    const existing = await base44.asServiceRole.entities.VenueKnowledge.filter({ venue_id });
    const existingQuestions = new Set(existing.map(r => (r.question || '').trim().toLowerCase()));

    let created = 0;
    let skipped = 0;
    const byTopic = {};

    for (const e of raw) {
      if (!e || !e.question || !e.answer) { skipped++; continue; }
      if (!VALID_TOPICS.includes(e.topic)) { skipped++; continue; }

      const key = e.question.trim().toLowerCase();
      if (existingQuestions.has(key)) { skipped++; continue; }
      existingQuestions.add(key);

      await base44.asServiceRole.entities.VenueKnowledge.create({
        venue_id,
        question: e.question,
        answer: e.answer,
        topic: e.topic,
        category: TOPIC_TO_CATEGORY[e.topic] || 'faq',
        priority: 5,
        tags: document_name ? [`from:${document_name}`] : [],
        source: 'imported',
        confidence: typeof e.confidence === 'number' ? e.confidence : null,
        needs_review: true,
        is_active: false
      });

      created++;
      byTopic[e.topic] = (byTopic[e.topic] || 0) + 1;
    }

    const topicsFound = Object.keys(byTopic);
    const topicsMissing = VALID_TOPICS.filter(t => !topicsFound.includes(t));

    return Response.json({
      success: true,
      created,
      skipped,
      byTopic,
      topicsFound,
      topicsMissing,
      document_name: document_name || null
    });

  } catch (error) {
    console.error('processVenueDocument error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
});