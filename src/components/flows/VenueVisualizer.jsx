import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { 
  Sparkles, ArrowRight, ArrowLeft, RefreshCw, Download,
  Loader2, CheckCircle, Eye, EyeOff
} from 'lucide-react';

const STYLE_OPTIONS = [
  { id: 'romantic', label: 'Romantic & Elegant', description: 'Soft, flowing, classic romance', icon: '💕' },
  { id: 'rustic', label: 'Rustic Charm', description: 'Natural wood, greenery', icon: '🌿' },
  { id: 'modern', label: 'Modern Minimalist', description: 'Clean lines, geometric', icon: '◻️' },
  { id: 'bohemian', label: 'Bohemian', description: 'Free-spirited, eclectic', icon: '🌾' },
  { id: 'garden', label: 'Garden Party', description: 'Lush florals, outdoor', icon: '🌸' },
  { id: 'glamorous', label: 'Glamorous & Luxe', description: 'Opulent, dramatic', icon: '✨' },
  { id: 'vintage', label: 'Vintage Romance', description: 'Antique charm, nostalgic', icon: '🕰️' },
  { id: 'coastal', label: 'Coastal Elegance', description: 'Beach-inspired, airy', icon: '🌊' },
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

const FLORAL_STYLES = [
  { id: 'lush_garden', label: 'Lush Garden Roses', description: 'Overflowing romantic blooms' },
  { id: 'wildflower', label: 'Wildflower Meadow', description: 'Natural, whimsical' },
  { id: 'minimal_modern', label: 'Modern & Minimal', description: 'Architectural' },
  { id: 'dried_preserved', label: 'Dried & Preserved', description: 'Pampas grass, earth tones' },
  { id: 'greenery_focused', label: 'Greenery Focused', description: 'Eucalyptus, ferns' },
  { id: 'classic_elegant', label: 'Classic & Elegant', description: 'Roses and hydrangeas' },
];

const LIGHTING_OPTIONS = [
  { id: 'string_lights', label: 'Romantic String Lights', description: 'Twinkling fairy lights' },
  { id: 'candles', label: 'Candlelit Ambiance', description: 'Warm flickering glow' },
  { id: 'chandeliers', label: 'Crystal Chandeliers', description: 'Elegant and glamorous' },
  { id: 'lanterns', label: 'Lanterns & Moroccan', description: 'Bohemian atmosphere' },
  { id: 'natural', label: 'Natural Daylight', description: 'Sun-drenched and airy' },
  { id: 'mixed', label: 'Mixed Romantic', description: 'Candles + string lights' },
];

const TABLE_SETTINGS = [
  { id: 'round_elegant', label: 'Round Tables, Elegant', description: 'Classic with fine china' },
  { id: 'long_feasting', label: 'Long Feasting Tables', description: 'Farm-style communal' },
  { id: 'mixed_eclectic', label: 'Mixed Eclectic', description: 'Varied shapes and sizes' },
  { id: 'minimalist', label: 'Minimalist Modern', description: 'Clean, simple elegance' },
];

const TRANSFORMATION_STRENGTHS = [
  { id: 'subtle', label: 'Subtle', value: 0.45, description: 'Light touches, true to original' },
  { id: 'balanced', label: 'Balanced', value: 0.60, description: 'Recommended' },
  { id: 'dramatic', label: 'Dramatic', value: 0.75, description: 'More creative changes' },
];

export default function VenueVisualizer({ venueId, venueName = 'Sugar Lake Weddings', onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selections, setSelections] = useState({
    style: null, colorPalette: null, florals: null, lighting: null,
    tableSettings: null, transformationStrength: 'balanced',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [showComparison, setShowComparison] = useState(false);
  const [error, setError] = useState(null);

  const { data: venuePhotos = [], isLoading } = useQuery({
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

  const getSteps = () => {
    const steps = [
      { title: 'Choose a Space', subtitle: 'Select which area to transform', key: 'photo', type: 'photo_select' },
      { title: 'Wedding Style', subtitle: 'Sets the overall aesthetic', key: 'style', type: 'style' },
      { title: 'Color Palette', subtitle: 'Colors that sing', key: 'colorPalette', type: 'color_palette' },
      { title: 'Floral Vision', subtitle: 'Set the romantic tone', key: 'florals', type: 'florals' },
      { title: 'Lighting', subtitle: 'Create the magic', key: 'lighting', type: 'lighting' },
    ];
    if (selectedPhoto?.category === 'reception') {
      steps.push({ title: 'Table Style', subtitle: 'Dining arrangement', key: 'tableSettings', type: 'table_settings' });
    }
    steps.push({ title: 'Intensity', subtitle: 'How much to change', key: 'transformationStrength', type: 'strength' });
    return steps;
  };

  const steps = getSteps();
  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;
  const canContinue = currentStep.type === 'photo_select' ? selectedPhoto !== null : selections[currentStep.key] !== null;

  const generateVisualization = async () => {
    if (!selectedPhoto) return;
    setIsGenerating(true);
    setError(null);

    try {
      const strengthValue = TRANSFORMATION_STRENGTHS.find(s => s.id === selections.transformationStrength)?.value || 0.6;
      const result = await base44.functions.invoke('generateVenueVisualization', {
        baseImageUrl: selectedPhoto.photo_url,
        photoDescription: selectedPhoto.photo_description,
        transformationHints: selectedPhoto.transformation_hints,
        designChoices: { ...selections, transformationStrength: strengthValue },
      });

      if (result.data?.success && result.data?.imageUrl) {
        setGeneratedImage(result.data.imageUrl);
      } else {
        throw new Error(result.data?.error || 'Failed to generate');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNext = () => isLastStep ? generateVisualization() : setStep(step + 1);
  const handleBack = () => step === 0 ? onCancel?.() : setStep(step - 1);

  const handleDownload = async () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `${venueName.replace(/\s+/g, '-')}-visualization.png`;
    link.click();
  };

  const handleStartOver = () => {
    setStep(0);
    setSelectedPhoto(null);
    setGeneratedImage(null);
    setSelections({ style: null, colorPalette: null, florals: null, lighting: null, tableSettings: null, transformationStrength: 'balanced' });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100 mb-4">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 text-rose-400 animate-spin" />
          <span className="text-stone-600">Loading venue photos...</span>
        </div>
      </div>
    );
  }

  if (venuePhotos.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100 mb-4 text-center">
        <Sparkles className="w-12 h-12 text-stone-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-stone-900 mb-2">Coming Soon!</h3>
        <p className="text-stone-600 mb-4">Venue photos are being prepared. Schedule a tour to see our spaces!</p>
        <Button onClick={onComplete} className="rounded-full bg-black hover:bg-stone-800">Schedule a Tour</Button>
      </div>
    );
  }

  // RESULT VIEW
  if (generatedImage) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden mb-4">
        <div className="bg-gradient-to-r from-rose-50 to-amber-50 px-6 py-4 border-b border-stone-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-rose-400" />
              <h3 className="text-lg font-semibold text-stone-900">Your Wedding Vision</h3>
            </div>
            <button onClick={() => setShowComparison(!showComparison)} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-stone-200 text-sm text-stone-600">
              {showComparison ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showComparison ? 'Hide Original' : 'Compare'}
            </button>
          </div>
        </div>
        <div className="p-4">
          {showComparison ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                <img src={selectedPhoto.photo_url} alt="Original" className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-xs text-white">Original</div>
              </div>
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                <img src={generatedImage} alt="Transformed" className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-rose-500 rounded text-xs text-white">Your Vision</div>
              </div>
            </div>
          ) : (
            <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-stone-100">
              <img src={generatedImage} alt="Your vision" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <Button onClick={generateVisualization} disabled={isGenerating} variant="outline" className="flex-1 rounded-full">
              <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />Regenerate
            </Button>
            <Button onClick={handleDownload} className="flex-1 rounded-full bg-rose-500 hover:bg-rose-600">
              <Download className="w-4 h-4 mr-2" />Download
            </Button>
          </div>
          <div className="mt-4 p-4 bg-gradient-to-r from-rose-50 to-amber-50 rounded-xl text-center">
            <p className="text-stone-700 mb-3">Love it? Let's make it real!</p>
            <Button onClick={onComplete} className="rounded-full bg-black hover:bg-stone-800">Schedule a Tour</Button>
          </div>
          <button onClick={handleStartOver} className="w-full mt-4 py-2 text-sm text-stone-500 hover:text-stone-700">← Try Different Design</button>
        </div>
      </motion.div>
    );
  }

  // GENERATING VIEW
  if (isGenerating) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100 mb-4">
        <div className="text-center">
          <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-stone-100 mb-6">
            <img src={selectedPhoto?.photo_url} alt="Base" className="w-full h-full object-cover opacity-50" />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
              <Loader2 className="w-12 h-12 text-white animate-spin mb-3" />
              <h3 className="text-xl font-semibold text-white">Creating Your Vision</h3>
              <p className="text-white/80 text-sm">Transforming {selectedPhoto?.name}...</p>
            </div>
          </div>
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden max-w-sm mx-auto">
            <div className="h-full bg-gradient-to-r from-rose-400 to-amber-400 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
          <p className="text-sm text-stone-500 mt-3">This usually takes 10-20 seconds...</p>
        </div>
      </motion.div>
    );
  }

  // QUESTIONNAIRE VIEW
  const renderOptions = () => {
    switch (currentStep.type) {
      case 'photo_select':
        return (
          <div className="space-y-6">
            {Object.entries(photosByCategory).map(([category, photos]) => (
              <div key={category}>
                <h5 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">
                  {category === 'ceremony' ? '💒 Ceremony' : category === 'reception' ? '🎉 Reception' : category === 'cocktail' ? '🥂 Cocktail' : '✨ ' + category}
                </h5>
                <div className="grid grid-cols-2 gap-3">
                  {photos.map((photo) => (
                    <button key={photo.id} onClick={() => setSelectedPhoto(photo)}
                      className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${selectedPhoto?.id === photo.id ? 'border-rose-400 ring-2 ring-rose-200' : 'border-stone-200 hover:border-stone-300'}`}>
                      <img src={photo.photo_url} alt={photo.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white font-medium text-sm">{photo.name}</p>
                      </div>
                      {selectedPhoto?.id === photo.id && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
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
          <div className="grid grid-cols-2 gap-3">
            {STYLE_OPTIONS.map((opt) => (
              <button key={opt.id} onClick={() => setSelections(p => ({ ...p, style: opt.id }))}
                className={`p-4 rounded-xl text-left border-2 transition-all ${selections.style === opt.id ? 'border-rose-400 bg-rose-50' : 'border-stone-100 hover:border-stone-200'}`}>
                <span className="text-2xl mb-2 block">{opt.icon}</span>
                <p className={`font-medium ${selections.style === opt.id ? 'text-rose-700' : 'text-stone-700'}`}>{opt.label}</p>
                <p className="text-xs text-stone-500 mt-1">{opt.description}</p>
              </button>
            ))}
          </div>
        );
      case 'color_palette':
        return (
          <div className="space-y-2">
            {COLOR_PALETTES.map((opt) => (
              <button key={opt.id} onClick={() => setSelections(p => ({ ...p, colorPalette: opt.id }))}
                className={`w-full p-4 rounded-xl flex items-center gap-4 border-2 transition-all ${selections.colorPalette === opt.id ? 'border-rose-400 bg-rose-50' : 'border-stone-100 hover:border-stone-200'}`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selections.colorPalette === opt.id ? 'border-rose-400 bg-rose-400' : 'border-stone-300'}`}>
                  {selections.colorPalette === opt.id && <CheckCircle className="w-4 h-4 text-white" />}
                </div>
                <div className="flex -space-x-1">
                  {opt.colors.map((c, i) => <div key={i} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: c }} />)}
                </div>
                <span className={`font-medium ${selections.colorPalette === opt.id ? 'text-rose-700' : 'text-stone-700'}`}>{opt.label}</span>
              </button>
            ))}
          </div>
        );
      case 'florals':
        return (
          <div className="space-y-2">
            {FLORAL_STYLES.map((opt) => (
              <button key={opt.id} onClick={() => setSelections(p => ({ ...p, florals: opt.id }))}
                className={`w-full p-4 rounded-xl flex items-start gap-4 text-left border-2 transition-all ${selections.florals === opt.id ? 'border-rose-400 bg-rose-50' : 'border-stone-100 hover:border-stone-200'}`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 ${selections.florals === opt.id ? 'border-rose-400 bg-rose-400' : 'border-stone-300'}`}>
                  {selections.florals === opt.id && <CheckCircle className="w-4 h-4 text-white" />}
                </div>
                <div>
                  <p className={`font-medium ${selections.florals === opt.id ? 'text-rose-700' : 'text-stone-700'}`}>{opt.label}</p>
                  <p className="text-sm text-stone-500">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
        );
      case 'lighting':
        return (
          <div className="space-y-2">
            {LIGHTING_OPTIONS.map((opt) => (
              <button key={opt.id} onClick={() => setSelections(p => ({ ...p, lighting: opt.id }))}
                className={`w-full p-4 rounded-xl flex items-start gap-4 text-left border-2 transition-all ${selections.lighting === opt.id ? 'border-rose-400 bg-rose-50' : 'border-stone-100 hover:border-stone-200'}`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 ${selections.lighting === opt.id ? 'border-rose-400 bg-rose-400' : 'border-stone-300'}`}>
                  {selections.lighting === opt.id && <CheckCircle className="w-4 h-4 text-white" />}
                </div>
                <div>
                  <p className={`font-medium ${selections.lighting === opt.id ? 'text-rose-700' : 'text-stone-700'}`}>{opt.label}</p>
                  <p className="text-sm text-stone-500">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
        );
      case 'table_settings':
        return (
          <div className="space-y-2">
            {TABLE_SETTINGS.map((opt) => (
              <button key={opt.id} onClick={() => setSelections(p => ({ ...p, tableSettings: opt.id }))}
                className={`w-full p-4 rounded-xl flex items-start gap-4 text-left border-2 transition-all ${selections.tableSettings === opt.id ? 'border-rose-400 bg-rose-50' : 'border-stone-100 hover:border-stone-200'}`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 ${selections.tableSettings === opt.id ? 'border-rose-400 bg-rose-400' : 'border-stone-300'}`}>
                  {selections.tableSettings === opt.id && <CheckCircle className="w-4 h-4 text-white" />}
                </div>
                <div>
                  <p className={`font-medium ${selections.tableSettings === opt.id ? 'text-rose-700' : 'text-stone-700'}`}>{opt.label}</p>
                  <p className="text-sm text-stone-500">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
        );
      case 'strength':
        return (
          <div className="space-y-3">
            {TRANSFORMATION_STRENGTHS.map((opt) => (
              <button key={opt.id} onClick={() => setSelections(p => ({ ...p, transformationStrength: opt.id }))}
                className={`w-full p-4 rounded-xl flex items-start gap-4 text-left border-2 transition-all ${selections.transformationStrength === opt.id ? 'border-rose-400 bg-rose-50' : 'border-stone-100 hover:border-stone-200'}`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 ${selections.transformationStrength === opt.id ? 'border-rose-400 bg-rose-400' : 'border-stone-300'}`}>
                  {selections.transformationStrength === opt.id && <CheckCircle className="w-4 h-4 text-white" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`font-medium ${selections.transformationStrength === opt.id ? 'text-rose-700' : 'text-stone-700'}`}>{opt.label}</p>
                    {opt.id === 'balanced' && <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">Recommended</span>}
                  </div>
                  <p className="text-sm text-stone-500">{opt.description}</p>
                </div>
              </button>
            ))}
            {selectedPhoto && (
              <div className="mt-4 p-3 bg-stone-50 rounded-xl">
                <p className="text-xs text-stone-500 mb-2">Selected space:</p>
                <div className="aspect-video rounded-lg overflow-hidden">
                  <img src={selectedPhoto.photo_url} alt={selectedPhoto.name} className="w-full h-full object-cover" />
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden mb-4">
      <div className="bg-gradient-to-r from-rose-50 to-amber-50 px-6 py-4 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-rose-400" />
          <h3 className="text-lg font-semibold text-stone-900">Venue Visualizer</h3>
        </div>
        <p className="text-sm text-stone-600 mt-1">See your wedding design on our actual venue</p>
      </div>
      <div className="px-6 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-stone-500">Step {step + 1} of {steps.length}</span>
          <span className="text-xs text-stone-500">{Math.round(((step + 1) / steps.length) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-rose-400 to-amber-400 rounded-full transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </div>
      <div className="p-6">
        <h4 className="text-xl font-semibold text-stone-900 mb-1">{currentStep.title}</h4>
        <p className="text-stone-500 mb-6">{currentStep.subtitle}</p>
        <div className="max-h-[400px] overflow-y-auto">{renderOptions()}</div>
        {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <Button onClick={handleBack} variant="outline" className="flex-1 rounded-full">
          <ArrowLeft className="w-4 h-4 mr-2" />{step === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Button onClick={handleNext} disabled={!canContinue} className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 disabled:from-stone-300 disabled:to-stone-300">
          {isLastStep ? <><Sparkles className="w-4 h-4 mr-2" />Transform</> : <>Continue<ArrowRight className="w-4 h-4 ml-2" /></>}
        </Button>
      </div>
    </motion.div>
  );
}