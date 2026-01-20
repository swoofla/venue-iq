import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { 
  Sparkles, ArrowRight, ArrowLeft, RefreshCw, Download, Share2, X,
  Loader2, CheckCircle, Eye, Minus
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

// --- Constants ---
const VIBES = [
  {
    id: 'romantic_garden',
    label: 'Romantic & Garden-Inspired',
    description: 'Soft, lush, floral-forward, dreamy',
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800',
    prompt: 'romantic garden wedding, soft flowing fabrics, lush floral arrangements, roses, peonies, delicate greenery, dreamy atmosphere, elegant and feminine, abundant blooms'
  },
  {
    id: 'modern_clean',
    label: 'Modern & Clean',
    description: 'Minimal, geometric, sophisticated',
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800',
    prompt: 'modern minimalist wedding, clean lines, geometric shapes, architectural florals, sophisticated and sleek, contemporary elegance, intentional negative space'
  },
  {
    id: 'timeless_elegant',
    label: 'Timeless & Elegant',
    description: 'Classic, refined, traditional beauty',
    image: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800',
    prompt: 'timeless elegant wedding, classic symmetrical arrangements, refined and polished, formal elegance, traditional beauty, graceful décor'
  },
  {
    id: 'warm_european',
    label: 'Warm & European',
    description: 'Tuscan, candlelit, intimate, old-world',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
    prompt: 'warm European wedding, Tuscan villa style, abundant candlelight, rustic elegance, old-world charm, intimate atmosphere, warm golden lighting, romantic candles'
  },
  {
    id: 'earthy_natural',
    label: 'Earthy & Natural',
    description: 'Organic, muted tones, textural, grounded',
    image: 'https://images.unsplash.com/photo-1510076857177-7470076d4098?w=800',
    prompt: 'earthy natural wedding, organic textures, dried florals, pampas grass, grounded and authentic, natural materials, raw beauty, tactile elements'
  },
  {
    id: 'bold_glamorous',
    label: 'Bold & Glamorous',
    description: 'Dramatic, luxe, statement-making, opulent',
    image: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800',
    prompt: 'bold glamorous wedding, dramatic statement pieces, luxurious textures, opulent floral installations, crystal details, high-impact design, showstopping décor'
  }
];

const DENSITIES = [
  {
    id: 'light',
    label: 'Light & Airy',
    description: 'Minimal, breathing room, understated elegance',
    image: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800',
    prompt: 'minimal décor, sparse elegant arrangements, lots of negative space, understated beauty, breathing room, less is more, refined simplicity'
  },
  {
    id: 'balanced',
    label: 'Balanced & Polished',
    description: 'Just right, intentional, curated',
    image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800',
    prompt: 'balanced décor, intentionally curated arrangements, polished styling, medium density florals, well-proportioned, thoughtfully placed'
  },
  {
    id: 'lush',
    label: 'Lush & Statement-Making',
    description: 'Abundant, full, dramatic impact',
    image: 'https://images.unsplash.com/photo-1507504031003-b417219a0fde?w=800',
    prompt: 'lush abundant décor, overflowing florals, dramatic installations, maximum impact, full and luxurious, statement-making arrangements, no empty space'
  }
];

const COLOR_PALETTES = [
  {
    id: 'classic_white_green',
    label: 'Classic White & Green',
    description: 'White, ivory, soft green, eucalyptus',
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800',
    colors: ['#FFFFFF', '#F5F5F0', '#9CAF88'],
    prompt: 'classic white and green palette, white flowers, ivory roses, soft green foliage, eucalyptus, elegant greenery, fresh and timeless'
  },
  {
    id: 'soft_blush_neutrals',
    label: 'Soft Blush Neutrals',
    description: 'Blush, champagne, taupe, soft ivory',
    image: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800',
    colors: ['#F8E1E1', '#F5E6D3', '#B8A99A'],
    prompt: 'soft blush neutral palette, blush pink flowers, champagne tones, taupe accents, soft ivory, warm romantic neutrals, gentle feminine colors'
  },
  {
    id: 'romantic_pastels',
    label: 'Romantic Pastels',
    description: 'Blush, lavender, dusty blue, soft peach',
    image: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800',
    colors: ['#F8E1E1', '#E6E6FA', '#6B8E9F'],
    prompt: 'romantic pastel palette, blush pink, soft lavender, dusty blue, pale peach, dreamy soft colors, delicate and feminine'
  },
  {
    id: 'earthy_neutrals',
    label: 'Earthy Neutrals',
    description: 'Cream, beige, caramel, terracotta, muted green',
    image: 'https://images.unsplash.com/photo-1510076857177-7470076d4098?w=800',
    colors: ['#F5F5DC', '#C4A77D', '#E07B53'],
    prompt: 'earthy neutral palette, cream and beige tones, caramel accents, terracotta, muted sage green, organic earth tones, warm natural colors'
  },
  {
    id: 'moody_jewel',
    label: 'Moody Jewel Tones',
    description: 'Burgundy, plum, emerald, deep navy',
    image: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800',
    colors: ['#800020', '#8E4585', '#046307'],
    prompt: 'moody jewel tone palette, deep burgundy, rich plum, emerald green, navy blue, dramatic saturated colors, luxurious and bold'
  },
  {
    id: 'autumn_warm',
    label: 'Autumn Tones',
    description: 'Peach, coral, apricot, terracotta, soft yellow',
    image: 'https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=800',
    colors: ['#FFCBA4', '#FF7F50', '#E07B53'],
    prompt: 'warm autumn palette, soft peach, coral, apricot, terracotta, muted yellow, golden warm tones, harvest-inspired colors'
  },
  {
    id: 'wildflower_mix',
    label: 'Wildflower Mix',
    description: 'Soft blue, lavender, buttery yellow, white, greenery',
    image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800',
    colors: ['#6B8E9F', '#E6E6FA', '#F5E6A3'],
    prompt: 'wildflower color palette, soft blue, lavender purple, buttery yellow, white blooms, abundant greenery, meadow-inspired, natural and whimsical'
  },
  {
    id: 'garden_greens',
    label: 'Garden Greens & Whites',
    description: 'White, cream, varied greens, hints of pale yellow',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
    colors: ['#FFFFFF', '#228B22', '#F5F5DC'],
    prompt: 'garden greens and white palette, crisp white flowers, cream accents, varied shades of green, pale yellow hints, lush botanical, fresh garden style'
  },
  {
    id: 'all_white',
    label: 'White + Creams',
    description: 'All white, all blush, all neutral with subtle variation',
    image: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800',
    colors: ['#FFFFFF', '#FFFAF0', '#F5F5F0'],
    prompt: 'monochromatic white and cream palette, all white flowers, ivory, soft cream, subtle tonal variation, pure and elegant, sophisticated simplicity'
  },
  {
    id: 'vibrant_colorful',
    label: 'Vibrant & Colorful',
    description: 'Fuchsia, rust, burnt orange, deep red, mauve',
    image: 'https://images.unsplash.com/photo-1507504031003-b417219a0fde?w=800',
    colors: ['#FF00FF', '#B7410E', '#C71585'],
    prompt: 'vibrant colorful palette, bold fuchsia, rust orange, burnt sienna, deep red, mauve, saturated statement colors, joyful and energetic'
  },
  {
    id: 'black_white',
    label: 'Black & White',
    description: 'Dramatic monochrome, high contrast, modern edge',
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800',
    colors: ['#000000', '#FFFFFF', '#333333'],
    prompt: 'black and white palette, dramatic monochrome, high contrast, crisp white flowers, black accents, modern sophisticated edge, bold and striking'
  }
];

const SEASONS = [
  {
    id: 'spring',
    label: 'Spring',
    description: 'Fresh, bright, new beginnings',
    image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800',
    prompt: 'spring wedding atmosphere, fresh blooms, bright natural light, cherry blossoms, tulips, new growth, airy and light feeling'
  },
  {
    id: 'summer',
    label: 'Summer',
    description: 'Warm, vibrant, sun-drenched',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
    prompt: 'summer wedding atmosphere, warm sunlight, lush greenery, vibrant energy, golden sunshine, garden party feeling'
  },
  {
    id: 'fall',
    label: 'Fall',
    description: 'Rich, warm, golden hour magic',
    image: 'https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=800',
    prompt: 'fall wedding atmosphere, warm amber tones, golden hour light, rich textures, autumn warmth, cozy romantic feeling'
  },
  {
    id: 'winter',
    label: 'Winter',
    description: 'Crisp, elegant, cozy warmth',
    image: 'https://images.unsplash.com/photo-1512438248247-f0f2a5a8b7f0?w=800',
    prompt: 'winter wedding atmosphere, crisp elegant feeling, candlelit warmth, evergreen accents, cozy romantic ambiance, soft glowing light'
  }
];

const STEPS = [
  { key: 'space', title: 'Choose a Space', subtitle: 'Select which area to transform' },
  { key: 'vibe', title: 'What feeling do you want?', subtitle: 'Pick the vibe that speaks to you' },
  { key: 'density', title: 'How much décor?', subtitle: 'Choose your styling density' },
  { key: 'colors', title: 'What colors speak to you?', subtitle: 'Choose your palette' },
  { key: 'season', title: 'What season?', subtitle: 'This influences lighting and atmosphere' },
];

// Helper to convert base64 to blob URL
const base64ToBlobUrl = (base64DataUrl) => {
  try {
    const base64Data = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Failed to convert base64 to blob:', error);
    return base64DataUrl;
  }
};

export default function VenueVisualizer({ venueId, venueName = 'Sugar Lake Weddings', onComplete, onCancel }) {
  const [step, setStep] = useState(0); // 0-4 for questions, 5 for review
  const [editingFrom, setEditingFrom] = useState(null);
  const [selections, setSelections] = useState({
    space: null,
    vibe: null,
    density: null,
    colors: null,
    season: null,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0); // 0 = transformed, 1 = original
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [error, setError] = useState(null);

  const { data: venuePhotos = [], isLoading: isLoadingPhotos } = useQuery({
    queryKey: ['venueVisualizationPhotos', venueId],
    queryFn: async () => {
      const photos = await base44.entities.VenueVisualizationPhoto.filter({
        venue_id: venueId, is_active: true
      });
      return photos.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },
    enabled: !!venueId
  });

  const { data: heroImages = [], isLoading: isLoadingHeroImages } = useQuery({
    queryKey: ['visualizerHeroImages'],
    queryFn: async () => {
      const images = await base44.entities.VisualizerHeroImage.filter({ is_active: true });
      return images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }
  });

  const photosByCategory = venuePhotos.reduce((acc, photo) => {
    if (!acc[photo.category]) acc[photo.category] = [];
    acc[photo.category].push(photo);
    return acc;
  }, {});

  // Group hero images by category, with fallbacks to hardcoded constants
  const vibes = heroImages.filter(img => img.category === 'vibe').length > 0
    ? heroImages.filter(img => img.category === 'vibe')
    : VIBES;
  const densities = heroImages.filter(img => img.category === 'density').length > 0
    ? heroImages.filter(img => img.category === 'density')
    : DENSITIES;
  const colorPalettes = heroImages.filter(img => img.category === 'colors').length > 0
    ? heroImages.filter(img => img.category === 'colors')
    : COLOR_PALETTES;
  const seasons = heroImages.filter(img => img.category === 'season').length > 0
    ? heroImages.filter(img => img.category === 'season')
    : SEASONS;

  const handleSelect = (key, value) => {
    setSelections(prev => ({ ...prev, [key]: value }));
    
    setTimeout(() => {
      if (editingFrom !== null) {
        setStep(5); // Return to review
        setEditingFrom(null);
      } else if (step < 4) {
        setStep(step + 1);
      } else {
        setStep(5); // Go to review
      }
    }, 300);
  };

  const handleEditSelection = (stepIndex) => {
    setEditingFrom(stepIndex);
    setStep(stepIndex);
  };

  const generateVisualization = async () => {
    if (!selections.space) {
      setError('Please select a space to visualize.');
      return;
    }
    setIsGenerating(true);
    setError(null);
  
    try {
      console.log('Calling generateVenueVisualization...');
      
      // Build the final prompt (using dynamic or fallback constants)
      const vibe = vibes.find(v => v.id === selections.vibe || v.option_id === selections.vibe);
      const density = densities.find(d => d.id === selections.density || d.option_id === selections.density);
      const colors = colorPalettes.find(c => c.id === selections.colors || c.option_id === selections.colors);
      const season = seasons.find(s => s.id === selections.season || s.option_id === selections.season);
      
      const spaceDescription = selections.space.photo_description || 'outdoor wedding venue';
      
      const preservationPrompt = 'CRITICAL: Preserve exact architecture, trees, landscape, camera angle, and perspective. Only add décor elements. Do not change the structure or environment.';
      
      const promptParts = [
        'professional wedding photography',
        'high quality realistic photo',
        spaceDescription,
        vibe?.prompt || '',
        density?.prompt || '',
        colors?.prompt || '',
        season?.prompt || '',
        'beautifully decorated wedding ceremony',
        'floral arrangements, elegant décor',
        preservationPrompt,
        'photorealistic, 8K quality, editorial wedding photography'
      ].filter(Boolean);
      
      const finalPrompt = promptParts.join(', ');
      
      console.log('Generated prompt:', finalPrompt);
      
      const result = await base44.functions.invoke('generateVenueVisualization', {
        baseImageUrl: selections.space.photo_url,
        maskImageUrl: selections.space.mask_url,
        prompt: finalPrompt,
        metadata: {
          vibe: selections.vibe,
          density: selections.density,
          colors: selections.colors,
          season: selections.season,
          spaceCategory: selections.space?.category
        }
      });
      
      console.log('Result received:', result);
      console.log('Result.data:', result.data);
      
      // Handle the response - backend returns { success: true, image: "base64..." }
      if (result.data?.success && result.data?.image) {
        console.log('Image data received, length:', result.data.image.length);
        
        // Convert base64 to blob URL for better mobile performance
        const base64Data = result.data.image.replace(/^data:image\/\w+;base64,/, '');
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/png' });
        const blobUrl = URL.createObjectURL(blob);
        
        setGeneratedImage(blobUrl);
      } else {
        console.error('No image in response:', result.data);
        throw new Error(result.data?.error || 'Failed to generate image');
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedImage) return;
    
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        window.open(generatedImage, '_blank');
      } else {
        const link = document.createElement('a');
        link.href = generatedImage;
        link.download = `wedding-vision-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setShowShareSheet(false);
      toast.success('Image downloaded');
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to download image');
    }
  };

  const handleShare = async () => {
    if (navigator.share && generatedImage) {
      try {
        const response = await fetch(generatedImage);
        const blob = await response.blob();
        const file = new File([blob], 'wedding-vision.png', { type: 'image/png' });
        await navigator.share({
          title: 'My Wedding Vision',
          text: 'Check out my wedding design for ' + venueName + '!',
          files: [file],
        });
        setShowShareSheet(false);
      } catch (err) {
        console.log('Share failed:', err);
        toast.error('Sharing not supported');
      }
    } else {
      toast.info('Sharing not supported on this device');
    }
  };

  const handleStartOver = () => {
    if (generatedImage && generatedImage.startsWith('blob:')) {
      URL.revokeObjectURL(generatedImage);
    }
    setStep(0);
    setSelections({ space: null, vibe: null, density: null, colors: null, season: null });
    setGeneratedImage(null);
    setError(null);
    setShowFullscreen(false);
    setFullscreenIndex(0);
    setEditingFrom(null);
    setIsGenerating(false);
  };

  // --- Loading State ---
  if (isLoadingPhotos) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100 mb-4 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-stone-400 animate-spin" />
      </div>
    );
  }

  // --- No Photos State ---
  if (venuePhotos.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100 mb-4 text-center">
        <Sparkles className="w-12 h-12 text-stone-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-stone-900 mb-2">Coming Soon!</h3>
        <p className="text-stone-600 mb-4">Venue photos are being prepared.</p>
        <Button onClick={onComplete} className="rounded-full bg-black hover:bg-stone-800">Schedule a Tour</Button>
      </div>
    );
  }

  // --- Generating State ---
  if (isGenerating) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4"
      >
        <div className="relative w-full max-w-2xl">
          <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden">
            <img src={selections.space?.photo_url} alt="Base" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-6">
              <h3 className="text-2xl font-light text-white mb-2">Creating Your Vision</h3>
              <div className="flex items-center space-x-1 mb-8">
                <motion.span 
                  className="text-white text-2xl"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                >
                  .
                </motion.span>
                <motion.span 
                  className="text-white text-2xl"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                >
                  .
                </motion.span>
                <motion.span 
                  className="text-white text-2xl"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                >
                  .
                </motion.span>
              </div>
            </div>
          </div>
          <div className="h-0.5 bg-white/20 rounded-full overflow-hidden mt-4">
            <motion.div 
              className="h-full bg-white" 
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 20, ease: "linear" }}
            />
          </div>
          <p className="text-sm text-white/60 mt-3 text-center">This usually takes 15-20 seconds...</p>
        </div>
      </motion.div>
    );
  }

  // --- Result View ---
  if (generatedImage) {
    return (
      <>
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden mb-4"
        >
          <div className="px-6 py-4 border-b border-stone-100">
            <h3 className="text-lg font-light text-stone-900">Your Wedding Vision</h3>
          </div>

          <div className="p-4">
            <button 
              onClick={() => setShowFullscreen(true)}
              className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-stone-100 group"
            >
              <img src={generatedImage} alt="Your personalized wedding vision" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                  <Eye className="w-6 h-6 text-black" />
                </div>
              </div>
            </button>

            <div className="flex gap-2 mt-4">
              <Button 
                onClick={generateVisualization} 
                variant="outline" 
                className="flex-1 rounded-full border-stone-200 text-stone-700 hover:bg-stone-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
              <Button 
                onClick={() => setShowShareSheet(true)} 
                className="flex-1 rounded-full bg-black hover:bg-stone-800"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>

            <div className="mt-6 p-6 bg-stone-50 rounded-xl text-center">
              <p className="text-stone-900 mb-3 font-light">Love it? Let's make it real!</p>
              <Button onClick={onComplete} className="rounded-full bg-black hover:bg-stone-800">
                Schedule a Tour
              </Button>
            </div>

            <button 
              onClick={handleStartOver} 
              className="w-full mt-4 py-3 text-sm text-stone-500 hover:text-stone-700 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Try Different Design
            </button>
          </div>
        </motion.div>

        {/* Fullscreen Viewer */}
        <AnimatePresence>
          {showFullscreen && selections.space && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4"
            >
              <button 
                onClick={() => setShowFullscreen(false)} 
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="relative w-full max-w-screen-lg">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={fullscreenIndex}
                    src={fullscreenIndex === 0 ? generatedImage : selections.space.photo_url}
                    alt={fullscreenIndex === 0 ? "Generated Vision" : "Original Space"}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="max-h-[85vh] max-w-full object-contain mx-auto"
                  />
                </AnimatePresence>
                
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    onClick={() => setFullscreenIndex(0)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm transition-colors",
                      fullscreenIndex === 0 ? "bg-white text-black" : "bg-white/20 text-white hover:bg-white/30"
                    )}
                  >
                    Your Vision
                  </button>
                  <button
                    onClick={() => setFullscreenIndex(1)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm transition-colors",
                      fullscreenIndex === 1 ? "bg-white text-black" : "bg-white/20 text-white hover:bg-white/30"
                    )}
                  >
                    Original
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Share Sheet */}
        <Drawer open={showShareSheet} onOpenChange={setShowShareSheet}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>Share Your Vision</DrawerTitle>
              <DrawerDescription>Download or share your wedding design</DrawerDescription>
            </DrawerHeader>
            <div className="p-4 flex flex-col gap-3 pb-8">
              <Button 
                variant="outline" 
                className="w-full rounded-full justify-start h-14" 
                onClick={handleDownload}
              >
                <Download className="w-5 h-5 mr-3" /> 
                <span className="flex-1 text-left">Save to Photos</span>
              </Button>
              <Button 
                variant="outline" 
                className="w-full rounded-full justify-start h-14" 
                onClick={handleShare}
              >
                <Share2 className="w-5 h-5 mr-3" /> 
                <span className="flex-1 text-left">Share via...</span>
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // --- Review View ---
  if (step === 5) {
    const vibe = vibes.find(v => v.id === selections.vibe || v.option_id === selections.vibe);
    const density = densities.find(d => d.id === selections.density || d.option_id === selections.density);
    const colors = colorPalettes.find(c => c.id === selections.colors || c.option_id === selections.colors);
    const season = seasons.find(s => s.id === selections.season || s.option_id === selections.season);

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden mb-4"
      >
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <button 
            onClick={onCancel} 
            className="p-2 rounded-full hover:bg-stone-100 text-stone-500"
          >
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-light text-stone-900">Review Your Vision</h3>
          <div className="w-9" />
        </div>

        <div className="p-6">
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-stone-100 mb-6">
            <img src={selections.space?.photo_url} alt={selections.space?.name} className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
              <p className="text-white font-light">{selections.space?.name}</p>
            </div>
          </div>

          <div className="space-y-3">
            <button 
              onClick={() => handleEditSelection(1)}
              className="w-full p-4 rounded-xl flex items-center gap-4 border border-stone-200 bg-white hover:bg-stone-50 text-left"
            >
              <div className="flex-1">
                <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Vibe</p>
                <p className="font-light text-stone-900">{vibe?.label || 'Not selected'}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400" />
            </button>

            <button 
              onClick={() => handleEditSelection(2)}
              className="w-full p-4 rounded-xl flex items-center gap-4 border border-stone-200 bg-white hover:bg-stone-50 text-left"
            >
              <div className="flex-1">
                <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Density</p>
                <p className="font-light text-stone-900">{density?.label || 'Not selected'}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400" />
            </button>

            <button 
              onClick={() => handleEditSelection(3)}
              className="w-full p-4 rounded-xl flex items-center gap-4 border border-stone-200 bg-white hover:bg-stone-50 text-left"
            >
              <div className="flex-1">
                <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Colors</p>
                {colors?.colors ? (
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                      {colors.colors.map((c, i) => (
                        <div key={i} className="w-6 h-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <span className="font-light text-stone-900">{colors.label}</span>
                  </div>
                ) : (
                  <p className="font-light text-stone-900">Not selected</p>
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400" />
            </button>

            <button 
              onClick={() => handleEditSelection(4)}
              className="w-full p-4 rounded-xl flex items-center gap-4 border border-stone-200 bg-white hover:bg-stone-50 text-left"
            >
              <div className="flex-1">
                <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Season</p>
                <p className="font-light text-stone-900">{season?.label || 'Not selected'}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400" />
            </button>
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <Button 
            onClick={generateVisualization} 
            disabled={!selections.space || !selections.vibe || !selections.density || !selections.colors || !selections.season} 
            className="w-full mt-6 rounded-full bg-black hover:bg-stone-800 h-12"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Create My Vision
          </Button>
        </div>
      </motion.div>
    );
  }

  // --- Questionnaire Steps ---
  const currentStepData = STEPS[step];

  const renderOptions = () => {
    switch (currentStepData.key) {
      case 'space':
        return (
          <div className="space-y-4">
            {Object.entries(photosByCategory).map(([category, photos]) => (
              <div key={category}>
                <h5 className="text-xs uppercase tracking-wide text-stone-500 mb-3 font-light">
                  {category.replace('_', ' ')}
                </h5>
                <div className="space-y-3">
                  {photos.map((photo) => (
                    <button 
                      key={photo.id} 
                      onClick={() => handleSelect('space', photo)}
                      className={cn(
                        "relative w-full aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all group",
                        selections.space?.id === photo.id 
                          ? 'border-black ring-2 ring-black' 
                          : 'border-stone-200 hover:border-stone-300'
                      )}
                    >
                      <img src={photo.photo_url} alt={photo.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4">
                        <p className="text-white font-light">{photo.name}</p>
                      </div>
                      {selections.space?.id === photo.id && (
                        <motion.div 
                          initial={{ scale: 0 }} 
                          animate={{ scale: 1 }} 
                          className="absolute top-3 right-3 w-8 h-8 bg-black rounded-full flex items-center justify-center"
                        >
                          <CheckCircle className="w-5 h-5 text-white" />
                        </motion.div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      
      case 'vibe':
      case 'density':
      case 'season':
        const options = currentStepData.key === 'vibe' ? vibes : currentStepData.key === 'density' ? densities : seasons;
        return (
          <div className="space-y-3">
            {options.map((opt) => (
              <button 
                key={opt.id || opt.option_id} 
                onClick={() => handleSelect(currentStepData.key, opt.id || opt.option_id)}
                className={cn(
                  "relative w-full rounded-xl overflow-hidden border-2 transition-all",
                  selections[currentStepData.key] === opt.id 
                    ? "border-black" 
                    : "border-transparent hover:border-stone-200"
                )}
              >
                <div className="aspect-[16/9] relative">
                  <img 
                    src={opt.image} 
                    alt={opt.label} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-white font-medium text-lg">{opt.label}</p>
                    <p className="text-white/70 text-sm mt-1">{opt.description}</p>
                  </div>
                  {selections[currentStepData.key] === opt.id && (
                    <div className="absolute top-3 right-3 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        );
      
      case 'colors':
        return (
          <div className="space-y-3">
            {colorPalettes.map((opt) => (
              <button 
                key={opt.id || opt.option_id} 
                onClick={() => handleSelect('colors', opt.id || opt.option_id)}
                className={cn(
                  "relative w-full rounded-xl overflow-hidden border-2 transition-all",
                  selections.colors === opt.id 
                    ? "border-black" 
                    : "border-transparent hover:border-stone-200"
                )}
              >
                <div className="aspect-[16/9] relative">
                  <img 
                    src={opt.image} 
                    alt={opt.label} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex -space-x-1">
                        {opt.colors.map((color, i) => (
                          <div 
                            key={i} 
                            className="w-6 h-6 rounded-full border-2 border-white shadow-sm" 
                            style={{ backgroundColor: color }} 
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-white font-medium text-lg">{opt.label}</p>
                    <p className="text-white/70 text-sm mt-1">{opt.description}</p>
                  </div>
                  {selections.colors === opt.id && (
                    <div className="absolute top-3 right-3 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        key={step}
        initial={{ opacity: 0, x: 20 }} 
        animate={{ opacity: 1, x: 0 }} 
        exit={{ opacity: 0, x: -20 }} 
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden mb-4"
      >
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <button 
            onClick={step === 0 ? onCancel : () => setStep(prev => Math.max(0, prev - 1))} 
            className="p-2 rounded-full hover:bg-stone-100 text-stone-500"
          >
            {step === 0 ? <X className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, index) => (
              <div 
                key={index} 
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  index <= step ? "bg-black" : "bg-stone-200"
                )}
              />
            ))}
          </div>
          <div className="w-9" />
        </div>

        <div className="p-6">
          <h4 className="text-xl font-light text-stone-900 mb-1">{currentStepData?.title}</h4>
          <p className="text-stone-500 mb-6 font-light">{currentStepData?.subtitle}</p>
          <div className="max-h-[500px] overflow-y-auto pr-2">
            {renderOptions()}
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}