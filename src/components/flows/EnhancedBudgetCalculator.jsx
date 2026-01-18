import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import ProgressDots from '../chat/ProgressDots';
import { DollarSign, CheckCircle, AlertTriangle } from 'lucide-react';

// Fixed: Use correct tier keys that match pricing data
const GUEST_TIERS = {
  'up_to_2': 'Just us two 💕',
  '2_to_20': 'Intimate gathering (up to 20)',
  '20_to_50': 'Small celebration (21-50)',
  '51_to_120': 'Classic wedding (51-120)',
};

const DAYS_OF_WEEK = {
  'saturday': 'Saturday',
  'friday': 'Friday',
  'sunday': 'Sunday',
  'weekday': 'Weekday (Mon-Thu)',
};

const SEASONS = {
  'peak': 'Peak Season (May - October)',
  'nonpeak': 'Non-Peak Season (November - April)',
};

// Fixed: Proper guest count lookup instead of parsing tier string
const GUEST_COUNTS = {
  'up_to_2': 2,
  '2_to_20': 15,
  '20_to_50': 35,
  '51_to_120': 85,
};

// Define which day/season combinations are N/A for each tier
const UNAVAILABLE_COMBINATIONS = {
  '20_to_50': [
    { day: 'saturday', season: 'peak' },
    { day: 'friday', season: 'peak' },
  ],
  // up_to_2 and 2_to_20 are flat rate - no day/season restrictions
  // 51_to_120 has all combinations available
};

