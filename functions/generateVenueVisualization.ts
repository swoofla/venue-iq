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
      prompt
    } = await req.json();

    console.log('baseImageUrl:', baseImageUrl ? 'present' : 'missing');
    console.log('maskImageUrl:', maskImageUrl || 'none');
    console.log('prompt:', prompt ? 'present' : 'missing');

    if (!baseImageUrl || !prompt) {
      return Response.json({ success: false, error: 'Missing required fields: baseImageUrl and prompt' }, { status: 400 });
    }

    const STABILITY_API_KEY = Deno.env.get('STABILITY_API_KEY');
    if (!STABILITY_API_KEY) {
      return Response.json({ success: false, error: 'Stability API key not configured' }, { status: 500 });
    }

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
      
      const imageStrength = 0.30; // Higher = more transformation
      
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
// NEGATIVE PROMPT
// ============================================
function buildNegativePrompt() {
  return `blurry, distorted, low quality, cartoon, anime, illustration, painting, 
sketch, unrealistic, artificial, oversaturated, 
people, guests, bride, groom, crowd,
text, watermark, logo, signature,
floating objects, impossible physics, wrong scale`;
}