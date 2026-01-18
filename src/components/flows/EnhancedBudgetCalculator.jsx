import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import ProgressDots from '../chat/ProgressDots';
import { DollarSign, CheckCircle, AlertCircle } from 'lucide-react';

// AVAILABILITY RULES - Controls which day/season combos are valid per tier
const AVAILABILITY_RULES = {
  up_to_2: {
    peak: ['weekday'],
    nonpeak: ['saturday', 'friday', 'sunday', 'weekday']
  },
  up_to_20: {
    peak: ['weekday'],
    nonpeak: ['saturday', 'friday', 'sunday', 'weekday']
  },
  up_to_50: {
    peak: ['sunday', 'weekday'],
    nonpeak: ['saturday', 'friday', 'sunday', 'weekday']
  },
  '51_to_120': {
    peak: ['saturday', 'friday', 'sunday', 'weekday'],
    nonpeak: ['saturday', 'friday', 'sunday', 'weekday']
  }
};

const GUEST_COUNTS = {
  up_to_2: 2,
  up_to_20: 15,
  up_to_50: 35,
  '51_to_120': 85
};

const GUEST_TIERS = [
  { id: 'up_to_2', label: 'Just us two 💕', sublabel: 'Elopement Package' },
  { id: 'up_to_20', label: 'Inner Circle', sublabel: 'Intimate gathering (up to 20)' },
  { id: 'up_to_50', label: '50 and Under', sublabel: 'Small celebration (21-50)' },
  { id: '51_to_120', label: 'Classic Wedding', sublabel: '51-120 guests' }
];

const ALL_DAYS = [
  { id: 'saturday', label: 'Saturday' },
  { id: 'friday', label: 'Friday' },
  { id: 'sunday', label: 'Sunday' },
  { id: 'weekday', label: 'Weekday (Mon-Thu)' }
];

const ALL_SEASONS = [
  { id: 'peak', label: 'Peak Season (May - October)' },
  { id: 'nonpeak', label: 'Non-Peak Season (November - April)' }
];

