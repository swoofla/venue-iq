import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import ProgressDots from '../chat/ProgressDots';
import { DollarSign, CheckCircle } from 'lucide-react';

// ============================================
// FIX #1: Corrected guest tier keys to match pricing data
// OLD: '2_to_20', '20_to_50' 
// NEW: 'up_to_20', 'up_to_50'
// ============================================
const GUEST_TIERS = {
  'up_to_2': 'Just us two 💕',
  'up_to_20': 'Intimate gathering (up to 20)',
  'up_to_50': 'Small celebration (21-50)',
  '51_to_120': 'Classic wedding (51-120)',
};

// ============================================
// FIX #2: Guest count lookup object
// OLD: parseInt(selections.guestTier.split('_')[1]) returned NaN
// NEW: Direct lookup with sensible midpoint estimates
// ============================================
const GUEST_COUNTS = {
  'up_to_2': 2,
  'up_to_20': 15,   // midpoint for 3-20 guests
  'up_to_50': 35,   // midpoint for 21-50 guests
  '51_to_120': 85,  // midpoint for 51-120 guests
};

const DAYS_OF_WEEK = {
  'saturday': 'Saturday',
  'friday': 'Friday',
  'sunday': 'Sunday',
  'weekday': 'Weekday (Mon-Thu)',
};

const PEAK_SEASONS = {
  'peak': 'Peak Season (May - October)',
  'nonpeak': 'Non-Peak Season (November - April)',
};

