// generateVenueVisualization.js - v2 with Spatially-Anchored Prompts
// This version fixes the "minimal changes" problem by using structured edit instructions
// instead of tag-soup prompts, and explicitly anchors decorations to visible geometry.

import { encodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";
import * as imagescript from "https://deno.land/x/imagescript@1.2.15/mod.ts";

Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log('=== generateVenueVisualization v2 START ===');

  try {
    const { 
      baseImageUrl,
      photoDescription,
      transformationHints,
      designChoices
    } = await req.json();

    if (!baseImageUrl || !designChoices) {
      return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Get API key
    const STABILITY_API_KEY = Deno.env.get('STABILITY_API_KEY');
    if (!STABILITY_API_KEY) {
      return Response.json({ success: false, error: 'Stability API key not configured' }, { status: 500 });
    }

    // Build the improved prompt
    const prompt = buildSpatiallyAnchoredPrompt(photoDescription, transformationHints, designChoices);
    console.log('=== PROMPT ===');
    console.log(prompt);
    console.log('==============');

    // Fetch and process the base image
    console.log('Fetching base image...');
    const imageResponse = await fetch(baseImageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch base image: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBytes = new Uint8Array(imageBuffer);

    // Resize to valid dimensions for Stability AI
    console.log('Resizing image...');
    const image = await imagescript.decode(imageBytes);
    const aspectRatio = image.width / image.height;
    
    // SDXL valid dimensions (must be multiples of 64)
    let targetWidth, targetHeight;
    if (aspectRatio > 1.3) {
      // Landscape
      targetWidth = 1216;
      targetHeight = 832;
    } else if (aspectRatio < 0.77) {
      // Portrait
      targetWidth = 832;
      targetHeight = 1216;
    } else {
      // Square-ish
      targetWidth = 1024;
      targetHeight = 1024;
    }
    
    image.resize(targetWidth, targetHeight);
    const resizedImageBytes = await image.encode(1); // PNG format
    const base64Image = encodeBase64(resizedImageBytes);

    // Determine strength from user selection
    const strengthMap = {
      'subtle': 0.50,      // More change than before (was 0.45)
      'balanced': 0.65,    // More change than before (was 0.60)
      'dramatic': 0.80     // More change than before (was 0.75)
    };
    const strength = strengthMap[designChoices.transformationStrength] || 0.65;
    
    // Stability API uses image_strength (inverse of denoising strength)
    // Lower image_strength = MORE changes
    const imageStrength = 1 - strength;
    console.log(`Transformation strength: ${strength} → image_strength: ${imageStrength}`);

    // Build FormData for Stability AI
    const formData = new FormData();
    
    // Convert base64 to blob
    const binaryString = atob(base64Image);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const imageBlob = new Blob([bytes], { type: 'image/png' });
    
    formData.append('init_image', imageBlob, 'venue.png');
    formData.append('init_image_mode', 'IMAGE_STRENGTH');
    formData.append('image_strength', imageStrength.toString());
    formData.append('text_prompts[0][text]', prompt);
    formData.append('text_prompts[0][weight]', '1');
    
    // Negative prompt - things to avoid
    const negativePrompt = buildNegativePrompt();
    formData.append('text_prompts[1][text]', negativePrompt);
    formData.append('text_prompts[1][weight]', '-1');
    
    formData.append('cfg_scale', '8');  // Slightly higher for better prompt adherence
    formData.append('samples', '1');
    formData.append('steps', '35');     // More steps for better quality

    // Call Stability AI
    console.log('Calling Stability AI...');
    const stabilityResponse = await fetch(
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

    if (!stabilityResponse.ok) {
      const errorText = await stabilityResponse.text();
      console.error('Stability API error:', stabilityResponse.status, errorText);
      throw new Error(`Stability API error: ${stabilityResponse.status} - ${errorText}`);
    }

    const stabilityResult = await stabilityResponse.json();
    
    if (!stabilityResult.artifacts || stabilityResult.artifacts.length === 0) {
      throw new Error('No image generated');
    }

    const generatedBase64 = stabilityResult.artifacts[0].base64;
    const totalTime = Date.now() - startTime;
    console.log(`=== SUCCESS in ${totalTime}ms ===`);

    return Response.json({
      success: true,
      image: `data:image/png;base64,${generatedBase64}`
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
// SPATIALLY-ANCHORED PROMPT BUILDER
// ============================================

function buildSpatiallyAnchoredPrompt(photoDescription, transformationHints, designChoices) {
  const { style, colorPalette, florals, lighting, tableSettings } = designChoices;

  // Default photo description if not provided
  const sceneDescription = photoDescription || 
    'outdoor wedding ceremony venue with chairs arranged in rows and a natural focal point';
  
  // Default transformation hints if not provided  
  const editableAreas = transformationHints ||
    'ceremony area, aisle, altar/arch area, chair decorations';

  // ============================================
  // STYLE DEFINITIONS - Full décor packages
  // ============================================
  const STYLE_PACKAGES = {
    romantic: {
      arch: 'romantic draped fabric wedding arch with flowing sheer curtains and cascading florals',
      aisle: 'rose petals scattered along the aisle with small floral arrangements on alternating chairs',
      altar: 'elegant floral focal point with soft draping fabric',
      vibe: 'dreamy, soft, romantic, ethereal'
    },
    rustic: {
      arch: 'wooden wedding arch made of natural branches, decorated with greenery garlands and wildflowers',
      aisle: 'burlap aisle runner with mason jar floral arrangements on shepherd hooks',
      altar: 'rustic wooden altar with climbing vines and natural elements',
      vibe: 'natural, earthy, warm, organic'
    },
    modern: {
      arch: 'sleek geometric metal wedding arch with minimalist floral accents, clean lines',
      aisle: 'simple modern aisle markers with single stem arrangements in clear glass',
      altar: 'modern sculptural altar piece with architectural flowers',
      vibe: 'clean, sophisticated, minimal, contemporary'
    },
    bohemian: {
      arch: 'macramé wedding arch backdrop with pampas grass, dried flowers and feathers',
      aisle: 'eclectic mix of vintage rugs as aisle runner, mismatched floral arrangements',
      altar: 'layered textiles and bohemian elements with dried botanicals',
      vibe: 'free-spirited, eclectic, artistic, whimsical'
    },
    garden: {
      arch: 'lush floral garden arch overflowing with roses, hydrangeas and trailing greenery',
      aisle: 'garden-style ground arrangements with abundant fresh flowers lining both sides',
      altar: 'romantic garden focal point bursting with fresh blooms',
      vibe: 'lush, abundant, fresh, botanical'
    },
    glamorous: {
      arch: 'dramatic tall wedding arch with cascading white orchids and crystal accents',
      aisle: 'mirrored aisle with tall floral arrangements on crystal pedestals',
      altar: 'opulent floral installation with dramatic height and luxury blooms',
      vibe: 'luxurious, dramatic, elegant, showstopping'
    },
    vintage: {
      arch: 'antique-style wedding arch with vintage lace, old garden roses and trailing ivy',
      aisle: 'vintage lanterns and antique urns with classic floral arrangements',
      altar: 'romantic vintage focal point with heirloom-style blooms',
      vibe: 'nostalgic, romantic, timeless, classic'
    },
    coastal: {
      arch: 'driftwood wedding arch with flowing white fabric and tropical greenery',
      aisle: 'seashells and beach grass accents with white tropical flowers',
      altar: 'coastal-inspired focal point with natural beach elements',
      vibe: 'breezy, relaxed, natural, oceanside'
    }
  };

  // ============================================
  // COLOR PALETTE DEFINITIONS
  // ============================================
  const COLOR_DEFINITIONS = {
    blush_gold: 'soft blush pink, champagne gold, ivory white, warm rose tones',
    sage_cream: 'sage green, soft cream, natural ivory, muted green tones',
    dusty_blue: 'dusty blue, silver gray, crisp white, soft blue-gray tones',
    burgundy_navy: 'deep burgundy, navy blue, gold accents, rich jewel tones',
    terracotta: 'terracotta orange, rust brown, warm desert tones, earthy colors',
    lavender: 'soft lavender, purple, dusty mauve, romantic purple tones',
    classic_white: 'pure white, fresh green, ivory, classic white and green palette',
    sunset: 'coral orange, soft pink, golden yellow, warm sunset colors'
  };

  // ============================================
  // FLORAL STYLE DEFINITIONS
  // ============================================
  const FLORAL_DEFINITIONS = {
    lush_garden: 'abundant overflowing garden roses, peonies, ranunculus, full romantic blooms',
    wildflower: 'natural wildflower meadow mix, loose unstructured arrangements, whimsical blooms',
    minimal_modern: 'architectural single stem flowers, calla lilies, orchids, sculptural arrangements',
    dried_preserved: 'dried flowers, pampas grass, preserved botanicals, earth-tone dried arrangements',
    greenery_focused: 'lush eucalyptus, ferns, olive branches, foliage-heavy with minimal flowers',
    classic_elegant: 'classic roses, hydrangeas, traditional elegant arrangements'
  };

  // ============================================
  // LIGHTING DEFINITIONS
  // ============================================
  const LIGHTING_DEFINITIONS = {
    string_lights: 'romantic twinkling string lights overhead, fairy light canopy, warm bistro lighting',
    candles: 'warm candlelit ambiance, pillar candles on stands, flickering romantic candlelight',
    chandeliers: 'crystal chandelier hanging overhead, elegant glamorous lighting fixture',
    lanterns: 'decorative lanterns along aisle, hanging moroccan-style lanterns',
    natural: 'beautiful natural daylight, golden hour sunlight filtering through',
    mixed: 'romantic combination of candles and string lights, layered warm lighting'
  };

  // Get the selected package
  const stylePackage = STYLE_PACKAGES[style] || STYLE_PACKAGES.romantic;
  const colors = COLOR_DEFINITIONS[colorPalette] || COLOR_DEFINITIONS.classic_white;
  const floralStyle = FLORAL_DEFINITIONS[florals] || FLORAL_DEFINITIONS.classic_elegant;
  const lightingStyle = LIGHTING_DEFINITIONS[lighting] || LIGHTING_DEFINITIONS.natural;

  // ============================================
  // BUILD THE STRUCTURED PROMPT
  // ============================================
  
  const prompt = `EDIT THIS WEDDING VENUE PHOTO. Keep the exact same environment, background, trees, sky, water, and camera perspective unchanged.

SCENE: ${sceneDescription}

ADD THESE WEDDING DECORATIONS (must be clearly visible):

1. CEREMONY ARCH/BACKDROP: ${stylePackage.arch}
   Place at the natural focal point (end of aisle, in front of tree or scenic backdrop).

2. AISLE DECORATIONS: ${stylePackage.aisle}
   Add along both sides of the center aisle between the chair rows.

3. ALTAR/FOCAL AREA: ${stylePackage.altar}
   Cluster decorations around the ceremony focal point.

DESIGN SPECIFICATIONS:
- Color palette: ${colors}
- Floral style: ${floralStyle}
- Lighting: ${lightingStyle}
- Overall vibe: ${stylePackage.vibe}

CRITICAL CONSTRAINTS - DO NOT MODIFY:
- Keep all existing chairs exactly as they are (same position, color, style, count)
- Keep the exact tree shape, trunk, branches, and canopy
- Keep the sky, clouds, and horizon unchanged
- Keep any water, lake, or background scenery identical
- Keep the grass and ground surface unchanged except for aisle decorations
- Maintain the exact camera angle and perspective

OUTPUT: Photorealistic professional wedding photography, natural lighting, realistic shadows, magazine quality. No people, no text, no watermarks.`;

  return prompt;
}

// ============================================
// NEGATIVE PROMPT
// ============================================

function buildNegativePrompt() {
  return `blurry, distorted, low quality, cartoon, anime, illustration, painting, drawing, 
sketch, unrealistic, artificial, fake looking, oversaturated, 
people, guests, bride, groom, wedding party, crowd,
text, watermark, logo, signature, frame, border,
different chairs, moved chairs, removed chairs, extra chairs,
different tree shape, modified tree, different sky, different background,
indoor, different venue, different location`;
}