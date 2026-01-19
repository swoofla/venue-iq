import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      baseImageUrl,
      photoDescription,
      transformationHints,
      designChoices,
      provider = 'stability'
    } = await req.json();

    if (!baseImageUrl || !designChoices) {
      return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Build transformation prompt
    const prompt = buildTransformationPrompt(photoDescription, transformationHints, designChoices);
    console.log('Transformation prompt:', prompt);

    // Generate with Stability AI
    const result = await generateWithStability(baseImageUrl, prompt, designChoices);
    return Response.json(result);

  } catch (error) {
    console.error('generateVenueVisualization error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});

function buildTransformationPrompt(photoDescription, transformationHints, designChoices) {
  const { style, colorPalette, florals, lighting, tableSettings } = designChoices;

  const styleKeywords = {
    romantic: 'romantic elegant wedding decor, soft flowing fabrics, classic romance, dreamy atmosphere',
    rustic: 'rustic wedding decor, natural wood elements, greenery garlands, barn wedding style',
    modern: 'modern minimalist wedding decor, clean lines, geometric elements, contemporary',
    bohemian: 'bohemian wedding decor, macrame backdrops, pampas grass, eclectic, free-spirited',
    garden: 'garden party wedding decor, lush overflowing florals, outdoor elegance, whimsical',
    glamorous: 'glamorous luxury wedding decor, crystal accents, dramatic lighting, opulent, gold details',
    vintage: 'vintage wedding decor, antique charm, lace details, nostalgic beauty, soft pastels',
    coastal: 'coastal wedding decor, beach-inspired, airy natural textures, seaside elegance'
  };

  const colorKeywords = {
    blush_gold: 'blush pink and gold color scheme, white accents, romantic warm tones',
    sage_cream: 'sage green and cream colors, ivory accents, natural earth tones',
    dusty_blue: 'dusty blue and silver color palette, elegant cool tones',
    burgundy_navy: 'burgundy and navy color scheme, rich jewel tones, gold accents',
    terracotta: 'terracotta and rust colors, burnt orange, warm earth tones',
    lavender: 'lavender and purple color palette, soft violet tones',
    classic_white: 'classic white and green, timeless elegance, ivory and forest green',
    sunset: 'coral and peach colors, warm pink tones, golden yellow accents'
  };

  const floralKeywords = {
    lush_garden: 'lush overflowing garden roses, peonies, ranunculus, abundant blooms',
    wildflower: 'wildflower arrangements, natural loose florals, meadow flowers',
    tropical: 'tropical flowers, orchids, birds of paradise, monstera leaves',
    minimal_modern: 'minimal modern florals, single stem arrangements, architectural',
    dried_preserved: 'dried flowers, pampas grass, preserved arrangements, earth tones',
    greenery_focused: 'lush greenery garlands, eucalyptus, ferns, foliage-focused',
    classic_elegant: 'classic roses, hydrangeas, elegant traditional arrangements'
  };

  const lightingKeywords = {
    string_lights: 'romantic string lights, fairy lights, twinkling overhead, bistro lighting',
    candles: 'candlelit ambiance, pillar candles, votives, warm flickering candlelight',
    chandeliers: 'crystal chandeliers, elegant dramatic lighting fixtures, glamorous sparkle',
    lanterns: 'lanterns, moroccan-style lighting, bohemian atmospheric glow',
    natural: 'natural daylight, golden hour sunlight, sun-drenched atmosphere',
    edison_bulbs: 'edison bulb string lights, industrial vintage lighting, warm filament',
    mixed: 'mixed romantic lighting, candles and string lights, layered warm glow'
  };

  const tableKeywords = {
    round_elegant: 'round tables with fine china, elegant place settings, crystal glassware',
    long_feasting: 'long wooden feasting tables, family style, rustic communal dining',
    mixed_eclectic: 'mixed table sizes, eclectic varied seating arrangements',
    minimalist: 'minimalist modern table settings, clean simple elegance'
  };

  let prompt = `Transform this wedding venue photo: ${photoDescription || 'wedding venue space'}. `;
  prompt += `Add beautiful wedding decorations: ${transformationHints || 'add floral arrangements, table settings, and lighting'}. `;
  
  if (style && styleKeywords[style]) prompt += `Style: ${styleKeywords[style]}. `;
  if (colorPalette && colorKeywords[colorPalette]) prompt += `Colors: ${colorKeywords[colorPalette]}. `;
  if (florals && floralKeywords[florals]) prompt += `Florals: ${floralKeywords[florals]}. `;
  if (lighting && lightingKeywords[lighting]) prompt += `Lighting: ${lightingKeywords[lighting]}. `;
  if (tableSettings && tableKeywords[tableSettings]) prompt += `Tables: ${tableKeywords[tableSettings]}. `;

  prompt += `Professional wedding photography, editorial quality, photorealistic, beautifully decorated, magazine-worthy, 8K quality.`;

  return prompt;
}

async function generateWithStability(baseImageUrl, prompt, designChoices) {
  const STABILITY_API_KEY = Deno.env.get('STABILITY_API_KEY');
  
  if (!STABILITY_API_KEY) {
    throw new Error('STABILITY_API_KEY not configured. Add it to your Base44 Secrets.');
  }

  // Fetch base image and convert to base64
  const imageResponse = await fetch(baseImageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  if (!imageResponse.ok) {
    console.error('Failed to fetch image:', imageResponse.status, await imageResponse.text());
    throw new Error('Failed to fetch base image');
  }
  
  const imageBuffer = await imageResponse.arrayBuffer();
  const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

  const strength = designChoices.transformationStrength || 0.60;

  const response = await fetch(
    'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STABILITY_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        init_image: base64Image,
        init_image_mode: 'IMAGE_STRENGTH',
        image_strength: 1 - strength,
        text_prompts: [
          { text: prompt, weight: 1.0 },
          { text: 'blurry, low quality, distorted, unrealistic, cartoon, anime, people, guests', weight: -1.0 }
        ],
        cfg_scale: 7,
        samples: 1,
        steps: 40,
        style_preset: 'photographic'
      })
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 402) throw new Error('Insufficient Stability AI credits');
    throw new Error(`Stability API error: ${errorData?.message || response.status}`);
  }

  const data = await response.json();
  if (!data.artifacts || data.artifacts.length === 0) throw new Error('No image generated');

  return {
    success: true,
    imageUrl: `data:image/png;base64,${data.artifacts[0].base64}`,
    provider: 'stability',
    prompt: prompt
  };
}