export default function EnhancedBudgetCalculator({ venueId, onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState({
    guestTier: null,
    dayOfWeek: null,
    peakSeason: null,
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

    // ============================================
    // FIX #2 (continued): Use lookup for guest count
    // ============================================
    const guestCount = GUEST_COUNTS[selections.guestTier] || 2;
    
    // Base venue price
    const basePriceObj = pricingConfig.venue_base?.[selections.guestTier];
    
    if (basePriceObj) {
      // ============================================
      // FIX #3: Corrected flat-price tier check
      // OLD: selections.guestTier === '2_to_20'
      // NEW: selections.guestTier === 'up_to_20'
      // ============================================
      // Handle flat-price tiers (up_to_2, up_to_20) that don't vary by day/season
      if (selections.guestTier === 'up_to_2' || selections.guestTier === 'up_to_20') {
        total += basePriceObj.price || 0;
      } 
      // Handle tiers that vary by day of week and peak/non-peak season
      else if (selections.dayOfWeek && selections.peakSeason) {
        const key = `${selections.dayOfWeek}_${selections.peakSeason}`;
        const priceData = basePriceObj[key];
        
        // Check if this day/season combo is available (some are N/A)
        if (priceData?.price !== null && priceData?.price !== undefined) {
          total += priceData.price;
        }
      }
    }

    // Per-person multiplied services (spirits, catering)
    const spiritsOption = getOptionsForCategory('spirits').find(o => o.label === selections.spirits);
    if (spiritsOption) {
      if (spiritsOption.price_type === 'per_person') {
        total += (spiritsOption.price * guestCount);
      } else if (spiritsOption.price_type === 'flat_plus_per_person') {
        // Handle options like "Beer and Wine Package" for up_to_20: $350 flat + $15/person
        total += spiritsOption.price + ((spiritsOption.extra_pp || 0) * guestCount);
      } else {
        total += spiritsOption.price || 0;
      }
    }

    const cateringOption = getOptionsForCategory('catering').find(o => o.label === selections.catering);
    if (cateringOption) {
      if (cateringOption.price_type === 'per_person') {
        total += (cateringOption.price * guestCount);
      } else {
        total += cateringOption.price || 0;
      }
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
  const getStepsForTier = () => {
    const baseSteps = [
      {
        title: 'Guest Count',
        question: 'How many guests do you plan to have at your event?',
        key: 'guestTier',
        options: Object.entries(GUEST_TIERS).map(([key, label]) => ({ key, label })),
      },
    ];

    // For flat-price tiers (up_to_2, up_to_20), skip day/season questions
    if (selections.guestTier === 'up_to_2' || selections.guestTier === 'up_to_20') {
      // Skip day of week and peak season steps
    } else if (selections.guestTier) {
      // Add day and season steps for variable-price tiers
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
          key: 'peakSeason',
          options: Object.entries(PEAK_SEASONS).map(([key, label]) => ({ key, label })),
        }
      );
    }

    // Add category steps if we have a guest tier selected
    if (selections.guestTier) {
      const categorySteps = [
        {
          title: 'Spirits & Beverages',
          question: 'What kind of spirits do you plan to have?',
          key: 'spirits',
          options: getOptionsForCategory('spirits'),
        },
        {
          title: 'Planning Services',
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
          title: 'Decorations',
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
          question: 'What kind of tableware do you want?',
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

      // Only add category steps that have options available for this tier
      categorySteps.forEach(s => {
        if (s.options.length > 0 || s.key === 'extras') {
          baseSteps.push(s);
        }
      });
    }

    return baseSteps;
  };

  const steps = getStepsForTier();
  const currentStep = steps[step];
  const canContinue = selections[currentStep?.key] !== null && 
                      selections[currentStep?.key] !== undefined && 
                      selections[currentStep?.key] !== '';
  const totalBudget = calculateTotal() || 0;

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
        guestTierLabel: GUEST_TIERS[selections.guestTier],
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

  // Check for N/A day/season combinations for up_to_50 tier
  const isDateComboAvailable = () => {
    if (selections.guestTier !== 'up_to_50') return true;
    if (!selections.dayOfWeek || !selections.peakSeason) return true;
    
    const key = `${selections.dayOfWeek}_${selections.peakSeason}`;
    const priceData = pricingConfig?.venue_base?.up_to_50?.[key];
    
    // Saturday and Friday peak are N/A for 21-50 guests
    return priceData?.price !== null && priceData?.price !== undefined;
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
          <p className="text-red-600 mb-4">Pricing configuration not found for this venue.</p>
          <Button onClick={onCancel} variant="outline" className="rounded-full">
            Go Back
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
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold">Guests:</span> {GUEST_TIERS[selections.guestTier]}</p>
            {selections.dayOfWeek && (
              <p><span className="font-semibold">Day:</span> {DAYS_OF_WEEK[selections.dayOfWeek]}</p>
            )}
            {selections.peakSeason && (
              <p><span className="font-semibold">Season:</span> {PEAK_SEASONS[selections.peakSeason]}</p>
            )}
          </div>
        </div>

        <p className="text-sm text-stone-600 mb-4">
          This is an estimate based on your selections. Would you like to schedule a tour to see our venue and discuss your wedding vision in person?
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
              
              // Show price info if available
              let priceDisplay = '';
              if (option.price !== undefined && option.price !== null) {
                if (option.price_type === 'per_person') {
                  priceDisplay = ` — $${option.price}/person`;
                } else if (option.price_type === 'flat_plus_per_person') {
                  priceDisplay = ` — $${option.price} + $${option.extra_pp}/person`;
                } else if (option.price > 0) {
                  priceDisplay = ` — $${option.price.toLocaleString()}`;
                } else if (option.note) {
                  priceDisplay = ` — ${option.note}`;
                }
              }

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
                  <p className="font-medium">{displayLabel}</p>
                  {priceDisplay && (
                    <p className={`text-sm mt-1 ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                      {priceDisplay}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Warning for N/A date combinations */}
          {currentStep.key === 'peakSeason' && selections.guestTier === 'up_to_50' && 
           (selections.dayOfWeek === 'saturday' || selections.dayOfWeek === 'friday') && 
           selections.peakSeason === 'peak' && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> Saturday and Friday peak season bookings are not available for 21-50 guest events. Please select a different day or choose non-peak season.
              </p>
            </div>
          )}

          {/* Running total - show after guest tier is selected and base price can be calculated */}
          {selections.guestTier && totalBudget > 0 && (
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
          disabled={!canContinue || (currentStep.key === 'peakSeason' && !isDateComboAvailable())}
          className="flex-1 rounded-full bg-black hover:bg-stone-800"
        >
          {step === steps.length - 1 ? 'See Total' : 'Continue'}
        </Button>
      </div>
    </motion.div>
  );
}