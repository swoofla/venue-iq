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
const STYLES = [
  { id: 'romantic', label: 'Romantic & Elegant', description: 'Soft, flowing, classic romance', icon: '💕' },
  { id: 'rustic', label: 'Rustic Charm', description: 'Natural wood, greenery, warmth', icon: '🌿' },
  { id: 'modern', label: 'Modern Minimalist', description: 'Clean lines, geometric shapes', icon: '◻️' },
  { id: 'bohemian', label: 'Bohemian', description: 'Free-spirited, eclectic, organic', icon: '🌾' },
  { id: 'garden', label: 'Garden Party', description: 'Lush florals, outdoor elegance', icon: '🌸' },
  { id: 'glamorous', label: 'Glamorous & Luxe', description: 'Opulent, dramatic, bold', icon: '✨' },
  { id: 'vintage', label: 'Vintage Romance', description: 'Antique charm, nostalgic', icon: '🕰️' },
  { id: 'coastal', label: 'Coastal Elegance', description: 'Beach-inspired, airy, relaxed', icon: '🌊' },
];

const COLOR_PALETTES = [
  { id: 'blush_gold', label: 'Blush & Gold', colors: ['#F8E1E1', '#D4AF37', '#FFFFFF'] },
  { id: 'sage_cream', label: 'Sage & Cream', colors: ['#9CAF88', '#FFFDD0', '#F5F5DC'] },
  { id: 'dusty_blue', label: 'Dusty Blue & Silver', colors: ['#6B8E9F', '#C0C0C0', '#FFFFFF'] },
  { id: 'burgundy_navy', label: 'Burgundy & Navy', colors: ['#800020', '#000080', '#D4AF37'] },
  { id: 'terracotta', label: 'Terracotta & Rust', colors: ['#E07B53', '#8B4513', '#DEB887'] },
  { id: 'lavender', label: 'Lavender Dreams', colors: ['#E6E6FA', '#9370DB', '#DDA0DD'] },
  { id: 'classic_white', label: 'Classic White & Green', colors: ['#FFFFFF', '#228B22', '#FFFAF0'] },
  { id: 'sunset', label: 'Sunset Coral', colors: ['#FF7F50', '#FFB6C1', '#FFD700'] },
];

const FLORALS = [
  { id: 'lush_garden', label: 'Lush Garden Roses', description: 'Overflowing romantic blooms' },
  { id: 'wildflower', label: 'Wildflower Meadow', description: 'Natural, whimsical arrangement' },
  { id: 'minimal_modern', label: 'Modern & Minimal', description: 'Architectural, structured' },
  { id: 'dried_preserved', label: 'Dried & Preserved', description: 'Pampas grass, earth tones' },
  { id: 'greenery', label: 'Greenery Focused', description: 'Eucalyptus, ferns, foliage' },
  { id: 'classic', label: 'Classic & Elegant', description: 'Timeless roses and hydrangeas' },
];

const LIGHTING = [
  { id: 'string_lights', label: 'Romantic String Lights', description: 'Twinkling fairy lights' },
  { id: 'candles', label: 'Candlelit Ambiance', description: 'Warm, flickering glow' },
  { id: 'chandeliers', label: 'Crystal Chandeliers', description: 'Elegant and glamorous' },
  { id: 'lanterns', label: 'Lanterns', description: 'Cozy, bohemian warmth' },
  { id: 'natural', label: 'Natural Daylight', description: 'Sun-drenched, golden hour' },
  { id: 'mixed', label: 'Mixed Romantic', description: 'Candles + string lights combined' },
];

