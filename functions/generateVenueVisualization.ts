// generateVenueVisualization.js - v3 with Inpainting + Masking Support
// 
// This version uses Stability AI's inpainting endpoint when a mask is provided,
// which forces all edits into the ceremony zone while protecting the background.
//
// USAGE:
// - If maskImageUrl is provided: Uses inpainting (best results)
// - If no mask: Falls back to img2img with structured prompts

import { encodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";
import * as imagescript from "https://deno.land/x/imagescript@1.2.15/mod.ts";

Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log('=== generateVenueVisualization v3 (Inpainting) START ===');

  try {
    const { 
      baseImageUrl,
      maskImageUrl,
      photoDescription,
      transformationHints,
      designChoices
    } = await req.json();

    if (!baseImageUrl || !designChoices) {
      return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const STABILITY_API_KEY = Deno.env.get('STABILITY_API_KEY');
    if (!STABILITY_API_KEY) {
      return Response.json({ success: false, error: 'Stability API key not configured' }, { status: 500 });
    }

    // Build the prompt
    const prompt = buildInpaintingPrompt(photoDescription, transformationHints, designChoices);
    console.log('=== PROMPT ===');
    console.log(prompt);
    console.log('==============');

    // Determine which mode to use
    const useInpainting = !!maskImageUrl;
    console.log(`Mode: ${useInpainting ? 'INPAINTING (with mask)' : 'IMG2IMG (no mask)'}`);

    // Fetch and process the base image
    console.log('Fetching base image...');
    const imageResponse = await fetch(baseImageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch base image: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBytes = new Uint8Array(imageBuffer);

    // Resize to valid SDXL dimensions
    console.log('Processing base image...');
    const image = await imagescript.decode(imageBytes);
    const aspectRatio = image.width / image.height;
    
    let targetWidth, targetHeight;
    if (aspectRatio > 1.3) {
      targetWidth = 1216;
      targetHeight = 832;
    } else if (aspectRatio < 0.77) {
      targetWidth = 832;
      targetHeight = 1216;
    } else {
      targetWidth = 1024;
      targetHeight = 1024;
    }
    
    image.resize(targetWidth, targetHeight);
    const resizedImageBytes = await image.encode(1);
    const base64Image = encodeBase64(resizedImageBytes);
    console.log(`Base image: ${targetWidth}x${targetHeight}`);

    // Process mask if provided
    let base64Mask = null;
    if (useInpainting) {
      console.log('Fetching mask image...');
      const maskResponse = await fetch(maskImageUrl);
      if (!maskResponse.ok) {
        console.warn(`Failed to fetch mask: ${maskResponse.status}, falling back to img2img`);
      } else {
        const maskBuffer = await maskResponse.arrayBuffer();
        const maskBytes = new Uint8Array(maskBuffer);
        
        const maskImage = await imagescript.decode(maskBytes);
        maskImage.resize(targetWidth, targetHeight);
        const resizedMaskBytes = await maskImage.encode(1);
        base64Mask = encodeBase64(resizedMaskBytes);
        console.log(`Mask image: ${targetWidth}x${targetHeight}`);
      }
    }

    // Determine strength
    const strengthMap = {
      'subtle': 0.55,
      'balanced': 0.70,
      'dramatic': 0.85
    };
    const strength = strengthMap[designChoices.transformationStrength] || 0.70;
    console.log(`Transformation strength: ${strength}`);

    // Convert base64 to blobs
    const imageBlob = base64ToBlob(base64Image, 'image/png');
    
    let result;
    if (base64Mask) {
      // ============================================
      // INPAINTING MODE (with mask)
      // ============================================
      console.log('Using INPAINTING endpoint...');
      
      const maskBlob = base64ToBlob(base64Mask, 'image/png');
      
      const formData = new FormData();
      formData.append('init_image', imageBlob, 'venue.png');
      formData.append('mask_image', maskBlob, 'mask.png');
      formData.append('mask_source', 'MASK_IMAGE_WHITE');
      formData.append('text_prompts[0][text]', prompt);
      formData.append('text_prompts[0][weight]', '1');
      formData.append('text_prompts[1][text]', buildNegativePrompt());
      formData.append('text_prompts[1][weight]', '-1');
      formData.append('cfg_scale', '8');
      formData.append('samples', '1');
      formData.append('steps', '40');

      const response = await fetch(
        'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image/masking',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${STABILITY_API_KEY}`,
            'Accept': 'application/json'
          },
          body: formData
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Stability Inpaint API error:', response.status, errorText);
        throw new Error(`Stability API error: ${response.status} - ${errorText}`);
      }

      result = await response.json();
      
    } else {
      // ============================================
      // IMG2IMG MODE (fallback, no mask)
      // ============================================
      console.log('Using IMG2IMG endpoint (no mask provided)...');
      
      const imageStrength = 1 - strength;
      
      const formData = new FormData();
      formData.append('init_image', imageBlob, 'venue.png');
      formData.append('init_image_mode', 'IMAGE_STRENGTH');
      formData.append('image_strength', imageStrength.toString());
      formData.append('text_prompts[0][text]', prompt);
      formData.append('text_prompts[0][weight]', '1');
      formData.append('text_prompts[1][text]', buildNegativePrompt());
      formData.append('text_prompts[1][weight]', '-1');
      formData.append('cfg_scale', '8');
      formData.append('samples', '1');
      formData.append('steps', '35');

      const response = await fetch(
        'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${STABILITY_API_KEY}`,
            'Accept': 'application/json'
          },
          body: formData
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Stability IMG2IMG API error:', response.status, errorText);
        throw new Error(`Stability API error: ${response.status} - ${errorText}`);
      }

      result = await response.json();
    }

    if (!result.artifacts || result.artifacts.length === 0) {
      throw new Error('No image generated');
    }

    const generatedBase64 = result.artifacts[0].base64;
    const totalTime = Date.now() - startTime;
    console.log(`=== SUCCESS in ${totalTime}ms ===`);

    return Response.json({
      success: true,
      image: `data:image/png;base64,${generatedBase64}`,
      mode: base64Mask ? 'inpainting' : 'img2img'
    });

  } catch (error) {
    console.error('generateVenueVisualization error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});

// ============================================
// HELPER: Base64 to Blob
// ============================================
function base64ToBlob(base64, mimeType) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

// ============================================
// INPAINTING-OPTIMIZED PROMPT BUILDER
// ============================================
function buildInpaintingPrompt(photoDescription, transformationHints, designChoices) {
  const { style, colorPalette, florals, lighting } = designChoices;

  const STYLE_DECOR = {
    romantic: 'romantic wedding arch with flowing sheer fabric draping and cascading floral arrangements, rose petals on the ground, elegant floral aisle markers, soft dreamy wedding decorations',
    rustic: 'rustic wooden wedding arch with greenery garlands and wildflowers, burlap accents, mason jar arrangements, natural branch elements, woodland wedding decorations',
    modern: 'sleek geometric metal wedding arch with minimalist floral accents, modern sculptural arrangements, clean contemporary wedding decorations',
    bohemian: 'macramé wedding arch backdrop with pampas grass and dried flowers, eclectic bohemian decorations, woven textiles, feather accents',
    garden: 'lush floral garden arch overflowing with roses and hydrangeas, abundant ground arrangements, romantic garden wedding decorations',
    glamorous: 'dramatic tall wedding arch with cascading white orchids and crystal accents, mirrored elements, luxury floral pedestals, opulent wedding decorations',
    vintage: 'antique-style wedding arch with vintage lace and old garden roses, antique lanterns, heirloom-inspired wedding decorations',
    coastal: 'driftwood wedding arch with flowing white fabric, tropical greenery, seashell accents, beach-inspired wedding decorations'
  };

  const COLOR_PALETTES = {
    blush_gold: 'soft blush pink, champagne gold, ivory white flowers and fabrics',
    sage_cream: 'sage green, soft cream, natural ivory tones',
    dusty_blue: 'dusty blue, silver gray, crisp white accents',
    burgundy_navy: 'deep burgundy, navy blue, gold accent colors',
    terracotta: 'terracotta orange, rust brown, warm earth tones',
    lavender: 'soft lavender, purple, dusty mauve colors',
    classic_white: 'pure white, fresh green, classic ivory palette',
    sunset: 'coral orange, soft pink, golden yellow warm tones'
  };

  const FLORAL_STYLES = {
    lush_garden: 'abundant overflowing garden roses, peonies, ranunculus',
    wildflower: 'natural wildflower mix, loose unstructured arrangements',
    minimal_modern: 'architectural single stem flowers, calla lilies, orchids',
    dried_preserved: 'dried flowers, pampas grass, preserved botanicals',
    greenery_focused: 'lush eucalyptus, ferns, olive branches, foliage',
    classic_elegant: 'classic roses, hydrangeas, traditional arrangements'
  };

  const LIGHTING_ADDITIONS = {
    string_lights: 'with romantic string lights and fairy light accents',
    candles: 'with pillar candles and warm candlelight ambiance',
    chandeliers: 'with elegant crystal chandelier elements',
    lanterns: 'with decorative lanterns and moroccan-style lighting',
    natural: 'in beautiful natural daylight',
    mixed: 'with romantic candles and string light accents'
  };

  const decorStyle = STYLE_DECOR[style] || STYLE_DECOR.romantic;
  const colors = COLOR_PALETTES[colorPalette] || COLOR_PALETTES.classic_white;
  const flowers = FLORAL_STYLES[florals] || FLORAL_STYLES.classic_elegant;
  const lightingAccent = LIGHTING_ADDITIONS[lighting] || LIGHTING_ADDITIONS.natural;

  const prompt = `Beautiful wedding ceremony decorations: ${decorStyle}. 
Colors: ${colors}. 
Florals: ${flowers}. 
${lightingAccent}.
Professional wedding photography, photorealistic, magazine quality, natural shadows, realistic scale.`;

  return prompt;
}

// ============================================
// NEGATIVE PROMPT
// ============================================
function buildNegativePrompt() {
  return `blurry, distorted, low quality, cartoon, anime, illustration, painting, 
sketch, unrealistic, artificial, oversaturated, 
people, guests, bride, groom, crowd,
text, watermark, logo, signature,
floating objects, impossible physics, wrong scale`;
}