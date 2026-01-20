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

// Pure JS base64 encoding (no external dependencies)
function uint8ArrayToBase64(uint8Array) {
  const CHUNK_SIZE = 0x8000; // 32KB chunks
  let result = '';
  for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
    const chunk = uint8Array.subarray(i, i + CHUNK_SIZE);
    // Build string character by character to avoid call stack issues
    let chunkStr = '';
    for (let j = 0; j < chunk.length; j++) {
      chunkStr += String.fromCharCode(chunk[j]);
    }
    result += chunkStr;
  }
  return btoa(result);
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log('=== generateVenueVisualization START ===');
  
  try {
    // Step 1: Auth check (OPTIONAL - allow public access for chatbot users)
    console.log('Step 1: Checking authentication...');
    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
      console.log('Step 1 PASSED: User authenticated:', user?.id || user?.email || 'anonymous');
    } catch (authError) {
      console.log('Step 1 WARNING: Auth check failed, proceeding as anonymous user');
      console.log('  - Auth error:', authError.message);
    }
    // Allow unauthenticated users (public chatbot)
    console.log('Step 1 COMPLETE: Proceeding with request (user:', user ? 'authenticated' : 'anonymous', ')');

    // Step 2: Parse request body
    console.log('Step 2: Parsing request body...');
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.log('ERROR: Failed to parse request body:', parseError.message);
      return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }
    
    const { 
      baseImageUrl,
      photoDescription,
      transformationHints,
      designChoices,
      provider = 'stability'
    } = requestBody;
    
    console.log('Step 2 PASSED: Request body parsed');
    console.log('  - baseImageUrl:', baseImageUrl ? baseImageUrl.substring(0, 80) + '...' : 'MISSING');
    console.log('  - photoDescription:', photoDescription ? 'present' : 'missing');
    console.log('  - designChoices:', designChoices ? JSON.stringify(designChoices).substring(0, 100) : 'MISSING');

    if (!baseImageUrl || !designChoices) {
      console.log('ERROR: Missing required fields');
      return Response.json({ success: false, error: 'Missing required fields: baseImageUrl and designChoices' }, { status: 400 });
    }

    // Step 3: Build prompt
    console.log('Step 3: Building transformation prompt...');
    const prompt = buildTransformationPrompt(photoDescription, transformationHints, designChoices);
    console.log('Step 3 PASSED: Prompt built');
    console.log('  - Prompt preview:', prompt.substring(0, 150) + '...');

    // Step 4: Check API key
    console.log('Step 4: Checking Stability API key...');
    const STABILITY_API_KEY = Deno.env.get('STABILITY_API_KEY');
    if (!STABILITY_API_KEY) {
      console.log('ERROR: STABILITY_API_KEY not found in environment');
      return Response.json({ success: false, error: 'Stability API key not configured' }, { status: 500 });
    }
    console.log('Step 4 PASSED: API key present (length:', STABILITY_API_KEY.length, ')');

    // Step 5: Fetch source image
    console.log('Step 5: Fetching source image from URL...');
    const fetchStartTime = Date.now();
    let imageResponse;
    try {
      imageResponse = await fetch(baseImageUrl, {
        headers: {
          'Accept': 'image/*'
        }
      });
    } catch (fetchError) {
      console.log('ERROR: Failed to fetch image:', fetchError.message);
      return Response.json({ success: false, error: `Failed to fetch source image: ${fetchError.message}` }, { status: 500 });
    }
    
    if (!imageResponse.ok) {
      console.log('ERROR: Image fetch returned status:', imageResponse.status);
      return Response.json({ success: false, error: `Image fetch failed with status ${imageResponse.status}` }, { status: 500 });
    }
    console.log('Step 5 PASSED: Image fetched in', Date.now() - fetchStartTime, 'ms');
    console.log('  - Content-Type:', imageResponse.headers.get('content-type'));
    console.log('  - Content-Length:', imageResponse.headers.get('content-length'));

    // Step 6: Convert to buffer
    console.log('Step 6: Converting image to buffer...');
    let imageBuffer;
    try {
      imageBuffer = await imageResponse.arrayBuffer();
    } catch (bufferError) {
      console.log('ERROR: Failed to convert to buffer:', bufferError.message);
      return Response.json({ success: false, error: `Buffer conversion failed: ${bufferError.message}` }, { status: 500 });
    }
    console.log('Step 6 PASSED: Buffer created, size:', imageBuffer.byteLength, 'bytes');

    // Step 7: Resize image to SDXL dimensions
    console.log('Step 7: Resizing image to SDXL dimensions...');
    let resizedImageBytes;
    try {
      const image = await Image.decode(new Uint8Array(imageBuffer));
      const originalWidth = image.width;
      const originalHeight = image.height;
      const originalRatio = originalWidth / originalHeight;
      console.log('  - Original dimensions:', originalWidth, 'x', originalHeight, '(ratio:', originalRatio.toFixed(3), ')');

      // Find closest SDXL dimension
      let closestDim = SDXL_DIMENSIONS[0];
      let closestDiff = Math.abs(originalRatio - closestDim.ratio);
      for (const dim of SDXL_DIMENSIONS) {
        const diff = Math.abs(originalRatio - dim.ratio);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestDim = dim;
        }
      }
      console.log('  - Target dimensions:', closestDim.width, 'x', closestDim.height);

      // Resize
      image.resize(closestDim.width, closestDim.height);
      resizedImageBytes = await image.encode();
      console.log('Step 7 PASSED: Image resized, new size:', resizedImageBytes.length, 'bytes');
    } catch (resizeError) {
      console.log('ERROR: Image resize failed:', resizeError.message);
      console.log('  - Stack:', resizeError.stack);
      return Response.json({ success: false, error: `Image resize failed: ${resizeError.message}` }, { status: 500 });
    }

    // Step 8: Convert to base64
    console.log('Step 8: Converting to base64...');
    let base64Image;
    try {
      base64Image = uint8ArrayToBase64(resizedImageBytes);
      console.log('Step 8 PASSED: Base64 created, length:', base64Image.length);
    } catch (base64Error) {
      console.log('ERROR: Base64 conversion failed:', base64Error.message);
      return Response.json({ success: false, error: `Base64 conversion failed: ${base64Error.message}` }, { status: 500 });
    }

    // Step 9: Call Stability AI
    console.log('Step 9: Calling Stability AI...');
    const stabilityStartTime = Date.now();
    
    // Determine strength based on user selection
    const strengthMap = {
      'subtle': 0.45,
      'balanced': 0.60,
      'dramatic': 0.75
    };
    const strength = strengthMap[designChoices.transformationStrength] || 0.60;
    console.log('  - Transformation strength:', strength);

    // Build FormData
    const formData = new FormData();
    
    // Convert base64 back to blob for FormData
    const binaryString = atob(base64Image);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const imageBlob = new Blob([bytes], { type: 'image/png' });
    
    formData.append('init_image', imageBlob, 'venue.png');
    formData.append('init_image_mode', 'IMAGE_STRENGTH');
    formData.append('image_strength', (1 - strength).toString());
    formData.append('text_prompts[0][text]', prompt);
    formData.append('text_prompts[0][weight]', '1');
    formData.append('text_prompts[1][text]', 'blurry, distorted, low quality, cartoon, anime, illustration, painting, drawing');
    formData.append('text_prompts[1][weight]', '-1');
    formData.append('cfg_scale', '7');
    formData.append('samples', '1');
    formData.append('steps', '30');

    let stabilityResponse;
    try {
      stabilityResponse = await fetch(
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
    } catch (stabilityFetchError) {
      console.log('ERROR: Stability API fetch failed:', stabilityFetchError.message);
      return Response.json({ success: false, error: `Stability API connection failed: ${stabilityFetchError.message}` }, { status: 500 });
    }

    console.log('  - Stability API status:', stabilityResponse.status);
    console.log('  - Stability API time:', Date.now() - stabilityStartTime, 'ms');

    if (!stabilityResponse.ok) {
      let errorText;
      try {
        errorText = await stabilityResponse.text();
      } catch {
        errorText = 'Could not read error response';
      }
      console.log('ERROR: Stability API error:', errorText);
      return Response.json({ 
        success: false, 
        error: `Stability AI error: ${stabilityResponse.status}`,
        details: errorText
      }, { status: 500 });
    }

    // Step 10: Parse response
    console.log('Step 10: Parsing Stability AI response...');
    let stabilityData;
    try {
      stabilityData = await stabilityResponse.json();
    } catch (parseError) {
      console.log('ERROR: Failed to parse Stability response:', parseError.message);
      return Response.json({ success: false, error: 'Failed to parse AI response' }, { status: 500 });
    }

    if (!stabilityData.artifacts || stabilityData.artifacts.length === 0) {
      console.log('ERROR: No artifacts in response');
      console.log('  - Response keys:', Object.keys(stabilityData));
      return Response.json({ success: false, error: 'No image generated' }, { status: 500 });
    }

    const generatedBase64 = stabilityData.artifacts[0].base64;
    console.log('Step 10 PASSED: Got generated image, base64 length:', generatedBase64.length);

    // Success!
    const totalTime = Date.now() - startTime;
    console.log('=== generateVenueVisualization SUCCESS ===');
    console.log('Total time:', totalTime, 'ms');

    return Response.json({
      success: true,
      image: `data:image/png;base64,${generatedBase64}`,
      prompt: prompt,
      processingTime: totalTime
    });

  } catch (error) {
    console.log('=== UNEXPECTED ERROR ===');
    console.log('Error:', error.message);
    console.log('Stack:', error.stack);
    return Response.json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});

