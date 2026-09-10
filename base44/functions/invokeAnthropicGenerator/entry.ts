import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-sonnet-5';
const TIMEOUT_MS = 60000;
const MAX_TOKENS = 2000;

const REPLY_TOOL = {
  name: 'reply',
  description: 'Return the virtual planner reply as structured fields.',
  input_schema: {
    type: 'object',
    properties: {
      needsHandoff: { type: 'boolean' },
      topicSummary: {
        type: 'string',
        description: "A SHORT noun phrase (2-4 words) naming the subject of the handoff. Never a full sentence. No trailing punctuation. Lowercase unless a proper noun."
      },
      acknowledgment: { type: 'string' },
      answer: { type: 'string' }
    },
    required: ['needsHandoff', 'answer']
  }
};

Deno.serve(async (req) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      console.error('[anthropic-generator] ANTHROPIC_API_KEY is not set in the environment');
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    const body = await req.json();
    const prompt = body?.prompt;
    if (typeof prompt !== 'string' || !prompt.trim()) {
      console.error('[anthropic-generator] missing or empty prompt in request body');
      return Response.json({ error: 'prompt is required' }, { status: 400 });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const t0 = Date.now();
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          tools: [REPLY_TOOL],
          tool_choice: { type: 'tool', name: 'reply' },
          messages: [{ role: 'user', content: prompt }]
        })
      });
    } finally {
      clearTimeout(timer);
    }

    const elapsed = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text();
      console.error('[anthropic-generator] HTTP', res.status, 'after', elapsed, 'ms:', errText.slice(0, 600));
      return Response.json({ error: 'Anthropic HTTP ' + res.status }, { status: 502 });
    }

    const payload = await res.json();
    const toolBlock = (payload.content || []).find((b) => b.type === 'tool_use');

    if (!toolBlock || !toolBlock.input) {
      console.error(
        '[anthropic-generator] no tool_use block returned. stop_reason:',
        payload.stop_reason,
        '| content block types:',
        (payload.content || []).map((b) => b.type).join(',')
      );
      return Response.json({ error: 'no structured output returned' }, { status: 502 });
    }

    console.log(
      '[anthropic-generator] ok in', elapsed, 'ms | model:', MODEL,
      '| input_tokens:', payload.usage?.input_tokens,
      '| output_tokens:', payload.usage?.output_tokens,
      '| stop_reason:', payload.stop_reason
    );

    return Response.json({ result: toolBlock.input });
  } catch (error) {
    console.error('[anthropic-generator] threw:', error?.name, '-', error?.message);
    return Response.json({ error: error?.message || 'unknown error' }, { status: 500 });
  }
});