export default function EnhancedBudgetCalculator({ venueId, onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState({
    guestTier: null,
    dayOfWeek: null,
    season: null,
    spirits: null,
    planning: null,
    catering: null,
    photography: null,
    florals: null,
    decor: null,
    entertainment: null,
    videography: null,
    desserts: null,
    linens: null,
    tableware: null,
    extras: 0
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function fetchPricing() {
      try {
        const configs = await base44.entities.WeddingPricingConfiguration.filter({ venue_id: venueId });
        if (configs.length > 0) {
          setPricingConfig(configs[0]);
        }
      } catch (error) {
        console.error('Failed to load pricing:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPricing();
  }, [venueId]);

  // Get available days based on tier + season
  const getAvailableDays = () => {
    if (!selections.guestTier || !selections.season) return ALL_DAYS;
    const rules = AVAILABILITY_RULES[selections.guestTier];
    if (!rules) return ALL_DAYS;
    const allowedDays = rules[selections.season] || [];
    return ALL_DAYS.filter(day => allowedDays.includes(day.id));
  };

  // Get available seasons based on tier
  const getAvailableSeasons = () => {
    if (!selections.guestTier) return ALL_SEASONS;
    return ALL_SEASONS;
  };

  // Get category options based on tier
  const getOptionsForCategory = (category) => {
    if (!pricingConfig || !selections.guestTier) return [];
    const categoryData = pricingConfig.pricing_data?.[category];
    if (!categoryData) return [];
    if (categoryData[selections.guestTier]) {
      return categoryData[selections.guestTier];
    }
    if (Array.isArray(categoryData)) {
      const tierData = categoryData.find(t => t.guest_tier === selections.guestTier);
      return tierData?.options || [];
    }
    return [];
  };

  // Calculate running total
  const calculateTotal = () => {
    if (!pricingConfig || !selections.guestTier) return 0;
    let total = 0;
    const guestCount = GUEST_COUNTS[selections.guestTier] || 2;

    // Base venue price
    const venueBase = pricingConfig.pricing_data?.venue_base?.[selections.guestTier];
    if (venueBase && selections.dayOfWeek && selections.season) {
      const key = `${selections.dayOfWeek}_${selections.season}`;
      const priceEntry = venueBase[key];
      if (priceEntry?.price) {
        total += priceEntry.price;
      }
    }

    // Calculate each category
    const categories = ['spirits', 'planning', 'catering', 'photography', 'florals', 
                       'decor', 'entertainment', 'videography', 'desserts', 'linens', 'tableware'];
    
    categories.forEach(category => {
      const options = getOptionsForCategory(category);
      const selected = options.find(o => o.label === selections[category]);
      if (selected) {
        if (selected.price_type === 'per_person') {
          total += selected.price * guestCount;
        } else if (selected.price_type === 'flat_plus_per_person') {
          total += selected.price + (selected.extra_pp || 0) * guestCount;
        } else {
          total += selected.price || 0;
        }
      }
    });

    total += selections.extras || 0;
    return total;
  };

  // Step definitions
  const getSteps = () => {
    const steps = [
      {
        title: 'Guest Count',
        question: 'How many guests do you plan to have at your event?',
        key: 'guestTier',
        type: 'guest_tier'
      },
      {
        title: 'Season',
        question: 'What time of year are you considering?',
        key: 'season',
        type: 'season',
        restriction: selections.guestTier && ['up_to_2', 'up_to_20'].includes(selections.guestTier)
          ? '⚠️ Note: Peak season (May-Oct) is only available on weekdays for this package.'
          : selections.guestTier === 'up_to_50'
          ? '⚠️ Note: Peak season (May-Oct) is only available Sunday or weekdays for this package.'
          : null
      },
      {
        title: 'Day of Week',
        question: 'What day of the week do you plan to get married on?',
        key: 'dayOfWeek',
        type: 'day_of_week'
      }
    ];

    if (selections.guestTier) {
      const categorySteps = [
        { title: 'Spirits & Beverages', question: 'What kind of spirits do you plan to have?', key: 'spirits', type: 'category' },
        { title: 'Planning Services', question: 'Do you want planning and coordination services?', key: 'planning', type: 'category' },
        { title: 'Catering', question: 'What kind of catering do you plan to have?', key: 'catering', type: 'category' },
        { title: 'Photography', question: 'What are you looking for in a photographer?', key: 'photography', type: 'category' },
        { title: 'Florals', question: 'What is your floral vision?', key: 'florals', type: 'category' },
        { title: 'Decorations', question: 'What are your plans for decorations and signage?', key: 'decor', type: 'category' },
        { title: 'Entertainment', question: 'What kind of entertainment are you looking for?', key: 'entertainment', type: 'category' },
        { title: 'Videography', question: 'Do you want a videographer?', key: 'videography', type: 'category' },
        { title: 'Desserts', question: 'What kind of desserts are you wanting?', key: 'desserts', type: 'category' },
        { title: 'Table Linens', question: 'Do you want table linens?', key: 'linens', type: 'category' },
        { title: 'Tableware', question: 'What kind of tableware do you want?', key: 'tableware', type: 'category' },
        { title: 'Extras Budget', question: "How much do you want to allow for 'extras'?", key: 'extras', type: 'extras' }
      ];
      return [...steps, ...categorySteps];
    }
    return steps;
  };

  const steps = getSteps();
  const currentStep = steps[step];

  const getCurrentOptions = () => {
    if (!currentStep) return [];
    switch (currentStep.type) {
      case 'guest_tier':
        return GUEST_TIERS;
      case 'season':
        return getAvailableSeasons();
      case 'day_of_week':
        return getAvailableDays();
      case 'category':
        return getOptionsForCategory(currentStep.key);
      case 'extras':
        return [
          { id: 0, label: '$0' },
          { id: 500, label: '$500' },
          { id: 1000, label: '$1,000' },
          { id: 1500, label: '$1,500' },
          { id: 2000, label: '$2,000' },
          { id: 3000, label: '$3,000' },
          { id: 5000, label: '$5,000' },
          { id: 10000, label: '$10,000' }
        ];
      default:
        return [];
    }
  };

  const currentOptions = getCurrentOptions();
  const canContinue = selections[currentStep?.key] !== null && selections[currentStep?.key] !== undefined;
  const totalBudget = calculateTotal();

  const handleSelect = (value) => {
    const key = currentStep.key;
    
    if (key === 'guestTier' && value !== selections.guestTier) {
      setSelections(prev => ({
        ...prev,
        guestTier: value,
        dayOfWeek: null,
        season: null,
        spirits: null,
        planning: null,
        catering: null,
        photography: null,
        florals: null,
        decor: null,
        entertainment: null,
        videography: null,
        desserts: null,
        linens: null,
        tableware: null
      }));
      return;
    }

    if (key === 'season') {
      const newSeason = value;
      const currentDay = selections.dayOfWeek;
      const tier = selections.guestTier;
      const rules = AVAILABILITY_RULES[tier];
      
      if (currentDay && rules) {
        const allowedDays = rules[newSeason] || [];
        if (!allowedDays.includes(currentDay)) {
          setSelections(prev => ({
            ...prev,
            season: newSeason,
            dayOfWeek: null
          }));
          return;
        }
      }
    }

    setSelections(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setSubmitted(true);
      onComplete({
        ...selections,
        totalBudget,
        guestCount: GUEST_COUNTS[selections.guestTier]
      });
    }
  };

  const handleBack = () => {
    if (step === 0) {
      onCancel();
    } else {
      setStep(step - 1);
    }
  };

  const formatPrice = (option) => {
    if (option.price === undefined || option.price === null) return '';
    if (option.price_type === 'per_person') {
      return ` - $${option.price}/person`;
    } else if (option.price_type === 'flat_plus_per_person') {
      return ` - $${option.price} + $${option.extra_pp}/person`;
    } else if (option.price > 0) {
      return ` - $${option.price.toLocaleString()}${option.note ? ` (${option.note})` : ''}`;
    }
    return '';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-4">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
          <span className="ml-3 text-stone-600">Loading budget calculator...</span>
        </div>
      </div>
    );
  }

  if (!pricingConfig) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-4">
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-stone-900 mb-2">Pricing Not Available</h3>
          <p className="text-stone-600 mb-4">Please contact us directly for a custom quote.</p>
          <Button onClick={onCancel} variant="outline" className="rounded-full">
            Back to Chat
          </Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-4 text-center"
      >
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-stone-900 mb-2">Your Budget Estimate</h3>
        
        <div className="bg-stone-50 rounded-xl p-6 mb-4 text-left">
          <div className="text-4xl font-bold text-stone-900 mb-4 text-center">
            ${totalBudget.toLocaleString()}
          </div>
          <div className="space-y-2 text-sm border-t border-stone-200 pt-4">
            <p><span className="font-semibold">Package:</span> {GUEST_TIERS.find(t => t.id === selections.guestTier)?.label}</p>
            <p><span className="font-semibold">Day:</span> {ALL_DAYS.find(d => d.id === selections.dayOfWeek)?.label}</p>
            <p><span className="font-semibold">Season:</span> {ALL_SEASONS.find(s => s.id === selections.season)?.label}</p>
          </div>
        </div>

        <p className="text-sm text-stone-600 mb-4">
          This is an estimate based on your selections. Schedule a tour to discuss your vision in detail!
        </p>

        <Button onClick={onCancel} className="w-full rounded-full bg-black hover:bg-stone-800">
          Schedule a Tour
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-4"
    >
      <ProgressDots current={step} total={steps.length} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="mt-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-stone-400" />
            <h3 className="text-lg font-semibold text-stone-900">{currentStep.title}</h3>
          </div>
          <p className="text-stone-600 mb-4">{currentStep.question}</p>

          {currentStep.restriction && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
              {currentStep.restriction}
            </div>
          )}

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {currentOptions.map((option) => {
              const optionKey = option.id ?? option.label;
              const isSelected = selections[currentStep.key] === optionKey;
              const displayLabel = option.label || option.id;
              const priceDisplay = formatPrice(option);
              const sublabel = option.sublabel;

              return (
                <button
                  key={optionKey}
                  onClick={() => handleSelect(optionKey)}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-black text-white'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-700'
                  }`}
                >
                  <p className="font-medium">{displayLabel}{priceDisplay}</p>
                  {sublabel && (
                    <p className={`text-sm mt-1 ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                      {sublabel}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {currentOptions.length === 0 && currentStep.type === 'day_of_week' && (
            <div className="bg-stone-100 rounded-xl p-4 text-center">
              <p className="text-stone-600">Please select a season first to see available days.</p>
            </div>
          )}

          {selections.guestTier && selections.dayOfWeek && selections.season && totalBudget > 0 && (
            <div className="mt-6 p-4 bg-stone-50 rounded-lg border border-stone-200">
              <p className="text-sm text-stone-600">Running total:</p>
              <p className="text-2xl font-bold text-stone-900">${totalBudget.toLocaleString()}</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-2 mt-6">
        <Button
          onClick={handleBack}
          variant="outline"
          className="flex-1 rounded-full"
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Button
          onClick={handleNext}
          disabled={!canContinue}
          className="flex-1 rounded-full bg-black hover:bg-stone-800 disabled:bg-stone-300"
        >
          {step === steps.length - 1 ? 'See Total' : 'Continue'}
        </Button>
      </div>
    </motion.div>
  );
}