const STEPS = [
  { key: 'space', title: 'Choose a Space', subtitle: 'Select which area to transform' },
  { key: 'style', title: 'Wedding Style', subtitle: "What's your aesthetic?" },
  { key: 'colorPalette', title: 'Color Palette', subtitle: 'Choose your colors' },
  { key: 'florals', title: 'Florals', subtitle: 'Your floral vision' },
  { key: 'lighting', title: 'Lighting', subtitle: 'Set the mood' },
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
    style: null, 
    colorPalette: null, 
    florals: null, 
    lighting: null,
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

  const photosByCategory = venuePhotos.reduce((acc, photo) => {
    if (!acc[photo.category]) acc[photo.category] = [];
    acc[photo.category].push(photo);
    return acc;
  }, {});

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
      const result = await base44.functions.invoke('generateVenueVisualization', {
        baseImageUrl: selections.space.photo_url,
        photoDescription: selections.space.photo_description,
        transformationHints: selections.space.transformation_hints,
        designChoices: {
          style: selections.style,
          colorPalette: selections.colorPalette,
          florals: selections.florals,
          lighting: selections.lighting,
        },
      });
  
      if (result.data?.success && result.data?.image) {
        const blobUrl = base64ToBlobUrl(result.data.image);
        setGeneratedImage(blobUrl);
      } else {
        const errorMsg = result.data?.error || result.data?.message || 'Failed to generate image';
        setError(errorMsg);
        setIsGenerating(false);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during generation.');
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
    setSelections({ space: null, style: null, colorPalette: null, florals: null, lighting: null });
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
    const getOptionLabel = (key, id) => {
      if (id === 'no_preference') return 'No Preference';
      const options = { style: STYLES, colorPalette: COLOR_PALETTES, florals: FLORALS, lighting: LIGHTING }[key];
      return options?.find(opt => opt.id === id)?.label || 'N/A';
    };

    const getColors = (id) => COLOR_PALETTES.find(p => p.id === id)?.colors || [];

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
            {STEPS.filter(s => s.key !== 'space').map((s, index) => (
              <button 
                key={s.key} 
                onClick={() => handleEditSelection(index + 1)}
                className="w-full p-4 rounded-xl flex items-center gap-4 border border-stone-200 bg-white hover:bg-stone-50 text-left"
              >
                <div className="flex-1">
                  <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">{s.title}</p>
                  {s.key === 'colorPalette' ? (
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1">
                        {getColors(selections[s.key])?.map((c, i) => (
                          <div key={i} className="w-6 h-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <span className="font-light text-stone-900">{getOptionLabel(s.key, selections[s.key])}</span>
                    </div>
                  ) : (
                    <p className="font-light text-stone-900">{getOptionLabel(s.key, selections[s.key])}</p>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400" />
              </button>
            ))}
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <Button 
            onClick={generateVisualization} 
            disabled={!selections.space || !selections.style || !selections.colorPalette || !selections.florals || !selections.lighting} 
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
      
      case 'style':
        return (
          <div className="space-y-3">
            {STYLES.map((opt) => (
              <button 
                key={opt.id} 
                onClick={() => handleSelect('style', opt.id)}
                className={cn(
                  "w-full p-4 rounded-xl text-left border transition-all flex items-start gap-4",
                  selections.style === opt.id 
                    ? 'border-black bg-black text-white' 
                    : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-900'
                )}
              >
                <span className="text-2xl pt-1">{opt.icon}</span>
                <div className="flex-1">
                  <p className="font-light text-base">{opt.label}</p>
                  <p className={cn("text-sm mt-1 font-light", selections.style === opt.id ? 'text-white/70' : 'text-stone-500')}>
                    {opt.description}
                  </p>
                </div>
                {selections.style === opt.id && (
                  <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    className="w-6 h-6 bg-white rounded-full flex items-center justify-center flex-shrink-0"
                  >
                    <CheckCircle className="w-4 h-4 text-black" />
                  </motion.div>
                )}
              </button>
            ))}
          </div>
        );
      
      case 'colorPalette':
        return (
          <div className="space-y-3">
            {COLOR_PALETTES.map((opt) => (
              <button 
                key={opt.id} 
                onClick={() => handleSelect('colorPalette', opt.id)}
                className={cn(
                  "w-full p-4 rounded-xl flex items-center gap-4 border transition-all",
                  selections.colorPalette === opt.id 
                    ? 'border-black bg-black text-white' 
                    : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-900'
                )}
              >
                <div className="flex -space-x-1">
                  {opt.colors.map((c, i) => (
                    <div 
                      key={i} 
                      className="w-8 h-8 rounded-full border-2 border-white shadow-sm" 
                      style={{ backgroundColor: c }} 
                    />
                  ))}
                </div>
                <span className="font-light flex-1">{opt.label}</span>
                {selections.colorPalette === opt.id && (
                  <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    className="w-6 h-6 bg-white rounded-full flex items-center justify-center"
                  >
                    <CheckCircle className="w-4 h-4 text-black" />
                  </motion.div>
                )}
              </button>
            ))}
          </div>
        );
      
      case 'florals':
        return (
          <div className="space-y-3">
            {FLORALS.map((opt) => (
              <button 
                key={opt.id} 
                onClick={() => handleSelect('florals', opt.id)}
                className={cn(
                  "w-full p-4 rounded-xl flex items-start gap-4 text-left border transition-all",
                  selections.florals === opt.id 
                    ? 'border-black bg-black text-white' 
                    : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-900'
                )}
              >
                <div className="flex-1">
                  <p className="font-light text-base">{opt.label}</p>
                  <p className={cn("text-sm mt-1 font-light", selections.florals === opt.id ? 'text-white/70' : 'text-stone-500')}>
                    {opt.description}
                  </p>
                </div>
                {selections.florals === opt.id && (
                  <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    className="w-6 h-6 bg-white rounded-full flex items-center justify-center"
                  >
                    <CheckCircle className="w-4 h-4 text-black" />
                  </motion.div>
                )}
              </button>
            ))}
            <button 
              onClick={() => handleSelect('florals', 'no_preference')}
              className={cn(
                "w-full p-4 rounded-xl flex items-center justify-center gap-4 border-2 border-dashed transition-all",
                selections.florals === 'no_preference' 
                  ? 'border-black bg-black text-white' 
                  : 'border-stone-300 text-stone-500 hover:border-stone-400'
              )}
            >
              <Minus className="w-5 h-5" />
              <span className="font-light">No Preference</span>
              {selections.florals === 'no_preference' && (
                <motion.div 
                  initial={{ scale: 0 }} 
                  animate={{ scale: 1 }} 
                  className="w-6 h-6 bg-white rounded-full flex items-center justify-center"
                >
                  <CheckCircle className="w-4 h-4 text-black" />
                </motion.div>
              )}
            </button>
          </div>
        );
      
      case 'lighting':
        return (
          <div className="space-y-3">
            {LIGHTING.map((opt) => (
              <button 
                key={opt.id} 
                onClick={() => handleSelect('lighting', opt.id)}
                className={cn(
                  "w-full p-4 rounded-xl flex items-start gap-4 text-left border transition-all",
                  selections.lighting === opt.id 
                    ? 'border-black bg-black text-white' 
                    : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-900'
                )}
              >
                <div className="flex-1">
                  <p className="font-light text-base">{opt.label}</p>
                  <p className={cn("text-sm mt-1 font-light", selections.lighting === opt.id ? 'text-white/70' : 'text-stone-500')}>
                    {opt.description}
                  </p>
                </div>
                {selections.lighting === opt.id && (
                  <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    className="w-6 h-6 bg-white rounded-full flex items-center justify-center"
                  >
                    <CheckCircle className="w-4 h-4 text-black" />
                  </motion.div>
                )}
              </button>
            ))}
            <button 
              onClick={() => handleSelect('lighting', 'no_preference')}
              className={cn(
                "w-full p-4 rounded-xl flex items-center justify-center gap-4 border-2 border-dashed transition-all",
                selections.lighting === 'no_preference' 
                  ? 'border-black bg-black text-white' 
                  : 'border-stone-300 text-stone-500 hover:border-stone-400'
              )}
            >
              <Minus className="w-5 h-5" />
              <span className="font-light">No Preference</span>
              {selections.lighting === 'no_preference' && (
                <motion.div 
                  initial={{ scale: 0 }} 
                  animate={{ scale: 1 }} 
                  className="w-6 h-6 bg-white rounded-full flex items-center justify-center"
                >
                  <CheckCircle className="w-4 h-4 text-black" />
                </motion.div>
              )}
            </button>
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