function buildTransformationPrompt(photoDescription, transformationHints, designChoices) {
  const { style, colorPalette, florals, lighting, tableSettings } = designChoices;

  // Style descriptions
  const styleDescriptions = {
    'romantic': 'romantic, soft, dreamy, elegant atmosphere with flowing fabrics and gentle curves',
    'modern': 'modern, minimalist, clean lines, contemporary design with sleek furnishings',
    'rustic': 'rustic, natural, organic, barn-style with wooden elements and natural textures',
    'classic': 'classic, timeless, traditional elegance with refined details',
    'bohemian': 'bohemian, free-spirited, eclectic mix of patterns, textures, and global influences',
    'glamorous': 'glamorous, luxurious, opulent with crystal, gold accents, and rich fabrics'
  };

  // Color palette descriptions
  const colorDescriptions = {
    'blush-gold': 'blush pink and gold color scheme, soft rose tones with warm metallic accents',
    'sage-white': 'sage green and white color scheme, natural greens with crisp white',
    'navy-burgundy': 'navy blue and burgundy color scheme, deep rich jewel tones',
    'terracotta': 'terracotta and earth tones, warm burnt orange with natural browns',
    'lavender': 'lavender and soft purple tones, romantic purple hues',
    'classic-white': 'all white and ivory color scheme, pure and elegant'
  };

  // Floral descriptions
  const floralDescriptions = {
    'lush-garden': 'lush overflowing garden-style floral arrangements with abundant greenery',
    'minimal': 'minimal, carefully curated floral accents with simple elegant stems',
    'wildflower': 'wildflower meadow style, natural and organic loose arrangements',
    'tropical': 'tropical exotic flowers, bold colors and dramatic leaves',
    'classic-roses': 'classic rose arrangements, timeless and romantic',
    'dried-flowers': 'dried flower arrangements with pampas grass and preserved botanicals'
  };

  // Lighting descriptions
  const lightingDescriptions = {
    'warm-ambient': 'warm ambient lighting with soft glowing candles and string lights',
    'bright-airy': 'bright and airy natural light flooding the space',
    'dramatic': 'dramatic lighting with spotlights and shadows creating depth',
    'fairy-lights': 'magical fairy lights and twinkling string lights everywhere',
    'candlelit': 'romantic candlelit atmosphere with flickering warm light',
    'golden-hour': 'golden hour sunset lighting with warm orange and pink hues'
  };

  // Build the prompt
  let promptParts = [
    'professional wedding photography',
    'high quality realistic photo',
    photoDescription || 'beautiful wedding venue'
  ];

  if (style && styleDescriptions[style]) {
    promptParts.push(styleDescriptions[style]);
  }

  if (colorPalette && colorDescriptions[colorPalette]) {
    promptParts.push(colorDescriptions[colorPalette]);
  }

  if (florals && floralDescriptions[florals]) {
    promptParts.push(floralDescriptions[florals]);
  }

  if (lighting && lightingDescriptions[lighting]) {
    promptParts.push(lightingDescriptions[lighting]);
  }

  if (tableSettings) {
    promptParts.push(`${tableSettings} table settings and place settings`);
  }

  if (transformationHints) {
    promptParts.push(transformationHints);
  }

  promptParts.push('wedding decor, celebration setup, detailed, photorealistic');

  return promptParts.join(', ');
}