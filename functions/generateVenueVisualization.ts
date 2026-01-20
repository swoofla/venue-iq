import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

// SDXL allowed dimensions (width x height)
const SDXL_DIMENSIONS = [
  { width: 1024, height: 1024, ratio: 1.0 },
  { width: 1152, height: 896, ratio: 1.286 },
  { width: 1216, height: 832, ratio: 1.462 },
  { width: 1344, height: 768, ratio: 1.75 },
  { width: 1536, height: 640, ratio: 2.4 },
  { width: 640, height: 1536, ratio: 0.417 },
  { width: 768, height: 1344, ratio: 0.571 },
  { width: 832, height: 1216, ratio: 0.684 },
  { width: 896, height: 1152, ratio: 0.778 },
];

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

// Find the best SDXL dimension for a given aspect ratio
function findBestDimension(width, height) {
  const aspectRatio = width / height;
  
  let bestMatch = SDXL_DIMENSIONS[0];
  let smallestDiff = Math.abs(aspectRatio - bestMatch.ratio);
  
  for (const dim of SDXL_DIMENSIONS) {
    const diff = Math.abs(aspectRatio - dim.ratio);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      bestMatch = dim;
    }
  }
  
  return bestMatch;
}

async function generateWithStability(baseImageUrl, prompt, designChoices) {
  const STABILITY_API_KEY = Deno.env.get('STABILITY_API_KEY');
  
  if (!STABILITY_API_KEY) {
    throw new Error('STABILITY_API_KEY not configured. Add it to your Base44 Secrets.');
  }

  console.log('[VenueVisualizer] Starting generation with URL:', baseImageUrl);

  try {
    // Fetch base image
    console.log('[VenueVisualizer] Fetching base image...');
    const imageResponse = await fetch(baseImageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error('[VenueVisualizer] Failed to fetch image. Status:', imageResponse.status, 'Error:', errorText);
      throw new Error(`Failed to fetch base image: ${imageResponse.status}`);
    }
    
    console.log('[VenueVisualizer] Image fetch successful. Content-Type:', imageResponse.headers.get('content-type'));
    
    const imageBuffer = await imageResponse.arrayBuffer();
    console.log(`[VenueVisualizer] Image buffer size: ${imageBuffer.byteLength} bytes`);

    // Decode image using imagescript (pure JS - works in Deno)
    console.log('[VenueVisualizer] Decoding image...');
    const image = await Image.decode(new Uint8Array(imageBuffer));
    const originalWidth = image.width;
    const originalHeight = image.height;
    
    console.log(`[VenueVisualizer] Original dimensions: ${originalWidth}x${originalHeight}`);
    
    // Find best matching SDXL dimension
    const targetDim = findBestDimension(originalWidth, originalHeight);
    console.log(`[VenueVisualizer] Target SDXL dimension: ${targetDim.width}x${targetDim.height}`);
    
    // Resize image using cover fit (resize + crop to fill)
    const scaleX = targetDim.width / originalWidth;
    const scaleY = targetDim.height / originalHeight;
    const scale = Math.max(scaleX, scaleY);
    
    const scaledWidth = Math.round(originalWidth * scale);
    const scaledHeight = Math.round(originalHeight * scale);
    
    console.log('[VenueVisualizer] Resizing to:', scaledWidth, 'x', scaledHeight);
    image.resize(scaledWidth, scaledHeight);
    
    const cropX = Math.round((scaledWidth - targetDim.width) / 2);
    const cropY = Math.round((scaledHeight - targetDim.height) / 2);
    console.log('[VenueVisualizer] Cropping at:', cropX, cropY);
    image.crop(cropX, cropY, targetDim.width, targetDim.height);
    
    console.log('[VenueVisualizer] Encoding resized image...');
    const resizedBuffer = await image.encode();
    
    console.log(`[VenueVisualizer] Resized image encoded: ${resizedBuffer.length} bytes`);
  } catch (imageError) {
    console.error('[VenueVisualizer] Image processing error:', imageError.message, imageError.stack);
    throw new Error(`Image processing failed: ${imageError.message}`);
  }

  const strength = designChoices.transformationStrength || 0.60;
  const imageStrength = 1 - strength;

  console.log('Calling Stability AI with image_strength:', imageStrength);

  // Create FormData for multipart/form-data request
  const formData = new FormData();
  
  // Add the resized image as a Blob
  const imageBlob = new Blob([resizedBuffer], { type: 'image/png' });
  formData.append('init_image', imageBlob, 'image.png');
  
  // Add other parameters
  formData.append('init_image_mode', 'IMAGE_STRENGTH');
  formData.append('image_strength', imageStrength.toString());
  formData.append('text_prompts[0][text]', prompt);
  formData.append('text_prompts[0][weight]', '1');
  formData.append('text_prompts[1][text]', 'blurry, low quality, distorted, unrealistic, cartoon, anime, people, guests');
  formData.append('text_prompts[1][weight]', '-1');
  formData.append('cfg_scale', '7');
  formData.append('samples', '1');
  formData.append('steps', '40');
  formData.append('style_preset', 'photographic');

  console.log('[VenueVisualizer] Sending request to Stability AI...');
  
  const response = await fetch(
    'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STABILITY_API_KEY}`,
        'Accept': 'application/json',
      },
      body: formData
    }
  );

  console.log('[VenueVisualizer] Stability AI response status:', response.status);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[VenueVisualizer] Stability AI error:', errorData);
    if (response.status === 402) throw new Error('Insufficient Stability AI credits');
    if (response.status === 400) throw new Error(`Stability API bad request: ${JSON.stringify(errorData)}`);
    if (response.status === 401) throw new Error('Invalid Stability API key');
    throw new Error(`Stability API error: ${errorData?.message || response.status}`);
  }

  console.log('[VenueVisualizer] Parsing Stability AI response...');
  const data = await response.json();
  
  if (!data.artifacts || data.artifacts.length === 0) {
    console.error('[VenueVisualizer] No artifacts in response:', data);
    throw new Error('No image generated');
  }

  console.log('[VenueVisualizer] Image generated successfully');

  return {
    success: true,
    imageUrl: `data:image/png;base64,${data.artifacts[0].base64}`,
    provider: 'stability',
    prompt: prompt,
    dimensions: `${targetDim.width}x${targetDim.height}`
  };
}