export default function EnhancedBudgetCalculator({ venueId, onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState({
    guestTier: null,
    dayOfWeek: null,
    season: null,
    spirits: null,
    catering: null,
    planning: null,
    photography: null,
    florals: null,
    decor: null,
    entertainment: null,
    videography: null,
    desserts: null,
    linens: null,
    tableware: null,
    extras: 0,
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function fetchPricing() {
      try {
        const configs = await base44.entities.WeddingPricingConfiguration.filter({ venue_id: venueId });
        if (configs.length > 0) {
          setPricingConfig(configs[0].pricing_data);
        }
      } catch (error) {
        console.error('Failed to load pricing:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPricing();
  }, [venueId]);

  // Check if a specific day/season combination is unavailable for the selected tier
  const isCombinationUnavailable = (day, season, tier) => {
    const unavailable = UNAVAILABLE_COMBINATIONS[tier];
    if (!unavailable) return false;
    return unavailable.some(combo => combo.day === day && combo.season === season);
  };

  // Check if the CURRENT selection is an unavailable combination
  const isCurrentCombinationUnavailable = () => {
    if (!selections.guestTier || !selections.dayOfWeek || !selections.season) {
      return false;
    }
    return isCombinationUnavailable(selections.dayOfWeek, selections.season, selections.guestTier);
  };

  // Get warning message for current step if applicable
  const getWarningMessage = () => {
    // Only show warning on Season step when there's a restriction
    if (step !== 2) return null;
    
    const tier = selections.guestTier;
    const day = selections.dayOfWeek;
    
    if (tier === 'up_to_50' && (day === 'saturday' || day === 'friday')) {
      return `Note: ${DAYS_OF_WEEK[day]} peak season bookings are not available for 21-50 guest events. Please select a different day or choose non-peak season.`;
    }
    return null;
  };

  const getOptionsForCategory = (category) => {
    if (!pricingConfig?.[category]) return [];
    const categoryData = pricingConfig[category];
    if (Array.isArray(categoryData)) {
      const tierData = categoryData.find(t => t.guest_tier === selections.guestTier);
      return tierData?.options || [];
    }
    return [];
  };

  const calculateTotal = () => {
    if (!pricingConfig || !selections.guestTier) return 0;
    let total = 0;

    const guestCount = GUEST_COUNTS[selections.guestTier] || 2;
    const basePriceObj = pricingConfig.venue_base?.[selections.guestTier];
    
    if (basePriceObj) {
      // Flat-price tiers (up_to_2, 2_to_20) don't vary by day/season
      if (selections.guestTier === 'up_to_2' || selections.guestTier === '2_to_20') {
        total += basePriceObj.price || 0;
      } 
      // Variable tiers need day and season
      else if (selections.dayOfWeek && selections.season) {
        const key = `${selections.dayOfWeek}_${selections.season}`;
        const priceEntry = basePriceObj[key];
        // Only add if price exists and is not null (N/A)
        if (priceEntry?.price !== null && priceEntry?.price !== undefined) {
          total += priceEntry.price;
        }
      }
    }

    // Per-person services (spirits, catering)
    const spiritsOption = getOptionsForCategory('spirits').find(o => o.label === selections.spirits);
    if (spiritsOption?.price_type === 'per_person') {
      total += (spiritsOption.price * guestCount);
    } else if (spiritsOption?.price) {
      total += spiritsOption.price;
    }

    const cateringOption = getOptionsForCategory('catering').find(o => o.label === selections.catering);
    if (cateringOption?.price_type === 'per_person') {
      total += (cateringOption.price * guestCount);
    } else if (cateringOption?.price) {
      total += cateringOption.price;
    }

    // Flat-price services
    ['planning', 'photography', 'florals', 'decor', 'entertainment', 'videography', 'desserts', 'linens', 'tableware'].forEach(category => {
      const option = getOptionsForCategory(category).find(o => o.label === selections[category]);
      if (option?.price) {
        total += option.price;
      }
    });

    // Extras
    total += (selections.extras || 0);

    return Math.max(0, total);
  };

  // Determine which steps to show based on guest tier
  const getSteps = () => {
    const baseSteps = [
      {
        title: 'Guest Count',
        question: 'How many guests do you plan to have at your event?',
        key: 'guestTier',
        options: Object.entries(GUEST_TIERS).map(([key, label]) => ({ key, label })),
      },
    ];

    // For flat-rate tiers (up_to_2, 2_to_20), skip day/season selection
    const needsDaySeasonSteps = selections.guestTier && 
      selections.guestTier !== 'up_to_2' && 
      selections.guestTier !== '2_to_20';

    if (needsDaySeasonSteps) {
      baseSteps.push(
        {
          title: 'Day of Week',
          question: 'What day of the week do you plan to get married on?',
          key: 'dayOfWeek',
          options: Object.entries(DAYS_OF_WEEK).map(([key, label]) => ({ key, label })),
        },
        {
          title: 'Season',
          question: 'What time of year are you considering?',
          key: 'season',
          options: Object.entries(SEASONS).map(([key, label]) => {
            // Mark unavailable options
            const isUnavailable = isCombinationUnavailable(
              selections.dayOfWeek, 
              key, 
              selections.guestTier
            );
            return { key, label, isUnavailable };
          }),
        }
      );
    }

    // Add category steps
    const categorySteps = [
      {
        title: 'Spirits & Beverages',
        question: 'What kind of spirits do you plan to have?',
        key: 'spirits',
        options: getOptionsForCategory('spirits'),
      },
      {
        title: 'Planning & Coordination',
        question: 'Do you want planning and coordination services?',
        key: 'planning',
        options: getOptionsForCategory('planning'),
      },
      {
        title: 'Catering',
        question: 'What kind of catering do you plan to have?',
        key: 'catering',
        options: getOptionsForCategory('catering'),
      },
      {
        title: 'Photography',
        question: 'What are you looking for in a photographer?',
        key: 'photography',
        options: getOptionsForCategory('photography'),
      },
      {
        title: 'Florals',
        question: 'What is your floral vision?',
        key: 'florals',
        options: getOptionsForCategory('florals'),
      },
      {
        title: 'Decorations & Signage',
        question: 'What are your plans for decorations and signage?',
        key: 'decor',
        options: getOptionsForCategory('decor'),
      },
      {
        title: 'Entertainment',
        question: 'What kind of entertainment are you looking for?',
        key: 'entertainment',
        options: getOptionsForCategory('entertainment'),
      },
      {
        title: 'Videography',
        question: 'Do you want a videographer?',
        key: 'videography',
        options: getOptionsForCategory('videography'),
      },
      {
        title: 'Desserts',
        question: 'What kind of desserts are you wanting?',
        key: 'desserts',
        options: getOptionsForCategory('desserts'),
      },
      {
        title: 'Table Linens',
        question: 'Do you want table linens?',
        key: 'linens',
        options: getOptionsForCategory('linens'),
      },
      {
        title: 'Tableware',
        question: 'What kind of tableware do you want to have?',
        key: 'tableware',
        options: getOptionsForCategory('tableware'),
      },
      {
        title: 'Extras Budget',
        question: 'How much do you want to allow for "extras"? (Live strings, photo booth, live wedding painter, favors, late night snacks, gifts for bridal party, upgrades, or things not accounted for)',
        key: 'extras',
        options: [0, 500, 1000, 1500, 2000, 3000, 5000, 10000].map(amount => ({ 
          key: amount, 
          label: amount === 0 ? '$0' : `$${amount.toLocaleString()}` 
        })),
      },
    ];

    return [...baseSteps, ...categorySteps];
  };

  const steps = getSteps();
  const currentStep = steps[step];
  
  // Fixed validation logic:
  // 1. A selection must be made
  // 2. The selection must not be an unavailable combination
  const hasSelection = selections[currentStep.key] !== null && 
                       selections[currentStep.key] !== undefined && 
                       selections[currentStep.key] !== '';
  
  // For season step, check if the selected season creates an invalid combination
  const isInvalidSeasonSelection = currentStep.key === 'season' && 
    selections.season && 
    isCombinationUnavailable(selections.dayOfWeek, selections.season, selections.guestTier);
  
  const canContinue = hasSelection && !isInvalidSeasonSelection;
  const totalBudget = calculateTotal() || 0;
  const warningMessage = getWarningMessage();

  const handleSelect = (value) => {
    setSelections(prev => ({
      ...prev,
      [currentStep.key]: value,
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
        guestCount: GUEST_COUNTS[selections.guestTier],
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

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-4">
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-stone-300 border-t-black rounded-full mx-auto mb-4"></div>
          <p className="text-stone-600">Loading budget calculator...</p>
        </div>
      </div>
    );
  }

  if (!pricingConfig) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-4">
        <div className="text-center py-8 text-red-600">
          Pricing configuration not found. Please contact support.
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
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold">Guests:</span> {GUEST_TIERS[selections.guestTier]}</p>
            {selections.dayOfWeek && (
              <p><span className="font-semibold">Day:</span> {DAYS_OF_WEEK[selections.dayOfWeek]}</p>
            )}
            {selections.season && (
              <p><span className="font-semibold">Season:</span> {SEASONS[selections.season]}</p>
            )}
          </div>
        </div>

        <p className="text-sm text-stone-600 mb-4">
          Would you like to schedule a tour to see our venue and discuss your wedding vision in person?
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
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-stone-400" />
            <h3 className="text-lg font-semibold text-stone-900">{currentStep.title}</h3>
          </div>
          <p className="text-stone-600 mb-4">{currentStep.question}</p>

          <div className="space-y-2">
            {currentStep.options.map((option) => {
              const optionKey = option.key !== undefined ? option.key : option.label;
              const isSelected = selections[currentStep.key] === optionKey;
              const displayLabel = option.label || optionKey;
              const displayPrice = option.price !== undefined ? ` - $${option.price.toLocaleString()}${option.price_type === 'per_person' ? ' (per person)' : ''}` : '';
              
              // Check if this specific option is unavailable
              const isOptionUnavailable = currentStep.key === 'season' && 
                isCombinationUnavailable(selections.dayOfWeek, optionKey, selections.guestTier);

              return (
                <button
                  key={optionKey}
                  onClick={() => handleSelect(optionKey)}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    isSelected
                      ? isOptionUnavailable 
                        ? 'bg-red-900 text-white' // Selected but unavailable
                        : 'bg-black text-white'  // Selected and available
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-700'
                  }`}
                >
                  <p className="font-medium">{displayLabel}{displayPrice}</p>
                </button>
              );
            })}
          </div>

          {/* Warning message for unavailable combinations */}
          {warningMessage && selections.season === 'peak' && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">{warningMessage}</p>
              </div>
            </div>
          )}

          {/* Budget preview - show after first 3 steps have valid selections */}
          {totalBudget > 0 && (
            <div className="mt-6 p-4 bg-stone-50 rounded-lg">
              <p className="text-sm text-stone-600">Estimated Total so far:</p>
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